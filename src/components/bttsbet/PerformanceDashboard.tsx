'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from './LanguageSwitcher'
import { translationsFor, type Locale, localizedPath } from '@/lib/i18n'

/**
 * PerformanceDashboard — « Des résultats consultables, pas des promesses. »
 *
 * 100% win-history.json (aucune stat inventée) :
 *  - history[] : enregistrements horodatés {date, market, status WON/LOST, finalScore}
 *    → périodes 7j / 30j / suivi public / total calculées côté client
 *  - stats.pending : compteur interne (resté dans win-history.json pour audit,
 *    volontairement NON affiché publiquement — seuls WON/LOST sont montrés)
 *  - stats.byType : répartition BTTS / Over 2,5 (le score exact n’a pas encore
 *    d’archive vérifiée → affiché « suivi en cours de constitution », jamais chiffré)
 *  - stats.trend14 : courbe hebdomadaire minimale (barres SVG, données réelles)
 *
 * Avertissement permanent affiché. Si aucune donnée → message honnête.
 */

interface TypeStat { total: number; won: number; lost: number; rate: number }
interface WinHistory {
  stats?: {
    total?: number
    won?: number
    lost?: number
    rate?: number
    pending?: number
    byType?: { btts?: TypeStat; over25?: TypeStat }
    trend14?: { date: string; total: number; won: number; lost: number; rate: number }[]
  }
  history?: { date: string; status: string; market: string }[]
  trackingPeriod?: { from?: string; startDate?: string; days?: number }
}

type Period = '7d' | '30d' | 'season' | 'total'

function periodStats(hist: WinHistory, period: Period) {
  const records = hist.history || []
  const seasonStart = hist.trackingPeriod?.from ?? hist.trackingPeriod?.startDate
  const now = new Date(); now.setUTCHours(0, 0, 0, 0)
  const minDiff = period === '7d' ? -7 : period === '30d' ? -30 : -99999
  let won = 0, lost = 0
  for (const r of records) {
    try {
      const d = new Date(r.date + 'T00:00:00Z')
      const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
      if (period === 'season') {
        if (seasonStart && r.date < seasonStart) continue
      } else if (diff < minDiff) continue
      if (r.status === 'WON') won++
      else if (r.status === 'LOST') lost++
    } catch { /* enregistrement ignoré */ }
  }
  const finished = won + lost
  return { finished, won, lost, rate: finished ? Math.round((won / finished) * 1000) / 10 : undefined }
}

export default function PerformanceDashboard({ initialLocale }: { initialLocale?: Locale } = {}) {
  const { lang: detectedLang } = useLanguage()
  const lang = initialLocale ?? detectedLang
  const t = translationsFor(lang)
  const loc = lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR'
  const [hist, setHist] = useState<WinHistory | null>(null)
  const [period, setPeriod] = useState<Period>('season')

  useEffect(() => {
    let cancelled = false
    fetch('/win-history.json')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setHist(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const periods: { id: Period; label: string }[] = [
    { id: '7d', label: t.home2.perfP7 },
    { id: '30d', label: t.home2.perfP30 },
    { id: 'season', label: t.home2.perfPSeason },
    { id: 'total', label: t.home2.perfPTotal },
  ]

  const cur = useMemo(() => (hist ? periodStats(hist, period) : null), [hist, period])
  const global = hist?.stats
  const byType = [
    { key: 'btts', label: t.home2.perfMktBtts, stat: global?.byType?.btts },
    { key: 'over25', label: t.home2.perfMktO25, stat: global?.byType?.over25 },
  ]
  const trend = global?.trend14 || []
  const trendMax = Math.max(...trend.map(p => p.rate), 100)

  const num = (v: number) => v.toLocaleString(loc)

  return (
    <section id="performance" className="hp-section" style={{ scrollMarginTop: '72px' }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="hp-sect-head">
          <div>
            <h2 className="hp-sect-title">{t.home2.perfTitle}</h2>
            <p className="hp-sect-sub">{t.home2.perfSubtitle}</p>
          </div>
          {/* Sélecteur de période */}
          <div className="hp-chips" role="tablist" aria-label={t.home2.perfSubtitle}>
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`hp-chip${period === p.id ? ' is-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!hist || !cur ? (
          <div className="hp-empty">
            <p className="hp-empty__title">{t.home2.perfBuilding}</p>
            <p className="hp-empty__text">{t.home2.mcEmptyText}</p>
          </div>
        ) : (
          <div className="hp-perf">
            {/* Métriques de la période */}
            <div className="hp-perf__grid">
              <div className="hp-kpi">
                <span className="hp-kpi__value">{num(cur.finished)}</span>
                <span className="hp-kpi__label">{t.home2.perfFinished}</span>
              </div>
              <div className="hp-kpi is-won">
                <span className="hp-kpi__value">{num(cur.won)}</span>
                <span className="hp-kpi__label">{t.home2.perfWon}</span>
              </div>
              <div className="hp-kpi is-loss">
                <span className="hp-kpi__value">{num(cur.lost)}</span>
                <span className="hp-kpi__label">{t.home2.perfLost}</span>
              </div>
              <div className="hp-kpi is-rate">
                <span className="hp-kpi__value">
                  {cur.rate !== undefined ? `${cur.rate.toLocaleString(loc, { minimumFractionDigits: 1 })}%` : '—'}
                </span>
                <span className="hp-kpi__label">{t.home2.perfRate}</span>
              </div>
            </div>

            {cur.finished === 0 && <p className="hp-perf__insufficient">{t.home2.perfInsufficient}</p>}

            <div className="hp-perf__row">
              {/* Courbe hebdomadaire — trend14 réel */}
              {trend.length > 1 && (
                <div className="hp-perf__panel">
                  <p className="hp-perf__panel-title">{t.home2.perfCurve}</p>
                  <div className="hp-trend" role="img" aria-label={t.home2.perfCurve}>
                    {trend.map(p => (
                      <span
                        key={p.date}
                        className="hp-trend__bar"
                        style={{ height: `${Math.max(6, (p.rate / trendMax) * 100)}%` }}
                        title={`${p.date} — ${p.total} ${p.rate.toLocaleString(loc)}%`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Répartition par marché — byType réel */}
              <div className="hp-perf__panel">
                <p className="hp-perf__panel-title">{t.home2.perfSplit}</p>
                <div className="hp-split">
                  {byType.map(({ key, label, stat }) => (
                    <div key={key} className="hp-split__row">
                      <span className="hp-split__label">{label}</span>
                      <span className="hp-split__bar" aria-hidden="true">
                        <span style={{ width: `${stat?.rate ?? 0}%` }} />
                      </span>
                      <span className="hp-split__value">
                        {stat ? `${stat.rate.toLocaleString(loc)}%` : t.home2.perfBuilding}
                      </span>
                    </div>
                  ))}
                  <div className="hp-split__row hp-split__row--empty">
                    <span className="hp-split__label">{t.home2.perfMktExact}</span>
                    <span className="hp-split__value hp-split__value--building">{t.home2.perfBuilding}</span>
                  </div>
                </div>
                <a href={localizedPath('/historique', lang)} className="hp-btn-primary hp-btn-primary--sm" data-cta="perf-explore-history">
                  {t.home2.perfExplore}
                </a>
              </div>
            </div>

            <p className="hp-perf__warning" role="note">{t.home2.perfWarning}</p>
          </div>
        )}
      </div>
    </section>
  )
}
