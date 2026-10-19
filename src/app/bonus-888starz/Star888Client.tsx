'use client'

import { useEffect, useState } from 'react'
import { AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

/* ─── Code promo 888Starz — btts221 (minuscules). VISION221 est le code Linebet. ─── */
const CODE = 'btts221'

/* ─── Offre annoncée par la campagne partenaire ─── */
const OFFER = {
  bonus: '300%',
  freeSpins: '100',
  wagering: 'Sans condition de mise',
  minDeposit: '1 €',
}

/* ─── Palette locale — 888Starz rouge clair (couleur de marque) ──────── */
const ORANGE = '#F87171'      // rouge clair 888Starz
const ORANGE_DARK = '#E55A5A' // rouge clair sombre
const PRIMARY = '#F87171'     // boutons et accents en rouge clair
const PRIMARY_HOVER = '#E55A5A'
const TEXT = '#F2F6FA'
const TEXT_SEC = '#9DABBB'
const BG_DARK = '#0B0F14'
const BORDER_OUTLINE = '#9DABBB'

/* Lien affilié 888Starz — inchangé */
const STAR888_SIGNUP = AFFILIATE.star888

/* ─── Étapes (4) — design moderne avec icônes SVG ────────────────────── */
const STEPS = [
  {
    n: '01',
    title: 'Inscris-toi via notre lien',
    desc: "Clique sur « S'inscrire sur 888Starz » ci-dessous. Crée ton compte gratuit en 2 minutes.",
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
    desc: `Pendant l'inscription (ou dans « Code Promo » de ton compte), tape exactement ${CODE} en minuscules.`,
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
    desc: `Effectue un premier dépôt à partir de ${OFFER.minDeposit} avec Wave, Orange Money ou un autre moyen disponible dans ton pays.`,
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
    desc: `Le bonus de ${OFFER.bonus} et les ${OFFER.freeSpins} free spins sont crédités selon l'offre affichée par 888Starz, ${OFFER.wagering.toLowerCase()}. Vérifie les conditions actuelles.`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5L12 2z" />
      </svg>
    ),
  },
]

/* ─── Moyens de dépôt ─────────────────────────────────────────────────── */
const PAYMENT_METHODS = [
  { name: 'Wave', color: '#1DC9FF', short: 'W' },
  { name: 'Orange Money', color: '#2F7DFF', short: 'OM' },
  { name: 'MTN', color: '#FFCC00', short: 'M' },
  { name: 'Moov', color: '#0066B3', short: 'M' },
]

/* ─── Détails bonus ──────────────────────────────────────────────────── */
const BONUS_ROWS = [
  { label: 'Bonus', value: '300% sur le premier dépôt', highlight: true },
  { label: 'Free spins', value: '100 free spins inclus' },
  { label: 'Condition de mise', value: 'Sans condition de mise (offre annoncée)' },
  { label: 'Dépôt minimum', value: '1 €' },
  { label: 'Code', value: `${CODE} (copiable — en minuscules)` },
  { label: 'Pays', value: 'International — tous les pays du monde, sans exception' },
]

/* ─── Liens internes ─────────────────────────────────────────────────── */
const INTERNAL_LINKS = [
  { href: '/', label: 'Pronostics BTTS Afrique de l\'Ouest' },
  { href: '/code-promo-linebet-senegal', label: 'Code Promo Linebet' },
  { href: '/btts-c-est-quoi', label: "C'est quoi BTTS ?" },
]

export default function Star888Client({ reviewDate }: { reviewDate: string }) {
  const reviewYear = reviewDate.slice(0, 4)
  const reviewDateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Dakar' }).format(new Date(`${reviewDate}T12:00:00Z`))
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [toast, setToast] = useState(false)

  /* Mesure : 1 vue de la page promo par session */
  useEffect(() => {
    trackAffiliateAction('888starz', 'promo_view', 'bonus-888starz-page')
  }, [])

  const showToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }

  const handleCopy = async () => {
    // Succès affiché UNIQUEMENT si la copie a réellement réussi
    const ok = await copyTextToClipboard(CODE)
    if (ok) {
      trackAffiliateCodeCopy('888starz', '888starz-promo-code-card')
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

  const copyCode = handleCopy

  return (
    <>
      {/* Toast flottant — seulement après un vrai succès de copie */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl"
          style={{
            backgroundColor: '#F87171',
            color: BG_DARK,
            border: '1.5px solid #F87171',
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
            <span aria-current="page">Guide Code Promo 888Starz</span>
          </li>
        </ol>
      </nav>

      {/* ─────────── HERO + H1 ─────────── */}
      <section className="pb-6 sm:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1
            className="text-3xl sm:text-5xl mb-3 leading-tight"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            CODE PROMO <span style={{ color: ORANGE, textShadow: `0 0 22px ${ORANGE}66` }}>888STARZ</span> {reviewYear} : BTTS221
          </h1>
          <div className="mx-auto mb-4 flex min-h-16 max-w-[340px] items-center justify-center rounded-xl bg-white px-4 py-2 shadow-lg sm:max-w-[440px]">
            <img src="/logos/888starz-provided.webp" alt="Logo officiel 888Starz" className="max-h-14 w-auto object-contain" width={1920} height={894} loading="eager" />
          </div>
          <p className="text-sm sm:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: TEXT_SEC }}>
            Inscris-toi avec le code <strong style={{ color: ORANGE }}>{CODE}</strong> et profite de l&apos;offre annoncée : <strong style={{ color: TEXT }}>300% de bonus + 100 free spins</strong>, sans condition de mise, dès 1 € de dépôt.
          </p>
          <p className="text-[11px] mt-3" style={{ color: TEXT_SEC }}>
            Guide vérifié le <time dateTime={reviewDate}>{reviewDateLabel}</time> · offre annoncée — conditions affichées par 888Starz · 18+
          </p>
        </div>
      </section>

      {/* ─────────── ENCARD OFFRE ─────────── */}
      <section className="pb-6" aria-label="Offre de bienvenue annoncée">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${ORANGE}0D`, border: `1px solid ${ORANGE}55` }}>
            <p className="text-2xl sm:text-3xl font-black" style={{ color: ORANGE, fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}>
              300% DE BONUS + 100 FREE SPINS
            </p>
            <p className="text-xs mt-2 font-semibold" style={{ color: TEXT }}>
              Sans condition de mise · Dès 1 € de dépôt
            </p>
            <p className="text-[10px] mt-1" style={{ color: TEXT_SEC }}>
              Offre annoncée par la campagne partenaire — vérifie les conditions affichées par 888Starz avant tout dépôt.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── CARTE CODE MODERNE ─────────── */}
      <section className="pb-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div
            className="rounded-2xl p-8 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${BG_DARK} 0%, #1A242F 100%)`,
              border: `1.5px solid ${ORANGE}`,
              boxShadow: `0 0 60px ${ORANGE}22, 0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 ${ORANGE}33`,
            }}
          >
            {/* Badge exclusif */}
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] mb-5"
              style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE, border: `1px solid ${ORANGE}55` }}>
              ★ Offre Internationale — Tous Pays
            </div>

            {/* Code btts221 — cliquable directement */}
            <p className="text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: TEXT_SEC }}>
              Code promo 888Starz
            </p>
            <button
              type="button"
              onClick={copyCode}
              title="Cliquer pour copier"
              aria-label={`Code promo ${CODE} — cliquer pour copier dans le presse-papier`}
              className="inline-flex items-center justify-center gap-3 mb-3 select-all cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-transparent border-0 p-0"
              style={{
                color: ORANGE,
                fontFamily: 'var(--font-mono), monospace',
                textShadow: `0 0 30px ${ORANGE}55, 0 0 12px ${ORANGE}88`,
              }}
            >
              <span className="text-5xl sm:text-6xl font-black tracking-[0.15em]">
                {CODE}
              </span>
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                style={{
                  backgroundColor: copied ? '#F87171' : `${ORANGE}1A`,
                  border: `1px solid ${copied ? '#F87171' : ORANGE}`,
                  color: copied ? BG_DARK : ORANGE,
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
              À saisir exactement en <strong style={{ color: TEXT }}>minuscules</strong> · Code {CODE}
            </p>

            {/* 3 boutons : 1-Copier, 2-S'inscrire, 3-Télécharger */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 sm:flex-initial sm:min-w-[260px] h-[52px] rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: copied ? '#F87171' : ORANGE,
                  color: BG_DARK,
                  border: 'none',
                  boxShadow: `0 6px 20px ${ORANGE}33`,
                }}
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
                href={STAR888_SIGNUP}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="flex-1 sm:flex-initial sm:min-w-[260px] h-[52px] rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: PRIMARY,
                  color: TEXT,
                  border: 'none',
                  boxShadow: '0 6px 20px rgba(127, 162, 198, 0.30)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PRIMARY_HOVER }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = PRIMARY }}
                data-cta="888starz-signup-v641"
                onClick={() => trackAffiliateAction('888starz', 'signup_cta_click', '888starz-promo-code-card')}
              >
                S&apos;inscrire sur 888Starz
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>

              <a
                href={AFFILIATE.star888Download}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="flex-1 sm:flex-initial sm:min-w-[260px] h-[52px] rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#C8CCDA',
                  border: `1.5px solid ${BORDER_OUTLINE}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1A242F' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                data-cta="888starz-download-v641"
                onClick={() => trackAffiliateAction('888starz', 'download_click', '888starz-promo-code-card')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Télécharger APK 888Starz
              </a>
            </div>

            <p className="text-[10px] mt-4" style={{ color: '#9DABBB' }}>
              Lien d&apos;affiliation rémunéré · 18+ · Jouer responsable
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── TABLE BONUS ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-4 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Détails de l&apos;offre 888Starz
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ORANGE}33`, backgroundColor: '#141C25' }}>
            <table className="w-full text-sm">
              <tbody>
                {BONUS_ROWS.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderTop: i === 0 ? 'none' : `1px solid ${ORANGE}1A`,
                      backgroundColor: row.highlight ? `${ORANGE}10` : 'transparent',
                    }}
                  >
                    <th scope="row" className="text-left p-4 font-semibold align-top" style={{ color: TEXT_SEC, width: '40%' }}>
                      {row.label}
                    </th>
                    <td className="text-left p-4 align-top font-bold" style={{ color: row.highlight ? ORANGE : TEXT }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] mt-2 text-center" style={{ color: TEXT_SEC }}>
            Offre annoncée par la campagne partenaire — les conditions affichées par 888Starz prévalent.
          </p>
        </div>
      </section>

      {/* ─────────── ÉTAPES (4) ─────────── */}
      <section className="pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-6 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Comment utiliser le code {CODE} sur 888Starz
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl p-5 relative"
                style={{
                  backgroundColor: '#141C25',
                  border: `1px solid ${ORANGE}22`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${ORANGE}15`, border: `1px solid ${ORANGE}40`, color: ORANGE }}
                    aria-hidden="true"
                  >
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: ORANGE }}>
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
        </div>
      </section>

      {/* ─────────── MOYENS DE DÉPÔT ─────────── */}
      <section className="pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2
            className="text-xl sm:text-2xl mb-2 text-center"
            style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}
          >
            Moyens de dépôt 888Starz
          </h2>
          <p className="text-center text-sm mb-6" style={{ color: TEXT_SEC }}>
            Dépose dès {OFFER.minDeposit} avec le moyen disponible dans ton pays · disponibilité à vérifier.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl p-4 text-center"
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

      {/* ─────────── LIENS INTERNES ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: '#141C25', border: `1px solid ${ORANGE}22` }}>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: ORANGE }}>
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

      {/* ─────────── FAQ VISIBLE — cohérente avec le JSON-LD ─────────── */}
      <section className="pb-10" aria-labelledby="faq-888starz">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 id="faq-888starz" className="text-xl sm:text-2xl mb-4 text-center" style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', sans-serif", letterSpacing: '0.03em', color: TEXT }}>
            Questions fréquentes sur le code promo 888Starz
          </h2>
          <div className="space-y-2">
            <details className="rounded-xl p-4" style={{ backgroundColor: '#141C25', border: `1px solid ${ORANGE}22` }}>
              <summary className="cursor-pointer font-bold" style={{ color: TEXT }}>Quel est le code promo 888Starz ?</summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_SEC }}>Le code promo 888Starz présenté sur cette page est <strong style={{ color: ORANGE }}>{CODE}</strong>, à saisir exactement en minuscules pendant l&apos;inscription ou dans la section « Code Promo ».</p>
            </details>
            <details className="rounded-xl p-4" style={{ backgroundColor: '#141C25', border: `1px solid ${ORANGE}22` }}>
              <summary className="cursor-pointer font-bold" style={{ color: TEXT }}>Que donne le code {CODE} en {reviewYear} ?</summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_SEC }}>Le code {CODE} donne <strong style={{ color: ORANGE }}>300% de bonus et 100 free spins</strong>, sans condition de mise, dès 1 € de dépôt — offre annoncée par la campagne partenaire. Vérifie les conditions affichées par 888Starz pour ton pays avant tout dépôt.</p>
            </details>
            <details className="rounded-xl p-4" style={{ backgroundColor: '#141C25', border: `1px solid ${ORANGE}22` }}>
              <summary className="cursor-pointer font-bold" style={{ color: TEXT }}>Quel est le dépôt minimum avec {CODE} ?</summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_SEC }}>Le dépôt minimum annoncé est de <strong style={{ color: TEXT }}>1 €</strong>. Vérifie le montant réellement affiché par 888Starz et les moyens de paiement disponibles dans ton pays avant de confirmer.</p>
            </details>
            <details className="rounded-xl p-4" style={{ backgroundColor: '#141C25', border: `1px solid ${ORANGE}22` }}>
              <summary className="cursor-pointer font-bold" style={{ color: TEXT }}>Le code fonctionne-t-il dans tous les pays ?</summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_SEC }}>La disponibilité peut dépendre du pays, du compte et de la période. Vérifie l&apos;éligibilité directement auprès de 888Starz avant de déposer.</p>
            </details>
          </div>
        </div>
      </section>

      {/* ─────────── Disclaimer 18+ ─────────── */}
      <section className="pb-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(255, 122, 122, 0.06)', border: '1px solid rgba(255, 122, 122, 0.2)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: TEXT_SEC }}>
              ⚠ BTTSPredict est un site informatif et d&apos;affiliation. Nous ne prenons aucun pari, ne collectons aucun fonds et ne sommes pas un bookmaker.
              L&apos;offre annoncée (300% + 100 free spins) est soumise aux conditions de 888Starz (éligibilité, moyens de paiement — voir site bookmaker).
              Pariez responsable · <a href="/jouer-responsable" className="underline" style={{ color: PRIMARY }}>en savoir plus</a> · 18+.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── STICKY BOTTOM BAR (mobile only) ─────────── */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-[80] flex items-center justify-between gap-3 px-4 py-3"
        style={{
          backgroundColor: BG_DARK,
          borderTop: `1.5px solid ${ORANGE}`,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: TEXT_SEC }}>Code promo</span>
          <span className="text-base font-black tracking-[0.12em]" style={{ color: ORANGE, fontFamily: 'var(--font-mono), monospace' }}>
            {CODE}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="px-5 py-2.5 rounded-[10px] font-bold text-[13px]"
          style={{
            backgroundColor: copied ? '#F87171' : ORANGE,
            color: BG_DARK,
          }}
        >
          {copyFailed ? '⚠ Manuel' : copied ? '✅ Copié' : '📋 Copier'}
        </button>
      </div>

      {/* Spacer pour sticky bar mobile */}
      <div className="sm:hidden h-[72px]" aria-hidden="true" />
    </>
  )
}
