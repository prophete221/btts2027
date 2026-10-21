'use client'

import { useEffect, useState } from 'react'
import { useScrollAnimation } from '@/hooks/useAnimations'
import { useLanguage } from './LanguageSwitcher'
import { translationsFor, type Locale, localizedPath } from '@/lib/i18n'
import { generateMatchSlug } from '@/lib/match-slug'
import AnimatedTitle from './HeroWordmark'
import MovingGradientButton from './MovingGradientButton'
import { getDakarDayDiff, hasDakarKickoffPassed } from '@/lib/dakar-date'

/**
 * Hero v4 — « signal terminal » premium.
 *
 * Colonne gauche : eyebrow, H1 (accents dégradés), texte, 2 CTA internes,
 * puis bandeau défilant des grands clubs européens suivis (décoratif,
 * logos locaux, défilement infini, pause au survol, désactivable via
 * prefers-reduced-motion).
 * Colonne droite : carte « Signal en vedette » — un VRAI match du flux
 * predictions.json (marchés, xG, forme, fiabilité, horodatage GMT),
 * sans aucune statistique inventée. Fallback si flux vide : pipeline
 * de traitement factuel (4 étapes de la méthode).
 * La carte « Centre de transparence » est supprimée (décision produit).
 * Aucun pourcentage de réussite affiché ici.
 */

/**
 * Logos des grands clubs suivis — fichiers locaux (public/logos/clubs/),
 * téléchargés depuis la même source ESPN que les logos d'équipes des matchs.
 * Purement décoratif : aucun club n'endosse ce site.
 */
const CLUB_LOGOS = [
  'real-madrid', 'barcelona', 'manchester-united', 'liverpool', 'bayern',
  'psg', 'chelsea', 'manchester-city', 'arsenal', 'juventus', 'ac-milan',
  'inter', 'dortmund', 'atletico', 'tottenham',
] as const

interface MarketPick {
  type: string
  prediction: string
  confidence?: number
}

interface FeedItem {
  match: string
  home: string
  away: string
  league: string
  date: string
  time: string
  homeLogo?: string
  awayLogo?: string
  confidence?: number
  reliabilityScore?: number
  xgHome?: number
  xgAway?: number
  xgTotal?: number
  formBTTS?: number
  ai_exact_score?: string
  predictions?: MarketPick[]
  type?: string
  prediction?: string
}

/** Écart en jours métier à Dakar entre la date du match et aujourd'hui. */
function dayDiff(dateStr: string): number {
  return getDakarDayDiff(dateStr)
}

function formatDay(dateStr: string, lang: Locale): string {
  try {
    const loc = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR'
    const d = new Date(dateStr + 'T12:00:00Z')
    return new Intl.DateTimeFormat(loc, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Africa/Dakar' }).format(d)
  } catch { return dateStr }
}

/** Richesse de données réelles d'un match — sert à choisir la vedette. */
function dataRichness(m: FeedItem): number {
  return (
    (m.predictions?.length ? 8 : 0) +
    (m.xgTotal !== undefined ? 4 : 0) +
    (m.ai_exact_score ? 2 : 0) +
    (m.reliabilityScore !== undefined ? 1 : 0)
  )
}

function plainTitle(text: string) {
  return text.replace(/[\[\]]/g, '')
}

function accentOf(text: string) {
  const m = text.match(/\[(.+?)\]/)
  return m ? m[1] : undefined
}

export default function Hero({ initialLocale }: { initialLocale?: Locale } = {}) {
  const [sectionRef] = useScrollAnimation(0.05)
  const { lang: detectedLang } = useLanguage()
  const lang = initialLocale ?? detectedLang
  const t = translationsFor(lang)

  const [featured, setFeatured] = useState<FeedItem | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/predictions.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(pred => {
        if (cancelled) return
        const raw: FeedItem[] = Array.isArray(pred?.free)
          ? pred.free
          : Array.isArray(pred?.predictions) ? pred.predictions : []
        // Signal en vedette : prochain match à venir avec les données les plus riches
        const upcoming = raw
          .filter(m => !hasDakarKickoffPassed(m.date, m.time))
          .sort((a, b) => dataRichness(b) - dataRichness(a))
        setFeatured(upcoming[0] || null)
        setReady(true)
      })
    return () => { cancelled = true }
  }, [])

  const m = featured
  const diff = m ? dayDiff(m.date) : 999
  const dayLabel = !m
    ? ''
    : diff === 0 ? t.home2.mcToday : diff === 1 ? t.home2.mcTomorrow : formatDay(m.date, lang)

  const picks: MarketPick[] = m
    ? (m.predictions?.length ? m.predictions : m.type ? [{ type: m.type, prediction: m.prediction || '', confidence: m.confidence }] : []).slice(0, 3)
    : []

  const pickWord = (word: string) =>
    word === 'Oui' ? t.predictions.bttsYes : word === 'Non' ? t.predictions.bttsNo : word

  const liveHref = m && m.home && m.away && m.date
    ? localizedPath(`/match/${generateMatchSlug(m.home, m.away, m.date)}`, lang)
    : ''

  const loc = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR'
  const num = (v?: number, digits = 2) =>
    v === undefined ? null : v.toLocaleString(loc, { maximumFractionDigits: digits })

  const pipeline = [
    { n: '01', title: t.home2.met1T },
    { n: '02', title: t.home2.met2T },
    { n: '03', title: t.home2.met3T },
    { n: '04', title: t.home2.met4T },
  ]

  return (
    <section ref={sectionRef} className="hp-hero relative overflow-hidden">
      {/* Ambiance : halos lumineux + grille fine (décoratif) */}
      <div className="hp-hero__glow hp-hero__glow--a" aria-hidden="true" />
      <div className="hp-hero__glow hp-hero__glow--b" aria-hidden="true" />
      <div className="hp-hero__gridbg" aria-hidden="true" />

      <div className="hp-hero__inner relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="hp-hero__grid">
          {/* ═══ Colonne message ═══ */}
          <div className="hp-hero__copy">
            <h1 className="hp-hero__title">
              <AnimatedTitle
                text={plainTitle(t.home2.heroTitle1)}
                accent={accentOf(t.home2.heroTitle1)}
              />
              <AnimatedTitle
                text={plainTitle(t.home2.heroTitle2)}
                accent={accentOf(t.home2.heroTitle2)}
                className="hp-hero__title-line2"
              />
            </h1>

            <p className="hp-hero__text">{t.home2.heroText}</p>

            <div className="hp-hero__cta-zone">
              <MovingGradientButton href="#matchs" dataCta="hero-open-matchs">
                {t.home2.heroCtaPrimary}
                <span className="hp-btn-arrow" aria-hidden="true">→</span>
              </MovingGradientButton>
              <a href={localizedPath('/historique', lang)} data-cta="hero-history" className="hp-btn-ghost">
                {t.home2.heroCtaSecondary}
              </a>
            </div>

            {/* Bandeau défilant — grands clubs suivis (décoratif, logos locaux) */}
            <div className="hp-clubs" aria-hidden="true">
              <div className="hp-clubs__track">
                {[0, 1].map(copy => (
                  <div className="hp-clubs__group" key={copy}>
                    {CLUB_LOGOS.map(slug => (
                      <img
                        key={`${copy}-${slug}`}
                        src={`/logos/clubs/${slug}.png`}
                        alt=""
                        width={500}
                        height={500}
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ Carte « Signal en vedette » — vraies données du flux ═══ */}
          <aside className="hp-live-zone" aria-label={t.home2.heroLiveEyebrow}>
            <div className="hp-live-halo" aria-hidden="true" />
            <article className="hp-live">
              <header className="hp-live__head">
                <p className="hp-live__eyebrow">
                  <span className="hp-live__pulse" aria-hidden="true" />
                  {t.home2.heroLiveEyebrow}
                </p>
                <span className="hp-live__badge">{t.home2.heroLiveBadge}</span>
              </header>

              {!ready ? (
                <div className="hp-live__skeleton" aria-hidden="true" />
              ) : m ? (
                <>
                  <div className="hp-live__meta">
                    <span className="hp-live__league">{m.league}</span>
                    <span className="hp-live__when">
                      <time dateTime={`${m.date}T${m.time || '00:00'}:00Z`}>{m.time}</time>
                      <small>{t.home2.mcTz}</small>
                      <em>{dayLabel}</em>
                    </span>
                  </div>

                  <div className="hp-live__teams">
                    <div className="hp-live__team">
                      {m.homeLogo && <img src={m.homeLogo} alt="" width={30} height={30} loading="lazy" />}
                      <span>{m.home}</span>
                    </div>
                    <div className="hp-live__sep" aria-hidden="true"><i>VS</i></div>
                    <div className="hp-live__team">
                      {m.awayLogo && <img src={m.awayLogo} alt="" width={30} height={30} loading="lazy" />}
                      <span>{m.away}</span>
                    </div>
                  </div>

                  {(picks.length > 0 || m.ai_exact_score) && (
                    <div className="hp-live__markets">
                      {picks.map(p => (
                        <span key={p.type} className={`hp-live__pick${p.type === 'BTTS' ? ' is-btts' : p.type.includes('Over') ? ' is-over' : ''}`}>
                          <b>{p.type}</b>
                          <span>{pickWord(p.prediction)}</span>
                          {p.confidence !== undefined && p.confidence > 0 && p.confidence <= 100 && <i>{p.confidence}%</i>}
                        </span>
                      ))}
                      {m.ai_exact_score && (
                        <span className="hp-live__pick is-exact">
                          <b>{t.home2.mcExact}</b>
                          <span>{m.ai_exact_score}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {(m.xgTotal !== undefined || m.formBTTS !== undefined || m.reliabilityScore !== undefined) && (
                    <div className="hp-live__data">
                      {m.xgHome !== undefined && m.xgAway !== undefined && (
                        <span><i>{t.home2.mcXg}</i> {num(m.xgHome)}/{num(m.xgAway)}</span>
                      )}
                      {m.xgTotal !== undefined && (
                        <span><i>Σ xG</i> {num(m.xgTotal, 1)}</span>
                      )}
                      {m.formBTTS !== undefined && (
                        <span><i>{t.home2.mcForm}</i> {m.formBTTS}%</span>
                      )}
                      {m.reliabilityScore !== undefined && (
                        <span><i>{t.home2.mcReliability}</i> {num(m.reliabilityScore, 1)}%</span>
                      )}
                    </div>
                  )}

                  <footer className="hp-live__foot">
                    <span className="hp-live__pub">
                      <span className="hp-status-dot" aria-hidden="true" />
                      {t.home2.mcPublished}
                    </span>
                    {liveHref && (
                      <a href={liveHref} className="hp-live__open" data-cta="hero-live-open">
                        {t.home2.mcOpen}
                        <span aria-hidden="true">→</span>
                      </a>
                    )}
                  </footer>
                </>
              ) : (
                /* Fallback factuel : pipeline de traitement (aucune donnée inventée) */
                <div className="hp-live__pipeline">
                  <ol>
                    {pipeline.map(s => (
                      <li key={s.n}>
                        <span className="hp-live__step-n" aria-hidden="true">{s.n}</span>
                        <span className="hp-live__step-t">{s.title}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="hp-live__pipeline-note">{t.home2.mcEmptyText}</p>
                </div>
              )}
            </article>
          </aside>
        </div>
      </div>
    </section>
  )
}
