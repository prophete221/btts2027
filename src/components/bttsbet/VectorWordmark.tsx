'use client'

/**
 * VectorWordmark — wordmark animé interactif (style « Vector Wordmark » Originkit).
 *
 * ⚙️ Moteur v5 — Canvas 2D (remplace le moteur WebGL qui ne rendait jamais en
 * production : le titre restait en repli statique). Le rendu 2D est garanti
 * sur tous les navigateurs, y compris mobiles sans WebGL stable.
 *
 * Rendu par-dessus un conteneur positionné (le titre du hero, absolute inset-0) :
 *  - le texte est rasterisé puis échantillonné en matrice de points
 *    (PAS ENTIER obligatoire : un pas flottant produit des indices non entiers
 *    dans le TypedArray → nuage vide — bug racine de la v4) ;
 *  - DRAW-IN « coalesce » : les points matérialisent le texte depuis un
 *    rayon très court (12–40 px) — le titre reste LISIBLE pendant toute
 *    l'animation (correctif « texte illisible » : plus de nuage éclaté) ;
 *  - DRIFT : dérive sinusoïdale faible — vivant mais net ;
 *  - POINTEUR : répulsion douce + teinte accent près du curseur, balayage
 *    automatique sans pointeur.
 *
 * Lisibilité (contrat v6) — le titre reste lisible à chaque instant :
 *  1. le texte DOM est visible jusqu'à la première frame du canvas ;
 *  2. le canvas peint alors un CALQUE TEXTE PLEIN (même géométrie que la
 *     matrice de points, donc parfaitement aligné) pendant que le texte DOM
 *     se fond en ~170 ms — aucun double texte ni nuage illisible ;
 *  3. les points matérialisent le titre par coalesce court (12–40 px) par-
 *     dessus ce calque plein, puis le calque se dissout au settle (onSettled).
 *
 * Contrat :
 *  - onReady appelé après la première frame réellement peinte (pixels > 0) ;
 *  - onSettled appelé quand tous les points sont posés (fin du draw-in) ;
 *  - onError appelé si le canvas 2D échoue ou si rien n'est peint dans le
 *    délai de garde (le titre statique du h1 reste alors visible).
 *
 * Accessibilité : le canvas est aria-hidden ; le vrai texte du h1 reste
 * dans le DOM tant que la première frame n'est pas peinte.
 */

import { useEffect, useRef } from 'react'

export interface VectorWordmarkHandles {
  size?: number
  spread?: number
  labels?: boolean
}

export interface VectorWordmarkProps {
  text: string
  font?: string
  weight?: number | string
  textColor?: string
  shade?: string
  accent?: string
  reach?: number
  speed?: number
  damping?: number
  handles?: VectorWordmarkHandles
  className?: string
  style?: React.CSSProperties
  /** Appelé après la première frame réellement peinte. */
  onReady?: () => void
  /** Appelé quand tous les points sont posés (fin du draw-in) — le texte
   *  DOM peut alors être fondé sans jamais rendre le titre illisible. */
  onSettled?: () => void
  /** Appelé si le rendu échoue (le titre statique doit réapparaître). */
  onError?: () => void
}

/** Premier caractère fort RTL (Arabe, Hébreu…) — équivalent CSS direction:auto. */
const RTL_RE = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

const DRAW_DURATION = 620
const STAGGER = 300
const DRIFT_AMP = 0.8
const SOLID_FADE_IN = 100 // relais du texte DOM (fondu entrant du calque plein)
const SOLID_FADE_OUT = 300 // dissolution du calque plein au settle
const MAX_POINTS = 2600
const READY_GUARD_MS = 3200

type Pt = {
  tx: number
  ty: number
  x: number
  y: number
  sx: number
  sy: number
  delay: number
  phase: number
  spd: number
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function hexToRgb(input: string | undefined, fb: [number, number, number]): [number, number, number] {
  if (!input) return fb
  let s = input.trim()
  if (s.slice(0, 4).toLowerCase() === 'var(') {
    const comma = s.indexOf(',')
    const close = s.lastIndexOf(')')
    if (comma < 0 || close < comma) return fb
    s = s.slice(comma + 1, close).trim()
  }
  if (s[0] !== '#') return fb
  let h = s.slice(1)
  if (h.length === 3 || h.length === 4) {
    let x = ''
    for (const c of h) x += c + c
    h = x
  }
  if (h.length === 6) h += 'ff'
  if (h.length < 6 || /[^0-9a-f]/i.test(h.slice(0, 6))) return fb
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export default function VectorWordmark({
  text,
  font = 'Inter, system-ui, sans-serif',
  weight = 800,
  textColor = '#F2F6FA',
  accent = '#2F7DFF',
  reach = 290,
  speed = 50,
  className,
  style,
  onReady,
  onSettled,
  onError,
}: VectorWordmarkProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cbs = useRef({ onReady, onSettled, onError })
  useEffect(() => {
    cbs.current = { onReady, onSettled, onError }
  })

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      cbs.current.onError?.()
      return
    }

    let disposed = false
    let raf = 0
    let running = false
    let ready = false
    let settledFired = false
    let playedIntro = false
    let start = 0
    let driftAmp = 0
    let pointerLive = false // vrai pointeur au survol
    let sweeping = false // balayage automatique (sans pointeur)
    const pointer = { x: -9999, y: -9999 }

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    let pts: Pt[] = []
    let solid: HTMLCanvasElement | null = null
    let cw = 0
    let ch = 0
    let fontPx = 32

    const textRGB = hexToRgb(textColor, [242, 246, 250])
    const accentRGB = hexToRgb(accent, [47, 125, 255])

    /** Rasterise le texte et échantillonne les glyphes (pas entier !). */
    const sample = () => {
      const rect = host.getBoundingClientRect()
      cw = Math.max(24, Math.floor(rect.width))
      ch = Math.max(16, Math.floor(rect.height))
      if (!text || cw < 24 || ch < 16) return

      const rtl = RTL_RE.test(text)
      const measure = document.createElement('canvas').getContext('2d')
      if (!measure) return
      const fam = `${weight} 100px ${font}`
      measure.font = fam
      measure.direction = rtl ? 'rtl' : 'ltr'
      const w100 = measure.measureText(text).width
      // Fit : le texte remplit ~98 % de la largeur du conteneur, sans dépasser sa hauteur.
      const sizeByW = w100 > 0 ? (cw * 0.98 * 100) / w100 : 100
      fontPx = Math.max(10, Math.min(sizeByW, (ch * 0.94 * 100) / 100))

      const off = document.createElement('canvas')
      off.width = cw
      off.height = ch
      const octx = off.getContext('2d', { willReadFrequently: true })
      if (!octx) return
      octx.font = `${weight} ${fontPx}px ${font}`
      octx.direction = rtl ? 'rtl' : 'ltr'
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      octx.fillStyle = '#fff'
      octx.fillText(text, cw / 2, ch / 2)

      // Calque texte plein (HiDPI) — même géométrie que la matrice : il
      // garantit un titre lisible pendant tout le draw-in, puis se dissout.
      solid = document.createElement('canvas')
      solid.width = Math.max(1, Math.ceil(cw * dpr))
      solid.height = Math.max(1, Math.ceil(ch * dpr))
      const sctx = solid.getContext('2d')
      if (sctx) {
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        sctx.font = `${weight} ${fontPx}px ${font}`
        sctx.direction = rtl ? 'rtl' : 'ltr'
        sctx.textAlign = 'center'
        sctx.textBaseline = 'middle'
        sctx.fillStyle = `rgb(${textRGB[0]},${textRGB[1]},${textRGB[2]})`
        sctx.fillText(text, cw / 2, ch / 2)
      } else {
        solid = null
      }

      const img = octx.getImageData(0, 0, cw, ch).data
      // PAS ENTIER — voir note d'en-tête (bug racine de la version WebGL).
      const step = Math.max(2, Math.round(Math.max(2.6, cw / 150)))
      const cx = cw / 2
      const cy = ch / 2
      const out: Pt[] = []
      for (let y = 0; y < ch; y += step) {
        for (let x = 0; x < cw; x += step) {
          const a = img[(y * cw + x) * 4 + 3]
          if (a > 140) {
            const ang = Math.random() * Math.PI * 2
            // Coalesce court : le mot reste reconnaissable dès les 1res frames.
            const dist = 12 + Math.random() * 28
            out.push({
              tx: x,
              ty: y,
              x: 0,
              y: 0,
              sx: cx + Math.cos(ang) * dist,
              sy: cy + Math.sin(ang) * dist,
              delay: (x / Math.max(1, cw)) * STAGGER + Math.random() * 80,
              // Phase spatiale (onde cohérente) : les points voisins dérivent
              // ensemble — les jambages restent lisibles (pas de criblage).
              phase: x * 0.018 + y * 0.011 + Math.random() * 0.4,
              spd: 0.0012 * (speed / 50),
            })
          }
        }
      }
      // Densité plafonnée pour les mobiles.
      while (out.length > MAX_POINTS && step < 9) {
        out.length = 0
        const s2 = step + 1
        for (let y = 0; y < ch; y += s2) {
          for (let x = 0; x < cw; x += s2) {
            const a = img[(y * cw + x) * 4 + 3]
            if (a > 140) {
              const ang = Math.random() * Math.PI * 2
              const dist = 12 + Math.random() * 28
              out.push({
                tx: x, ty: y, x: 0, y: 0,
                sx: cx + Math.cos(ang) * dist,
                sy: cy + Math.sin(ang) * dist,
                delay: (x / Math.max(1, cw)) * STAGGER + Math.random() * 80,
                phase: x * 0.018 + y * 0.011 + Math.random() * 0.4,
                spd: 0.0012 * (speed / 50),
              })
            }
          }
        }
        if (out.length <= MAX_POINTS) break
      }
      pts = out
    }

    const paint = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      if (!pts.length) return

      const elapsed = now - start
      let lit = 0
      const baseR = Math.max(0.75, fontPx * 0.052)

      // Calque texte plein : lisible dès la 1re frame, dissous au settle.
      const SETTLE_AT = STAGGER + DRAW_DURATION
      let solidA = 0
      if (elapsed < SOLID_FADE_IN) solidA = elapsed / SOLID_FADE_IN
      else if (elapsed < SETTLE_AT) solidA = 1
      else if (elapsed < SETTLE_AT + SOLID_FADE_OUT)
        solidA = 1 - (elapsed - SETTLE_AT) / SOLID_FADE_OUT
      if (solidA > 0.01 && solid) {
        ctx.globalAlpha = Math.min(1, solidA)
        ctx.drawImage(solid, 0, 0, cw, ch)
        ctx.globalAlpha = 1
      }

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const t = Math.min(1, Math.max(0, (elapsed - p.delay) / DRAW_DURATION))
        const e = easeOutCubic(t)
        let x = p.sx + (p.tx - p.sx) * e
        let y = p.sy + (p.ty - p.sy) * e

        // Dérive sinusoïdale continue (jamais figé après le draw-in).
        const amp = driftAmp * e
        x += Math.sin(now * p.spd + p.phase) * DRIFT_AMP * amp
        y += Math.cos(now * p.spd * 0.93 + p.phase * 1.41) * DRIFT_AMP * 0.8 * amp

        // Répulsion + teinte accent près du pointeur (balayage).
        let near = 0
        if (pointerLive || sweeping) {
          const dx = x - pointer.x
          const dy = y - pointer.y
          const d2 = dx * dx + dy * dy
          const R = Math.max(60, reach * 0.42)
          if (d2 < R * R && d2 > 0.01) {
            const d = Math.sqrt(d2)
            const f = (R - d) / R
            const push = pointerLive ? 15 : 9
            x += (dx / d) * f * push
            y += (dy / d) * f * push
            near = f * (pointerLive ? 1 : 0.55)
          }
        }

        const pulse = 0.9 + 0.1 * Math.sin(now * 0.0022 + p.phase)
        const r = baseR * pulse * (0.9 + 0.28 * near)
        const tr = textRGB
        const ar = accentRGB
        const cr = Math.round(tr[0] + (ar[0] - tr[0]) * near * 0.9)
        const cg = Math.round(tr[1] + (ar[1] - tr[1]) * near * 0.9)
        const cb = Math.round(tr[2] + (ar[2] - tr[2]) * near * 0.9)

        const alpha = Math.max(0.06, e) * (0.94 + 0.06 * near)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
        if (e > 0.04) lit++
      }

      if (!ready && (lit > 30 || solidA > 0.6)) {
        ready = true
        cbs.current.onReady?.()
      }
      return lit
    }

    const loop = (now: number) => {
      if (!running || disposed) return
      paint(now)
      const elapsed = now - start
      if (!settledFired && elapsed > STAGGER + DRAW_DURATION) {
        settledFired = true
        cbs.current.onSettled?.()
      }
      if (elapsed > STAGGER + DRAW_DURATION + 350) {
        const target = 1
        driftAmp += (target - driftAmp) * 0.04
      }
      raf = requestAnimationFrame(loop)
    }

    const startLoop = () => {
      if (running || disposed || reduced) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const drawStatic = () => {
      if (!pts.length) return false
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      const baseR = Math.max(0.75, fontPx * 0.052)
      for (const p of pts) {
        ctx.fillStyle = `rgba(${textRGB[0]},${textRGB[1]},${textRGB[2]},0.92)`
        ctx.fillRect(p.tx - baseR, p.ty - baseR, baseR * 2, baseR * 2)
      }
      return true
    }

    const resample = () => {
      if (disposed) return
      dpr = Math.min(2, window.devicePixelRatio || 1)
      sample()
      canvas.width = Math.max(1, Math.ceil(cw * dpr))
      canvas.height = Math.max(1, Math.ceil(ch * dpr))
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      if (!pts.length) return
      if (reduced) {
        if (drawStatic() || solid) {
          if (!ready) {
            ready = true
            cbs.current.onReady?.()
          }
          if (!settledFired) {
            settledFired = true
            cbs.current.onSettled?.()
          }
        }
        stopLoop()
        return
      }
      if (playedIntro) {
        const elapsedNow = performance.now() - start
        if (elapsedNow > STAGGER + DRAW_DURATION) {
          // Intro terminée (resize/retour viewport) : état posé direct.
          start = performance.now() - (STAGGER + DRAW_DURATION + 1000)
          driftAmp = 1
        }
        // sinon : draw-in en cours (ex. re-sample fonts.ready) → on conserve
        // l'horloge, les points re-convergent simplement vers les cibles.
      } else {
        start = performance.now()
        driftAmp = 0
        playedIntro = true
      }
      startLoop()
    }

    // Attendre la police réelle (next/font) avant d'échantillonner, garde-fou 900 ms.
    const famProbe = `${weight} 16px ${font}`
    const fontsReady: Promise<void> =
      typeof document !== 'undefined' && 'fonts' in document
        ? (document as Document).fonts.check(famProbe, text)
          ? Promise.resolve()
          : (document as Document).fonts.load(famProbe, text).then(() => undefined).catch(() => undefined)
        : Promise.resolve()
    const kick = window.setTimeout(() => { if (!disposed) resample() }, 900)
    void fontsReady.then(() => {
      if (disposed) return
      window.clearTimeout(kick)
      resample()
      void (document as Document).fonts.ready.then(() => { if (!disposed) resample() })
    })

    // Garde-fou : si rien n'est peint après READY_GUARD_MS, signaler l'échec
    // pour que le titre statique du h1 reste visible.
    const guard = window.setTimeout(() => {
      if (!disposed && !ready) cbs.current.onError?.()
    }, READY_GUARD_MS)

    const ro = new ResizeObserver(() => { if (!disposed) resample() })
    ro.observe(host)

    const io = new IntersectionObserver(
      ([entry]) => {
        if (disposed || reduced) return
        if (entry.isIntersecting) {
          if (!ready && !playedIntro) start = performance.now()
          startLoop()
        } else {
          stopLoop()
        }
      },
      { threshold: 0.05 }
    )
    io.observe(host)

    const onPointerMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ev.clientX - rect.left
      pointer.y = ev.clientY - rect.top
      pointerLive = true
      sweeping = false
    }
    const onPointerLeave = () => { pointerLive = false }
    // Balayage automatique quand le pointeur ne survole pas le titre —
    // démarré seulement APRÈS le draw-in (lisibilité pendant l'intro).
    const sweep = window.setInterval(() => {
      if (disposed || pointerLive || !ready || !settledFired || reduced) return
      sweeping = true
      pointer.x = cw * (0.15 + 0.7 * Math.abs(Math.sin(performance.now() * 0.00035)))
      pointer.y = ch * 0.5
    }, 140)

    const onVis = () => {
      if (disposed || reduced) return
      if (document.hidden) stopLoop()
      else startLoop()
    }

    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave, { passive: true })
    document.addEventListener('visibilitychange', onVis)

    return () => {
      disposed = true
      stopLoop()
      window.clearTimeout(kick)
      window.clearTimeout(guard)
      window.clearInterval(sweep)
      ro.disconnect()
      io.disconnect()
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVis)
    }
    // Recréation complète quand le texte / la police changent
  }, [text, font, weight, textColor, accent, reach, speed])

  return (
    <span
      ref={hostRef}
      className={className ? `vwm ${className}` : 'vwm'}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="vwm__canvas" />
    </span>
  )
}
