'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

/* ─── Code promo Linebet — VISION221 (majuscules) ───────────────────── */
const CODE = 'VISION221'

/* ─── Offre annoncée par la campagne partenaire ─────────────────────── */
const OFFER = {
  bonus: '300%',
  freeSpins: '100',
  wagering: 'Sans condition de mise',
  minDeposit: '1 €',
}

/* ─── Palette locale — bleu marque Linebet + cyan ────────────────────── */
const GOLD = '#2F7DFF'
const CYAN = '#22D3EE'
const PRIMARY = '#2F7DFF'
const TEXT = '#F2F6FA'
const TEXT_SEC = '#9DABBB'
const BG_DARK = '#0B0F14'

/* Lien affilié Linebet — registration (inchangé) */
const LINEBET_SIGNUP = AFFILIATE.linebet
/* Vrai lien affilié de téléchargement (APK) — inchangé */
const LINEBET_DOWNLOAD = AFFILIATE.linebetDownload

/* ─── Bandeau défilant — bénéfices de l'offre annoncée ───────────────── */
const BENEFITS = [
  '300% de bonus',
  '100 Free Spins',
  'Sans condition de mise',
  'Dès 1 € de dépôt',
  'International — tous les pays du monde',
  'App Android & iOS',
]

/* ─── Étapes (4) — design moderne avec icônes SVG ───────────────────── */
const STEPS = [
  {
    n: '01',
    title: 'Inscris-toi via notre lien',
    desc: "Clique sur « S'inscrire sur Linebet » ci-dessous. Crée ton compte gratuit en 2 minutes avec ton email ou ton numéro.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    n: '02',
    title: `Saisis le code ${CODE}`,
    desc: `Pendant l'inscription (ou dans « Code Promo » de ton compte), colle exactement ${CODE} en majuscules.`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
      </svg>
    ),
  },
  {
    n: '03',
    title: `Dépose dès ${OFFER.minDeposit}`,
    desc: `Effectue ton premier dépôt à partir de ${OFFER.minDeposit} avec Wave, Orange Money ou un autre moyen disponible dans ton pays.`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Reçois 300% + 100 free spins',
    desc: `Le bonus de ${OFFER.bonus} et les ${OFFER.freeSpins} free spins sont crédités selon l'offre affichée par Linebet, ${OFFER.wagering.toLowerCase()}.`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5L12 2z" />
      </svg>
    ),
  },
]

/* ─── Moyens de dépôt ───────────────────────────────────────────────── */
const PAYMENT_METHODS = [
  { name: 'Wave', color: '#1DC9FF', short: 'W' },
  { name: 'Orange Money', color: '#2F7DFF', short: 'OM' },
  { name: 'MTN', color: '#FFCC00', short: 'M' },
  { name: 'Moov', color: '#0066B3', short: 'M' },
  { name: 'Free Money', color: '#CC0066', short: 'F' },
]

/* ─── Détails offre ─────────────────────────────────────────────────── */
const BONUS_ROWS = [
  { label: 'Bonus', value: '300% sur le premier dépôt', highlight: true },
  { label: 'Free spins', value: '100 free spins inclus' },
  { label: 'Condition de mise', value: 'Sans condition de mise (offre annoncée)' },
  { label: 'Dépôt minimum', value: '1 €' },
  { label: 'Code', value: `${CODE} (copiable — en majuscules)` },
  { label: 'Pays', value: 'International — tous les pays du monde, sans exception' },
]

/* ─── Liens internes ─────────────────────────────────────────────────── */
const INTERNAL_LINKS = [
  { href: '/btts/predictions/today', label: 'Pronostics du jour' },
  { href: '/bonus-888starz', label: 'Code promo 888Starz' },
  { href: '/btts-c-est-quoi', label: "C'est quoi BTTS ?" },
]

/* ─── Compteur animé (motion design billboard) ───────────────────────── */
function useCountUp(target: number, duration = 1300): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      // Motion réduite → saut direct à la valeur finale (p = 1)
      const p = reduced ? 1 : Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function LinebetClient() {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [toast, setToast] = useState(false)

  const bonusCount = useCountUp(300)
  const spinsCount = useCountUp(100)
  const depositCount = useCountUp(1)

  /* Mesure : 1 vue de la page promo par session */
  useEffect(() => {
    trackAffiliateAction('linebet', 'promo_view', 'code-promo-linebet-page')
  }, [])

  const showToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }

  const handleCopy = async () => {
    // Succès affiché UNIQUEMENT si la copie a réellement réussi
    const ok = await copyTextToClipboard(CODE)
    if (ok) {
      trackAffiliateCodeCopy('linebet', 'linebet-promo-code-card')
      setCopied(true)
      setCopyFailed(false)
      showToast()
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopyFailed(true)
      showToast()
      setTimeout(() => setCopyFailed(false), 4000)
    }
  }

  // alias demandé par la spec : copyCode()
  const copyCode = handleCopy

  return (
    <>
      {/* Toast flottant — seulement après un vrai succès de copie */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl"
          style={{
            backgroundColor: '#2F7DFF',
            color: BG_DARK,
            border: '1.5px solid #2F7DFF',
            boxShadow: '0 10px 40px rgba(169, 196, 223, 0.4)',
          }}
          role="status"
          aria-live="polite"
        >
          {copyFailed ? `⚠ Copie impossible — code : ${CODE}` : '✅ Code copié !'}
        </div>
      )}

      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <ol className="flex items-center gap-2 text-sm" style={{ color: TEXT_SEC }}>
          <li>
            <a href="/" className="hover:text-emerald transition-colors">Accueil</a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <span aria-current="page">Code Promo Linebet International</span>
          </li>
        </ol>
      </nav>

      {/* ─────────── HERO + H1 — aurore bleue Linebet ─────────── */}
      <section className="lpb-hero pb-6 sm:pb-8">
        <div className="lpb-orb lpb-orb--1" aria-hidden="true" />
        <div className="lpb-orb lpb-orb--2" aria-hidden="true" />
        <span className="lpb-spark text-lg" style={{ top: '14%', left: '9%', animationDelay: '0.2s' }} aria-hidden="true">✦</span>
        <span className="lpb-spark text-sm" style={{ top: '58%', left: '16%', animationDelay: '1.1s' }} aria-hidden="true">✦</span>
        <span className="lpb-spark text-base" style={{ top: '22%', right: '11%', animationDelay: '1.8s' }} aria-hidden="true">✦</span>
        <span className="lpb-spark text-xs" style={{ top: '66%', right: '18%', animationDelay: '0.7s' }} aria-hidden="true">✦</span>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="lpb-rise flex justify-center mb-4" style={{ '--d': '40ms' } as CSSProperties}>
            <span className="lpb-badge text-[10px] tracking-[0.18em]">★ Code Promo N°1 Mondial</span>
          </div>
          <h1
            className="lpb-rise text-3xl sm:text-5xl mb-3 leading-tight"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT, '--d': '120ms' } as CSSProperties}
          >
            CODE PROMO <span style={{ color: GOLD, textShadow: `0 0 22px ${GOLD}66` }}>LINEBET</span> VISION221
          </h1>
          <div className="lpb-rise mx-auto mb-4 flex min-h-16 max-w-[280px] items-center justify-center rounded-xl bg-white px-4 py-2 shadow-lg sm:max-w-[340px]" style={{ '--d': '220ms' } as CSSProperties}>
            <img src="/logos/linebet-provided.jpg" alt="Logo officiel Linebet" className="max-h-14 w-auto object-contain" width={1280} height={465} loading="eager" />
          </div>
          <p className="lpb-rise text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: TEXT_SEC, '--d': '320ms' } as CSSProperties}>
            Inscris-toi avec le code <strong style={{ color: GOLD }}>{CODE}</strong> et profite de l&apos;offre annoncée : <strong style={{ color: TEXT }}>300% de bonus + 100 free spins</strong>, sans condition de mise, dès 1 € de dépôt.
          </p>
          <p className="lpb-rise text-[11px] mt-3" style={{ color: TEXT_SEC, '--d': '420ms' } as CSSProperties}>
            Offre annoncée — vérifie les conditions affichées par Linebet · 18+
          </p>
        </div>
      </section>

      {/* ─────────── BANDEAU DÉFILANT BÉNÉFICES (décoratif) ─────────── */}
      <section className="pb-6" aria-hidden="true">
        <div className="lpb-marquee">
          <div className="lpb-marquee__track">
            {[0, 1].map((copy) => (
              <div className="lpb-marquee__group" key={copy}>
                {BENEFITS.map((b) => (
                  <span className="lpb-marquee__item" key={`${copy}-${b}`}>{b}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── BILLBOARD OFFRE — 3 chiffres animés ─────────── */}
      <section className="pb-8" aria-label="Offre de bienvenue annoncée">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="lpb-stat lpb-pop" style={{ '--d': '120ms' } as CSSProperties}>
              <p className="lpb-stat__num">{bonusCount}%</p>
              <span className="sr-only">300% de bonus</span>
              <p className="text-[10px] sm:text-xs mt-1.5 font-bold uppercase tracking-wider" style={{ color: TEXT }}>Bonus</p>
            </div>
            <div className="lpb-stat lpb-pop" style={{ '--d': '260ms' } as CSSProperties}>
              <p className="lpb-stat__num">{spinsCount}</p>
              <span className="sr-only">100 free spins</span>
              <p className="text-[10px] sm:text-xs mt-1.5 font-bold uppercase tracking-wider" style={{ color: TEXT }}>
                <span className="lpb-spins-star" aria-hidden="true">✦</span> Free spins
              </p>
            </div>
            <div className="lpb-stat lpb-pop" style={{ '--d': '400ms' } as CSSProperties}>
              <p className="lpb-stat__num">{depositCount} €</p>
              <span className="sr-only">1 euro de dépôt minimum</span>
              <p className="text-[10px] sm:text-xs mt-1.5 font-bold uppercase tracking-wider" style={{ color: TEXT }}>Dépôt min.</p>
            </div>
          </div>
          <p className="text-xs mt-3 text-center font-semibold" style={{ color: TEXT }}>
            {OFFER.wagering} · Offre annoncée par la campagne partenaire — vérifie les conditions affichées par Linebet avant tout dépôt.
          </p>
        </div>
      </section>

      {/* ─────────── CARTE CODE PREMIUM — bordure animée + reflet ─────────── */}
      <section className="pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="lpb-card">
            <div className="lpb-card__inner">
              <span className="lpb-shine__beam" aria-hidden="true" />

              {/* Code VISION221 — cliquable directement */}
              <p className="text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: TEXT_SEC }}>
                Code promo Linebet
              </p>
              <button
                type="button"
                onClick={copyCode}
                title="Cliquer pour copier"
                aria-label={`Code promo ${CODE} — cliquer pour copier dans le presse-papier`}
                className="inline-flex items-center justify-center gap-3 mb-3 select-all cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-transparent border-0 p-0"
                style={{ fontFamily: 'var(--font-mono), monospace' }}
              >
                <span className="lpb-code text-5xl sm:text-6xl font-black tracking-[0.15em]">
                  {CODE}
                </span>
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: copied ? '#2F7DFF' : 'rgba(47, 125, 255, 0.14)',
                    border: `1px solid ${copied ? '#2F7DFF' : GOLD}`,
                    color: copied ? BG_DARK : GOLD,
                  }}
                  aria-hidden="true"
                >
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </span>
              </button>
              <p className="text-xs mb-6" style={{ color: TEXT_SEC }}>
                À saisir exactement en <strong style={{ color: TEXT }}>majuscules</strong> · Code {CODE}
              </p>

              {/* 3 boutons : Copier / S'inscrire / Télécharger (Google Play) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  onClick={handleCopy}
                  className="lpb-btn lpb-btn--copy flex-1 sm:flex-initial sm:min-w-[240px]"
                  aria-label={`Copier le code ${CODE} dans le presse-papier`}
                >
                  {copyFailed ? (
                    <>⚠ Copie impossible</>
                  ) : copied ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copié !
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copier le code {CODE}
                    </>
                  )}
                </button>

                <a
                  href={LINEBET_SIGNUP}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="lpb-btn lpb-btn--primary flex-1 sm:flex-initial sm:min-w-[240px]"
                  data-cta="linebet-signup-v60"
                  onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'linebet-promo-code-card')}
                >
                  S&apos;inscrire sur Linebet
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>

                <a
                  href={LINEBET_DOWNLOAD}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="lpb-btn lpb-btn--store flex-1 sm:flex-initial sm:min-w-[240px]"
                  data-cta="linebet-download-v62"
                  onClick={() => trackAffiliateAction('linebet', 'download_click', 'linebet-promo-code-card', { link_target: 'download' })}
                >
                  <img src="/logos/google-play.svg" alt="" width={22} height={22} loading="lazy" aria-hidden="true" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>Télécharger l&apos;app</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: TEXT_SEC }}>Google Play · APK Android</span>
                  </span>
                </a>
              </div>

              <p className="text-[10px] mt-4" style={{ color: '#9DABBB' }}>
                Lien d&apos;affiliation rémunéré · 18+ · Jouer responsable
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── TABLE OFFRE ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-4 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Détails de l&apos;offre Linebet
          </h2>
          <div className="lpb-rise rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}33`, backgroundColor: '#141C25' }}>
            <table className="w-full text-sm">
              <tbody>
                {BONUS_ROWS.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderTop: i === 0 ? 'none' : `1px solid ${GOLD}1A`,
                      backgroundColor: row.highlight ? `${GOLD}10` : 'transparent',
                    }}
                  >
                    <th scope="row" className="text-left p-4 font-semibold align-top" style={{ color: TEXT_SEC, width: '40%' }}>
                      {row.label}
                    </th>
                    <td className="text-left p-4 align-top font-bold" style={{ color: row.highlight ? GOLD : TEXT }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] mt-2 text-center" style={{ color: TEXT_SEC }}>
            Offre annoncée par la campagne partenaire — les conditions affichées par Linebet prévalent.
          </p>
        </div>
      </section>

      {/* ─────────── ÉTAPES (4) — apparition en cascade ─────────── */}
      <section className="pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-6 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Comment utiliser le code {CODE}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, idx) => (
              <div
                key={step.n}
                className="lpb-rise lpb-step rounded-2xl p-5 relative"
                style={{
                  backgroundColor: '#141C25',
                  border: `1px solid ${GOLD}22`,
                  '--d': `${idx * 130}ms`,
                } as CSSProperties}
              >
                {/* Numéro + icône */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="lpb-num w-10 h-10 flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: GOLD }}>
                    {step.n}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: TEXT, fontFamily: 'Poppins, sans-serif' }}>
                  {step.title}
                </h3>
                <p className="text-[12px] leading-relaxed" style={{ color: TEXT_SEC }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA inline après étapes */}
          <div className="text-center mt-6">
            <button
              onClick={handleCopy}
              className="lpb-btn lpb-btn--copy px-5"
              style={{ minHeight: 44 }}
            >
              {copyFailed ? `⚠ Copie impossible — code : ${CODE}` : copied ? `✅ Code copié — colle-le sur Linebet` : `📋 Copier ${CODE} maintenant`}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────── MOYENS DE DÉPÔT ─────────── */}
      <section className="pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-2 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Moyens de dépôt Linebet
          </h2>
          <p className="text-center text-sm mb-6" style={{ color: TEXT_SEC }}>
            Dépose dès {OFFER.minDeposit} avec le moyen disponible dans ton pays · disponibilité à vérifier.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <div
                key={m.name}
                className="lpb-pay rounded-2xl p-4 text-center"
                style={{ backgroundColor: '#141C25', border: `1px solid ${m.color}33` }}
              >
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-base"
                  style={{ backgroundColor: `${m.color}1A`, color: m.color, border: `1px solid ${m.color}55` }}
                  aria-hidden="true"
                >
                  {m.short}
                </div>
                <p className="text-[11px] font-semibold" style={{ color: TEXT }}>
                  {m.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── FAQ visible (alignée sur JSON-LD) ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-4 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {[
              {
                q: 'Quel est le code promo Linebet ?',
                a: `Le code promo Linebet est ${CODE} — à saisir en majuscules lors de l'inscription ou dans la section « Code Promo » de ton compte. Valable dans le monde entier — tous les pays du monde, sans exception.`,
              },
              {
                q: `Que donne le code ${CODE} ?`,
                a: `300% de bonus et 100 free spins, sans condition de mise, dès 1 € de dépôt — offre annoncée par la campagne partenaire. Vérifie l'offre affichée par Linebet pour ton pays avant tout dépôt.`,
              },
              {
                q: 'Comment déposer avec Wave ou Orange Money ?',
                a: "Si Wave ou Orange Money est disponible pour ton pays, sélectionne-le dans la section Dépôt de Linebet, dépose à partir de 1 € puis vérifie les conditions affichées avant de confirmer.",
              },
              {
                q: 'Le bonus est-il valable dans tous les pays ?',
                a: "La disponibilité du code et de l'offre dépend du pays, du compte et de la période. Vérifie ton éligibilité et les conditions actuellement affichées par Linebet avant toute inscription ou dépôt.",
              },
            ].map((item) => (
              <details key={item.q} className="lpb-faq rounded-2xl p-4" style={{ backgroundColor: '#141C25', border: `1px solid ${GOLD}22` }}>
                <summary className="cursor-pointer font-semibold text-sm" style={{ color: TEXT }}>
                  {item.q}
                </summary>
                <p className="text-[12px] mt-2 leading-relaxed" style={{ color: TEXT_SEC }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── LIENS INTERNES ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: '#141C25', border: `1px solid ${GOLD}22` }}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: CYAN }}>
              À découvrir sur BTTSPredict
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {INTERNAL_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg font-semibold transition-all"
                  style={{ backgroundColor: `${PRIMARY}15`, color: TEXT, border: `1px solid ${PRIMARY}33` }}
                >
                  {l.label} →
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Disclaimer 18+ ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255, 122, 122, 0.06)', border: '1px solid rgba(255, 122, 122, 0.2)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: TEXT_SEC }}>
              ⚠ BTTSPredict est un site informatif et d&apos;affiliation. Nous ne prenons aucun pari, ne collectons aucun fonds et ne sommes pas un bookmaker.
              L&apos;offre annoncée (300% + 100 free spins) est soumise aux conditions de Linebet (éligibilité, moyens de paiement — voir site bookmaker).
              Pariez responsable · <a href="/jouer-responsable" className="underline" style={{ color: PRIMARY }}>en savoir plus</a> · 18+.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── STICKY BOTTOM BAR (mobile only) ─────────── */}
      <div
        className="lpb-sticky sm:hidden fixed bottom-0 left-0 right-0 z-[80] flex items-center justify-between gap-3 px-4 py-3"
        style={{
          backgroundColor: BG_DARK,
          borderTop: `1.5px solid ${GOLD}`,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: TEXT_SEC }}>Code promo</span>
          <span className="text-base font-black tracking-[0.12em]" style={{ color: GOLD, fontFamily: 'var(--font-mono), monospace' }}>
            {CODE}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="px-5 py-2.5 rounded-[10px] font-bold text-[13px]"
          style={{
            backgroundColor: copied ? '#2F7DFF' : GOLD,
            color: BG_DARK,
          }}
        >
          {copyFailed ? '⚠ Manuel' : copied ? '✅ Copié' : '📋 Copier'}
        </button>
      </div>

      {/* Spacer pour sticky bar mobile (évite que le footer ne soit masqué) */}
      <div className="sm:hidden h-[72px]" aria-hidden="true" />
    </>
  )
}
