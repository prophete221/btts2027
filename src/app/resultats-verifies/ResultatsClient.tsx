'use client'

/**
 * /resultats-verifies — résultats vérifiés (Vague 2 → V3 motion design).
 * Données réelles de win-history.json uniquement ; chaque taux avec son
 * dénominateur ; sémantique stricte WIN (vert) / LOST (rouge) ; texte ≥ 12px.
 *
 * Motion design (macOS noir) :
 *  - révélation en cascade des cartes et du tableau (IntersectionObserver) ;
 *  - compteurs animés (count-up) sur les taux et totaux réels ;
 *  - barres de performance par marché qui grandissent à l'apparition ;
 *  - badges WIN/LOST avec pop d'apparition + lueur pour les gains ;
 *  - hover de ligne avec liseré vert/rouge selon le résultat ;
 *  - tout est désactivé sous prefers-reduced-motion.
 */

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/components/bttsbet/LanguageSwitcher'
import { fmtPct } from '@/components/bttsbet/SimpleCharts'
import { useCountUp } from '@/hooks/useAnimations'

type ResultHistoryEntry = {
  date: string
  match: string
  type?: string
  market?: string
  status?: string
  isWon?: boolean
  tier?: string
  proba?: number
  finalScore?: string
  score?: string
}

type Copy = {
  loading: string
  verified: string
  allRate: string
  goldPicks: string
  verifiedCount: string
  premiumSelection: string
  last30: string
  lastScan: string
  detailed: string
  date: string
  match: string
  market: string
  proba: string
  score: string
  result: string
  empty: string
  marketBreakdown: string
  sample: string
  noMarketData: string
  btts: string
  over: string
  won: string
  lost: string
  source: string
  published: string
  scopeOf: string
}

const COPIES: Record<'fr' | 'en' | 'ar', Copy> = {
  fr: {
    loading: 'Chargement…', verified: 'Vérifiés', allRate: 'Taux global', goldPicks: 'Sélections Gold', verifiedCount: 'vérifiés', premiumSelection: 'Sélection premium', last30: '30 derniers jours', lastScan: 'Dernière vérification', detailed: 'Tableau détaillé (100 derniers)', date: 'Date', match: 'Match', market: 'Marché', proba: 'Proba modèle', score: 'Score', result: 'Résultat', empty: 'Aucun résultat vérifié.', marketBreakdown: 'Performance par marché', sample: 'vérifiés', noMarketData: 'Pas encore de données suffisantes par marché.', btts: 'BTTS', over: 'Over 2.5', won: 'WIN', lost: 'LOST', source: 'Source : ESPN', published: 'publiés', scopeOf: 'sur',
  },
  en: {
    loading: 'Loading…', verified: 'Verified', allRate: 'Overall rate', goldPicks: 'Gold picks', verifiedCount: 'verified', premiumSelection: 'Premium selection', last30: 'Last 30 days', lastScan: 'Last verification', detailed: 'Detailed table (last 100)', date: 'Date', match: 'Match', market: 'Market', proba: 'Model proba', score: 'Score', result: 'Result', empty: 'No verified result.', marketBreakdown: 'Performance by market', sample: 'verified', noMarketData: 'Not enough market-level data yet.', btts: 'BTTS', over: 'Over 2.5', won: 'WIN', lost: 'LOST', source: 'Source: ESPN', published: 'published', scopeOf: 'out of',
  },
  ar: {
    loading: 'جار التحميل…', verified: 'موثق', allRate: 'المعدل العام', goldPicks: 'اختيارات Gold', verifiedCount: 'موثق', premiumSelection: 'اختيار مميز', last30: 'آخر 30 يوماً', lastScan: 'آخر تحقق', detailed: 'الجدول التفصيلي (آخر 100)', date: 'التاريخ', match: 'المباراة', market: 'السوق', proba: 'احتمال النموذج', score: 'النتيجة', result: 'الحالة', empty: 'لا توجد نتائج موثقة.', marketBreakdown: 'الأداء حسب السوق', sample: 'موثق', noMarketData: 'لا توجد بيانات كافية حسب السوق بعد.', btts: 'BTTS', over: 'أكثر من 2.5', won: 'فوز', lost: 'خسارة', source: 'المصدر: ESPN', published: 'منشور', scopeOf: 'من أصل',
  },
}

/** Révélation à l'entrée dans le viewport (une fois) — scopes compacts. */
function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Révélation différée d'un frame (évite un setState synchrone dans
    // l'effet — cascade de rendus — tout en restant quasi immédiate).
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    // Déjà dans le viewport au montage → révéler immédiatement (sinon un
    // conteneur plus grand que l'écran n'atteindrait jamais le seuil).
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, visible]
}

/** Carte KPI glass avec compteur animé. */
function KpiCard({
  eyebrow,
  value,
  decimals = 0,
  suffix,
  subValue,
  footnote,
  tone = 'default',
  delay,
  visible,
  lang,
}: {
  eyebrow: string
  value: string
  decimals?: number
  suffix?: string
  subValue: string
  footnote: string
  tone?: 'default' | 'gold'
  delay: number
  visible: boolean
  lang: 'fr' | 'en' | 'ar'
}) {
  const numeric = parseFloat(value.replace(',', '.'))
  const canCount = Number.isFinite(numeric)
  const [ref, display] = useCountUp(canCount ? numeric : 0, 1500, { decimals })
  const shown = lang === 'fr' ? display.replace('.', ',') : display
  return (
    <div
      ref={canCount ? (ref as React.RefObject<HTMLDivElement>) : undefined}
      className={`rv-card${tone === 'gold' ? ' rv-card--gold' : ''}${visible ? ' is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="rv-card__eyebrow">{eyebrow}</div>
      <div className="rv-card__row">
        <div className="rv-card__value">
          {canCount ? shown : value}
          {suffix}
        </div>
        <div className="rv-card__subvalue">{subValue}</div>
      </div>
      <div className="rv-card__footnote">{footnote}</div>
    </div>
  )
}

export default function ResultatsClient({ initialData }: { initialData?: any }) {
  const { lang } = useLanguage()
  const copy = COPIES[lang]
  const [data, setData] = useState<any>(initialData || null)
  // Trois scopes indépendants : les seuils IO restent atteignables même si
  // le tableau fait plusieurs écrans de haut.
  const [kpiRef, kpiVisible] = useReveal<HTMLDivElement>()
  const [marketRef, marketVisible] = useReveal<HTMLElement>()
  const [tableRef, tableVisible] = useReveal<HTMLDivElement>()

  useEffect(() => {
    if (data) return
    fetch('/win-history.json').then(r => r.json()).then(d => setData(d)).catch(() => {})
  }, [data])

  if (!data || !data.stats) return <div className="text-center py-8 text-sm text-[#9DABBB]">{copy.loading}</div>

  const stats = data.stats
  const history: ResultHistoryEntry[] = data.history || []
  const won = stats.won || 0
  const lost = stats.lost || 0
  const total = won + lost
  const goldRate = stats.gold?.rate || 0
  const goldTotal = stats.gold?.total || 0
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  let w30 = 0, l30 = 0
  for (const h of history) {
    const d = new Date(h.date).getTime()
    if (d >= thirtyDaysAgo) {
      if (h.status === 'WON' || h.isWon === true) w30++
      else if (h.status === 'LOST' || h.isWon === false) l30++
    }
  }
  const rate30 = (w30 + l30) > 0 ? ((w30 / (w30 + l30)) * 100).toFixed(1) : null
  // (2026-09-28) Yield/ROI retirés : ils dépendaient d'une cote fictive 1,90.
  // Aucun chiffre financier ne sera affiché tant que des cotes réelles ne sont pas collectées.

  const seen = new Set<string>()
  const dedupedHistory: ResultHistoryEntry[] = []
  for (const h of history) {
    const key = `${h.date}-${h.match}-${h.type || h.market || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    dedupedHistory.push(h)
  }

  function getMarket(h: ResultHistoryEntry): string {
    const t = (h.type || h.market || '').toUpperCase()
    if (t.includes('BTTS')) return copy.btts
    if (t.includes('OVER')) return copy.over
    return t || '-'
  }

  const marketStats = [
    { label: copy.btts, rows: history.filter(h => (h.type || h.market || '').toUpperCase().includes('BTTS')) },
    { label: copy.over, rows: history.filter(h => (h.type || h.market || '').toUpperCase().includes('OVER')) },
  ].map(item => {
    const wins = item.rows.filter(h => h.status === 'WON' || h.isWon === true).length
    const losses = item.rows.filter(h => h.status === 'LOST' || h.isWon === false).length
    const count = wins + losses
    return { ...item, wins, losses, count, rate: count ? +((wins / count) * 100).toFixed(1) : null }
  })

  const generatedAt = data.generatedAt ? new Date(data.generatedAt) : null
  const scanLabel = generatedAt && !Number.isNaN(generatedAt.getTime())
    ? `${copy.lastScan}: ${generatedAt.toLocaleString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · ${copy.source}`
    : `${copy.lastScan} · ${copy.source}`
  const published = stats.archivedTotal || 0
  // V8.2 : « en attente » (futurs/récents) et « non vérifiables » (passés > 48 h)
  // sont deux compteurs distincts — ne jamais fusionner ni présenter les non
  // vérifiables comme futurs ou en attente de vérification.
  const pendingN = stats.pending || 0
  const unverifiableN = stats.unverifiable || 0
  const trackingFrom = data.trackingPeriod?.startDate || null

  return (
    <div>
      {/* Périmètre explicite */}
      <p className={`rv-scope${kpiVisible ? ' is-visible' : ''}`}>
        {total} {copy.verified} {copy.scopeOf} {published} {copy.published}
        {trackingFrom && (lang === 'fr' ? ` depuis le ${trackingFrom} (suivi public)` : lang === 'en' ? ` since ${trackingFrom} (public tracking)` : ` منذ ${trackingFrom}`)}
        {pendingN > 0 && ` · ${pendingN} ${lang === 'fr' ? 'en attente de vérification' : lang === 'en' ? 'pending verification' : 'قيد التحقق'}`}
        {unverifiableN > 0 && ` · ${unverifiableN} ${lang === 'fr' ? 'non vérifiables (passés de plus de 48 h sans score vérifiable)' : lang === 'en' ? 'unverifiable (past more than 48 h without a verifiable score)' : 'غير قابلة للتوثق (تجاوزت 48 ساعة بدون نتيجة قابلة للتحقق)'}`}
      </p>

      <div className="rv-grid" ref={kpiRef as React.RefObject<HTMLDivElement>}>
        <KpiCard
          eyebrow={copy.verified}
          value={String(total)}
          suffix=""
          subValue={`${won} WIN / ${lost} LOST`}
          footnote={`${copy.allRate}: ${fmtPct(stats.rate?.toFixed(1), lang)} %`}
          delay={0}
          visible={kpiVisible}
          lang={lang}
        />
        <KpiCard
          eyebrow={copy.goldPicks}
          value={goldRate ? goldRate.toFixed(1) : '0.0'}
          decimals={1}
          suffix=" %"
          subValue={`${goldTotal} ${copy.verifiedCount}`}
          footnote={`${copy.premiumSelection} · ${stats.gold?.won || 0} WIN / ${stats.gold?.lost || 0} LOST`}
          tone="gold"
          delay={90}
          visible={kpiVisible}
          lang={lang}
        />
        <KpiCard
          eyebrow={copy.last30}
          value={rate30 !== null ? rate30 : '—'}
          decimals={rate30 !== null ? 1 : 0}
          suffix={rate30 !== null ? ' %' : ''}
          subValue={`${w30} WIN / ${l30} LOST`}
          footnote={scanLabel}
          delay={180}
          visible={kpiVisible}
          lang={lang}
        />
      </div>

      <section
        className={`rv-section${marketVisible ? ' is-visible' : ''}`}
        aria-labelledby="market-breakdown-title"
        style={{ transitionDelay: '120ms' }}
        ref={marketRef as React.RefObject<HTMLElement>}
      >
        <h2 id="market-breakdown-title" className="rv-section__title">{copy.marketBreakdown}</h2>
        <div className="rv-grid rv-grid--markets">
          {marketStats.map((item, mi) => (
            <div key={item.label} className="rv-market">
              <div className="rv-market__head">
                <div className="rv-market__label">{item.label}</div>
                <div className="rv-market__rate">{item.rate !== null ? `${fmtPct(item.rate.toFixed(1), lang)} %` : '—'}</div>
              </div>
              {/* Barre motion : grandit de 0 → rate% à l'apparition */}
              <div className="rv-market__track" aria-hidden="true">
                <div
                  className={`rv-market__bar${item.rate !== null && item.rate < 50 ? ' rv-market__bar--weak' : ''}${marketVisible ? ' is-visible' : ''}`}
                  style={{ width: marketVisible && item.rate !== null ? `${Math.max(2, item.rate)}%` : '0%', transitionDelay: `${200 + mi * 160}ms` }}
                />
                <div
                  className="rv-market__bar-ghost"
                  style={{ width: item.rate !== null ? `${Math.max(2, item.rate)}%` : '0%', transitionDelay: `${200 + mi * 160}ms` }}
                  aria-hidden="true"
                />
              </div>
              <div className="rv-market__meta">
                {item.wins} WIN · {item.losses} LOST · {item.count} {copy.sample}
                {item.count > 0 && item.count < 30 && (
                  <span className="rv-sample-flag">
                    {lang === 'fr' ? 'échantillon faible' : lang === 'en' ? 'small sample' : 'عينة صغيرة'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {marketStats.every(item => item.count === 0) && <p className="rv-empty-note">{copy.noMarketData}</p>}
      </section>

      <div
        className={`rv-section${tableVisible ? ' is-visible' : ''}`}
        style={{ transitionDelay: '80ms' }}
        ref={tableRef as React.RefObject<HTMLDivElement>}
      >
        <h2 className="rv-section__title">{copy.detailed}</h2>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead>
              <tr>
                <th className="text-left">{copy.date}</th>
                <th className="text-left">{copy.match}</th>
                <th className="text-left">{copy.market}</th>
                <th className="rv-th-center">{copy.proba}</th>
                <th className="rv-th-center">{copy.score}</th>
                <th className="rv-th-center">{copy.result}</th>
              </tr>
            </thead>
            <tbody>
              {dedupedHistory.length === 0 ? (
                <tr><td colSpan={6} className="rv-empty-cell">{copy.empty}</td></tr>
              ) : dedupedHistory.slice(0, 100).map((h, i) => {
                const isWon = h.status === 'WON' || h.isWon === true
                const isGold = (h.tier || 'STANDARD').toUpperCase() === 'GOLD'
                const probaPct = typeof h.proba === 'number' && h.proba > 0 ? `${fmtPct((h.proba * 100).toFixed(0), lang)}%` : '—'
                // Cascade : 22 premières lignes échelonnées, les suivantes apparaissent avec la fin de la vague
                const rowDelay = Math.min(i, 22) * 34
                return (
                  <tr
                    key={i}
                    className={`rv-row rv-row--${isWon ? 'win' : 'loss'}${tableVisible ? ' is-visible' : ''}`}
                    style={{ transitionDelay: `${rowDelay}ms` }}
                  >
                    <td className="rv-cell rv-cell--date">{(h.date || '').slice(5)}</td>
                    <td className="rv-cell rv-cell--match">{(h.match || '').substring(0, 35)}</td>
                    <td className="rv-cell rv-cell--market">
                      {getMarket(h)}
                      {isGold && <span className="rv-gold-flag">GOLD</span>}
                    </td>
                    <td className="rv-cell rv-cell--proba">{probaPct}</td>
                    <td className="rv-cell rv-cell--score">{h.finalScore || h.score || '-'}</td>
                    <td className="rv-cell rv-cell--result">
                      <span className={`rv-badge rv-badge--${isWon ? 'win' : 'loss'}${tableVisible ? ' is-visible' : ''}`} style={{ transitionDelay: `${60 + rowDelay}ms` }}>
                        <span className="rv-badge__dot" aria-hidden="true" />
                        {isWon ? 'WIN' : 'LOST'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
