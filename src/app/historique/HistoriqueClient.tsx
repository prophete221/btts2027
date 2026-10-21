'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/bttsbet/LanguageSwitcher'
import AnimatedTitle from '@/components/bttsbet/HeroWordmark'

interface TrackingPeriod {
  startDate: string
  modelVersion?: string  // Optionnel : ne plus exposer publiquement
  isPublicPeriod: boolean
  disclaimer: string
  insufficientVolume: boolean
}

interface Stats {
  total: number
  won: number
  lost: number
  pending: number
  unverifiable?: number
  archivedTotal: number
  rate: number
  gold: {
    total: number
    won: number
    lost: number
    rate: number
  }
  standard: {
    total: number
    won: number
    lost: number
    rate: number
  }
  byType: {
    btts: { total: number; won: number; lost: number; rate: number }
    over25: { total: number; won: number; lost: number; rate: number }
  }
  trend14: Array<{ date: string; total: number; won: number; lost: number; rate: number }>
  period: { from: string; to: string; days: number }
}

interface HistoryEntry {
  date: string
  match: string
  league: string
  market: string
  prediction?: string
  tier: string
  proba: number
  status: 'WON' | 'LOST' | 'PENDING' | string
  finalScore: string
  verifiedAt: string
  source: string
}

interface WinHistory {
  generatedAt: string
  trackingPeriod: TrackingPeriod
  stats: Stats
  history: HistoryEntry[]
}

export default function HistoriqueClient() {
  const { lang } = useLanguage()
  const copy = lang === 'fr' ? { loading: 'Chargement de l’historique vérifié…', error: 'Erreur de récupération des données', retry: 'Réessayer', newTracking: 'Nouveau suivi public', title: 'Historique vérifié', intro: 'BTTSPredict lance une nouvelle période de suivi vérifié. Chaque pronostic publié est enregistré, horodaté et évalué après le résultat officiel du match. Les performances seront publiées progressivement, sans modification rétroactive.', launch: 'Nouvelle période de suivi publique' } : lang === 'en' ? { loading: 'Loading verified history…', error: 'Unable to retrieve the data', retry: 'Try again', newTracking: 'New public tracking period', title: 'Verified history', intro: 'BTTSPredict is starting a new verified tracking period. Every published prediction is recorded, time-stamped and assessed after the official match result. Performance will be published progressively, without retroactive changes.', launch: 'New public tracking period' } : { loading: 'جار تحميل السجل الموثق…', error: 'تعذر استرجاع البيانات', retry: 'إعادة المحاولة', newTracking: 'فترة تتبع عامة جديدة', title: 'السجل الموثق', intro: 'تبدأ BTTSPredict فترة جديدة لتتبع التوقعات الموثقة. يتم تسجيل كل توقع منشور وتأريخه وتقييمه بعد النتيجة الرسمية للمباراة. سيتم نشر الأداء تدريجياً دون تعديلات بأثر رجعي.', launch: 'فترة تتبع عامة جديدة' }
  const [data, setData] = useState<WinHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Chaînes complémentaires (historiquement codées en dur en FR — corrigé Vague 2)
  const t = lang === 'fr' ? {
    trendTitle: 'Tendance 14 jours', tableTitle: 'Pronostics vérifiés du nouveau suivi', methodLink: 'Méthodologie du modèle →',
    thDate: 'Date', thMatch: 'Match', thMarket: 'Marché', thPred: 'Prévision', thScore: 'Score', thResult: 'Résultat',
    rateGlobal: 'Taux global', winShort: 'W', loseShort: 'L', verifiedWord: 'vérifiés', goldRateLabel: 'Taux Gold',
    wonBadge: 'Gagné', lostBadge: 'Perdu', pendingBadge: 'En attente', emptyTable: 'Aucun pronostic vérifié pour le moment.',
    emptyTableHint: (d: string) => `Les pronostics publiés à partir du ${d} seront vérifiés après le résultat officiel des matchs.`,
    verifiedCountLabel: (n: number) => `${n} vérifiés`,
  } : lang === 'en' ? {
    trendTitle: '14-day trend', tableTitle: 'Verified predictions of the new tracking', methodLink: 'Model methodology →',
    thDate: 'Date', thMatch: 'Match', thMarket: 'Market', thPred: 'Prediction', thScore: 'Score', thResult: 'Result',
    rateGlobal: 'Overall rate', winShort: 'W', loseShort: 'L', verifiedWord: 'verified', goldRateLabel: 'Gold rate',
    wonBadge: 'Won', lostBadge: 'Lost', pendingBadge: 'Pending', emptyTable: 'No verified prediction yet.',
    emptyTableHint: (d: string) => `Predictions published from ${d} will be verified after the official match result.`,
    verifiedCountLabel: (n: number) => `${n} verified`,
  } : {
    trendTitle: 'اتجاه 14 يوماً', tableTitle: 'توقعات موثقة من التتبع الجديد', methodLink: 'منهجية النموذج ←',
    thDate: 'التاريخ', thMatch: 'المباراة', thMarket: 'السوق', thPred: 'التوقع', thScore: 'النتيجة', thResult: 'الحالة',
    rateGlobal: 'المعدل الإجمالي', winShort: 'ف', loseShort: 'خ', verifiedWord: 'موثق', goldRateLabel: 'معدل Gold',
    wonBadge: 'فاز', lostBadge: 'خسر', pendingBadge: 'قيد الانتظار', emptyTable: 'لا توجد توقعات موثقة بعد.',
    emptyTableHint: (d: string) => `ستتم موثقة التوقعات المنشورة من ${d} بعد النتيجة الرسمية للمباراة.`,
    verifiedCountLabel: (n: number) => `${n} موثق`,
  }

  useEffect(() => {
    fetch('/win-history.json')
      .then(r => {
        if (!r.ok) throw new Error('Impossible de charger les données')
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block w-10 h-10 border-2 border-[#6B7A8C] border-t-[#2F7DFF] rounded-full animate-spin mb-4" aria-hidden="true" />
        <p className="text-sm text-[#9DABBB]">{copy.loading}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-sm text-[#F87171] mb-3">Erreur de récupération des données</p>
        <p className="text-xs text-[#9DABBB]">{error}</p>
        <button onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-[10px] text-sm font-bold"
          style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>
          {copy.retry}
        </button>
      </div>
    )
  }

  if (!data) return null

  const { trackingPeriod, stats, history } = data
  const insufficient = trackingPeriod.insufficientVolume || stats.total < 30

  return (
    <>
      {/* Hero section : lancement officiel */}
      <section className="max-w-4xl mx-auto px-4 pt-12 pb-8 sm:pt-16">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            style={{ backgroundColor: 'rgba(127, 162, 198, 0.16)', color: '#2F7DFF', border: '1px solid rgba(127, 162, 198, 0.30)' }}>
            {copy.newTracking}
          </span>
          <AnimatedTitle
            as="h1"
            text={copy.title}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
          <p className="text-base text-[#9DABBB] leading-relaxed max-w-2xl mx-auto">
            {copy.intro}
          </p>
        </div>

        {/* Disclaimer : période de lancement — version crédible */}
        {insufficient && (
          <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(47, 125, 255, 0.06)', border: '1px solid rgba(47, 125, 255, 0.2)' }}>
            <p className="text-sm text-[#2F7DFF] leading-relaxed mb-2 font-bold">
              {copy.launch}
            </p>
            <p className="text-xs text-[#9DABBB] leading-relaxed">
              Suivi public lancé le {trackingPeriod.startDate}. Chaque pronostic est enregistré, horodaté et vérifié après le résultat officiel du match. Les performances sont publiées progressivement, sans modification rétroactive. Aucun résultat futur n'est garanti.
            </p>
          </div>
        )}
      </section>

      {/* Fraîcheur des données — les compteurs détaillés sont dans la section
          « Taux de réussite » ci-dessous (retrait des compteurs redondants). */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <p className="text-xs text-[#9DABBB] text-center mt-4 leading-relaxed">
          {lang === 'fr' ? 'Dernière mise à jour' : lang === 'en' ? 'Last data update' : 'آخر تحديث'} : {new Date(data.generatedAt).toLocaleString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          {stats.period.from && (lang === 'fr' ? ` · Période : ${stats.period.from} → ${stats.period.to || 'en cours'}` : lang === 'en' ? ` · Period: ${stats.period.from} → ${stats.period.to || 'ongoing'}` : ` · الفترة: ${stats.period.from} → ${stats.period.to || 'جارية'}`)}
        </p>
      </section>

      {/* Taux de réussite — affiché uniquement si volume suffisant */}
      {!insufficient && stats.total > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
              <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold mb-2">{t.rateGlobal}</div>
              <div className="text-3xl font-bold text-[#F2F6FA] mb-1">{stats.rate}%</div>
              <div className="text-xs text-[#9DABBB]">{stats.won} {t.winShort} · {stats.lost} {t.loseShort} · {stats.total} {t.verifiedWord}</div>
            </div>
            <div className="p-5 rounded-2xl" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
              <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold mb-2">BTTS</div>
              <div className="text-3xl font-bold text-[#2F7DFF] mb-1">{stats.byType.btts.rate}%</div>
              <div className="text-xs text-[#9DABBB]">{stats.byType.btts.won} {t.winShort} · {stats.byType.btts.lost} {t.loseShort} · {stats.byType.btts.total} {t.verifiedWord}</div>
            </div>
            <div className="p-5 rounded-2xl" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
              <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold mb-2">Over 2.5</div>
              <div className="text-3xl font-bold text-[#2F7DFF] mb-1">{stats.byType.over25.rate}%</div>
              <div className="text-xs text-[#9DABBB]">
                {stats.byType.over25.won} {t.winShort} · {stats.byType.over25.lost} {t.loseShort} · {stats.byType.over25.total} {t.verifiedWord}
                {stats.byType.over25.total > 0 && stats.byType.over25.total < 30 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[12px]" style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#FBBF24' }}>
                    {lang === 'fr' ? 'échantillon faible' : lang === 'en' ? 'small sample' : 'عينة صغيرة'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Trend 14j — affiché uniquement si volume suffisant */}
      {!insufficient && stats.trend14 && stats.trend14.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-8">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {t.trendTitle}
          </h2>
          <div className="flex items-end gap-1 h-32 p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
            {stats.trend14.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.won} W / ${d.lost} L = ${d.rate}%`}>
                <div className="w-full rounded-t-sm bg-[#2F7DFF]"
                  style={{
                    height: `${Math.min(100, d.rate)}%`,
                    minHeight: '4px',
                  }}
                  aria-hidden="true" />
                <div className="text-xs text-[#6B7A8C] mt-1 hidden sm:block">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tableau des pronostics vérifiés */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {t.tableTitle}
        </h2>

        {history.length === 0 ? (
          <div className="p-6 rounded-xl text-center" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
            <p className="text-sm text-[#9DABBB] mb-2">{t.emptyTable}</p>
            <p className="text-xs text-[#9DABBB]">
              {t.emptyTableHint(trackingPeriod.startDate)}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #223041' }}>
                  <th className="text-left py-3 px-3 font-bold text-[#9DABBB]">{t.thDate}</th>
                  <th className="text-left py-3 px-3 font-bold text-[#9DABBB]">{t.thMatch}</th>
                  <th className="text-left py-3 px-3 font-bold text-[#9DABBB] hidden sm:table-cell">{t.thMarket}</th>
                  <th className="text-center py-3 px-3 font-bold text-[#9DABBB]">{t.thPred}</th>
                  <th className="text-center py-3 px-3 font-bold text-[#9DABBB]">{t.thScore}</th>
                  <th className="text-center py-3 px-3 font-bold text-[#9DABBB]">{t.thResult}</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 100).map((h, i) => {
                  const isWon = h.status === 'WON'
                  const isLost = h.status === 'LOST'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #223041' }}>
                      <td className="py-2 px-3 text-[#9DABBB] text-xs whitespace-nowrap">{h.date}</td>
                      <td className="py-2 px-3 text-[#F2F6FA]">
                        <div className="font-medium">{h.match}</div>
                        <div className="text-xs text-[#9DABBB] uppercase tracking-wide">{h.league}</div>
                      </td>
                      <td className="py-2 px-3 text-[#9DABBB] hidden sm:table-cell">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{
                            backgroundColor: 'rgba(47, 125, 255, 0.12)',
                            color: '#2F7DFF',
                          }}>
                          {h.market === 'btts' ? 'BTTS' : 'Over 2.5'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-[#9DABBB]">{h.prediction || '—'}</td>
                      <td className="py-2 px-3 text-center text-[#9DABBB]">{h.finalScore}</td>
                      <td className="py-2 px-3 text-center">
                        {isWon ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: 'rgba(52, 211, 153, 0.13)', color: '#34D399' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} aria-hidden="true" />
                            {t.wonBadge}
                          </span>
                        ) : isLost ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: 'rgba(248, 113, 113, 0.13)', color: '#F87171' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F87171' }} aria-hidden="true" />
                            {t.lostBadge}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
                            style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FBBF24' }} aria-hidden="true" />
                            {t.pendingBadge}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Liens utiles */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/methodologie" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all"
            style={{ backgroundColor: '#141C25', color: '#9DABBB', border: '1px solid #223041' }}>
            {t.methodLink}
          </Link>
          <Link href="/btts/predictions/today" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all"
            style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>
            Voir les pronostics du jour →
          </Link>
        </div>
      </section>

      {/* 18+ disclaimer */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(255, 122, 122, 0.06)', border: '1px solid rgba(255, 122, 122, 0.2)' }}>
          <p className="text-xs text-[#9DABBB] leading-relaxed">
            18+ · Les paris sportifs comportent un risque de perte. Aucun gain n'est garanti. BTTSPredict ne prend pas de paris et ne collecte pas de fonds. Jouez de manière responsable.
          </p>
        </div>
      </section>
    </>
  )
}
