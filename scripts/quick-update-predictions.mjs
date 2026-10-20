// ═════════════════════════════════════════════════════════════════════════════
// BTTSPredict – Predictions Engine v91
// Display-first: always publishes top N matches per day (sorted by reliability)
// Eliminates only truly unusable matches. Generous thresholds = always visible.
// ═════════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { validatePredictionPayload } from './validate-predictions.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const PREDICTIONS_FILE = path.join(PUBLIC_DIR, 'predictions.json')
const ARCHIVE_DIR = path.join(PUBLIC_DIR, 'predictions-archive')

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })

function writeJsonAtomically(file, payload) {
  const tempFile = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2))
  fs.renameSync(tempFile, file)
}

const FUTURE_DAYS = 7        // look ahead 7 days to ensure we always have matches
const MAX_FREE = 12           // show up to 12 free matches (Gemini-powered analysis)
const MAX_VIP = 8            // show up to 8 VIP matches
const DISPLAY_TZ = 'Africa/Dakar'  // Senegal timezone = UTC+0 (GMT)
const MIN_KICKOFF_LEAD_MINUTES = 30 // safety buffer for long enrichment/verification steps

// ─── HIGH BTTS Leagues ───
// Inclut les compétitions midweek (Champions League mardi/mercredi) et les
// grands championnats (LaLiga, Serie A, Ligue 1) — sans eux, les mardis et
// mercredis se retrouvent avec 0-1 match affiché alors que ESPN en recense 9+.
const ESPN_SLUGS = {
  'uefa.champions': 'UEFA Champions League',
  'eng.1': 'Premier League',
  'eng.2': 'Championship',
  'esp.1': 'LaLiga',
  'ita.1': 'Serie A',
  'fra.1': 'Ligue 1',
  'ger.1': 'Bundesliga',
  'ger.2': '2. Bundesliga',
  'ned.1': 'Eredivisie',
  'bel.1': 'Jupiler Pro League',
  'swi.1': 'Swiss Super League',
  'por.1': 'Liga Portugal',
  'aut.1': 'Austrian Bundesliga',
  'sco.1': 'Scottish Premiership',
  'usa.1': 'MLS',
}

const LEAGUE_PROFILES = {
  'uefa.champions': { bttsRate: 0.54, avgGoals: 3.05, homeFactor: 1.30, awayFactor: 1.15 },
  'eng.1': { bttsRate: 0.55, avgGoals: 2.82, homeFactor: 1.35, awayFactor: 1.10 },
  'eng.2': { bttsRate: 0.56, avgGoals: 2.68, homeFactor: 1.32, awayFactor: 1.08 },
  'ger.1': { bttsRate: 0.58, avgGoals: 3.05, homeFactor: 1.40, awayFactor: 1.15 },
  'ger.2': { bttsRate: 0.57, avgGoals: 2.90, homeFactor: 1.35, awayFactor: 1.12 },
  'ned.1': { bttsRate: 0.57, avgGoals: 3.15, homeFactor: 1.38, awayFactor: 1.18 },
  'bel.1': { bttsRate: 0.55, avgGoals: 2.85, homeFactor: 1.33, awayFactor: 1.10 },
  'swi.1': { bttsRate: 0.54, avgGoals: 2.78, homeFactor: 1.30, awayFactor: 1.08 },
  'por.1': { bttsRate: 0.55, avgGoals: 2.72, homeFactor: 1.35, awayFactor: 1.10 },
  'aut.1': { bttsRate: 0.54, avgGoals: 2.80, homeFactor: 1.32, awayFactor: 1.08 },
  'sco.1': { bttsRate: 0.53, avgGoals: 2.65, homeFactor: 1.30, awayFactor: 1.05 },
  'esp.1': { bttsRate: 0.51, avgGoals: 2.70, homeFactor: 1.35, awayFactor: 1.10 },
  'ita.1': { bttsRate: 0.52, avgGoals: 2.75, homeFactor: 1.32, awayFactor: 1.10 },
  'fra.1': { bttsRate: 0.50, avgGoals: 2.65, homeFactor: 1.33, awayFactor: 1.08 },
  'usa.1': { bttsRate: 0.56, avgGoals: 3.10, homeFactor: 1.35, awayFactor: 1.12 },
}

const DEFAULT_PROFILE = { bttsRate: 0.54, avgGoals: 2.80, homeFactor: 1.33, awayFactor: 1.10 }

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

// ─── Fetch real team stats from ESPN schedule API ───
async function fetchTeamStats(slug, teamId, teamName) {
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
        const profile = LEAGUE_PROFILES[slug] || DEFAULT_PROFILE
        allMatches.push({ ...m, profile, slug })
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
    const profile = m.profile || DEFAULT_PROFILE
    const dateStr = m.date
    const slug = m.slug

    // ─── Fetch REAL team stats from ESPN ───
    const homeStats = m.homeTeamId ? await fetchTeamStats(slug, m.homeTeamId, m.home) : { available: false, dataQuality: 'LOW', matchCount: 0 }
    const awayStats = m.awayTeamId ? await fetchTeamStats(slug, m.awayTeamId, m.away) : { available: false, dataQuality: 'LOW', matchCount: 0 }

    // Determine data quality (worst of both teams)
    const homeQuality = homeStats.available ? homeStats.dataQuality : 'LOW'
    const awayQuality = awayStats.available ? awayStats.dataQuality : 'LOW'
    const qualityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    const dataQuality = qualityRank[homeQuality] <= qualityRank[awayQuality] ? homeQuality : awayQuality

    // ─── Calculate lambda from REAL data ───
    // If real data available: use real avg scored/conceded (with home/away split when possible)
    // If not available: fall back to LEAGUE_PROFILES (context only, not team-specific)
    let homeAttackXG, homeDefenseXG, awayAttackXG, awayDefenseXG

    if (homeStats.available && homeStats.matchCount >= 4) {
      // Real data: prefer home-specific stats for home team
      homeAttackXG = homeStats.homeAvgScored !== null ? homeStats.homeAvgScored : homeStats.avgScored
      homeDefenseXG = homeStats.homeAvgConceded !== null ? homeStats.homeAvgConceded : homeStats.avgConceded
    } else {
      // Fallback: league average (not team-specific — data quality LOW)
      homeAttackXG = profile.avgGoals * 0.55
      homeDefenseXG = profile.avgGoals * 0.45
    }

    if (awayStats.available && awayStats.matchCount >= 4) {
      // Real data: prefer away-specific stats for away team
      awayAttackXG = awayStats.awayAvgScored !== null ? awayStats.awayAvgScored : awayStats.avgScored
      awayDefenseXG = awayStats.awayAvgConceded !== null ? awayStats.awayAvgConceded : awayStats.avgConceded
    } else {
      awayAttackXG = profile.avgGoals * 0.45
      awayDefenseXG = profile.avgGoals * 0.55
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
      confidence: Math.round(Math.max(40, Math.min(95, bttsProbRaw * 100))),
      bttsProb: +bttsProbRaw.toFixed(4),
      homeLambda: xgHome,
      awayLambda: xgAway,
    }

    const over25Prediction = {
      type: 'Over 2.5',
      prediction: over25ProbRaw >= 0.50 ? 'Oui' : 'Non',
      confidence: Math.round(Math.max(40, Math.min(95, over25ProbRaw * 100))),
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
      formBTTS: homeStats.available ? Math.round((homeStats.avgScored + awayStats.avgScored) / 10 * 100) : 0,
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

  // ─── DISPLAY-FIRST PUBLICATION ───
  // Free: top 8 by reliability (any score, always show top)
  const free = scored.slice(0, MAX_FREE)

  // VIP: next 6 after free (lower reliability, "preview" teasing)
  // Sélection VIP = copie détachée de scored, explicitement marquée vip: true.
  // Le statut VIP n'est JAMAIS déduit du tier GOLD, d'une proba ou d'un tableau.
  const vipPreview = scored.slice(MAX_FREE, MAX_FREE + MAX_VIP).map(p => ({ ...p, vip: true }))

  // If we don't have enough matches, duplicate some from free into vip
  // Miroirs de teasing uniquement : explicitement NON VIP (vip: false) —
  // un match gratuit ne peut jamais être affiché comme sélection VIP.
  if (vipPreview.length < 3 && free.length > 0) {
    const extra = free.slice(0, 3 - vipPreview.length).map(p => ({ ...p, vipMirror: true, vip: false }))
    vipPreview.push(...extra)
  }

  // ─── LOG RESULTS ───
  console.log(`\n[v91] ===== RESULTS =====`)
  console.log(`Total analysed: ${uniqueMatches.length}`)
  console.log(`Rejected (very low proba): ${rejected}`)
  console.log(`Published: ${scored.length}`)
  console.log(`Free published: ${free.length} (max ${MAX_FREE})`)
  console.log(`VIP preview: ${vipPreview.length} (max ${MAX_VIP})`)

  console.log(`\n--- REJECTED (first 10) ---`)
  rejectionReasons.slice(0, 10).forEach(r => console.log(r))

  console.log(`\n--- FREE (top ${free.length}) ---`)
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
  // ─── Archive daily ───
  const archiveFile = path.join(ARCHIVE_DIR, `${today}.json`)
  writeJsonAtomically(archiveFile, predictionsData)

  console.log(`[v91] Archived to predictions-archive/${today}.json`)

  console.log(`\n[v91] Done.`)
}

quickUpdate().catch(err => {
  console.error('[v91] FATAL:', err)
  process.exit(1)
})
