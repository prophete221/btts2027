// ═════════════════════════════════════════════════════════════════════════════
// BTTSPredict – Predictions Engine v91
// Display-first: always publishes top N matches per day (sorted by reliability)
// Eliminates only truly unusable matches. Generous thresholds = always visible.
// ═════════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { validatePredictionPayload } from './validate-predictions.mjs'
import { deriveFormBtts, hasSufficientTeamStats } from './prediction-model.mjs'
import { publicVipFixture } from './public-predictions.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const PREDICTIONS_FILE = path.join(PUBLIC_DIR, 'predictions.json')

function writeJsonAtomically(file, payload) {
  const tempFile = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2))
  fs.renameSync(tempFile, file)
}

const FUTURE_DAYS = 7        // look ahead 7 days to ensure we always have matches
// Régression du 22/10 : la limite unique MAX_FREE=12 remplissait tous les slots
// free avec les seuls matchs du jour (163 acceptés les jeudis Europa/Conference
// après l'ajout des ligues du 20-21/10) — les matchs de demain et des jours
// suivants n'étaient JAMAIS publiés (section « À venir » vide, onglet « Demain »
// de la homepage vide). Publication par quotas quotidiens :
const MAX_FREE_TODAY = 24     // matchs du jour en accès libre (budget Gemini ≈ 6 chunks)
const MAX_PER_DAY_UPCOMING = 8 // matchs publiés par jour à venir (J+1..J+N)
const MAX_UPCOMING_DAYS = 5   // profondeur « À venir » affichée
const MAX_VIP = 8            // show up to 8 VIP matches (toujours des matchs du jour)
const DISPLAY_TZ = 'Africa/Dakar'  // Senegal timezone = UTC+0 (GMT)
const MIN_KICKOFF_LEAD_MINUTES = 30 // safety buffer for long enrichment/verification steps

// Ligues ESPN suivies. Aucune moyenne de ligue n'est utilisée pour fabriquer
// une prédiction lorsque les données d'équipe sont insuffisantes.
const ESPN_SLUGS = {
  'uefa.champions': 'UEFA Champions League',
  // Jeudi = soirée Europa League + Conference League — sans elles, les jeudis
  // affichaient 0 match (régression du 22/10 : 36 matchs ESPN ignorés).
  'uefa.europa': 'UEFA Europa League',
  'uefa.europa.conf': 'UEFA Conference League',
  'eng.1': 'Premier League',
  'eng.2': 'Championship',
  'esp.1': 'LaLiga',
  'ita.1': 'Serie A',
  'fra.1': 'Ligue 1',
  'ger.1': 'Bundesliga',
  'ger.2': '2. Bundesliga',
  'ned.1': 'Eredivisie',
  'bel.1': 'Jupiler Pro League',
  // ⚠ swi.1 renvoie HTTP 400 sur l'API ESPN — le vrai slug suisse est sui.1.
  'sui.1': 'Swiss Super League',
  'por.1': 'Liga Portugal',
  'aut.1': 'Austrian Bundesliga',
  'sco.1': 'Scottish Premiership',
  'usa.1': 'MLS',
}

// ─── Helpers ───
function getTodayISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ })
}

function formatDateParam(d) {
  // Use local date in DISPLAY_TZ
  const tzDate = new Date(d.toLocaleString('en-US', { timeZone: DISPLAY_TZ }))
  const y = tzDate.getFullYear()
  const m = String(tzDate.getMonth() + 1).padStart(2, '0')
  const day = String(tzDate.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// ─── Cotes réelles (bookmaker) SANS clé API — source ESPN scoreboard ───
// ESPN expose gratuitement les cotes DraftKings au format américain
// (ex: "+115" → décimale 2.15, "-105" → décimale 1.95).
function americanToDecimal(value) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace('+', ''))
  if (!Number.isFinite(n) || n === 0) return null
  const dec = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1
  return +(Math.round(dec * 100) / 100).toFixed(2)
}

function extractEventOdds(comp) {
  try {
    const o = comp.odds && Array.isArray(comp.odds) ? comp.odds[0] : null
    if (!o) return null

    const moneyline = o.moneyline || {}
    const home = americanToDecimal(moneyline.home?.close?.odds ?? moneyline.home?.open?.odds)
    const away = americanToDecimal(moneyline.away?.close?.odds ?? moneyline.away?.open?.odds)
    const draw = americanToDecimal(o.drawOdds?.moneyLine)

    // Total (Over/Under) : line "o2.5" → 2.5
    const total = o.total || {}
    const overLine = parseFloat(String(total.over?.close?.line ?? total.over?.open?.line ?? '').replace(/[^0-9.]/g, ''))
    const over25 = americanToDecimal(total.over?.close?.odds ?? total.over?.open?.odds)
    const under25 = americanToDecimal(total.under?.close?.odds ?? total.under?.open?.odds)
    const isOver25 = Number.isFinite(overLine) ? Math.abs(overLine - 2.5) < 0.01 : true

    const result = {
      provider: o.provider?.displayName || o.provider?.name || 'ESPN',
      home,
      draw,
      away,
      over25: isOver25 ? over25 : null,
      under25: isOver25 ? under25 : null,
    }

    // Considéré fiable si au moins 2 cotes 1X2 ou au moins une cote O/U
    const x12Count = [result.home, result.draw, result.away].filter(v => v !== null).length
    if (x12Count >= 2 || result.over25 !== null) return result
    return null
  } catch {
    return null
  }
}

// ─── Classement ESPN (gratuit, sans clé API) — cache par ligue ───
const standingsCache = new Map()

async function fetchStandings(slug) {
  if (standingsCache.has(slug)) return standingsCache.get(slug)

  const empty = new Map()
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTTSPredict/1.0)' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) {
      standingsCache.set(slug, empty)
      return empty
    }
    const data = await res.json()
    const map = new Map()
    const walk = (node) => {
      if (!node) return
      const entries = node.standings?.entries || node.entries || []
      for (const entry of entries) {
        const teamId = String(entry.team?.id || '')
        if (!teamId) continue
        const stats = {}
        for (const s of entry.stats || []) {
          if (s.name) stats[s.name] = s.value !== undefined ? s.value : s.displayValue
        }
        map.set(teamId, {
          rank: parseInt(stats.rank, 10) || null,
          points: parseInt(stats.points, 10) || null,
          played: parseInt(stats.gamesPlayed, 10) || null,
          gf: parseInt(stats.pointsFor, 10) || null,
          ga: parseInt(stats.pointsAgainst, 10) || null,
        })
      }
      for (const child of node.children || []) walk(child)
    }
    walk(data)
    standingsCache.set(slug, map)
    return map
  } catch {
    standingsCache.set(slug, empty)
    return empty
  }
}

// ─── SUPPRIMÉ: matchHash, getTeamForm (synthétique), getH2H (synthétique) ───
// Ces fonctions fabriquaient des statistiques d'équipe à partir de hash pseudo-aléatoires.
// Remplacées par fetchTeamStats() qui récupère les vrais résultats ESPN.

// ─── Cache en mémoire pour les stats d'équipe (évite les requêtes dupliquées) ───
const teamStatsCache = new Map()

// ─── Résolution domestique pour les coupes internationales ───
// Un match de coupe (uefa.champions) oppose des équipes dont les vraies données
// récentes vivent dans leur championnat domestique : en octobre, chaque équipe
// n'a que 2-3 matchs de phase de ligue terminés dans le calendrier UCL, ce qui
// déclenchait une abstention systématique (min. 4 matchs) → 0-2 matchs du jour
// les soirs de C3 (régression du 21/10 : 9 matchs UCL rejetés, run #851).
// On interroge donc le calendrier DOMESTIQUE de l'équipe — données réelles,
// jamais des moyennes de ligue fabriquées. L'abstention reste la règle si
// aucune source ne fournit ≥ 4 matchs réels.
const DOMESTIC_SLUGS = [
  'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1',
  'ned.1', 'por.1', 'bel.1', 'tur.1', 'aut.1',
  'sco.1', 'nor.1', 'den.1', 'swe.1', 'gre.1', 'sui.1',
]
const teamSlugResolution = new Map() // teamId → slug domestique résolu

// ─── Poisson functions (conservées — mathématiquement correctes) ───
function factorial(n) {
  if (n <= 1) return 1
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function bttsRealProb(lambdaHome, lambdaAway) {
  const pHomeScores = 1 - Math.exp(-lambdaHome)
  const pAwayScores = 1 - Math.exp(-lambdaAway)
  return pHomeScores * pAwayScores
}

function over25RealProb(lambdaHome, lambdaAway) {
  let pUnder25 = 0
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j <= 2 - i; j++) {
      const pHome = Math.exp(-lambdaHome) * Math.pow(lambdaHome, i) / factorial(i)
      const pAway = Math.exp(-lambdaAway) * Math.pow(lambdaAway, j) / factorial(j)
      pUnder25 += pHome * pAway
    }
  }
  return 1 - pUnder25
}

// ─── Fetch real team stats from ESPN schedule API (un slug donné) ───
async function fetchTeamStatsFromSlug(slug, teamId) {
  const cacheKey = `${slug}_${teamId}`
  if (teamStatsCache.has(cacheKey)) return teamStatsCache.get(cacheKey)

  const maxRetries = 3
  const baseDelay = 1000

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTTSPredict/1.0)' }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)))
          continue
        }
        break
      }
      const data = await res.json()
      const events = data.events || []

      const finishedMatches = []
      for (const ev of events) {
        const comp = ev.competitions?.[0]
        if (!comp) continue
        const status = comp.status?.type?.name
        if (status !== 'STATUS_FULL_TIME' && status !== 'STATUS_FINAL') continue

        const home = comp.competitors?.find(c => c.homeAway === 'home')
        const away = comp.competitors?.find(c => c.homeAway === 'away')
        if (!home || !away) continue

        const homeScore = typeof home.score === 'object' ? home.score?.value : home.score
        const awayScore = typeof away.score === 'object' ? away.score?.value : away.score
        if (homeScore === undefined || awayScore === undefined || homeScore === null || awayScore === null) continue

        const isHome = String(home.team?.id) === String(teamId)
        const myScore = isHome ? homeScore : awayScore
        const oppScore = isHome ? awayScore : homeScore
        const oppName = isHome ? (away.team?.displayName || 'Unknown') : (home.team?.displayName || 'Unknown')

        finishedMatches.push({
          date: (ev.date || '').slice(0, 10),
          opponent: oppName,
          isHome,
          goalsFor: parseInt(myScore, 10),
          goalsAgainst: parseInt(oppScore, 10),
          result: myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D',
        })
      }

      // Take last 8 (most recent first in ESPN schedule)
      // Sort by date descending (most recent first) — ensures we get the 8 latest
      finishedMatches.sort((a, b) => new Date(b.date) - new Date(a.date))
      const recent = finishedMatches.slice(0, 8)

      if (recent.length === 0) {
        const result = { dataQuality: 'LOW', matchCount: 0, available: false, dataSource: 'LEAGUE_FALLBACK' }
        teamStatsCache.set(cacheKey, result)
        return result
      }

      // Calculate real stats
      const totalGoalsFor = recent.reduce((s, m) => s + m.goalsFor, 0)
      const totalGoalsAgainst = recent.reduce((s, m) => s + m.goalsAgainst, 0)
      const avgScored = totalGoalsFor / recent.length
      const avgConceded = totalGoalsAgainst / recent.length

      const homeMatches = recent.filter(m => m.isHome)
      const awayMatches = recent.filter(m => !m.isHome)

      const homeAvgScored = homeMatches.length > 0
        ? homeMatches.reduce((s, m) => s + m.goalsFor, 0) / homeMatches.length
        : null
      const homeAvgConceded = homeMatches.length > 0
        ? homeMatches.reduce((s, m) => s + m.goalsAgainst, 0) / homeMatches.length
        : null
      const awayAvgScored = awayMatches.length > 0
        ? awayMatches.reduce((s, m) => s + m.goalsFor, 0) / awayMatches.length
        : null
      const awayAvgConceded = awayMatches.length > 0
        ? awayMatches.reduce((s, m) => s + m.goalsAgainst, 0) / awayMatches.length
        : null

      const dataQuality = recent.length >= 8 ? 'HIGH' : recent.length >= 4 ? 'MEDIUM' : 'LOW'

      // ─── Forme détaillée (5 derniers matchs) pour l'analyse AI ───
      const last5 = recent.slice(0, 5)
      const resultLetterFr = { W: 'V', D: 'N', L: 'D' }
      const gf5 = last5.reduce((s, m) => s + m.goalsFor, 0)
      const ga5 = last5.reduce((s, m) => s + m.goalsAgainst, 0)
      const wins5 = last5.filter(m => m.result === 'W').length
      const draws5 = last5.filter(m => m.result === 'D').length
      const losses5 = last5.filter(m => m.result === 'L').length
      const btts5 = last5.filter(m => m.goalsFor > 0 && m.goalsAgainst > 0).length
      const over255 = last5.filter(m => (m.goalsFor + m.goalsAgainst) >= 3).length
      const cleanSheets5 = last5.filter(m => m.goalsAgainst === 0).length
      const failedToScore5 = last5.filter(m => m.goalsFor === 0).length
      const form = {
        last5String: last5.map(m => resultLetterFr[m.result] || '?').join('-'),
        wins: wins5, draws: draws5, losses: losses5,
        goalsFor: gf5, goalsAgainst: ga5,
        bttsRate: last5.length ? +(btts5 / last5.length).toFixed(2) : null,
        over25Rate: last5.length ? +(over255 / last5.length).toFixed(2) : null,
        cleanSheets: cleanSheets5,
        failedToScore: failedToScore5,
        count: last5.length,
      }

      const result = {
        available: true,
        dataSource: 'ESPN_TEAM_SCHEDULE',
        matchCount: recent.length,
        dataQuality,
        avgScored,
        avgConceded,
        homeAvgScored,
        homeAvgConceded,
        awayAvgScored,
        awayAvgConceded,
        recent,
        form,
      }

      teamStatsCache.set(cacheKey, result)
      return result

    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)))
        continue
      }
    }
  }

  const result = { dataQuality: 'LOW', matchCount: 0, available: false, dataSource: 'LEAGUE_FALLBACK' }
  teamStatsCache.set(cacheKey, result)
  return result
}

// ─── Fetch team stats avec résolution domestique (coupes internationales) ───
// 1. Calendrier de la ligue du match (comportement nominal)
// 2. Slug domestique déjà résolu pour cette équipe
// 3. Scan des championnats domestiques — le premier avec ≥ 4 matchs réels gagne
// 4. Sinon : abstention honnête (aucune donnée fabriquée)
async function fetchTeamStats(slug, teamId, teamName) {
  const trySlug = async (s) => {
    const key = `${s}_${teamId}`
    if (teamStatsCache.has(key)) return teamStatsCache.get(key)
    const stats = await fetchTeamStatsFromSlug(s, teamId)
    teamStatsCache.set(key, stats)
    return stats
  }

  const primary = await trySlug(slug)
  if (hasSufficientTeamStats(primary)) return primary

  const resolved = teamSlugResolution.get(String(teamId))
  if (resolved && resolved !== slug) {
    const viaResolved = await trySlug(resolved)
    if (hasSufficientTeamStats(viaResolved)) return viaResolved
  }

  for (const s of DOMESTIC_SLUGS) {
    if (s === slug) continue
    const viaDomestic = await trySlug(s)
    if (hasSufficientTeamStats(viaDomestic)) {
      teamSlugResolution.set(String(teamId), s)
      console.log(`[v91] ${teamName || teamId}: stats via ${s} (ligue du match ${slug} insuffisante — résolution domestique)`)
      return viaDomestic
    }
  }

  return primary
}

// ─── Assign tier ───
function assignTier(reliability) {
  if (reliability >= 75) return 'GOLD'
  if (reliability >= 60) return 'SILVER'
  return 'STANDARD'
}

// ─── Fetch ESPN scoreboard ───
async function fetchESPNMatches(slug, dateParam) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateParam}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTTSPredict/1.0)' }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    // Classement de la ligue (gratuit ESPN, mis en cache) — enrichit l'analyse AI
    const standings = await fetchStandings(slug)
    const matches = []
    for (const event of data.events || []) {
      const comp = event.competitions?.[0]
      if (!comp) continue
      const statusType = comp.status?.type?.name
      if (['STATUS_FINAL', 'STATUS_POSTPONED', 'STATUS_CANCELED'].includes(statusType)) continue

      // Use the event's real calendar date in Africa/Dakar. The ESPN query date
      // is not reliable for late UTC kickoffs that belong to the next Dakar day.
      const matchDate = comp.date
        ? new Date(comp.date).toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ })
        : dateParam.slice(0, 4) + '-' + dateParam.slice(4, 6) + '-' + dateParam.slice(6, 8)
      const today = getTodayISO()
      if (matchDate < today) continue
      if (matchDate === today && comp.date) {
        const kickoff = new Date(comp.date).getTime()
        if (Number.isFinite(kickoff) && kickoff <= Date.now() + MIN_KICKOFF_LEAD_MINUTES * 60 * 1000) continue
      }

      const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
      const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
      if (!homeComp || !awayComp) continue
      const homeTeam = homeComp.team?.displayName || homeComp.team?.shortDisplayName || 'Home'
      const awayTeam = awayComp.team?.displayName || awayComp.team?.shortDisplayName || 'Away'
      const time = comp.date ? new Date(comp.date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: DISPLAY_TZ }) : ''
      // ─── Cotes réelles du bookmaker (gratuit,ESPN/DraftKings) ───
      const odds = extractEventOdds(comp)
      const homeStanding = standings.get(String(homeComp.team?.id || '')) || null
      const awayStanding = standings.get(String(awayComp.team?.id || '')) || null
      matches.push({
        match: `${homeTeam} vs ${awayTeam}`,
        home: homeTeam,
        away: awayTeam,
        league: ESPN_SLUGS[slug] || slug,
        date: matchDate,
        time,
        homeLogo: homeComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${homeComp.team?.id}.png`,
        awayLogo: awayComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${awayComp.team?.id}.png`,
        slug,
        homeTeamId: homeComp.team?.id,
        awayTeamId: awayComp.team?.id,
        odds,
        standingsHome: homeStanding,
        standingsAway: awayStanding,
      })
    }
    return matches
  } catch (err) {
    return []
  }
}

// ─── Generate unique match ID ───
function genMatchId(home, away, date) {
  const h = home.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)
  const a = away.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)
  return `${h}-vs-${a}-${date}`
}

// ─── Generate unique analysis text ───
function genAnalysis(home, away, xgHome, xgAway, bttsProb, over25Prob, formHome, formAway, h2h, reliability) {
  const xgTotal = (xgHome + xgAway).toFixed(2)
  const homeForm = `${formHome.scoredIn}/5 derniers matchs marques`
  const awayForm = `${formAway.scoredIn}/5 derniers matchs marques`
  const h2hText = `${h2h.bttsCount}/${h2h.totalH2H} H2H BTTS`
  const probPct = (bttsProb * 100).toFixed(1)
  const overPct = (over25Prob * 100).toFixed(1)
  const relPct = reliability.toFixed(1)

  return `${home} (${homeForm}, xG ${xgHome.toFixed(2)}) vs ${away} (${awayForm}, xG ${xgAway.toFixed(2)}). xG cumule ${xgTotal}, BTTS ${probPct}%, Over 2.5 ${overPct}%, ${h2hText}. Fiabilite ${relPct}%.`
}

// ─── Main ───
async function quickUpdate() {
  const today = getTodayISO()
  console.log(`[v91 Display-First] Generating predictions for ${today}`)
  console.log('[v91] Strategy: display top matches per day. Eliminate only truly unusable.')

  const dateParams = []
  for (let i = 0; i < FUTURE_DAYS; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dateParams.push(formatDateParam(d))
  }

  // Fetch all matches
  const allMatches = []
  for (const [slug, leagueName] of Object.entries(ESPN_SLUGS)) {
    for (const dateParam of dateParams) {
      const matches = await fetchESPNMatches(slug, dateParam)
      for (const m of matches) {
        allMatches.push({ ...m, slug })
      }
      console.log(`[v91] ${slug}/${dateParam}: ${matches.length} matches`)
    }
  }

  // Deduplicate
  const uniqueMatches = []
  const seen = new Set()
  for (const m of allMatches) {
    const key = `${m.match}-${m.date}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueMatches.push(m)
  }

    console.log(`[v91] Total unique matches: ${uniqueMatches.length}`)
  if (uniqueMatches.length === 0) {
    throw new Error(`[v91] ESPN returned no scheduled matches for ${today}; existing predictions.json was preserved`)
  }
  // ─── RELIABILITY SCORING — only eliminate truly unusable ───

  const scored = []
  let rejected = 0
  const rejectionReasons = []

  for (const m of uniqueMatches) {
    const slug = m.slug

    // ─── Fetch REAL team stats from ESPN ───
    const homeStats = m.homeTeamId ? await fetchTeamStats(slug, m.homeTeamId, m.home) : { available: false, dataQuality: 'LOW', matchCount: 0 }
    const awayStats = m.awayTeamId ? await fetchTeamStats(slug, m.awayTeamId, m.away) : { available: false, dataQuality: 'LOW', matchCount: 0 }

    // No league-average fallback: identical fabricated inputs are not evidence.
    if (!hasSufficientTeamStats(homeStats) || !hasSufficientTeamStats(awayStats)) {
      rejected++
      rejectionReasons.push(`ABSTENTION: ${m.home} vs ${m.away} - données récentes insuffisantes (min. 4 matchs par équipe)`)
      continue
    }

    // Determine data quality (worst of both teams)
    const homeQuality = homeStats.available ? homeStats.dataQuality : 'LOW'
    const awayQuality = awayStats.available ? awayStats.dataQuality : 'LOW'
    const qualityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    const dataQuality = qualityRank[homeQuality] <= qualityRank[awayQuality] ? homeQuality : awayQuality

    // ─── Calculate lambda from REAL data only ───
    let homeAttackXG, homeDefenseXG, awayAttackXG, awayDefenseXG

    if (homeStats.available && homeStats.matchCount >= 4) {
      // Real data: prefer home-specific stats for home team
      homeAttackXG = homeStats.homeAvgScored !== null ? homeStats.homeAvgScored : homeStats.avgScored
      homeDefenseXG = homeStats.homeAvgConceded !== null ? homeStats.homeAvgConceded : homeStats.avgConceded
    }

    if (awayStats.available && awayStats.matchCount >= 4) {
      // Real data: prefer away-specific stats for away team
      awayAttackXG = awayStats.awayAvgScored !== null ? awayStats.awayAvgScored : awayStats.avgScored
      awayDefenseXG = awayStats.awayAvgConceded !== null ? awayStats.awayAvgConceded : awayStats.avgConceded
    }

    // Lambda = average of (team attack, opponent defense)
    const homeBonus = 0.15
    const lambdaHome = Math.max(0.50, Math.min(3.00,
      (homeAttackXG + awayDefenseXG) / 2 + homeBonus
    ))
    const lambdaAway = Math.max(0.50, Math.min(3.00,
      (awayAttackXG + homeDefenseXG) / 2
    ))

    // ─── Calculate REAL Poisson probas ───
    const bttsProbRaw = bttsRealProb(lambdaHome, lambdaAway)
    const over25ProbRaw = over25RealProb(lambdaHome, lambdaAway)

    const xgHome = +lambdaHome.toFixed(2)
    const xgAway = +lambdaAway.toFixed(2)
    const xgTotal = +(lambdaHome + lambdaAway).toFixed(2)

    // ═══ DISPLAY-FIRST: only reject if both BTTS and Over 2.5 are very low ═══
    const maxProb = Math.max(bttsProbRaw, over25ProbRaw)
    if (maxProb < 0.35) {
      rejected++
      rejectionReasons.push(`REJETE: ${m.home} vs ${m.away} - BTTS ${(bttsProbRaw*100).toFixed(1)}% + Over ${(over25ProbRaw*100).toFixed(1)}% tous deux < 35%`)
      continue
    }

    // ═══ RELIABILITY SCORE — basé sur données réelles, pas de randomisation ═══
    // xg score: higher xG total → higher score
    let xgScore = 0
    if (xgTotal >= 3.2) xgScore = 95
    else if (xgTotal >= 2.8) xgScore = 85
    else if (xgTotal >= 2.4) xgScore = 75
    else if (xgTotal >= 2.0) xgScore = 60
    else xgScore = 45

    // data quality score: based on real data availability
    let qualityScore = 0
    if (dataQuality === 'HIGH') qualityScore = 100
    else if (dataQuality === 'MEDIUM') qualityScore = 70
    else qualityScore = 40

    // BTTS probability score
    const bttsScore = Math.min(100, bttsProbRaw * 100 * 1.25)

    // No H2H score — h2h_available is false by default (no synthetic H2H)
    const h2hScore = 50 // neutral — no H2H data available

    // Reliability = weighted by data quality
    const reliability = +(
      (bttsScore * 0.35) +
      (xgScore * 0.25) +
      (qualityScore * 0.30) +
      (h2hScore * 0.10)
    ).toFixed(2)

    // Estimated odds (informational) — fallback quand aucune cote bookmaker réelle
    const estimatedCoteBTTS = +(1 / Math.max(0.20, bttsProbRaw)).toFixed(2)
    const estimatedCoteOver = +(1 / Math.max(0.20, over25ProbRaw)).toFixed(2)

    // ─── Forme réelle des deux équipes (5 derniers matchs ESPN) ───
    const formHome = homeStats.available && homeStats.form ? homeStats.form : null
    const formAway = awayStats.available && awayStats.form ? awayStats.form : null

    // ─── Analyse textuelle enrichie : forme + classement + cotes réelles ───
    const formBits = []
    if (formHome) formBits.push(`${m.home} : forme ${formHome.last5String} (${formHome.wins}V ${formHome.draws}N ${formHome.losses}D, ${formHome.goalsFor} buts marqués / ${formHome.goalsAgainst} encaissés sur 5)`)
    else formBits.push(`${m.home} : forme indisponible`)
    if (formAway) formBits.push(`${m.away} : forme ${formAway.last5String} (${formAway.wins}V ${formAway.draws}N ${formAway.losses}D, ${formAway.goalsFor} buts marqués / ${formAway.goalsAgainst} encaissés sur 5)`)
    else formBits.push(`${m.away} : forme indisponible`)
    const rankBits = []
    if (m.standingsHome?.rank) rankBits.push(`${m.home} ${m.standingsHome.rank}e (${m.standingsHome.points ?? '?'} pts)`)
    if (m.standingsAway?.rank) rankBits.push(`${m.away} ${m.standingsAway.rank}e (${m.standingsAway.points ?? '?'} pts)`)
    const oddsBit = m.odds?.provider
      ? ` Cotes ${m.odds.provider} — 1: ${m.odds.home ?? '—'} / N: ${m.odds.draw ?? '—'} / 2: ${m.odds.away ?? '—'}${m.odds.over25 ? ` · Over 2.5: ${m.odds.over25}` : ''}.`
      : ''
    const analysis = `${formBits.join(' · ')}.${rankBits.length ? ` Classement : ${rankBits.join(', ')}.` : ''} Modèle Poisson : xG cumulé ${xgTotal}, BTTS ${(bttsProbRaw*100).toFixed(1)}%, Over 2.5 ${(over25ProbRaw*100).toFixed(1)}%.${oddsBit} Fiabilité ${reliability}%.`
    const matchId = genMatchId(m.home, m.away, m.date)

    // Build TWO predictions: BTTS + Over 2.5 (so component has both)
    const bttsPrediction = {
      type: 'BTTS',
      prediction: bttsProbRaw >= 0.50 ? 'Oui' : 'Non',
      confidence: Math.round(bttsProbRaw * 100),
      bttsProb: +bttsProbRaw.toFixed(4),
      homeLambda: xgHome,
      awayLambda: xgAway,
    }

    const over25Prediction = {
      type: 'Over 2.5',
      prediction: over25ProbRaw >= 0.50 ? 'Oui' : 'Non',
      confidence: Math.round(over25ProbRaw * 100),
      over25Prob: +over25ProbRaw.toFixed(4),
      homeLambda: xgHome,
      awayLambda: xgAway,
    }

    // MAIN prediction object — contains everything the component needs
    const prediction = {
      id: matchId,
      match: m.match,
      home: m.home,
      away: m.away,
      league: m.league,
      date: m.date,
      type: 'BTTS',
      prediction: bttsPrediction.prediction,
      proba: +bttsProbRaw.toFixed(4),
      bttsProbDisplay: `${(bttsProbRaw * 100).toFixed(2)}%`,
      over25ProbDisplay: `${(over25ProbRaw * 100).toFixed(2)}%`,
      confidence: bttsPrediction.confidence,
      time: m.time || '',
      matchSemantic: matchId,
      source: 'poisson-v92-real-data',
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      tier: assignTier(reliability),
      reliabilityScore: reliability,
      dataQuality: dataQuality,
      dataSource: homeStats.dataSource === 'ESPN_TEAM_SCHEDULE' && awayStats.dataSource === 'ESPN_TEAM_SCHEDULE'
        ? 'ESPN_TEAM_SCHEDULE'
        : 'LEAGUE_FALLBACK',
      matchCountHome: homeStats.matchCount || 0,
      matchCountAway: awayStats.matchCount || 0,
      h2hAvailable: false,
      xgHome: xgHome,
      xgAway: xgAway,
      xgTotal: xgTotal,
      formBTTS: deriveFormBtts(homeStats, awayStats),
      analysis: analysis,
      // ─── DATA FIELDS the component needs ───
      // PromoVip reads these via p.analysis?.X (we mirror them here too)
      analysisData: {
        bttsProb: +bttsProbRaw.toFixed(4),
        over25Prob: +over25ProbRaw.toFixed(4),
        homeLambda: xgHome,
        awayLambda: xgAway,
        xgTotal: xgTotal,
      },
      estimatedCote: estimatedCoteBTTS,
      estimatedCoteOver: estimatedCoteOver,
      // ─── Cotes réelles du marché (sans clé API — ESPN/DraftKings) ───
      // odds = cotes bookmaker réelles quand disponibles, sinon null
      // (le frontend affiche alors la cote estimée Poisson en secours)
      odds: m.odds || null,
      oddsSource: m.odds?.provider || 'ESTIMATION_POISSON',
      estimatedCoteBTTS,
      estimatedCoteOver,
      // ─── Forme réelle (5 derniers matchs) + classement — pour l'analyse AI ───
      formHome,
      formAway,
      // ─── Historique détaillé des 5 derniers matchs de chaque équipe ───
      // (déjà fetché via ESPN_TEAM_SCHEDULE — publié pour la section
      // « Dernière minute » des pages /match/ : adversaire, score, résultat)
      last5Home: (homeStats.recent || []).slice(0, 5).map(r => ({
        date: r.date, opponent: r.opponent, venue: r.isHome ? 'H' : 'A',
        score: `${r.goalsFor}-${r.goalsAgainst}`, result: r.result,
      })),
      last5Away: (awayStats.recent || []).slice(0, 5).map(r => ({
        date: r.date, opponent: r.opponent, venue: r.isHome ? 'H' : 'A',
        score: `${r.goalsFor}-${r.goalsAgainst}`, result: r.result,
      })),
      standingsHome: m.standingsHome || null,
      standingsAway: m.standingsAway || null,
      // ─── BOTH predictions array (so FreePredictions has both BTTS + Over 2.5) ───
      predictions: [bttsPrediction, over25Prediction],
      // Mirror key fields at top-level so the component reads them directly
      bttsProb: +bttsProbRaw.toFixed(4),
      over25Prob: +over25ProbRaw.toFixed(4),
      homeLambda: xgHome,
      awayLambda: xgAway,
    }

    scored.push(prediction)
  }

  // ─── SORT BY DATE ASC FIRST, THEN RELIABILITY DESC ───
  // Priority: matches scheduled for TODAY (Africa/Dakar) come first,
  // then upcoming matches sorted by date ascending.
  // Within the same date, sort by reliability descending.
  scored.sort((a, b) => {
    const dateCmp = (a.date || '').localeCompare(b.date || '')
    if (dateCmp !== 0) return dateCmp
    return b.reliabilityScore - a.reliabilityScore
  })

  // ─── DISPLAY-FIRST PUBLICATION (quotas quotidiens) ───
  // scored est trié date ASC puis fiabilité DESC → chaque journée est déjà
  // triée par fiabilité. On publie : le jour J en grand volume, puis les
  // meilleures affiches des jours à venir pour alimenter « À venir ».
  const todayMatches = scored.filter(p => p.date === today)
  const upcomingDays = new Map()
  for (const p of scored) {
    if (typeof p.date === 'string' && p.date > today) {
      if (!upcomingDays.has(p.date)) upcomingDays.set(p.date, [])
      upcomingDays.get(p.date).push(p)
    }
  }
  const freeToday = todayMatches.slice(0, MAX_FREE_TODAY)
  const freeUpcoming = []
  for (const day of [...upcomingDays.keys()].sort().slice(0, MAX_UPCOMING_DAYS)) {
    freeUpcoming.push(...upcomingDays.get(day).slice(0, MAX_PER_DAY_UPCOMING))
  }
  const free = [...freeToday, ...freeUpcoming]

  // Aucun choix privé n'est publié sans accès sécurisé : le preview n'expose que
  // l'identité du match et les métadonnées de fixture explicitement autorisées.
  // Aperçu VIP : d'abord les sélections du jour non publiées en accès libre ;
  // si le jour est pauvre (ex. jeudis Europa où tout le jour est déjà en free),
  // complété par les meilleures affiches à venir — l'aperçu VIP ne doit jamais
  // être vide (la page VIP reste sinon sans sélection à présenter).
  const freeKeys = new Set(free.map(p => `${p.home}|${p.away}|${p.date}`))
  const notInFree = (list) => list.filter(p => !freeKeys.has(`${p.home}|${p.away}|${p.date}`))
  const upcomingAll = scored.filter(p => typeof p.date === 'string' && p.date > today)
  const vipPreview = [...notInFree(todayMatches), ...notInFree(upcomingAll)]
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '')
      if (dateCmp !== 0) return dateCmp
      return b.reliabilityScore - a.reliabilityScore
    })
    .slice(0, MAX_VIP)
    .map(publicVipFixture)

  // ─── LOG RESULTS ───
  console.log(`\n[v91] ===== RESULTS =====`)
  console.log(`Total analysed: ${uniqueMatches.length}`)
  console.log(`Rejected (very low proba): ${rejected}`)
  console.log(`Published: ${scored.length}`)
  console.log(`Free published: ${free.length} (du jour: ${freeToday.length}/${MAX_FREE_TODAY}, à venir: ${freeUpcoming.length}, max ${MAX_PER_DAY_UPCOMING}/jour sur ${MAX_UPCOMING_DAYS} jours)`)
  console.log(`VIP preview: ${vipPreview.length} (max ${MAX_VIP}, sélections du jour)`)

  console.log(`\n--- REJECTED (first 10) ---`)
  rejectionReasons.slice(0, 10).forEach(r => console.log(r))

  console.log(`\n--- FREE (${free.length}) ---`)
  free.forEach(p => console.log(`  ${p.match} | ${p.date} ${p.time} | ${p.league} | BTTS ${p.bttsProbDisplay} | O2.5 ${p.over25ProbDisplay} | xG ${p.xgTotal} | Rel ${p.reliabilityScore}`))

  // ─── Calculate stats ───
  const avgReliability = scored.length > 0
    ? +(scored.reduce((sum, p) => sum + p.reliabilityScore, 0) / scored.length).toFixed(2)
    : 0

  // ─── Save predictions.json (new structure with predictions nested) ───
  const predictionsData = {
    date: today,
    lastUpdated: new Date().toISOString(),
    source: 'ESPN + TheSportsDB',
    free: free,
    vipPreview: vipPreview,
    stats: {
      avgReliability: avgReliability,
      totalAnalyzed: uniqueMatches.length,
      totalRejected: rejected,
      totalAccepted: scored.length,
      freeCount: free.length,
      vipCount: vipPreview.length,
    },
    // Backward compat: predictions = free
    predictions: free,
  }

  const validationErrors = validatePredictionPayload(predictionsData, {
    today,
    requireTimestamp: true,
    checkKickoff: true,
    now: new Date(),
  })

  if (validationErrors.length > 0) {
    throw new Error(`[v91] Refusing to publish invalid predictions:\n${validationErrors.join('\n')}`)
  }
  writeJsonAtomically(PREDICTIONS_FILE, predictionsData)
  console.log(`\n[v91] Written to predictions.json (${free.length} free, ${vipPreview.length} VIP)`)
  console.log(`[v91] File size: ${(fs.statSync(PREDICTIONS_FILE).size / 1024).toFixed(1)} KB`)
  console.log('[v91] Archive finalization is deferred until enrichment is complete.')

  console.log(`\n[v91] Done.`)
}

quickUpdate().catch(err => {
  console.error('[v91] FATAL:', err)
  process.exit(1)
})
