import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar, Footer } from '@/components/bttsbet'
import { generateMatchSlug, getAllMatchSlugs, getMatchBySlug, getVerifiedHistoryForMatch, verifiedMarketKey } from '@/lib/matches'
import type { TeamFormSummary } from '@/lib/matches'
import Link from 'next/link'
import MatchAnalyticsCharts from '@/components/bttsbet/MatchAnalyticsCharts'
import MatchViewTracker from '@/components/bttsbet/MatchViewTracker'
import TeamContext from '@/components/bttsbet/TeamContext'
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
  lastMinute: string; lastMinuteSub: string; letterWin: string; letterDraw: string; letterLoss: string;
  venueHome: string; venueAway: string; noRecent: string;
  newsSection: string; newsSub: string; absencesLabel: string; oddsInsightLabel: string;
  formSection: string; formSub: string; statGoalsFor: string; statGoalsAgainst: string;
  statCleanSheets: string; statFailedToScore: string; statBtts: string; statOver: string;
  formMatches: string; standingsLabel: string; ptsUnit: string; playedUnit: string;
  oddsSection: string; oddsNote: string; oddsHome: string; oddsDraw: string; oddsAway: string; oddsOver: string; oddsUnder: string;
}> = {
  fr: { home: 'Accueil', predictions: 'Pronostics', breadcrumb: 'Fil d’Ariane', finalScore: 'Score réel vérifié', predictedScore: 'Score estimé', report: 'Pronostics du modèle', published: 'Données publiées', bttsSubtitle: 'Les deux équipes marquent', overSubtitle: 'Total de buts ≥ 3', won: 'Gagné', lost: 'Perdu', pending: 'En attente', noFuture: 'Aucun résultat futur n’est garanti. 18+.', keyFact: 'À retenir', analysis: 'Analyse statistique', verification: 'Vérification', verifiedAt: 'Vérifié le', source: 'Source : ESPN et TheSportsDB.', intelligence: 'Analyse du match', further: 'Aller plus loin', today: 'Voir les pronostics du jour →', todayDesc: 'Tous les matchs analysés par notre modèle statistique', premium: 'Pronostics premium →', vipDesc: 'Programme VIP BTTSPredict', disclaimer: '18+ · Les paris sportifs comportent un risque de perte. Aucun résultat futur n’est garanti. BTTSPredict ne prend pas de paris et ne collecte pas de fonds. Pronostic publié à titre informatif, ne constitue pas une incitation à parier.', dataUsed: 'Données utilisées', dataUsedDesc: 'Informations disponibles pour cette analyse.', matchesAnalyzed: 'Matchs pris en compte', perTeam: 'par équipe', lambdaLabel: 'Buts estimés par le modèle', lambdaHint: 'Estimations calculées à partir des buts récents disponibles ; ce ne sont pas des scores de match.', xgTotalLabel: 'Total de buts estimé', modelSource: 'Modèle statistique', recentForm: 'Forme récente', formBttsLabel: 'BTTS sur les matchs récents', conclusion: 'Conclusion', qualityNote: 'La qualité des données décrit les informations disponibles, pas les chances de gagner.', publishedOn: 'Données publiées le', readOfMatch: 'notre lecture du match', riskLevel: 'Niveau de prudence', notAvailable: 'Non disponible', lastMinute: 'Dernière minute', lastMinuteSub: 'Historique des 5 derniers matchs de chaque équipe — source ESPN, mise à jour avant le coup d’envoi.', letterWin: 'V', letterDraw: 'N', letterLoss: 'D', venueHome: 'D', venueAway: 'E', noRecent: 'Aucun match récent enregistré pour cette équipe.', newsSection: 'Actualités & infos clés', newsSub: 'Analyses et points clés issus de nos données, actualisés avant le coup d’envoi.', absencesLabel: 'Absents & indisponibles', oddsInsightLabel: 'Lecture des cotes', formSection: 'Forme des équipes', formSub: 'Bilan des derniers matchs (source ESPN) : résultats, buts et tendances BTTS / Over 2.5.', statGoalsFor: 'Buts marqués', statGoalsAgainst: 'Buts encaissés', statCleanSheets: 'Sans encaisser', statFailedToScore: 'Sans marquer', statBtts: 'BTTS', statOver: 'Over 2.5', formMatches: 'derniers matchs', standingsLabel: 'Classement', ptsUnit: 'pts', playedUnit: 'MJ', oddsSection: 'Cotes du marché', oddsNote: 'Cotes indicatives du marché, susceptibles de varier. 18+.', oddsHome: '1', oddsDraw: 'N', oddsAway: '2', oddsOver: 'Over 2.5', oddsUnder: 'Under 2.5' },
  en: { home: 'Home', predictions: 'Predictions', breadcrumb: 'Breadcrumb', finalScore: 'Verified result', predictedScore: 'Model score estimate', report: 'Model predictions', published: 'Published data', bttsSubtitle: 'Both teams to score', overSubtitle: 'Total goals ≥ 3', won: 'Won', lost: 'Lost', pending: 'Pending', noFuture: 'No future result is guaranteed. 18+.', keyFact: 'À retenir', analysis: 'Statistical analysis', verification: 'Verification', verifiedAt: 'Verified on', source: 'Source: ESPN and TheSportsDB.', intelligence: 'Match analysis', further: 'Explore further', today: 'View today’s predictions →', todayDesc: 'All matches analyzed by our statistical model', premium: 'Premium predictions →', vipDesc: 'BTTSPredict VIP programme', disclaimer: '18+ · Sports betting carries a risk of loss. No future result is guaranteed. BTTSPredict does not take bets or hold funds. This prediction is informational and is not an invitation to bet.', dataUsed: 'Data used', dataUsedDesc: 'Information available for this analysis.', matchesAnalyzed: 'Matches included', perTeam: 'per team', lambdaLabel: 'Model-estimated goals', lambdaHint: 'Estimates based on available recent goals; they are not match scores.', xgTotalLabel: 'Estimated total goals', modelSource: 'Statistical model', recentForm: 'Recent form', formBttsLabel: 'BTTS in recent matches', conclusion: 'Conclusion', qualityNote: 'Data quality describes the information available, not the chance of winning.', publishedOn: 'Data published on', readOfMatch: 'our read of the match', riskLevel: 'Prudence level', notAvailable: 'Not available', lastMinute: 'Last-minute insights', lastMinuteSub: 'Each team’s last 5 matches — ESPN data, refreshed before kick-off.', letterWin: 'W', letterDraw: 'D', letterLoss: 'L', venueHome: 'H', venueAway: 'A', noRecent: 'No recent match recorded for this team.', newsSection: 'Team news & key insights', newsSub: 'What our data says about this match — refreshed before kick-off.', absencesLabel: 'Absences & unavailability', oddsInsightLabel: 'Odds read', formSection: 'Team form', formSub: 'Recent matches breakdown (ESPN source): results, goals and BTTS / Over 2.5 trends.', statGoalsFor: 'Goals scored', statGoalsAgainst: 'Goals conceded', statCleanSheets: 'Clean sheets', statFailedToScore: 'Failed to score', statBtts: 'BTTS', statOver: 'Over 2.5', formMatches: 'recent games', standingsLabel: 'Standing', ptsUnit: 'pts', playedUnit: 'MP', oddsSection: 'Market odds', oddsNote: 'Indicative market odds, subject to change. 18+.', oddsHome: '1', oddsDraw: 'X', oddsAway: '2', oddsOver: 'Over 2.5', oddsUnder: 'Under 2.5' },
  ar: { home: 'الرئيسية', predictions: 'التوقعات', breadcrumb: 'مسار التنقل', finalScore: 'النتيجة الفعلية المؤكدة', predictedScore: 'نتيجة تقديرية', report: 'توقعات النموذج', published: 'بيانات منشورة', bttsSubtitle: 'كلا الفريقين يسجلان', overSubtitle: 'إجمالي الأهداف ≥ 3', won: 'فوز', lost: 'خسارة', pending: 'قيد الانتظار', noFuture: 'لا توجد ضمانات لأي نتيجة مستقبلية. 18+.', keyFact: 'الخلاصة', analysis: 'تحليل إحصائي', verification: 'التحقق', verifiedAt: 'تم التحقق في', source: 'المصدر: ESPN وTheSportsDB.', intelligence: 'تحليل المباراة', further: 'استكشف المزيد', today: 'عرض توقعات اليوم ←', todayDesc: 'جميع المباريات التي حللها نموذجنا الإحصائي', premium: 'التوقعات المميزة ←', vipDesc: 'برنامج VIP من BTTSPredict', disclaimer: '18+ · المراهنات الرياضية تنطوي على خطر الخسارة. لا توجد ضمانات لأي نتيجة مستقبلية. BTTSPredict لا يقبل الرهانات ولا يحتفظ بالأموال. هذا التوقع إعلامي وليس دعوة للمراهنة.', dataUsed: 'البيانات المستخدمة', dataUsedDesc: 'البيانات المتاحة لهذا التحليل.', matchesAnalyzed: 'المباريات المشمولة', perTeam: 'لكل فريق', lambdaLabel: 'أهداف يقدّرها النموذج', lambdaHint: 'تقديرات مبنية على الأهداف الحديثة المتاحة، وليست نتيجة المباراة.', xgTotalLabel: 'إجمالي الأهداف المقدّر', modelSource: 'نموذج إحصائي', recentForm: 'الأداء الأخير', formBttsLabel: 'BTTS في المباريات الأخيرة', conclusion: 'الخاتمة', qualityNote: 'جودة البيانات تصف المعلومات المتاحة، ولا تعني فرصة الفوز.', publishedOn: 'نُشرت البيانات في', readOfMatch: 'قراءتنا للمباراة', riskLevel: 'مستوى الحذر', notAvailable: 'غير متوفر', lastMinute: 'آخر اللحظات', lastMinuteSub: 'آخر 5 مباريات لكل فريق — بيانات ESPN، تُحدّث قبل انطلاق المباراة.', letterWin: 'ف', letterDraw: 'ت', letterLoss: 'خ', venueHome: 'د', venueAway: 'خ', noRecent: 'لا توجد مباريات حديثة مسجّلة لهذا الفريق.', newsSection: 'أخبار الفريقين ومعلومات أساسية', newsSub: 'ما تقوله بياناتنا عن هذه المباراة — تُحدّث قبل انطلاق المباراة.', absencesLabel: 'الغائبون وغير المتاحين', oddsInsightLabel: 'قراءة الأسواق', formSection: 'أداء الفريقين', formSub: 'حصيلة المباريات الأخيرة (مصدر ESPN): النتائج والأهداف واتجاهات BTTS وOver 2.5.', statGoalsFor: 'أهداف مسجّلة', statGoalsAgainst: 'أهداف مستقبلة', statCleanSheets: 'شباك نظيفة', statFailedToScore: 'دون تسجيل', statBtts: 'BTTS', statOver: 'Over 2.5', formMatches: 'مباريات أخيرة', standingsLabel: 'الترتيب', ptsUnit: 'نقطة', playedUnit: 'مباراة', oddsSection: 'أسواق المراهنات', oddsNote: 'أسعار السوق إرشادية وقابلة للتغيير. 18+.', oddsHome: '1', oddsDraw: 'X', oddsAway: '2', oddsOver: 'Over 2.5', oddsUnder: 'Under 2.5' },
}

const FORM_LETTERS: Record<string, 'W' | 'D' | 'L'> = { V: 'W', N: 'D', D: 'L', W: 'W' }

interface Last5Record {
  date: string
  opponent: string
  venue: 'H' | 'A'
  score: string
  result: 'W' | 'D' | 'L'
}

interface TeamFormView {
  results: Array<'W' | 'D' | 'L'>
  goalsFor: number | null
  goalsAgainst: number | null
  bttsRate: number | null
  over25Rate: number | null
  cleanSheets: number | null
  failedToScore: number | null
  count: number
}

/**
 * Dérive un bilan (buts, BTTS, Over 2.5, clean sheets) depuis les 5 derniers
 * matchs publiés. Utilisé en repli quand le pipeline n'a pas publié formHome/formAway.
 */
function deriveFormFromRecords(records: Last5Record[] | undefined) {
  if (!records || records.length === 0) return null
  let goalsFor = 0
  let goalsAgainst = 0
  let btts = 0
  let over = 0
  let cleanSheets = 0
  let failedToScore = 0
  for (const record of records) {
    const [scored, conceded] = record.score.split('-').map(value => Number.parseInt(value, 10))
    if (!Number.isFinite(scored) || !Number.isFinite(conceded)) continue
    goalsFor += scored
    goalsAgainst += conceded
    if (scored > 0 && conceded > 0) btts += 1
    if (scored + conceded >= 3) over += 1
    if (conceded === 0) cleanSheets += 1
    if (scored === 0) failedToScore += 1
  }
  return {
    goalsFor,
    goalsAgainst,
    bttsRate: btts / records.length,
    over25Rate: over / records.length,
    cleanSheets,
    failedToScore,
    count: records.length,
  }
}

/**
 * Vue de forme par équipe : chiffres du pipeline (formHome/formAway) en priorité,
 * sinon dérivés des derniers matchs. Les pastilles de résultat viennent des
 * records quand ils existent, sinon de last5String (V-N-D → W-D-L).
 */
function buildFormView(records: Last5Record[] | undefined, form: TeamFormSummary | null | undefined): TeamFormView | null {
  const derived = deriveFormFromRecords(records)
  if ((!records || records.length === 0) && !form) return null
  const pick = (pipeline: number | undefined, fallback: number | null | undefined): number | null =>
    typeof pipeline === 'number' && Number.isFinite(pipeline) ? pipeline : fallback ?? null
  const results: Array<'W' | 'D' | 'L'> = records && records.length > 0
    ? records.map(record => record.result)
    : (form?.last5String || '')
        .split('-')
        .map(letter => FORM_LETTERS[letter.trim()])
        .filter((value): value is 'W' | 'D' | 'L' => Boolean(value))
  return {
    results,
    goalsFor: pick(form?.goalsFor, derived?.goalsFor),
    goalsAgainst: pick(form?.goalsAgainst, derived?.goalsAgainst),
    bttsRate: pick(form?.bttsRate, derived?.bttsRate),
    over25Rate: pick(form?.over25Rate, derived?.over25Rate),
    cleanSheets: pick(form?.cleanSheets, derived?.cleanSheets),
    failedToScore: pick(form?.failedToScore, derived?.failedToScore),
    count: typeof form?.count === 'number' && form.count > 0 ? form.count : records?.length ?? 0,
  }
}

function FormPills({ results, letters }: { results: Array<'W' | 'D' | 'L'>; letters: { W: string; D: string; L: string } }) {
  return (
    <span className="ml-auto flex shrink-0 gap-1" aria-hidden="true">
      {results.map((result, i) => (
        <i
          key={`${result}-${i}`}
          className={`not-italic inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
            result === 'W'
              ? 'bg-[#1E4620] text-[#6EE787]'
              : result === 'L'
                ? 'bg-[#4A1D1D] text-[#FF8A80]'
                : 'bg-[#26313D] text-[#9DABBB]'
          }`}
        >
          {result === 'W' ? letters.W : result === 'L' ? letters.L : letters.D}
        </i>
      ))}
    </span>
  )
}

function FormStat({ value, label }: { value: string | number | null; label: string }) {
  return (
    <div className="rounded-xl border border-[#223041] bg-[#10161D] p-2 text-center">
      <div className="font-mono text-base font-bold text-[#F2F6FA]">{value ?? '—'}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6B7A8C]">{label}</div>
    </div>
  )
}

function NewsCard({ label, text, accent }: { label: string; text: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-5" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <span className="text-xs font-bold uppercase tracking-wider text-[#9DABBB]">{label}</span>
      <p className="mt-1 text-sm leading-relaxed text-[#F2F6FA]">{text}</p>
    </div>
  )
}

function StatusBadge({ kind, label }: { kind: 'won' | 'lost' | 'pending'; label: string }) {
  const palette: { backgroundColor: string; color: string } = kind === 'won'
    ? { backgroundColor: 'rgba(52, 211, 153, 0.13)', color: '#34D399' }
    : kind === 'lost'
      ? { backgroundColor: 'rgba(248, 113, 113, 0.13)', color: '#F87171' }
      : { backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={palette}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.color }} aria-hidden="true" />
      {label}
    </div>
  )
}

export default async function MatchPage({ params, locale = 'fr' }: PageProps & { locale?: Locale }) {
  const { slug } = await params
  const match = getMatchBySlug(slug)

  if (!match) notFound()
  const copy = MATCH_COPY[locale]

  const { home, away, league, date, time, homeLogo, awayLogo, predictions } = match
  const verifiedHistory = getVerifiedHistoryForMatch(home, away, date)

  // Champs éditoriaux : la version anglaise est préférée sur les pages /en quand disponible.
  const pickLocalized = (fr?: string | null, en?: string | null) => (locale === 'en' && en ? en : fr) || null
  const keyFactText = pickLocalized(match.aiKeyFact, match.aiKeyFactEn)
  const analysisText = pickLocalized(match.aiAnalysis, match.aiAnalysisEn)
  const absencesText = pickLocalized(match.aiAbsences, match.aiAbsencesEn)
  const oddsInsightText = pickLocalized(match.aiOddsInsight, match.aiOddsInsightEn)
  const hasNews = Boolean(keyFactText || absencesText || oddsInsightText || analysisText)

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

  // Forme détaillée : stats du pipeline (formHome/formAway) sinon dérivées des derniers matchs.
  const homeFormView = buildFormView(match.last5Home, match.formHome)
  const awayFormView = buildFormView(match.last5Away, match.formAway)
  const hasTeamForm = Boolean(homeFormView || awayFormView)
  const formLetters = { W: copy.letterWin, D: copy.letterDraw, L: copy.letterLoss }

  // Cotes du marché (affichées seulement si présentes).
  const oddsItems = match.odds
    ? ([
        { label: copy.oddsHome, value: match.odds.home },
        { label: copy.oddsDraw, value: match.odds.draw },
        { label: copy.oddsAway, value: match.odds.away },
        { label: copy.oddsOver, value: match.odds.over25 },
        { label: copy.oddsUnder, value: match.odds.under25 },
      ] as const).filter(item => typeof item.value === 'number' && Number.isFinite(item.value))
    : []

  // Probabilités du modèle en pourcentage (0..1 → 0..100).
  const toPercent = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null)
  const bttsPercent = toPercent(match.bttsProb)
  const overPercent = toPercent(match.over25Prob)

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
          {/* HERO — en-tête visuel du match */}
          <header className="relative mb-10 overflow-hidden rounded-3xl border border-[#223041] shadow-[0_24px_80px_rgba(0,0,0,0.35)]" style={{ background: 'linear-gradient(140deg, #13223B 0%, #141C25 48%, #0E141B 100%)' }}>
            <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(closest-side, #2F7DFF, transparent)' }} />

            <div className="relative flex flex-wrap items-center justify-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-wider sm:pt-8">
              {league && <span className="rounded-full border border-[#223041] bg-[#10161D] px-3 py-1 text-[#9DABBB]">{league}</span>}
              <span className="rounded-full border border-[#223041] bg-[#10161D] px-3 py-1 font-mono text-[#9DABBB]">{date}{time ? ` · ${time}` : ''}</span>
              {match.dataQuality && (
                <span className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(52, 211, 153, 0.12)', color: '#34D399' }}>{match.dataQuality}</span>
              )}
            </div>

            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-7 sm:gap-6 sm:px-8 sm:py-9">
              <div className="flex flex-col items-center gap-3 text-center">
                {homeLogo ? (
                  <img src={homeLogo} alt={`Logo ${home}`} width={84} height={84} className="h-14 w-14 rounded-2xl bg-[#10161D] object-contain p-1 ring-1 ring-[#223041] sm:h-20 sm:w-20" decoding="async" />
                ) : (
                  <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10161D] text-lg font-black text-[#9DABBB] ring-1 ring-[#223041] sm:h-20 sm:w-20">{home.slice(0, 2).toUpperCase()}</div>
                )}
                <span className="text-sm font-bold leading-tight sm:text-lg">{home}</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xl font-black tracking-tight text-[#9DABBB] sm:text-3xl">VS</span>
                {finalScore && (
                  <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: 'rgba(52, 211, 153, 0.13)', color: '#34D399' }}>
                    {copy.finalScore} : {finalScore}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center gap-3 text-center">
                {awayLogo ? (
                  <img src={awayLogo} alt={`Logo ${away}`} width={84} height={84} className="h-14 w-14 rounded-2xl bg-[#10161D] object-contain p-1 ring-1 ring-[#223041] sm:h-20 sm:w-20" decoding="async" />
                ) : (
                  <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10161D] text-lg font-black text-[#9DABBB] ring-1 ring-[#223041] sm:h-20 sm:w-20">{away.slice(0, 2).toUpperCase()}</div>
                )}
                <span className="text-sm font-bold leading-tight sm:text-lg">{away}</span>
              </div>
            </div>

            {(bttsPercent != null || overPercent != null) && (
              <div className="relative flex flex-wrap items-center justify-center gap-2 pb-6 sm:pb-8">
                {bttsPercent != null && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#223041] bg-[#10161D]/80 px-3.5 py-1.5 text-xs font-bold">
                    <span className="text-[#9DABBB]">BTTS</span>
                    <span className="font-mono text-sm text-[#2F7DFF]">{bttsPercent}%</span>
                  </span>
                )}
                {overPercent != null && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#223041] bg-[#10161D]/80 px-3.5 py-1.5 text-xs font-bold">
                    <span className="text-[#9DABBB]">Over 2.5</span>
                    <span className="font-mono text-sm text-[#2F7DFF]">{overPercent}%</span>
                  </span>
                )}
              </div>
            )}
          </header>

          {/* 1. PRONOSTICS DU MODÈLE */}
          <section className="mb-10">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2F7DFF]">{copy.intelligence}</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {home} vs {away}
                  <span className="text-[#9DABBB]"> · BTTS &amp; Over 2.5</span>
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
                const probPercent = Number.isFinite(p.proba) && p.proba > 0 && p.proba <= 1 ? Math.round(p.proba * 100) : null

                return (
                  <div key={i} className="rounded-2xl border border-[#223041] bg-[#141C25] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2F7DFF]">{label}</span>
                      {probPercent != null && (
                        <span className="rounded px-2 py-0.5 font-mono text-xs font-bold" style={{ backgroundColor: 'rgba(47, 125, 255, 0.12)', color: '#2F7DFF' }}>
                          {probPercent}%
                        </span>
                      )}
                    </div>

                    <div className="mb-1 text-3xl font-black" style={{ color: p.prediction === 'Oui' ? '#F2F6FA' : '#9DABBB' }}>
                      {p.prediction === 'Oui' ? (locale === 'ar' ? 'نعم' : locale === 'en' ? 'Yes' : 'Oui') : p.prediction === 'Non' ? (locale === 'ar' ? 'لا' : locale === 'en' ? 'No' : 'Non') : p.prediction}
                    </div>

                    <div className="mb-3 text-xs text-[#9DABBB]">
                      {isBtts ? copy.bttsSubtitle : isOver ? copy.overSubtitle : ''}
                    </div>

                    {probPercent != null && (
                      <div className="mb-4 h-2 w-full overflow-hidden rounded-full border border-[#223041] bg-[#10161D]" role="img" aria-label={`${label} : ${probPercent}%`}>
                        <div className="h-full rounded-full" style={{ width: `${probPercent}%`, background: 'linear-gradient(90deg, #1B4DBF, #2F7DFF)' }} />
                      </div>
                    )}

                    {isWon && <StatusBadge kind="won" label={copy.won} />}
                    {isLost && <StatusBadge kind="lost" label={copy.lost} />}
                    {isPending && <StatusBadge kind="pending" label={copy.pending} />}
                  </div>
                )
              })}
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-[#9DABBB]">
              {copy.noFuture}
            </p>
          </section>

          {/* 2. COTES DU MARCHÉ (affichées seulement si présentes) */}
          {oddsItems.length > 0 && (
            <section className="mb-10" aria-labelledby="match-odds">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="match-odds" className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.oddsSection}</h2>
                {match.odds?.provider && <span className="text-xs uppercase tracking-wider text-[#9DABBB]">{match.odds.provider}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {oddsItems.map(item => (
                  <div key={item.label} className="rounded-xl border border-[#223041] bg-[#141C25] p-3 text-center">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#9DABBB]">{item.label}</div>
                    <div className="mt-1 font-mono text-lg font-bold text-[#F2F6FA]">{item.value?.toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#6B7A8C]">{copy.oddsNote}</p>
            </section>
          )}

          {/* 3. ACTUALITÉS & INFOS CLÉS (analyse éditoriale du pipeline) */}
          {hasNews && (
            <section className="mb-10" aria-labelledby="match-news">
              <h2 id="match-news" className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.newsSection}</h2>
              <p className="mb-4 mt-1 text-xs text-[#9DABBB]">{copy.newsSub}</p>
              <div className="space-y-3">
                {keyFactText && (
                  <div className="rounded-2xl border border-[#223041] bg-[#141C25] p-4 sm:p-5" style={{ borderLeft: '3px solid #2F7DFF' }}>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2F7DFF]">{copy.keyFact}</span>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-[#F2F6FA]">{keyFactText}</p>
                  </div>
                )}
                {absencesText && <NewsCard label={copy.absencesLabel} text={absencesText} accent="#FBBF24" />}
                {oddsInsightText && <NewsCard label={copy.oddsInsightLabel} text={oddsInsightText} accent="#34D399" />}
                {analysisText && <NewsCard label={copy.analysis} text={analysisText} />}
              </div>
            </section>
          )}

          {/* 4. FORME DES ÉQUIPES — comparaison détaillée (VISIBLE, données ESPN) */}
          {hasTeamForm && (
            <section className="mb-10" aria-labelledby="match-team-form">
              <h2 id="match-team-form" className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.formSection}</h2>
              <p className="mb-4 mt-1 text-xs text-[#9DABBB]">{copy.formSub}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  { team: home, logo: homeLogo, view: homeFormView, standings: match.standingsHome },
                  { team: away, logo: awayLogo, view: awayFormView, standings: match.standingsAway },
                ] as const).map(side => (
                  <div key={side.team} className="rounded-2xl border border-[#223041] bg-[#141C25] p-4">
                    <div className="flex items-center gap-2 border-b border-[#223041] pb-3">
                      {side.logo && <img src={side.logo} alt="" width={26} height={26} loading="lazy" className="shrink-0 rounded" />}
                      <span className="truncate text-sm font-bold text-[#F2F6FA]">{side.team}</span>
                      {side.view && side.view.results.length > 0 && (
                        <FormPills results={side.view.results} letters={formLetters} />
                      )}
                    </div>

                    {side.view ? (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <FormStat value={side.view.goalsFor} label={copy.statGoalsFor} />
                          <FormStat value={side.view.goalsAgainst} label={copy.statGoalsAgainst} />
                          <FormStat value={side.view.cleanSheets} label={copy.statCleanSheets} />
                          <FormStat value={side.view.failedToScore} label={copy.statFailedToScore} />
                          <FormStat value={side.view.bttsRate != null ? `${Math.round(side.view.bttsRate * 100)}%` : null} label={copy.statBtts} />
                          <FormStat value={side.view.over25Rate != null ? `${Math.round(side.view.over25Rate * 100)}%` : null} label={copy.statOver} />
                        </div>
                        <p className="mt-2 text-[11px] text-[#6B7A8C]">
                          {side.view.count > 0 ? `${side.view.count} ${copy.formMatches} · ` : ''}ESPN
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-[#9DABBB]">{copy.noRecent}</p>
                    )}

                    {side.standings && side.standings.rank != null && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#223041] bg-[#10161D] px-3 py-2 text-xs">
                        <span className="font-bold text-[#F2F6FA]">{copy.standingsLabel} : <span className="font-mono text-[#2F7DFF]">#{side.standings.rank}</span></span>
                        {side.standings.points != null && <span className="text-[#9DABBB]">· {side.standings.points} {copy.ptsUnit}</span>}
                        {side.standings.played != null && <span className="text-[#9DABBB]">· {side.standings.played} {copy.playedUnit}</span>}
                        {side.standings.gf != null && side.standings.ga != null && <span className="font-mono text-[#9DABBB]">· {side.standings.gf}:{side.standings.ga}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {match.formBtts != null && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-[#223041] bg-[#141C25] px-4 py-3 text-sm">
                  <span className="text-[#9DABBB]">{copy.formBttsLabel}</span>
                  <span className="font-mono font-bold text-[#F2F6FA]">{match.formBtts}%</span>
                </div>
              )}
            </section>
          )}

          {/* 5. DERNIÈRE MINUTE — historique détaillé des 5 derniers matchs
              de chaque équipe (données réelles ESPN ; section masquée si absentes) */}
          {(match.last5Home?.length || match.last5Away?.length) ? (
            <section className="mb-10" aria-labelledby="match-last-minute">
              <h2 id="match-last-minute" className="text-xl font-bold mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.lastMinute}</h2>
              <p className="text-xs text-[#9DABBB] mb-4">{copy.lastMinuteSub}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { team: home, logo: homeLogo, records: match.last5Home || [] },
                  { team: away, logo: awayLogo, records: match.last5Away || [] },
                ] as const).map(side => (
                  <div key={side.team} className="rounded-2xl border border-[#223041] bg-[#141C25] p-4">
                    <div className="flex items-center gap-2 border-b border-[#223041] pb-3 mb-3">
                      {side.logo && (
                        <img src={side.logo} alt="" width={26} height={26} loading="lazy" className="shrink-0 rounded" />
                      )}
                      <span className="text-sm font-bold text-[#F2F6FA] truncate">{side.team}</span>
                      <FormPills results={side.records.map(record => record.result)} letters={formLetters} />
                    </div>
                    {side.records.length === 0 ? (
                      <p className="text-xs text-[#9DABBB]">{copy.noRecent}</p>
                    ) : (
                      <ul className="space-y-2">
                        {side.records.map((r, i) => (
                          <li
                            key={`${side.team}-rec-${i}`}
                            className="flex items-center gap-2 rounded-lg bg-[#10161D] border border-[#223041] px-3 py-2 text-xs"
                          >
                            <span className="text-[#9DABBB] font-mono shrink-0">{r.date ? r.date.slice(5).replace('-', '/') : '—'}</span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${r.venue === 'H' ? 'bg-[#223041] text-[#9DABBB]' : 'bg-[#1B2A3A] text-[#7FB2FF]'}`}>
                              {r.venue === 'H' ? copy.venueHome : copy.venueAway}
                            </span>
                            <span className="truncate text-[#F2F6FA]">{r.opponent}</span>
                            <span className="ml-auto shrink-0 font-mono font-bold text-[#F2F6FA]">{r.score}</span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                r.result === 'W' ? 'bg-[#1E4620] text-[#6EE787]' : r.result === 'L' ? 'bg-[#4A1D1D] text-[#FF8A80]' : 'bg-[#26313D] text-[#9DABBB]'
                              }`}
                            >
                              {r.result === 'W' ? copy.letterWin : r.result === 'L' ? copy.letterLoss : copy.letterDraw}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* 6. ESTIMATIONS DU MODÈLE (graphiques) */}
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

          {/* 7. DONNÉES UTILISÉES */}
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

          {/* 8. CONTEXTE DES ÉQUIPES (actualités de sources ouvertes quand disponibles) */}
          <TeamContext home={home} away={away} locale={locale} />

          {/* 9. QUALITÉ DES DONNÉES — transparence (mission) */}
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

          {/* 10. Vérification */}
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
