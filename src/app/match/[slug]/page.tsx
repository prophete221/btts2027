import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar, Footer } from '@/components/bttsbet'
import { generateMatchSlug, getAllMatchSlugs, getMatchBySlug, getVerifiedHistoryForMatch, verifiedMarketKey } from '@/lib/matches'
import Link from 'next/link'
import MatchAnalyticsCharts from '@/components/bttsbet/MatchAnalyticsCharts'
import MatchViewTracker from '@/components/bttsbet/MatchViewTracker'
import { localizedPath, type Locale } from '@/lib/i18n'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Stratégie SSG explicite pour /match/[slug] :
// - generateStaticParams() pré-génère toutes les pages match valides au build
// - dynamicParams = false → toute URL /match/[slug] non pré-générée retourne 404
//   (au lieu d'être servie côté serveur, ce qui casserait en mode `output: export`)
// - dynamic = 'force-static' → garantie que la page est rendue en statique pur
//
// En cas de /match/[slug] introuvable, l'utilisateur voit la page /404.html
// personnalisée (gérée par LWS via .htaccess).
export const dynamicParams = false
export const dynamic = 'force-static'

export async function generateStaticParams() {
  const slugs = getAllMatchSlugs()
  // Si aucune page match n'est disponible, on génère un fallback pour que le build SSG passe
  if (slugs.length === 0) {
    return [{ slug: '_placeholder' }]
  }
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const match = getMatchBySlug(slug)
  if (!match) {
    return {
      title: 'Match introuvable',
      robots: { index: false, follow: false },
    }
  }

  const home = match.home
  const away = match.away
  const league = match.league
  const date = match.date
  // Title court — limite Bing 70 chars (avec template " | BTTSPredict").
  // Format: "Home vs Away BTTS 08/08" — on évite "Pronostic" pour les équipes longues.
  const shortDate = date ? date.slice(5).replace('-', '/') : '' // "2026-08-15" → "08/15"
  const title = `${home} vs ${away} BTTS${shortDate ? ` ${shortDate}` : ''}`
  const description = `Pronostic BTTS et Over 2.5 : ${home} vs ${away} (${league}, ${date}). Analyse et résultat vérifié. 18+.`

  return {
    title,
    description,
    alternates: { canonical: `https://bttspredict.com/match/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `https://bttspredict.com/match/${slug}`,
      type: 'article',
      images: match.homeLogo ? [{ url: match.homeLogo, alt: `Logo ${home}` }] : [],
    },
  }
}

const SITE_URL = 'https://bttspredict.com'

const MATCH_COPY: Record<Locale, {
  home: string; predictions: string; breadcrumb: string; finalScore: string; predictedScore: string; report: string; published: string;
  bttsSubtitle: string; overSubtitle: string; won: string; lost: string; pending: string; noFuture: string;
  keyFact: string; analysis: string; verification: string; verifiedAt: string; source: string;
  intelligence: string; further: string; today: string; todayDesc: string; premium: string; vipDesc: string; disclaimer: string;
  dataUsed: string; dataUsedDesc: string; matchesAnalyzed: string; perTeam: string; lambdaLabel: string; lambdaHint: string;
  xgTotalLabel: string; modelSource: string; recentForm: string; formBttsLabel: string; conclusion: string; qualityNote: string;
  publishedOn: string; readOfMatch: string; riskLevel: string; notAvailable: string;
}> = {
  fr: { home: 'Accueil', predictions: 'Pronostics', breadcrumb: 'Fil d’Ariane', finalScore: 'Score réel vérifié', predictedScore: 'Score estimé', report: 'Pronostics du modèle', published: 'Données publiées', bttsSubtitle: 'Les deux équipes marquent', overSubtitle: 'Total de buts ≥ 3', won: 'Gagné', lost: 'Perdu', pending: 'En attente', noFuture: 'Aucun résultat futur n’est garanti. 18+.', keyFact: 'À retenir', analysis: 'Analyse statistique', verification: 'Vérification', verifiedAt: 'Vérifié le', source: 'Source : ESPN et TheSportsDB.', intelligence: 'Analyse du match', further: 'Aller plus loin', today: 'Voir les pronostics du jour →', todayDesc: 'Tous les matchs analysés par notre modèle statistique', premium: 'Pronostics premium →', vipDesc: 'Programme VIP BTTSPredict', disclaimer: '18+ · Les paris sportifs comportent un risque de perte. Aucun résultat futur n’est garanti. BTTSPredict ne prend pas de paris et ne collecte pas de fonds. Pronostic publié à titre informatif, ne constitue pas une incitation à parier.', dataUsed: 'Données utilisées', dataUsedDesc: 'Informations disponibles pour cette analyse.', matchesAnalyzed: 'Matchs pris en compte', perTeam: 'par équipe', lambdaLabel: 'Buts estimés par le modèle', lambdaHint: 'Estimations calculées à partir des buts récents disponibles ; ce ne sont pas des scores de match.', xgTotalLabel: 'Total de buts estimé', modelSource: 'Modèle statistique', recentForm: 'Forme récente', formBttsLabel: 'BTTS sur les matchs récents', conclusion: 'Conclusion', qualityNote: 'La qualité des données décrit les informations disponibles, pas les chances de gagner.', publishedOn: 'Données publiées le', readOfMatch: 'notre lecture du match', riskLevel: 'Niveau de prudence', notAvailable: 'Non disponible' },
  en: { home: 'Home', predictions: 'Predictions', breadcrumb: 'Breadcrumb', finalScore: 'Verified result', predictedScore: 'Model score estimate', report: 'Model predictions', published: 'Published data', bttsSubtitle: 'Both teams to score', overSubtitle: 'Total goals ≥ 3', won: 'Won', lost: 'Lost', pending: 'Pending', noFuture: 'No future result is guaranteed. 18+.', keyFact: 'À retenir', analysis: 'Statistical analysis', verification: 'Verification', verifiedAt: 'Verified on', source: 'Source: ESPN and TheSportsDB.', intelligence: 'Match analysis', further: 'Explore further', today: 'View today’s predictions →', todayDesc: 'All matches analyzed by our statistical model', premium: 'Premium predictions →', vipDesc: 'BTTSPredict VIP programme', disclaimer: '18+ · Sports betting carries a risk of loss. No future result is guaranteed. BTTSPredict does not take bets or hold funds. This prediction is informational and is not an invitation to bet.', dataUsed: 'Data used', dataUsedDesc: 'Information available for this analysis.', matchesAnalyzed: 'Matches included', perTeam: 'per team', lambdaLabel: 'Model-estimated goals', lambdaHint: 'Estimates based on available recent goals; they are not match scores.', xgTotalLabel: 'Estimated total goals', modelSource: 'Statistical model', recentForm: 'Recent form', formBttsLabel: 'BTTS in recent matches', conclusion: 'Conclusion', qualityNote: 'Data quality describes the information available, not the chance of winning.', publishedOn: 'Data published on', readOfMatch: 'our read of the match', riskLevel: 'Prudence level', notAvailable: 'Not available' },
  ar: { home: 'الرئيسية', predictions: 'التوقعات', breadcrumb: 'مسار التنقل', finalScore: 'النتيجة الفعلية المؤكدة', predictedScore: 'نتيجة تقديرية', report: 'توقعات النموذج', published: 'بيانات منشورة', bttsSubtitle: 'كلا الفريقين يسجلان', overSubtitle: 'إجمالي الأهداف ≥ 3', won: 'فوز', lost: 'خسارة', pending: 'قيد الانتظار', noFuture: 'لا توجد ضمانات لأي نتيجة مستقبلية. 18+.', keyFact: 'الخلاصة', analysis: 'تحليل إحصائي', verification: 'التحقق', verifiedAt: 'تم التحقق في', source: 'المصدر: ESPN وTheSportsDB.', intelligence: 'تحليل المباراة', further: 'استكشف المزيد', today: 'عرض توقعات اليوم ←', todayDesc: 'جميع المباريات التي حللها نموذجنا الإحصائي', premium: 'التوقعات المميزة ←', vipDesc: 'برنامج VIP من BTTSPredict', disclaimer: '18+ · المراهنات الرياضية تنطوي على خطر الخسارة. لا توجد ضمانات لأي نتيجة مستقبلية. BTTSPredict لا يقبل الرهانات ولا يحتفظ بالأموال. هذا التوقع إعلامي وليس دعوة للمراهنة.', dataUsed: 'البيانات المستخدمة', dataUsedDesc: 'البيانات المتاحة لهذا التحليل.', matchesAnalyzed: 'المباريات المشمولة', perTeam: 'لكل فريق', lambdaLabel: 'أهداف يقدّرها النموذج', lambdaHint: 'تقديرات مبنية على الأهداف الحديثة المتاحة، وليست نتيجة المباراة.', xgTotalLabel: 'إجمالي الأهداف المقدّر', modelSource: 'نموذج إحصائي', recentForm: 'الأداء الأخير', formBttsLabel: 'BTTS في المباريات الأخيرة', conclusion: 'الخاتمة', qualityNote: 'جودة البيانات تصف المعلومات المتاحة، ولا تعني فرصة الفوز.', publishedOn: 'نُشرت البيانات في', readOfMatch: 'قراءتنا للمباراة', riskLevel: 'مستوى الحذر', notAvailable: 'غير متوفر' },
}

export default async function MatchPage({ params, locale = 'fr' }: PageProps & { locale?: Locale }) {
  const { slug } = await params
  const match = getMatchBySlug(slug)

  if (!match) notFound()
  const copy = MATCH_COPY[locale]

  const { home, away, league, date, time, homeLogo, awayLogo, predictions } = match
  const verifiedHistory = getVerifiedHistoryForMatch(home, away, date)
  const aiKeyFact = match.aiKeyFact || null
  const aiAnalysis = match.aiAnalysis || null

  // One market card per prediction type. Archived feeds can contain repeated
  // rows for the same market; the match page must never present duplicates.
  const marketMap = new Map<string, (typeof predictions)[number]>()
  for (const prediction of predictions) {
    const market = (prediction.type || prediction.market || 'prediction').toLowerCase()
    const existing = marketMap.get(market)
    if (!existing || (!existing.status && prediction.status)) marketMap.set(market, prediction)
  }
  const marketPredictions = Array.from(marketMap.values()).map(prediction => {
    const verified = verifiedHistory.find(entry => verifiedMarketKey(entry.market || entry.type) === verifiedMarketKey(prediction.type || prediction.market))
    if (!verified) return prediction
    return {
      ...prediction,
      status: verified.status || (verified.isWon === true ? 'WON' : verified.isWon === false ? 'LOST' : prediction.status),
      isWon: verified.isWon,
      finalScore: verified.finalScore || verified.score || prediction.finalScore,
      verifiedAt: verified.verifiedAt || prediction.verifiedAt,
      source: verified.source || prediction.source,
    }
  })

  // Aggregate verification status from unique markets only.
  const verified = marketPredictions.filter(p => p.status === 'WON' || p.status === 'LOST')
  const won = verified.filter(p => p.status === 'WON').length
  const lost = verified.filter(p => p.status === 'LOST').length
  const pending = marketPredictions.filter(p => !p.status || p.status === 'PENDING').length
  const verifiedResult = verifiedHistory.find(entry => (entry.finalScore || entry.score) && (entry.finalScore || entry.score) !== '-')
  const finalScore = verifiedResult?.finalScore || verifiedResult?.score || null

  // Données réelles disponibles (aucune invention : section affichée seulement si présentes)
  const hasUsageData = match.dataQuality || match.dataSource || match.matchCountHome != null || match.aiRisk
  const hasLambda = match.homeLambda != null || match.awayLambda != null || match.xgTotal != null

  // Vraie date de publication/vérification issue des données (verifiedAt, sinon
  // la date de publication du snapshot). Aucune date codée en dur.
  const publishedDateRaw = verified[0]?.verifiedAt || match.lastUpdated || null
  const publishedDateLabel = publishedDateRaw
    ? new Date(publishedDateRaw).toLocaleDateString(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long' })
    : null

  // Breadcrumb JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: copy.home, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: copy.predictions, item: `${SITE_URL}/btts/predictions/today` },
      { '@type': 'ListItem', position: 3, name: `${home} vs ${away}`, item: `${SITE_URL}/match/${slug}` },
    ],
  }

  // SportsEvent JSON-LD (if real data)
  const sportsEventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${home} vs ${away}`,
    sport: 'Football',
    startDate: `${date}T${time || '00:00'}`,
    location: { '@type': 'Place', name: league },
    homeTeam: { '@type': 'SportsTeam', name: home, logo: homeLogo },
    awayTeam: { '@type': 'SportsTeam', name: away, logo: awayLogo },
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col text-[#F2F6FA]">
      <Navbar />
      <MatchViewTracker match={`${home} vs ${away}`} league={league} />

      <main id="main-content" className="flex-1">
        {/* Breadcrumb */}
        <nav aria-label={copy.breadcrumb} className="max-w-4xl mx-auto px-4 pt-6 pb-2 text-xs text-[#9DABBB]">
          <Link href={localizedPath('/', locale)} className="hover:text-[#2F7DFF]">{copy.home}</Link>
          <span className="mx-1">/</span>
          <Link href={localizedPath('/btts/predictions/today', locale)} className="hover:text-[#2F7DFF]">{copy.predictions}</Link>
          <span className="mx-1">/</span>
          <span className="text-[#9DABBB]">{home} vs {away}</span>
        </nav>

        <article className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8 rounded-3xl border border-[#223041] bg-[#141C25] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
            <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4">
              <div className="flex flex-col items-center gap-2 flex-1">
                {homeLogo && (
                  <img src={homeLogo} alt={`${home} logo`} width={80} height={80} className="rounded-xl object-contain" loading="lazy" decoding="async" />
                )}
                <span className="text-sm sm:text-base font-bold text-center">{home}</span>
              </div>
              <div className="text-2xl font-bold text-[#9DABBB]">vs</div>
              <div className="flex flex-col items-center gap-2 flex-1">
                {awayLogo && (
                  <img src={awayLogo} alt={`${away} logo`} width={80} height={80} className="rounded-xl object-contain" loading="lazy" decoding="async" />
                )}
                <span className="text-sm sm:text-base font-bold text-center">{away}</span>
              </div>
            </div>

            <div className="text-center text-sm text-[#9DABBB] mb-2">
              {league} · {date}{time ? ` · ${time}` : ''}
            </div>

            {finalScore && (
              <div className="text-center mb-2">
                <span className="inline-block px-4 py-2 rounded-xl text-lg font-bold" style={{ backgroundColor: '#10161D', border: '1px solid #223041' }}>
                  {copy.finalScore} : {finalScore}
                </span>
              </div>
            )}
          </header>

          {/* 1. PRONOSTICS */}
          <section className="mb-10">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7DFF]">{copy.intelligence}</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {copy.report}
                </h1>
              </div>
              <span className="text-right text-xs uppercase tracking-wider text-[#9DABBB]">{copy.published}{publishedDateLabel ? ` · ${publishedDateLabel}` : ''}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {marketPredictions.map((p, i) => {
                const market = (p.type || p.market || '').toLowerCase()
                const isBtts = market.includes('btts')
                const isOver = market.includes('over') || market.includes('o2.5') || market.includes('o25')
                const label = isBtts ? 'BTTS' : isOver ? 'Over 2.5' : (p.type || p.market || 'Prediction')
                const isWon = p.status === 'WON'
                const isLost = p.status === 'LOST'
                const isPending = !p.status || p.status === 'PENDING'
                const probLabel = Number.isFinite(p.proba) && p.proba > 0 && p.proba <= 1 ? `${Math.round(p.proba * 100)}%` : null

                return (
                  <div key={i} className="p-5 rounded-2xl bg-[#141C25] border border-[#223041]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2F7DFF]">
                        {label}
                      </span>
                      {probLabel && (
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(47,125,255,0.12)', color: '#2F7DFF' }}>
                          {probLabel}
                        </span>
                      )}
                    </div>

                    <div className="text-2xl font-black mb-2" style={{ color: p.prediction === 'Oui' ? '#F2F6FA' : '#9DABBB' }}>
                      {p.prediction === 'Oui' ? (locale === 'ar' ? 'نعم' : locale === 'en' ? 'Yes' : 'Oui') : p.prediction === 'Non' ? (locale === 'ar' ? 'لا' : locale === 'en' ? 'No' : 'Non') : p.prediction}
                    </div>

                    {/* Subtitle to make cards visually distinct */}
                    <div className="text-xs text-[#9DABBB] mb-3">
                      {isBtts ? copy.bttsSubtitle : isOver ? copy.overSubtitle : ''}
                    </div>

                    {isWon && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(52, 211, 153, 0.13)', color: '#34D399' }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#34D399' }} aria-hidden="true" />
                        {copy.won}
                      </div>
                    )}
                    {isLost && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(248, 113, 113, 0.13)', color: '#F87171' }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F87171' }} aria-hidden="true" />
                        {copy.lost}
                      </div>
                    )}
                    {isPending && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' }}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FBBF24' }} aria-hidden="true" />
                        {copy.pending}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-[#9DABBB] mt-4 leading-relaxed text-center">
              {copy.noFuture}
            </p>
          </section>

          <details className="mb-8 rounded-2xl border border-[#223041] p-4">
            <summary className="cursor-pointer text-sm font-semibold">{locale === 'en' ? 'How was this prediction calculated?' : locale === 'ar' ? 'كيف حُسب هذا التوقع؟' : 'Comment ce pronostic a-t-il été calculé ?'}</summary>
            <div className="mt-5">
          {/* 2. DONNÉES UTILISÉES */}
          {hasUsageData && (
            <section className="mb-10" aria-labelledby="match-data-used">
              <h2 id="match-data-used" className="text-xl font-bold mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.dataUsed}</h2>
              <p className="text-xs text-[#9DABBB] mb-4">{copy.dataUsedDesc}</p>
              <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-5">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl bg-[#10161D] border border-[#223041] p-3">
                    <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{copy.matchesAnalyzed}</dt>
                    <dd className="text-lg font-bold text-[#F2F6FA] font-mono mt-1">
                      {match.matchCountHome != null && match.matchCountAway != null
                        ? `${match.matchCountHome} + ${match.matchCountAway}`
                        : '—'}
                    </dd>
                    <dd className="text-xs text-[#6B7A8C]">{copy.perTeam}</dd>
                  </div>
                  {hasLambda && (
                    <div className="rounded-xl bg-[#10161D] border border-[#223041] p-3">
                      <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{locale === 'en' ? 'Home / away goals estimate' : locale === 'ar' ? 'تقدير أهداف المضيف / الضيف' : 'Buts estimés domicile / extérieur'}</dt>
                      <dd className="text-lg font-bold text-[#F2F6FA] font-mono mt-1">
                        {match.homeLambda != null && match.awayLambda != null
                          ? `${match.homeLambda.toFixed(2)} / ${match.awayLambda.toFixed(2)}`
                          : '—'}
                      </dd>
                      <dd className="text-xs text-[#6B7A8C]">{copy.lambdaLabel.toLowerCase()}</dd>
                    </div>
                  )}
                  {match.xgTotal != null && (
                    <div className="rounded-xl bg-[#10161D] border border-[#223041] p-3">
                      <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{copy.xgTotalLabel}</dt>
                      <dd className="text-lg font-bold text-[#F2F6FA] font-mono mt-1">{match.xgTotal.toFixed(2)}</dd>
                      <dd className="text-xs text-[#6B7A8C]">{copy.modelSource}</dd>
                    </div>
                  )}
                  <div className="rounded-xl bg-[#10161D] border border-[#223041] p-3">
                    <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">Source</dt>
                    <dd className="text-sm font-bold text-[#F2F6FA] mt-1 break-words">{match.dataSource || 'ESPN'}</dd>
                    <dd className="text-xs text-[#6B7A8C]">{match.dataQuality || ''}</dd>
                  </div>
                </dl>
                <p className="text-xs text-[#9DABBB] mt-3 leading-relaxed">{copy.lambdaHint}</p>
              </div>
            </section>
          )}

          {/* 3. FORME RÉCENTE & CONTEXTE (données réelles uniquement) */}
          {match.formBtts != null && (
            <section className="mb-10" aria-labelledby="match-recent-form">
              <h2 id="match-recent-form" className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.recentForm}</h2>
              <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {match.formBtts != null && (
                    <div className="flex items-center justify-between rounded-xl bg-[#10161D] border border-[#223041] px-4 py-3">
                      <span className="text-sm text-[#9DABBB]">{copy.formBttsLabel}</span>
                      <span className="text-sm font-bold text-[#F2F6FA] font-mono">{match.formBtts}%</span>
                    </div>
                  )}
                </div>

              </div>
            </section>
          )}

          {/* 4. INDICATEURS */}
          <section className="mb-10" aria-label={copy.intelligence}>
            <MatchAnalyticsCharts
              bttsProb={match.bttsProb}
              over25Prob={match.over25Prob}
              homeLambda={match.homeLambda}
              awayLambda={match.awayLambda}
              xgTotal={match.xgTotal}
              lang={locale}
            />
          </section>

          {/* 5. QUALITÉ DES DONNÉES — transparence (mission) */}
          {hasUsageData && (
            <section
              className="rounded-[16px] bg-[#10161D] border border-[#223041] p-4 sm:p-5 mb-10"
              aria-label={locale === 'en' ? 'Data quality' : locale === 'ar' ? 'جودة البيانات' : 'Qualité des données'}
            >
              <h2 className="text-sm font-bold text-[#F2F6FA] mb-3">{locale === 'en' ? 'Data quality' : locale === 'ar' ? 'جودة البيانات' : 'Qualité des données'}</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-[#141C25] border border-[#223041] p-2">
                  <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">{locale === 'en' ? 'Quality' : locale === 'ar' ? 'الجودة' : 'Qualité'}</dt>
                  <dd className="text-xs font-bold text-[#F2F6FA] mt-1">{match.dataQuality || copy.notAvailable}</dd>
                </div>
                <div className="rounded-lg bg-[#141C25] border border-[#223041] p-2">
                  <dt className="text-xs uppercase tracking-wider text-[#9DABBB] font-bold">Source</dt>
                  <dd className="text-xs font-bold text-[#F2F6FA] mt-1">{match.dataSource || copy.notAvailable}</dd>
                </div>
              </dl>
              <p className="text-xs text-[#9DABBB] mt-3">
                {copy.qualityNote}
              </p>
            </section>
          )}

            </div>
          </details>

          {/* 6. Lecture du match */}
          {(aiKeyFact || aiAnalysis) && (
            <section className="mb-10" aria-labelledby="match-conclusion">
              <h2 id="match-conclusion" className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.conclusion}</h2>
              <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
                <div className="flex items-center justify-between border-b border-[#223041] pb-3 mb-4">
                  <h3 className="text-sm font-bold text-[#F2F6FA]">{copy.readOfMatch}</h3>
                </div>

                {/* Statistique Clé */}
                {aiKeyFact && (
                  <div className="p-3 rounded-lg bg-[#10161D] border border-[#223041] mb-3">
                    <span className="text-xs font-bold text-[#2F7DFF] uppercase tracking-wider block mb-1">
                      {copy.keyFact}
                    </span>
                    <p className="text-sm text-[#F2F6FA] leading-relaxed">&ldquo;{aiKeyFact}&rdquo;</p>
                  </div>
                )}

                {/* Analyse Complète */}
                {aiAnalysis && (
                  <div className="p-3.5 rounded-lg bg-[#10161D] border border-[#223041]">
                    <span className="text-xs font-bold text-[#9DABBB] uppercase tracking-wider block mb-1">
                      {copy.analysis}
                    </span>
                    <p className="text-sm text-[#9DABBB] leading-relaxed">
                      {aiAnalysis}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 7. Vérification */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {copy.verification}
            </h2>
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#34D399' }}>{won}</div>
                  <div className="text-xs text-[#9DABBB] uppercase">{copy.won}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#F87171' }}>{lost}</div>
                  <div className="text-xs text-[#9DABBB] uppercase">{copy.lost}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono" style={{ color: '#FBBF24' }}>{pending}</div>
                  <div className="text-xs text-[#9DABBB] uppercase">{copy.pending}</div>
                </div>
              </div>
              {verified.length > 0 && verified[0].verifiedAt && (
                <p className="text-xs text-[#9DABBB] mt-3 text-center">
                  {copy.verifiedAt} {new Date(verified[0].verifiedAt).toLocaleString(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
              {verified.length === 0 && publishedDateLabel && (
                <p className="text-xs text-[#9DABBB] mt-3 text-center">
                  {copy.publishedOn} {publishedDateLabel}
                </p>
              )}
              <p className="text-xs text-[#9DABBB] mt-2 text-center">
                {copy.source}
              </p>
            </div>
          </section>

          {/* Liens internes */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {copy.further}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href={localizedPath('/btts/predictions/today', locale)} className="block p-4 rounded-xl transition-colors hover:border-[#2F7DFF]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7DFF]"
                style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
                <div className="text-sm font-bold text-[#F2F6FA] mb-1">{copy.today}</div>
                <div className="text-xs text-[#9DABBB]">{copy.todayDesc}</div>
              </Link>
              <Link href={localizedPath('/vip', locale)} className="block p-4 rounded-xl transition-colors hover:border-[#2F7DFF]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7DFF]"
                style={{ backgroundColor: '#141C25', border: '1px solid #223041' }}>
                <div className="text-sm font-bold text-[#F2F6FA] mb-1">{copy.premium}</div>
                <div className="text-xs text-[#9DABBB]">{copy.vipDesc}</div>
              </Link>
            </div>
          </section>

          {/* Disclaimer */}
          <section>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(255, 122, 122, 0.06)', border: '1px solid rgba(255, 122, 122, 0.2)' }}>
              <p className="text-xs text-[#9DABBB] leading-relaxed">
                {copy.disclaimer}
              </p>
            </div>
          </section>
        </article>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} />
    </div>
  )
}
