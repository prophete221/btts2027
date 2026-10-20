'use client'

/**
 * /statistiques — tableau de bord analytique honnête (Vague 2).
 *
 * RÈGLES ABSOLUES :
 *  - uniquement des données réelles de public/win-history.json (suivi public) ;
 *  - chaque taux affiché avec son dénominateur et son périmètre ;
 *  - aucune projection, aucune donnée inventée, aucune perte masquée ;
 *  - legacyStats (période privée pré-08/08) jamais affiché publiquement.
 */

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Navbar, Footer } from '@/components/bttsbet'
import { useLanguage } from '@/components/bttsbet/LanguageSwitcher'
import AnimatedTitle from '@/components/bttsbet/HeroWordmark'
import { RateBar, CompositionBar, CumulativeLine, DailyBars, fmtPct } from '@/components/bttsbet/SimpleCharts'

interface HistoryEntry {
  date: string
  match: string
  league: string
  market: string
  tier: string
  proba: number
  status: string
  finalScore: string
  verifiedAt: string
  source: string
}

interface WinHistory {
  generatedAt: string
  trackingPeriod: { startDate: string; isPublicPeriod: boolean; disclaimer: string; insufficientVolume: boolean }
  stats: {
    total: number
    won: number
    lost: number
    pending: number
    unverifiable?: number
    archivedTotal: number
    rate: number
    gold: { total: number; won: number; lost: number; rate: number }
    standard: { total: number; won: number; lost: number; rate: number }
    byType: {
      btts: { total: number; won: number; lost: number; rate: number }
      over25: { total: number; won: number; lost: number; rate: number }
    }
    trend14: Array<{ date: string; total: number; won: number; lost: number; rate: number }>
    period: { from: string; to: string; days: number }
  }
  history: HistoryEntry[]
}

type Copy = ReturnType<typeof makeCopy>

function makeCopy(lang: 'fr' | 'en' | 'ar') {
  if (lang === 'en') {
    return {
      title: 'Verified statistics', subtitle: 'All figures below come from the public verified tracking — every rate is shown with its denominator. No projection, no fabricated data.',
      scopeTitle: 'Scope',
      scope: (pub: number, ver: number, pend: number, unv: number, from: string) =>
        `${pub} predictions published since ${from} (public tracking). ${ver} verified against official results (ESPN). ${pend} pending verification (future or recent). ${unv} unverifiable — matches past more than 48 h without a verifiable score: neither won, lost nor pending. Pre-${from} archives are private and excluded.`,
      kpiOverall: 'Overall success rate', kpiGold: 'Gold picks rate', kpiPending: 'Pending verification', kpiVerified: 'Verified predictions',
      ofPublished: (p: number) => `of ${p} published`,
      composition: 'Outcome composition', compositionDesc: (p: number) => `All ${p} published predictions since the tracking start — losses, pending and unverifiable included, nothing hidden.`,
      evolution: 'Cumulative verified results', daily: 'Daily verifications', dailyDesc: 'Last 30 days with at least one verification (days without verification are not invented).',
      markets: 'By market', tiers: 'By selection tier', leagues: 'By competition',
      leaguesNote: (l: number, t: number) => `Competitions come from verified entries only (${t} entries across ${l} competitions). Counts below are real — uneven coverage reflects actual data, not a ranking of competitions.`,
      tableLeague: 'Competition', tableWin: 'WIN', tableLost: 'LOST', tableRate: 'Rate', tableSample: 'Sample',
      verifiedOn: 'Verified predictions only — pending predictions and unverifiable matches are not included in any rate.',
      updated: 'Last data update', method: 'Methodology', results: 'Verified results →', today: 'Today’s predictions →',
      loading: 'Loading statistics…', error: 'Unable to load statistics data.', retry: 'Retry',
      disclaimer: '18+ · Sports betting carries a risk of loss. No future result is guaranteed. BTTSPredict does not take bets or hold funds.',
    }
  }
  if (lang === 'ar') {
    return {
      title: 'إحصائيات موثقة', subtitle: 'جميع الأرقام أدناه من التتبع العام الموثق — كل معدل يظهر مع مقامه. لا توجد توقعات مستقبلية ولا بيانات مؤلفة.',
      scopeTitle: 'النطاق',
      scope: (pub: number, ver: number, pend: number, unv: number, from: string) =>
        `${pub} توقعاً منشوراً منذ ${from} (تتبع عام). ${ver} موثقاً مقابل النتائج الرسمية (ESPN). ${pend} قيد التحقق (مستقبلية أو حديثة). ${unv} غير قابلة للتوثق — مباريات تجاوزت 48 ساعة بدون نتيجة قابلة للتحقق: ليست فوزاً ولا خسارة ولا معلقة. أرشيف ما قبل ${from} خاص ومستبعد.`,
      kpiOverall: 'معدل النجاح الإجمالي', kpiGold: 'معدل اختيارات Gold', kpiPending: 'قيد التحقق', kpiVerified: 'توقعات موثقة',
      ofPublished: (p: number) => `من أصل ${p} منشور`,
      composition: 'توزيع النتائج', compositionDesc: (p: number) => `جميع التوقعات المنشورة (${p}) منذ بداية التتبع — الخسائر والمعلقة وغير القابلة للتوثق مشمولة، لا شيء مخفي.`,
      evolution: 'النتائج الموثقة التراكمية', daily: 'التحققات اليومية', dailyDesc: 'آخر 30 يوماً بتحقق واحد على الأقل (الأيام بدون تحقق غير مؤلفة).',
      markets: 'حسب السوق', tiers: 'حسب مستوى الاختيار', leagues: 'حسب المسابقة',
      leaguesNote: (l: number, t: number) => `المسابقات من الإدخالات الموثقة فقط (${t} إدخالاً عبر ${l} مسابقة). الأعداد حقيقية — التغطية غير المتكافئة تعكس البيانات الفعلية وليست ترتيباً للمسابقات.`,
      tableLeague: 'المسابقة', tableWin: 'فوز', tableLost: 'خسارة', tableRate: 'المعدل', tableSample: 'العينة',
      verifiedOn: 'التوقعات الموثقة فقط — التوقعات المعلقة والمباريات غير القابلة للتوثق لا تدخل في أي معدل.',
      updated: 'آخر تحديث للبيانات', method: 'المنهجية', results: 'النتائج الموثقة ←', today: 'توقعات اليوم ←',
      loading: 'جار تحميل الإحصائيات…', error: 'تعذر تحميل بيانات الإحصائيات.', retry: 'إعادة المحاولة',
      disclaimer: '18+ · المراهنات الرياضية تنطوي على خطر الخسارة. لا توجد ضمانات لأي نتيجة مستقبلية. BTTSPredict لا يقبل الرهانات ولا يحتفظ بالأموال.',
    }
  }
  return {
    title: 'Statistiques vérifiées', subtitle: 'Tous les chiffres ci-dessous proviennent du suivi public vérifié — chaque taux est affiché avec son dénominateur. Aucune projection, aucune donnée inventée.',
    scopeTitle: 'Périmètre',
    scope: (pub: number, ver: number, pend: number, unv: number, from: string) =>
      `${pub} pronostics publiés depuis le ${from} (suivi public). ${ver} vérifiés contre les résultats officiels (ESPN). ${pend} en attente de vérification (matchs futurs ou récents). ${unv} non vérifiables — matchs passés de plus de 48 h sans score vérifiable : ni gagnés, ni perdus, ni en attente. Les archives antérieures au ${from} sont privées et exclues.`,
    kpiOverall: 'Taux de réussite global', kpiGold: 'Taux Sélections Gold', kpiPending: 'En attente de vérification', kpiVerified: 'Pronostics vérifiés',
    ofPublished: (p: number) => `sur ${p} publiés`,
    composition: 'Composition des résultats', compositionDesc: (p: number) => `Les ${p} pronostics publiés depuis le lancement du suivi — pertes, en attente et non vérifiables inclus, rien n'est masqué.`,
    evolution: 'Évolution des résultats vérifiés', daily: 'Vérifications par jour', dailyDesc: 'Les 30 derniers jours comptant au moins une vérification (les jours sans vérification ne sont pas inventés).',
    markets: 'Par marché', tiers: 'Par niveau de sélection', leagues: 'Par compétition',
    leaguesNote: (l: number, t: number) => `Compétitions issues des seules entrées vérifiées (${t} entrées réparties sur ${l} compétitions). Les effectifs ci-dessous sont réels — la couverture inégale reflète les données, ce n'est pas un classement des compétitions.`,
    tableLeague: 'Compétition', tableWin: 'WIN', tableLost: 'LOST', tableRate: 'Taux', tableSample: 'Échantillon',
    verifiedOn: 'Pronostics vérifiés uniquement — les pronostics en attente et les matchs non vérifiables n\'entrent dans aucun taux.',
    updated: 'Dernière mise à jour des données', method: 'Méthodologie', results: 'Résultats vérifiés →', today: 'Pronostics du jour →',
    loading: 'Chargement des statistiques…', error: 'Impossible de charger les données de statistiques.', retry: 'Réessayer',
    disclaimer: '18+ · Les paris sportifs comportent un risque de perte. Aucun résultat futur n\'est garanti. BTTSPredict ne prend pas de paris et ne collecte pas de fonds.',
  }
}

export default function StatistiquesClient() {
  const { lang } = useLanguage()
  const copy = makeCopy(lang)
  const [data, setData] = useState<WinHistory | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/win-history.json')
      .then(r => { if (!r.ok) throw new Error('HTTP error'); return r.json() })
      .then(d => setData(d))
      .catch(() => setFailed(true))
  }, [])

  if (failed) {
    return (
      <Shell>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-sm text-[#F87171] mb-3">{copy.error}</p>
          <button onClick={() => { setFailed(false); fetch('/win-history.json').then(r => r.json()).then(d => setData(d)).catch(() => setFailed(true)) }}
            className="mt-4 px-4 py-2 rounded-[10px] text-sm font-bold" style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>
            {copy.retry}
          </button>
        </div>
      </Shell>
    )
  }

  if (!data || !data.stats) {
    return (
      <Shell>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-block w-10 h-10 border-2 border-[#6B7A8C] border-t-[#2F7DFF] rounded-full animate-spin mb-4" aria-hidden="true" />
          <p className="text-sm text-[#9DABBB]">{copy.loading}</p>
        </div>
      </Shell>
    )
  }

  const { stats, history, trackingPeriod, generatedAt } = data
  const from = trackingPeriod.startDate
  const lowVolume = trackingPeriod.insufficientVolume || stats.total < 30

  // ── Données réelles calculées côté client (aucune invention) ──
  const byLeagueMap = new Map<string, { won: number; lost: number }>()
  const dailyMap = new Map<string, { won: number; lost: number }>()
  for (const h of history) {
    const lg = h.league || '—'
    const cur = byLeagueMap.get(lg) || { won: 0, lost: 0 }
    if (h.status === 'WON') { cur.won++; byLeagueMap.set(lg, cur) }
    else if (h.status === 'LOST') { cur.lost++; byLeagueMap.set(lg, cur) }
    const d = dailyMap.get(h.date) || { won: 0, lost: 0 }
    if (h.status === 'WON') { d.won++; dailyMap.set(h.date, d) }
    else if (h.status === 'LOST') { d.lost++; dailyMap.set(h.date, d) }
  }
  const leagues = Array.from(byLeagueMap.entries())
    .map(([league, v]) => ({ league, ...v, total: v.won + v.lost, rate: v.won + v.lost > 0 ? +(v.won / (v.won + v.lost) * 100).toFixed(1) : null }))
    .sort((a, b) => b.total - a.total)
  const dailyAll = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
  const daily30 = dailyAll.slice(-30)
  const cumulative = dailyAll.reduce<Array<{ date: string; cumWon: number; cumLost: number }>>((acc, d) => {
    const prev = acc[acc.length - 1]
    acc.push({ date: d.date, cumWon: (prev?.cumWon || 0) + d.won, cumLost: (prev?.cumLost || 0) + d.lost })
    return acc
  }, [])
  const tierGold = { won: history.filter(h => (h.tier || '').toUpperCase() === 'GOLD' && h.status === 'WON').length, lost: history.filter(h => (h.tier || '').toUpperCase() === 'GOLD' && h.status === 'LOST').length }
  const tierStd = { won: history.filter(h => (h.tier || '').toUpperCase() !== 'GOLD' && h.status === 'WON').length, lost: history.filter(h => (h.tier || '').toUpperCase() !== 'GOLD' && h.status === 'LOST').length }
  const pendingShare = stats.archivedTotal > 0 ? Number(((stats.pending / stats.archivedTotal) * 100).toFixed(1)) : null
  const updatedLabel = new Date(generatedAt).toLocaleString(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Shell>
      <div className="max-w-5xl mx-auto px-4 py-10">
      {/* En-tête */}
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7DFF] mb-2">BTTSPredict · {copy.scopeTitle}</p>
        <AnimatedTitle as="h1" text={copy.title} className="text-2xl sm:text-3xl font-bold text-[#F2F6FA]" style={{ fontFamily: 'Poppins, sans-serif' }} />
        <p className="mt-2 text-sm text-[#9DABBB] leading-relaxed max-w-3xl">{copy.subtitle}</p>
      </header>

      {/* Périmètre explicite */}
      <section className="rounded-2xl border border-[#223041] bg-[#10161D] p-4 sm:p-5 mb-8" aria-label={copy.scopeTitle}>
        <h2 className="text-sm font-bold text-[#F2F6FA] mb-2 flex items-center gap-2">
          <span className="inline-block w-1.5 h-4 rounded-full bg-[#2F7DFF]" aria-hidden="true" />{copy.scopeTitle}
        </h2>
        <p className="text-sm text-[#9DABBB] leading-relaxed">
          {copy.scope(stats.archivedTotal, stats.total, stats.pending, stats.unverifiable ?? 0, from)}
        </p>
        {lowVolume && (
          <p className="mt-2 text-xs text-[#FBBF24] leading-relaxed">
            {trackingPeriod.disclaimer}
          </p>
        )}
      </section>

      {/* KPI — chaque taux avec son dénominateur */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-5">
          <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{copy.kpiOverall}</div>
          <div className="mt-1 text-3xl font-bold text-[#F2F6FA] font-mono">{fmtPct(stats.rate.toFixed(1), lang)} %</div>
          <div className="mt-1 text-xs text-[#9DABBB]">{stats.won} WIN / {stats.lost} LOST — {stats.total} {copy.kpiVerified.toLowerCase()}</div>
        </div>
        <div className="rounded-2xl border border-[#2F7DFF]/40 bg-[#141C25] p-5">
          <div className="text-xs uppercase tracking-wider text-[#2F7DFF] font-bold">{copy.kpiGold}</div>
          <div className="mt-1 text-3xl font-bold text-[#F2F6FA] font-mono">{fmtPct(stats.gold.rate.toFixed(1), lang)} %</div>
          <div className="mt-1 text-xs text-[#9DABBB]">{stats.gold.won} WIN / {stats.gold.lost} LOST — {stats.gold.total} vérifié{stats.gold.total > 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-5">
          <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{copy.kpiPending}</div>
          <div className="mt-1 text-3xl font-bold font-mono" style={{ color: '#FBBF24' }}>{stats.pending}</div>
          <div className="mt-1 text-xs text-[#9DABBB]">{pendingShare !== null && `${fmtPct(pendingShare.toFixed(1), lang)} % `}{copy.ofPublished(stats.archivedTotal)}</div>
        </div>
        <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-5">
          <div className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{copy.kpiVerified}</div>
          <div className="mt-1 text-3xl font-bold text-[#F2F6FA] font-mono">{stats.total}</div>
          <div className="mt-1 text-xs text-[#9DABBB]">{copy.verifiedOn}</div>
        </div>
      </div>

      {/* Composition WIN / LOST / PENDING */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-composition">
        <h2 id="st-composition" className="text-base font-bold text-[#F2F6FA] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.composition}</h2>
        <p className="text-xs text-[#9DABBB] mb-4">{copy.compositionDesc(stats.archivedTotal)}</p>
        <CompositionBar won={stats.won} lost={stats.lost} pending={stats.pending} unverifiable={stats.unverifiable ?? 0}
          labels={{ won: 'WIN', lost: 'LOST', pending: lang === 'fr' ? 'En attente' : lang === 'en' ? 'Pending' : 'قيد الانتظار', unverifiable: lang === 'fr' ? 'Non vérifiables' : lang === 'en' ? 'Unverifiable' : 'غير قابلة للتوثق' }} />
      </section>

      {/* Évolution cumulée */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-evolution">
        <h2 id="st-evolution" className="text-base font-bold text-[#F2F6FA] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.evolution}</h2>
        <CumulativeLine points={cumulative} lang={lang} />
      </section>

      {/* Vérifications par jour */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-daily">
        <h2 id="st-daily" className="text-base font-bold text-[#F2F6FA] mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.daily}</h2>
        <p className="text-xs text-[#9DABBB] mb-4">{copy.dailyDesc}</p>
        <DailyBars days={daily30} lang={lang} />
      </section>

      {/* Par marché */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-markets">
        <h2 id="st-markets" className="text-base font-bold text-[#F2F6FA] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.markets}</h2>
        <div className="space-y-5">
          <RateBar label="BTTS" rate={stats.byType.btts.rate} won={stats.byType.btts.won} lost={stats.byType.btts.lost} lang={lang} />
          <RateBar label="Over 2.5" rate={stats.byType.over25.rate} won={stats.byType.over25.won} lost={stats.byType.over25.lost} lang={lang} />
        </div>
      </section>

      {/* Par niveau de sélection */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-tiers">
        <h2 id="st-tiers" className="text-base font-bold text-[#F2F6FA] mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.tiers}</h2>
        <div className="space-y-5">
          <RateBar label={lang === 'fr' ? 'Gold (sélection premium)' : lang === 'en' ? 'Gold (premium selection)' : 'Gold (اختيار مميز)'}
            rate={tierGold.won + tierGold.lost > 0 ? Number(((tierGold.won / (tierGold.won + tierGold.lost)) * 100).toFixed(1)) : null}
            won={tierGold.won} lost={tierGold.lost} lang={lang} color="#E8C268" />
          <RateBar label={lang === 'fr' ? 'Standard' : 'Standard'}
            rate={tierStd.won + tierStd.lost > 0 ? Number(((tierStd.won / (tierStd.won + tierStd.lost)) * 100).toFixed(1)) : null}
            won={tierStd.won} lost={tierStd.lost} lang={lang} />
        </div>
      </section>

      {/* Par compétition */}
      <section className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-6 mb-8" aria-labelledby="st-leagues">
        <h2 id="st-leagues" className="text-base font-bold text-[#F2F6FA] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.leagues}</h2>
        <p className="text-xs text-[#9DABBB] mb-4 leading-relaxed">{copy.leaguesNote(leagues.length, stats.total)}</p>
        {leagues.length === 0 ? (
          <p className="text-sm text-[#9DABBB]">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#223041] text-xs uppercase tracking-wider text-[#9DABBB]">
                  <th className="text-left py-2 px-2 font-bold">{copy.tableLeague}</th>
                  <th className="text-center py-2 px-2 font-bold">{copy.tableWin}</th>
                  <th className="text-center py-2 px-2 font-bold">{copy.tableLost}</th>
                  <th className="text-center py-2 px-2 font-bold">{copy.tableRate}</th>
                </tr>
              </thead>
              <tbody>
                {leagues.map(l => (
                  <tr key={l.league} className="border-b border-[#223041]/50">
                    <td className="py-2.5 px-2 text-[#F2F6FA] font-medium">{l.league}</td>
                    <td className="py-2.5 px-2 text-center font-mono" style={{ color: '#34D399' }}>{l.won}</td>
                    <td className="py-2.5 px-2 text-center font-mono" style={{ color: '#F87171' }}>{l.lost}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[#F2F6FA]">
                      {l.rate !== null ? `${fmtPct(l.rate.toFixed(1), lang)} %` : '—'}
                      <span className="ml-1 text-xs text-[#6B7A8C]">({l.total})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mise à jour + navigation */}
      <p className="text-xs text-[#6B7A8C] mb-8">
        {copy.updated} : {updatedLabel} · {copy.verifiedOn}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        <Link href={lang === 'fr' ? '/methodologie' : `/${lang}/methodologie`} className="p-4 rounded-xl border border-[#223041] bg-[#141C25] hover:border-[#2F7DFF]/60 transition-colors">
          <div className="text-sm font-bold text-[#F2F6FA]">{copy.method} →</div>
        </Link>
        <Link href={lang === 'fr' ? '/resultats-verifies' : `/${lang}/resultats-verifies`} className="p-4 rounded-xl border border-[#223041] bg-[#141C25] hover:border-[#2F7DFF]/60 transition-colors">
          <div className="text-sm font-bold text-[#F2F6FA]">{copy.results}</div>
        </Link>
        <Link href={lang === 'fr' ? '/btts/predictions/today' : `/${lang}/btts/predictions/today`} className="p-4 rounded-xl font-bold text-sm text-center" style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>
          {copy.today}
        </Link>
      </div>

      <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(255, 122, 122, 0.06)', border: '1px solid rgba(255, 122, 122, 0.2)' }}>
        <p className="text-xs text-[#9DABBB] leading-relaxed">{copy.disclaimer}</p>
      </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col text-[#F2F6FA]">
      <Navbar />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
