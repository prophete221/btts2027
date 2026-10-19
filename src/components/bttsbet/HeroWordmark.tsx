'use client'

/**
 * AnimatedTitle — motion design « kinetic settle » (nouvelle génération).
 *
 * Changement de style demandé : on remplace la matrice de points WebGL
 * (texte illisible pendant l'animation) par une animation 100 % DOM/CSS
 * du TEXTE RÉEL — le titre n'est jamais remplacé, déformé ni redessiné :
 *
 *   1. chaque mot monte depuis un masque (overflow hidden), easeOutExpo ;
 *   2. apparition rapide (opacity 320 ms) + settle doux flou→net (500 ms)
 *      → le mot est lisible dès son entrée, net en < 500 ms ;
 *   3. stagger 55 ms mot à mot, onde de haut en bas du titre ;
 *   4. une fois posé, l'accent reçoit un reflet lumineux (balayage du
 *      dégradé) — pur surlignage, la lisibilité reste intacte.
 *
 * Garde-fous :
 * - SEO/AT : texte intégral en sr-only ; couche visuelle aria-hidden ;
 * - sans JS (HTML statique) : texte visible (état par défaut = posé) ;
 * - prefers-reduced-motion : aucune animation (texte statique) ;
 * - RTL/arabe natif (flux inline réel, plus aucun canvas) ;
 * - failsafe 2 s : le titre devient visible quoi qu'il arrive ;
 * - repli polices : l'intro attend document.fonts.ready (450 ms max).
 *
 * API strictement inchangée (text, accent, as, className, style,
 * accentColor, handles, enabled…) — drop-in replacement, aucun appelant
 * à modifier, aucun texte ni contenu modifié.
 */

import * as React from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Conservé pour compatibilité API (ancien moteur de poignées, désormais ignoré). */
export type WordmarkHandles = {
  size?: number
  spread?: number
  labels?: boolean
}

export type AnimatedTitleProps = {
  text: string
  accent?: string
  as?: 'span' | 'h1' | 'h2'
  className?: string
  style?: React.CSSProperties
  fontFamily?: string
  fontWeight?: number
  /** Couleur d'accent — dégradé personnalisé si fourni (ex. or VIP #E8C268). */
  accentColor?: string
  /** Compatibilité API historique (moteur CSS : ignoré). */
  handles?: WordmarkHandles
  /** Active l'effet (défaut true — RTL/arabe supportés nativement). */
  enabled?: boolean
}

/* Moteur CSS — injecté via React 19 (dédupliqué par href + precedence).
   Transitions posées UNIQUEMENT en phase play : l'armement (pré-paint)
   est instantané, puis chaque mot glisse vers son état final lisible. */
const AW_CSS = `
.aw{display:block}
.aw-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.aw-m{display:inline-block;overflow:hidden;padding:0.12em 0;margin:-0.12em 0}
.aw-w{display:inline-block;opacity:1;transform:translateY(0);filter:blur(0)}
.aw--armed .aw-w{opacity:0;transform:translateY(0.72em);filter:blur(7px)}
.aw--play .aw-w{opacity:1;transform:translateY(0);filter:blur(0);
  transition:transform 760ms cubic-bezier(0.19,1,0.22,1),opacity 300ms ease-out,filter 440ms cubic-bezier(0.33,0.75,0.35,1);
  transition-delay:calc(var(--aw-i,0)*55ms)}
.aw-em{font-style:normal}
/* Dégradé posé sur le mot lui-même : background-clip:text ne traverse pas
   les enfants inline-block (masques) — l'accent reste donc toujours visible. */
.aw-w--em{background-image:linear-gradient(120deg,#4A90FF 0%,#45C7F7 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
/* Hôte à dégradé global (ex. VIP : h1 background-clip:text) — réplique par mot. */
.aw-w--hostgrad{-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;background-repeat:no-repeat}
/* Mesure des rects à l'état repos (neutralise le transform d'armement). */
.aw--measure .aw-w{transform:none!important;transition:none!important}
.aw--play .aw-w--em{animation:aw-glint 1250ms cubic-bezier(0.22,1,0.36,1) 950ms both}
@keyframes aw-glint{from{background-position:140% 0,0 0}to{background-position:-40% 0,0 0}}
@media (prefers-reduced-motion:reduce){
  .aw--armed .aw-w,.aw--play .aw-w{opacity:1;transform:none;filter:none;transition:none!important;animation:none!important}
}
`

type Phase = 'idle' | 'armed' | 'play'

type Seg = { words: string[]; accent: boolean }

/** Segmente le texte en mots, en isolant le segment accent (dégradé). */
function buildSegments(text: string, accent?: string): Seg[] {
  const split = (s: string) => s.split(/\s+/).filter(Boolean)
  if (!accent) return [{ words: split(text), accent: false }]
  const idx = text.indexOf(accent)
  if (idx < 0) return [{ words: split(text), accent: false }]
  const segs: Seg[] = []
  const push = (s: string, isAccent: boolean) => {
    const words = split(s)
    if (words.length) segs.push({ words, accent: isAccent })
  }
  push(text.slice(0, idx), false)
  push(accent, true)
  push(text.slice(idx + accent.length), false)
  return segs
}

const SR_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
  /* opacity crée un calque : exclut ces glyphes du masque background-clip:text
     d'un hôte à dégradé (sinon double-peinture nowrap sous l'animation). */
  opacity: 0,
}

/**
 * AnimatedTitle — révélation « kinetic settle » du titre réel.
 * Le mot à mot en masque garde le texte lisible à chaque instant
 * (forme finale dès l'entrée, netteté < 500 ms, aucune distorsion).
 */
export default function AnimatedTitle({
  text,
  accent,
  as = 'span',
  className,
  style,
  accentColor,
  enabled = true,
}: AnimatedTitleProps) {
  const Tag = as as any
  const hostRef = useRef<HTMLElement | null>(null)
  const layerRef = useRef<HTMLSpanElement | null>(null)

  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const active = enabled && !reduced

  /* Phase 'armed' dès le premier render quand l'animation est active :
     l'armement reste pré-paint (useLayoutEffect) sans setState synchrone
     dans l'effet (cascade de rendus interdite par react-hooks). */
  const [phase, setPhase] = useState<Phase>(() => (active ? 'armed' : 'idle'))

  /* Hôte à dégradé global (ex. VIP : h1 avec background-clip:text +
     -webkit-text-fill-color:transparent) : le clip ne traverse PAS les boîtes
     inline-block (masques) ni les calques transform/filter → sans correction,
     les mots seraient invisibles. On réplique donc le dégradé sur chaque mot
     (auto-clip sur l'élément qui porte texte ET fond — prouvé fiable), avec
     continuité pixel du dégradé d'origine (background-size/position = rects).
     Mesure à l'état repos (aucun transform) ; re-appliqué après fonts.ready
     (la police change les largeurs) et au redimensionnement. */
  const applyHostGradient = useCallback(() => {
    const host = hostRef.current
    const layer = layerRef.current
    if (!host || !layer) return
    const cs = window.getComputedStyle(host)
    const bgi = cs.backgroundImage
    const clip = (cs as any).webkitBackgroundClip || cs.backgroundClip
    const fill = (cs as any).webkitTextFillColor || cs.color
    const transparentFill = /rgba\(0, 0, 0, 0\)|transparent/.test(fill)
    const words = layer.querySelectorAll<HTMLElement>('.aw-w')
    if (clip !== 'text' || (!transparentFill && (!bgi || bgi === 'none'))) {
      words.forEach((w) => {
        w.classList.remove('aw-w--hostgrad')
        w.style.backgroundImage = ''
        w.style.backgroundSize = ''
        w.style.backgroundPosition = ''
      })
      return
    }
    if (!bgi || bgi === 'none') {
      /* clip:text sans fond : restaure la peinture pleine (filet de sécurité). */
      words.forEach((w) => {
        w.classList.remove('aw-w--hostgrad')
        w.style.backgroundImage = ''
        w.style.backgroundSize = ''
        w.style.backgroundPosition = ''
        ;(w.style as any).webkitTextFillColor = cs.color
      })
      return
    }
    const lr0 = layer.getBoundingClientRect()
    const W = Math.max(1, Math.round(lr0.width))
    const H = Math.max(1, Math.round(lr0.height))
    /* Mesure à l'état repos : en phase armed, les mots sont translate +0.72em
       (pré-paint) — sans neutralisation, background-position serait faussé. */
    layer.classList.add('aw--measure')
    const rects = Array.from(words).map((w) => w.getBoundingClientRect())
    layer.classList.remove('aw--measure')
    words.forEach((w, k) => {
      if (w.classList.contains('aw-w--em')) return /* accent : son propre dégradé */
      const r = rects[k]
      w.classList.add('aw-w--hostgrad')
      w.style.backgroundImage = bgi
      w.style.backgroundSize = `${W}px ${H}px`
      w.style.backgroundPosition = `${-Math.round(r.left - lr0.left)}px ${-Math.round(r.top - lr0.top)}px`
    })
  }, [])

  /* Arme avant la première peinture, démarre après les polices (450 ms max),
     failsafe 2 s pour garantir un titre visible en toutes circonstances. */
  useLayoutEffect(() => {
    if (!active) return
    let cancelled = false
    let raf0 = 0
    let raf1 = 0
    let raf2 = 0
    let failsafe = 0
    let resizeTimer = 0
    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        if (!cancelled) applyHostGradient()
      }, 180)
    }
    applyHostGradient() /* mesure à l'état repos, avant tout transform */
    /* Re-armement différé d'un frame : le montage part déjà de 'armed'
       (initialiseur useState). Utile si l'effet re-court après une
       désactivation ; sans effet sinon (bail-out React sur même valeur). */
    raf0 = requestAnimationFrame(() => {
      if (!cancelled) setPhase('armed')
    })
    const start = () => {
      if (cancelled) return
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setPhase('play')
        })
      })
    }
    const fonts = (document as any).fonts
    if (fonts?.ready?.then) {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        applyHostGradient() /* re-mesure après échange de police */
        start()
      }
      const cap = window.setTimeout(finish, 450)
      fonts.ready.then(() => {
        window.clearTimeout(cap)
        finish()
      }).catch(() => {
        window.clearTimeout(cap)
        finish()
      })
    } else {
      start()
    }
    failsafe = window.setTimeout(() => {
      if (!cancelled) setPhase('play')
    }, 2000)
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf0)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(failsafe)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [text, active, applyHostGradient])

  const segments = buildSegments(text, accent)

  /* Dégradé d'accent personnalisé (ex. or VIP) + reflet en 1re couche.
     2e couche = dégradé de base → état final identique au style statique. */
  const customAccent = accentColor && accentColor !== '#2F7DFF'
    ? {
        backgroundImage: `linear-gradient(115deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0) 58%), linear-gradient(115deg, ${accentColor} 0%, ${accentColor} 100%)`,
      }
    : undefined

  let wordIndex = 0
  const renderWords = (words: string[], isAccent: boolean) =>
    words.map((w, k) => {
      const i = wordIndex++
      return (
        <React.Fragment key={`${i}-${w}`}>
          {k > 0 && ' '}
          <span className="aw-m">
            <span
              className={`aw-w${isAccent ? ' aw-w--em' : ''}`}
              style={
                {
                  '--aw-i': i,
                  ...(isAccent && customAccent ? customAccent : null),
                } as React.CSSProperties
              }
            >
              {w}
            </span>
          </span>
        </React.Fragment>
      )
    })

  const phaseClass =
    phase === 'armed' ? ' aw--armed' : phase === 'play' ? ' aw--play' : ''

  return (
    <Tag
      ref={hostRef as any}
      className={className}
      style={{ ...style, display: 'block', position: 'relative' }}
    >
      <style href="animated-title-motion" precedence="medium">
        {AW_CSS}
      </style>
      {/* Texte intégral pour l'accessibilité (la couche visuelle est aria-hidden). */}
      <span style={SR_STYLE}>{text}</span>
      <span
        aria-hidden="true"
        ref={layerRef}
        className={`aw${phaseClass}`}
      >
        {segments.map((seg, si) => (
          <React.Fragment key={si}>
            {si > 0 && ' '}
            {seg.accent ? (
              <em className="aw-em">{renderWords(seg.words, true)}</em>
            ) : (
              renderWords(seg.words, false)
            )}
          </React.Fragment>
        ))}
      </span>
    </Tag>
  )
}
