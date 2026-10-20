'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from './LanguageSwitcher'
import { translationsFor, type Locale, localizedPath } from '@/lib/i18n'
import { generateMatchSlug } from '@/lib/match-slug'

// useLayoutEffect isomorphe (évite le warning SSR React)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * MatchCenter — section « Matchs analysés aujourd’hui » (accueil).
 *
 * 100% données réelles :
 *  - predictions.json  → matchs du jour/demain/semaine (free uniquement)
 *  - win-history.json   → jointure sur matchs terminés (score final, gagné/perdu)
 *
 * Filtres : marché (BTTS / Over 2,5 / Score exact), statut (À venir / Terminés),
 * onglets de date (Aujourd’hui / Demain / Cette semaine) + compteur factuel.
 * Aucun badge « sûr »/« immanquable » ; les pronostics perdants ne sont jamais cachés.
 * Squelettes de chargement, état vide professionnel, colonnes empilées <768px.
 */

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
  exact_score_prob?: string
  odds?: { provider?: string; home?: number | null; draw?: number | null; away?: number | null; over25?: number | null; under25?: number | null } | null
  predictions?: MarketPick[]
  type?: string
  prediction?: string
  bttsProb?: number
  over25Prob?: number
}

interface HistoryRecord {
  date: string
  match: string
  market: string
  status: string
  finalScore?: string
}

type MarketFilter = 'all' | 'btts' | 'o25' | 'exact'
type StatusFilter = 'all' | 'upcoming' | 'finished'
type DayFilter = 'all' | 'today' | 'tomorrow' | 'week'

function dayDiff(dateStr: string): number {
  try {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    const d = new Date(dateStr + 'T00:00:00Z')
    return Math.round((d.getTime() - today.getTime()) / 86400000)
  } catch { return 999 }
}

function formatCardDate(dateStr: string, lang: Locale): string {
  try {
    const loc = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR'
    const d = new Date(dateStr + 'T12:00:00Z')
    return new Intl.DateTimeFormat(loc, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d)
  } catch { return dateStr }
}

const hasBtts = (m: FeedItem) =>
  (m.predictions?.some(p => p.type === 'BTTS') ?? false) || m.type === 'BTTS' || m.bttsProb !== undefined
const hasO25 = (m: FeedItem) =>
  (m.predictions?.some(p => p.type?.includes('Over')) ?? false) || Boolean(m.type?.includes('Over')) || m.over25Prob !== undefined
const hasExact = (m: FeedItem) => Boolean(m.ai_exact_score)

export default function MatchCenter({ initialLocale }: { initialLocale?: Locale } = {}) {
  const { lang: detectedLang } = useLanguage()
  const lang = initialLocale ?? detectedLang
  const t = translationsFor(lang)

  const [items, setItems] = useState<FeedItem[]>([])
  const [results, setResults] = useState<Map<string, HistoryRecord>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dataDate, setDataDate] = useState('')
  const [market, setMarket] = useState<MarketFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [day, setDay] = useState<DayFilter>('week')
  const [league, setLeague] = useState<string>('all')
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/predictions.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/win-history.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([pred, hist]) => {
      if (cancelled) return
      const raw: FeedItem[] = pred?.free || pred?.predictions || []
      setItems(Array.isArray(raw) ? raw : [])
      if (pred?.lastUpdated) setDataDate(String(pred.lastUpdated).slice(0, 10))
      const map = new Map<string, HistoryRecord>()
      const recs: HistoryRecord[] = hist?.history || []
      for (const rec of recs) map.set(`${rec.match}|${rec.date}`, rec)
      setResults(map)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Compétitions → filtre ligue (depuis la section Couverture)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (typeof detail === 'string') {
        setLeague(detail)
        setDay('all')
        setStatus('all')
      }
    }
    window.addEventListener('bttspredict:league', handler)
    return () => window.removeEventListener('bttspredict:league', handler)
  }, [])

  const filtered = useMemo(() => {
    return items.filter(m => {
      const diff = dayDiff(m.date)
      if (day === 'today' && diff !== 0) return false
      if (day === 'tomorrow' && diff !== 1) return false
      if (day === 'week' && (diff < 0 || diff > 7)) return false
      const isFinished = diff < 0
      if (status === 'upcoming' && isFinished) return false
      if (status === 'finished' && !isFinished) return false
      if (market === 'btts' && !hasBtts(m)) return false
      if (market === 'o25' && !hasO25(m)) return false
      if (market === 'exact' && !hasExact(m)) return false
      if (league !== 'all' && m.league !== league) return false
      return true
    }).sort((a, b) => {
      const da = dayDiff(a.date), db = dayDiff(b.date)
      const fa = da < 0, fb = db < 0
      if (fa !== fb) return fa ? 1 : -1 // à venir d’abord, terminés ensuite
      if (da !== db) return da - db
      return (a.time || '').localeCompare(b.time || '')
    })
  }, [items, market, status, day, league])

  const leagues = useMemo(() => {
    const set = new Set<string>()
    items.forEach(m => m.league && set.add(m.league))
    return Array.from(set).sort()
  }, [items])

  // ═══ Révélation 3D au scroll ═══
  // Gate JS (.mc3d) : sans JS les cartes restent visibles (progressive enhancement).
  // Chaque carte entre en scène (opacity + rotateX + translateY, stagger via --d)
  // quand elle entre dans le viewport, puis le délai de transition est retiré
  // pour que le hover 3D reste instantané.
  useIsoLayoutEffect(() => {
    if (loading) return
    const grid = gridRef.current
    if (!grid) return
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('.hp-mc-card'))
    if (cards.length === 0) return

    let reduced = false
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* no-op */
    }
    if (reduced || typeof IntersectionObserver === 'undefined') {
      cards.forEach(c => c.classList.add('is-revealed'))
      return
    }

    grid.classList.add('mc3d')
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.style.transitionDelay = el.style.getPropertyValue('--d') || '0ms'
          el.classList.add('is-revealed')
          io.unobserve(el)
          const done = (e: TransitionEvent) => {
            if (e.propertyName !== 'transform') return
            el.style.transitionDelay = ''
            el.removeEventListener('transitionend', done)
          }
          el.addEventListener('transitionend', done)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    )
    cards.forEach(c => {
      if (!c.classList.contains('is-revealed')) io.observe(c)
    })
    return () => io.disconnect()
  }, [loading, filtered])

  const dayTabs: { id: DayFilter; label: string }[] = [
    { id: 'today', label: t.home2.mcToday },
    { id: 'tomorrow', label: t.home2.mcTomorrow },
    { id: 'week', label: t.home2.mcWeek },
  ]
  const marketTabs: { id: MarketFilter; label: string }[] = [
    { id: 'all', label: t.home2.mcAllMarkets },
    { id: 'btts', label: t.home2.mcBtts },
    { id: 'o25', label: t.home2.mcO25 },
    { id: 'exact', label: t.home2.mcExact },
  ]
  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: t.home2.mcAll },
    { id: 'upcoming', label: t.home2.mcUpcoming },
    { id: 'finished', label: t.home2.mcFinished },
  ]

  return (
    <section id="matchs" className="hp-section" style={{ scrollMarginTop: '72px' }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* En-tête de section */}
        <div className="hp-sect-head">
          <div>
            <p className="hp-eyebrow">{t.home2.mcEyebrow}</p>
            <h2 className="hp-sect-title">{t.home2.mcTitle}</h2>
            <p className="hp-sect-sub">{t.home2.mcSubtitle}</p>
          </div>
          <div className="hp-sect-meta">
            <span className="hp-counter" role="status">
              <strong>{loading ? '…' : filtered.length}</strong> {t.home2.mcCountSuffix}
            </span>
            {dataDate && (
              <span className="hp-data-date">{t.home2.mcUpdated} {dataDate}</span>
            )}
          </div>
        </div>

        {/* Filtres — chips scrollables, compactes */}
        <div className="hp-filters" role="group" aria-label={t.home2.mcTitle}>
          <div className="hp-filter-row">
            <div className="hp-chips" role="tablist" aria-label={t.home2.mcSignal}>
              {marketTabs.map(f => (
                <button
                  key={f.id}
                  onClick={() => setMarket(f.id)}
                  aria-pressed={market === f.id}
                  className={`hp-chip${market === f.id ? ' is-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="hp-chips" role="tablist">
              {statusTabs.map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatus(f.id)}
                  aria-pressed={status === f.id}
                  className={`hp-chip hp-chip--ghost${status === f.id ? ' is-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="hp-chips" role="tablist">
              {dayTabs.map(f => (
                <button
                  key={f.id}
                  onClick={() => setDay(f.id)}
                  aria-pressed={day === f.id}
                  className={`hp-chip hp-chip--ghost${day === f.id ? ' is-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {leagues.length > 1 && (
            <div className="hp-filter-row">
              <div className="hp-chips">
                <button
                  onClick={() => setLeague('all')}
                  aria-pressed={league === 'all'}
                  className={`hp-chip hp-chip--ghost${league === 'all' ? ' is-active' : ''}`}
                >
                  {t.home2.mcAllLeagues}
                </button>
                {leagues.map(l => (
                  <button
                    key={l}
                    onClick={() => setLeague(l)}
                    aria-pressed={league === l}
                    className={`hp-chip hp-chip--ghost${league === l ? ' is-active' : ''}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="hp-mc-grid" aria-hidden="true" ref={loading ? gridRef : undefined}>
            {[1, 2, 3, 4].map(i => <div key={i} className="hp-mc-card hp-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="hp-empty">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <p className="hp-empty__title">{t.home2.mcEmptyTitle}</p>
            <p className="hp-empty__text">{t.home2.mcEmptyText}</p>
            <a href={localizedPath('/historique', lang)} className="hp-btn-ghost hp-btn-ghost--sm" data-cta="mc-empty-archives">
              {t.home2.mcEmptyCta}
            </a>
          </div>
        ) : (
          <div className="hp-mc-grid" ref={filtered.length > 0 ? gridRef : undefined}>
            {filtered.map((m, i) => (
              <MatchCard key={`${m.match}-${m.date}-${m.time}`} m={m} index={i} lang={lang} results={results} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ═══ Carte de match ═══ */
function MatchCard({ m, index, lang, results }: {
  m: FeedItem
  index: number
  lang: Locale
  results: Map<string, HistoryRecord>
}) {
  const t = translationsFor(lang)
  const cardRef = useRef<HTMLElement | null>(null)
  const tiltRaf = useRef(0)
  const tiltPointer = useRef({ x: 0, y: 0 })
  const tiltCapable = useRef<boolean | null>(null)
  const diff = dayDiff(m.date)
  const isFinished = diff < 0
  const record = results.get(`${m.match}|${m.date}`)
  const hasResult = isFinished && record?.finalScore
  const won = record?.status === 'WON'
  const lost = record?.status === 'LOST'

  const picks: MarketPick[] = (m.predictions?.length
    ? m.predictions
    : m.type ? [{ type: m.type, prediction: m.prediction || '', confidence: m.confidence }] : []
  ).slice(0, 3)

  const matchHref = m.home && m.away && m.date
    ? localizedPath(`/match/${generateMatchSlug(m.home, m.away, m.date)}`, lang)
    : ''

  const loc = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR'
  const num = (v?: number, digits = 2) =>
    v === undefined ? null : v.toLocaleString(loc, { maximumFractionDigits: digits })

  // ═══ Tilt 3D « motion designer » — la carte pivote doucement sous le curseur ═══
  // Desktop uniquement (hover:hover + pointer:fine), rAF-throttlé, aucune
  // re-render React : écriture directe de variables CSS (--rx/--ry/--mx/--my).
  const tiltEnabled = () => {
    if (tiltCapable.current === null) {
      try {
        tiltCapable.current =
          typeof window !== 'undefined' &&
          window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      } catch {
        tiltCapable.current = false
      }
    }
    return tiltCapable.current
  }

  const applyTilt = () => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (tiltPointer.current.x - rect.left) / rect.width - 0.5
    const py = (tiltPointer.current.y - rect.top) / rect.height - 0.5
    el.style.setProperty('--ry', `${(px * 9).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`)
  }

  const onCardMove = (e: React.MouseEvent) => {
    if (!tiltEnabled()) return
    tiltPointer.current = { x: e.clientX, y: e.clientY }
    if (tiltRaf.current) return
    tiltRaf.current = requestAnimationFrame(() => {
      tiltRaf.current = 0
      applyTilt()
    })
  }

  const onCardLeave = () => {
    if (tiltRaf.current) {
      cancelAnimationFrame(tiltRaf.current)
      tiltRaf.current = 0
    }
    const el = cardRef.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  useEffect(() => () => {
    if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current)
  }, [])

  return (
    <article
      ref={cardRef}
      className="hp-mc-card"
      onMouseMove={onCardMove}
      onMouseLeave={onCardLeave}
      style={{ ['--d' as string]: `${Math.min(index, 6) * 40}ms` }}
    >
      {/* Ligne 1 : compétition + horodatage */}
      <div className="hp-mc-top">
        <span className="hp-mc-league">{m.league}</span>
        {isFinished ? (
          <span className="hp-mc-when is-finished">{formatCardDate(m.date, lang)}</span>
        ) : (
          <span className="hp-mc-when">
            <time dateTime={`${m.date}T${m.time || '00:00'}:00Z`}>{m.time}</time>
            <small>{t.home2.mcTz}</small>
            {diff === 1 && <em>{t.home2.mcTomorrow}</em>}
            {diff > 1 && <em>{formatCardDate(m.date, lang)}</em>}
          </span>
        )}
      </div>

      {/* Ligne 2 : équipes */}
      <div className="hp-mc-teams">
        <div className="hp-mc-team">
          {m.homeLogo && <img src={m.homeLogo} alt="" width={22} height={22} loading="lazy" />}
          <span>{m.home}</span>
        </div>
        <span className="hp-mc-vs" aria-hidden="true">—</span>
        <div className="hp-mc-team">
          {m.awayLogo && <img src={m.awayLogo} alt="" width={22} height={22} loading="lazy" />}
          <span>{m.away}</span>
        </div>
      </div>

      {/* Résultat — matchs terminés (jamais caché) */}
      {isFinished && (
        <div className={`hp-mc-result${won ? ' is-won' : ''}${lost ? ' is-lost' : ''}`}>
          {hasResult ? (
            <>
              <span className="hp-mc-result__score">{record?.finalScore}</span>
              <span className="hp-mc-result__badge">{won ? t.home2.mcWon : lost ? t.home2.mcLost : ''}</span>
              <span className="hp-mc-result__label">{t.home2.mcFinalScore}</span>
            </>
          ) : (
            <span className="hp-mc-result__label">{t.home2.mcVerifying}</span>
          )}
        </div>
      )}

      {/* Ligne 3 : marchés du modèle */}
      {(picks.length > 0 || m.ai_exact_score) && (
        <div className="hp-mc-picks">
          {picks.map(p => (
            <span key={p.type} className={`hp-pick${p.type === 'BTTS' ? ' is-btts' : ''}`}>
              <b>{p.type}</b>
              <span>{p.prediction}</span>
              {p.confidence !== undefined && <i>{p.confidence}%</i>}
            </span>
          ))}
          {m.ai_exact_score && (
            <span className="hp-pick is-exact">
              <b>{t.home2.mcExact}</b>
              <span>{m.ai_exact_score}</span>
              {m.exact_score_prob && <i>{m.exact_score_prob}</i>}
            </span>
          )}
        </div>
      )}

      {/* Ligne 3bis : cotes réelles du marché (gratuit — ESPN/bookmaker) */}
      {m.odds && (m.odds.home || m.odds.away) && (
        <div className="hp-mc-data" title={m.odds.provider ? `Cotes ${m.odds.provider}` : 'Cotes marché'}>
          {m.odds.home !== null && m.odds.home !== undefined && <span><i>1</i> {m.odds.home}</span>}
          {m.odds.draw !== null && m.odds.draw !== undefined && <span><i>N</i> {m.odds.draw}</span>}
          {m.odds.away !== null && m.odds.away !== undefined && <span><i>2</i> {m.odds.away}</span>}
          {m.odds.over25 !== null && m.odds.over25 !== undefined && <span><i>O2.5</i> {m.odds.over25}</span>}
        </div>
      )}

      {/* Ligne 4 : synthèse données réelles */}
      {(m.xgTotal !== undefined || m.formBTTS !== undefined || m.reliabilityScore !== undefined) && (
        <div className="hp-mc-data">
          {m.xgHome !== undefined && m.xgAway !== undefined && (
            <span title="xG domicile / extérieur"><i>{t.home2.mcXg}</i> {num(m.xgHome)}/{num(m.xgAway)}</span>
          )}
          {m.xgTotal !== undefined && <span title="xG total"><i>Σ</i> {num(m.xgTotal, 1)}</span>}
          {m.formBTTS !== undefined && <span title={t.home2.mcForm}><i>{t.home2.mcForm}</i> {m.formBTTS}%</span>}
          {m.reliabilityScore !== undefined && (
            <span title={t.home2.mcReliability}><i>{t.home2.mcReliability}</i> {num(m.reliabilityScore, 1)}%</span>
          )}
        </div>
      )}

      {/* Ligne 5 : publication + analyse */}
      <div className="hp-mc-foot">
        <span className="hp-mc-pub">
          <span className="hp-status-dot" aria-hidden="true" />
          {t.home2.mcPublished}
        </span>
        {matchHref && (
          <a href={matchHref} className="hp-mc-open" data-cta={`mc-open-${index}`}>
            {t.home2.mcOpen}
            <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </article>
  )
}
