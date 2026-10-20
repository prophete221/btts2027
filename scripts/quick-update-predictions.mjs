// ═════════════════════════════════════════════════════════════════════════════
// BTTSPredict – Predictions Engine v92 — AGRÉGATEUR DE COUVERTURE
// ═════════════════════════════════════════════════════════════════════════════
// Mission « matchs réels du jour » :
//   1. SOURCE PRINCIPALE : ESPN scoreboard public — ~76 ligues (au lieu de 11).
//   2. SOURCE DE SECOURS : TheSportsDB eventsday (clé publique, dégradée :
//      3 événements/jour maximum sur la clé gratuite actuelle).
//   3. Dédoublonnage par équipes normalisées + date (Jaccard ≥ 0.6 par camp).
//   4. Fuseau unique Africa/Dakar (UTC+0) pour dates et heures.
//   5. Vraie source conservée par ligne (dataSource) + journal des rejets.
//   6. Qualité par ligne :
//        HIGH   : ≥ 8 vrais matchs récents par équipe (deux équipes)
//        MEDIUM : ≥ 4 vrais matchs récents par équipe (deux équipes)
//        LOW    : match réel, données limitées → AUCUNE probabilité calculée,
//                 AUCUN λ, AUCUNE cote — marqué « Données limitées ».
// Interdits maintenus : lambda par défaut, proba 0.62, clamp 40-54 %,
// score exact inventé, cote inventée, Gemini comme source factuelle.
// Les probabilités Poisson ne sont calculées QUE si les DEUX équipes ont
// ≥ 4 vrais matchs réels récents ESPN (sinon ligne affichage seul).
// ═════════════════════════════════════════════════════════════════════════════

import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { validatePredictionPayload } from './validate-predictions.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const PREDICTIONS_FILE = path.join(PUBLIC_DIR, 'predictions.json')
const REJECTS_FILE = path.join(PUBLIC_DIR, 'predictions-rejects.json')
const ARCHIVE_DIR = path.join(PUBLIC_DIR, 'predictions-archive')

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true })

function writeJsonAtomically(file, payload) {
  const tempFile = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2))
  fs.renameSync(tempFile, file)
}

const FUTURE_DAYS = 4                 // horizon J0..J+3 — compromis couverture / budget requêtes ESPN
const STATS_WINDOW_DAYS = 3           // stats d'équipe réelles seulement pour J0..J+2
const MAX_FREE = 120                  // cap d'hygiène du payload (journalisé au-delà)
const MAX_VIP = 8                     // sélections VIP (flag explicite vip: true)
const MIN_KICKOFF_LEAD_MINUTES = 30   // aucune ligne publiée après le coup d'envoi -30 min
const MIN_PROBA = 0.35                // seuil plancher pour les lignes AVEC probabilités
export const GEMINI_MAX_LINES = 48    // plafond de lignes envoyées à Gemini (enrich_predictions.py)
export const DISPLAY_TZ = 'Africa/Dakar'
export const MIN_PROBA_THRESHOLD = MIN_PROBA
export const MAX_FREE_LINES = MAX_FREE
export const MAX_VIP_LINES = MAX_VIP
export const STATS_WINDOW = STATS_WINDOW_DAYS

// ─── ESPN : 76 slugs valides (sondés en production le 2026-10-20).
// Les 10 noms historiques sont conservés à l'identique (cohérence archives) ;
// les nouveaux slugs utilisent le nom de ligue renvoyé par ESPN.
export const ESPN_SLUGS = {
  'eng.1': 'Premier League',
  'eng.2': 'Championship',
  'ger.1': 'Bundesliga',
  'ger.2': '2. Bundesliga',
  'ned.1': 'Eredivisie',
  'bel.1': 'Jupiler Pro League',
  'por.1': 'Liga Portugal',
  'aut.1': 'Austrian Bundesliga',
  'sco.1': 'Scottish Premiership',
  'usa.1': 'MLS',
  'esp.1': 'LaLiga',
  'esp.2': 'LaLiga 2',
  'ita.1': 'Serie A',
  'ita.2': 'Serie B',
  'fra.1': 'Ligue 1',
  'fra.2': 'Ligue 2',
  'eng.3': 'League One',
  'eng.4': 'League Two',
  'eng.5': 'National League',
  'ned.2': 'Eerste Divisie',
  'sco.2': 'Scottish Championship',
  'sco.3': 'Scottish League One',
  'den.1': 'Superliga',
  'nor.1': 'Eliteserien',
  'swe.1': 'Allsvenskan',
  'fin.1': 'Veikkausliiga',
  'irl.1': 'League of Ireland Premier Division',
  'wal.1': 'Cymru Premier',
  'gre.1': 'Super League Greece',
  'tur.1': 'Süper Lig',
  'rus.1': 'Russian Premier League',
  'cze.1': 'Czech Liga',
  'rou.1': 'Liga I',
  'isr.1': 'Israeli Premier League',
  'aut.2': '2. Liga (Austria)',
  'usa.open': 'U.S. Open Cup',
  'bra.1': 'Brasileirão Série A',
  'bra.2': 'Brasileirão Série B',
  'mex.1': 'Liga BBVA MX',
  'arg.1': 'Liga Profesional Argentina',
  'chi.1': 'Primera División de Chile',
  'col.1': 'Categoría Primera A',
  'ecu.1': 'LigaPro Ecuador',
  'par.1': 'Primera División Paraguay',
  'per.1': 'Liga 1 Perú',
  'uru.1': 'Primera División Uruguay',
  'ven.1': 'Primera División Venezuela',
  'bol.1': 'Liga Profesional Boliviano',
  'jpn.1': 'J1 League',
  'chn.1': 'Chinese Super League',
  'aus.1': 'A-League Men',
  'ksa.1': 'Saudi Pro League',
  'ind.1': 'Indian Super League',
  'idn.1': 'Super League Indonesia',
  'tha.1': 'Thai League 1',
  'mys.1': 'Malaysia Super League',
  'sgp.1': 'Singapore Premier League',
  'rsa.1': 'Premiership (South Africa)',
  'nga.1': 'Nigeria Professional League',
  'uefa.champions': 'UEFA Champions League',
  'uefa.europa': 'UEFA Europa League',
  'uefa.europa.conf': 'UEFA Conference League',
  'uefa.nations': 'UEFA Nations League',
  'conmebol.libertadores': 'CONMEBOL Libertadores',
  'conmebol.sudamericana': 'CONMEBOL Sudamericana',
  'concacaf.champions_cup': 'CONCACAF Champions Cup',
  'concacaf.nations.league': 'Concacaf Nations League',
  'afc.champions': 'AFC Champions League Elite',
  'afc.cup': 'AFC Champions League Two',
  'caf.champions': 'CAF Champions League',
  'fifa.world': 'FIFA World Cup',
  'fifa.cwc': 'FIFA Club World Cup',
  'fifa.wwc': "FIFA Women's World Cup",
  'uefa.wchampions': "UEFA Women's Champions League",
  'eng.w.1': "Women's Super League",
  'usa.nwsl': 'NWSL',
}

// ─── Helpers date/heure — fuseau unique Africa/Dakar (UTC+0) ───
export function dakarDateFromISO(iso) {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ })
}

export function dakarTimeFromISO(iso) {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: DISPLAY_TZ })
}

function getTodayISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ })
}

// ─── Normalisation des équipes + dédoublonnage ───
export function normalizeTeamName(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !['fc', 'cf', 'afc', 'sc', 'ac', 'if', 'fk', 'sk', 'cd', 'club'].includes(t))
    .sort()
    .join(' ')
    .trim()
}

export function tokenJaccard(a, b) {
  const sa = new Set((a || '').split(' ').filter(Boolean))
  const sb = new Set((b || '').split(' ').filter(Boolean))
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

/**
 * Même club ? Jaccard ≥ 0.6 OU inclusion de token (variantes courtes :
 * « Wolverhampton » ⊆ « Wolverhampton Wanderers »). Toujours combiné à la
 * similarité du camp opposé — deux clubs distincts ne fusionnent jamais.
 */
function sameClubTokens(a, b) {
  const sa = new Set((a || '').split(' ').filter(Boolean))
  const sb = new Set((b || '').split(' ').filter(Boolean))
  if (sa.size === 0 || sb.size === 0) return false
  if (tokenJaccard(a, b) >= 0.6) return true
  if (sa.size <= sb.size) {
    for (const t of sa) if (!sb.has(t)) return false
    return true
  }
  for (const t of sb) if (!sa.has(t)) return false
  return true
}

/** Deux candidats sont le même match si même date Dakar + même club (jaccard ≥ 0.6 ou inclusion) sur chaque camp. */
export function sameMatch(a, b) {
  if (!a || !b) return false
  if (a.date !== b.date) return false
  return sameClubTokens(normalizeTeamName(a.home), normalizeTeamName(b.home))
    && sameClubTokens(normalizeTeamName(a.away), normalizeTeamName(b.away))
}

/**
 * Dédoublonnage multi-sources : priorité à la source la plus riche
 * (ESPN avec IDs d'équipes > TheSportsDB). Ordre d'entrée = priorité.
 * Pré-calcul des jetons normalisés (une seule fois par candidat).
 */
export function dedupCandidates(candidates) {
  const kept = []
  const duplicates = []
  const norm = new Map()
  const tokensOf = (c) => {
    let t = norm.get(c)
    if (!t) {
      t = { home: normalizeTeamName(c.home), away: normalizeTeamName(c.away) }
      norm.set(c, t)
    }
    return t
  }
  for (const c of candidates || []) {
    const t = tokensOf(c)
    const twin = kept.find(k => {
      const kt = tokensOf(k)
      return k.date === c.date
        && sameClubTokens(kt.home, t.home)
        && sameClubTokens(kt.away, t.away)
    })
    if (twin) { duplicates.push({ source: c.source, dropped: c }); continue }
    kept.push(c)
  }
  return { kept, duplicates }
}

// ─── Classification d'un événement source → candidat ou rejet motivé ───
// Retourne { status: 'kept' | 'rejected', reason?, candidate? }
export function classifyESPNEvent(event, ctx) {
  const todayISO = ctx.todayISO
  const now = ctx.now instanceof Date ? ctx.now : new Date()
  const comp = event?.competitions?.[0]
  if (!comp) return { status: 'rejected', reason: 'sans_donnees_competition' }
  const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
  const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
  const homeTeam = homeComp?.team?.displayName || homeComp?.team?.shortDisplayName
  const awayTeam = awayComp?.team?.displayName || awayComp?.team?.shortDisplayName
  if (!homeComp || !awayComp || !homeTeam || !awayTeam) {
    return { status: 'rejected', reason: 'sans_equipes' }
  }
  const statusType = comp.status?.type?.name
  if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FULL_TIME') return { status: 'rejected', reason: 'termine' }
  if (statusType === 'STATUS_POSTPONED') return { status: 'rejected', reason: 'reporte' }
  if (statusType === 'STATUS_CANCELED') return { status: 'rejected', reason: 'annule' }
  if (!comp.date) return { status: 'rejected', reason: 'sans_date' }
  const date = dakarDateFromISO(comp.date)
  if (!date) return { status: 'rejected', reason: 'sans_date' }
  if (date < todayISO) return { status: 'rejected', reason: 'date_passee' }
  const time = dakarTimeFromISO(comp.date) || ''
  if (date === todayISO) {
    const kickoff = new Date(comp.date).getTime()
    if (Number.isFinite(kickoff) && kickoff <= now.getTime() + MIN_KICKOFF_LEAD_MINUTES * 60 * 1000) {
      return { status: 'rejected', reason: 'deja_commence' }
    }
  }
  return {
    status: 'kept',
    candidate: {
      home: homeTeam, away: awayTeam,
      league: ctx.leagueName || ESPN_SLUGS[ctx.slug] || ctx.slug,
      date, time,
      homeLogo: homeComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${homeComp.team?.id}.png`,
      awayLogo: awayComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${awayComp.team?.id}.png`,
      slug: ctx.slug,
      homeTeamId: homeComp.team?.id, awayTeamId: awayComp.team?.id,
      kickoffISO: comp.date,
      source: 'ESPN',
    },
  }
}

/** Normalise un instant TheSportsDB vers un ISO UTC parseable. */
export function toUTCInstant(raw) {
  if (!raw || typeof raw !== 'string') return null
  let iso = raw.trim().replace(' ', 'T')
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null
  if (!iso.includes('T')) iso = `${iso.slice(0, 10)}T12:00:00`
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso = `${iso}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : iso
}

export function classifyTSBEvent(event, ctx) {
  const todayISO = ctx.todayISO
  const now = ctx.now instanceof Date ? ctx.now : new Date()
  const raw = event?.strEvent || ''
  const sep = raw.includes(' vs ') ? ' vs ' : raw.includes(' vs.') ? ' vs. ' : null
  if (!sep) return { status: 'rejected', reason: 'sans_equipes' }
  const parts = raw.split(sep)
  const home = (parts[0] || '').trim()
  const away = (parts.slice(1).join(sep) || '').trim()
  if (!home || !away) return { status: 'rejected', reason: 'sans_equipes' }
  if (event.strStatus && /^(FT|Match Finished|Finished|Final|Postponed|Cancelled|Canceled|APT|PST|SUSP|ABD)$/i.test(event.strStatus)) {
    return { status: 'rejected', reason: /post/i.test(event.strStatus) ? 'reporte' : /canc/i.test(event.strStatus) ? 'annule' : 'termine' }
  }
  // Date Dakar : strTimestamp (UTC) prioritaire, sinon dateEvent + strTime (UTC), sinon rejet.
  const instant = toUTCInstant(event.strTimestamp)
    || (event.dateEvent && event.strTime ? toUTCInstant(`${event.dateEvent}T${event.strTime}`) : null)
  if (!instant) return { status: 'rejected', reason: 'sans_date' }
  const date = dakarDateFromISO(instant)
  if (!date) return { status: 'rejected', reason: 'sans_date' }
  if (date < todayISO) return { status: 'rejected', reason: 'date_passee' }
  const time = dakarTimeFromISO(instant) || ''
  if (date === todayISO) {
    const kickoff = new Date(instant).getTime()
    if (Number.isFinite(kickoff) && kickoff <= now.getTime() + MIN_KICKOFF_LEAD_MINUTES * 60 * 1000) {
      return { status: 'rejected', reason: 'deja_commence' }
    }
  }
  return {
    status: 'kept',
    candidate: {
      home, away,
      league: event.strLeague || 'Ligue inconnue',
      date, time,
      homeLogo: null, awayLogo: null,
      slug: null,
      homeTeamId: event.idHomeTeam || null, awayTeamId: event.idAwayTeam || null,
      kickoffISO: instant,
      source: 'TheSportsDB',
    },
  }
}

// ─── Poisson (conservé — mathématiquement correct, alimenté par données réelles) ───
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

// ─── Cache mémoire des stats d'équipe ───
const teamStatsCache = new Map()

async function fetchTeamStats(slug, teamId) {
  const cacheKey = `${slug}_${teamId}`
  if (teamStatsCache.has(cacheKey)) return teamStatsCache.get(cacheKey)

  const maxRetries = 3
  const baseDelay = 800

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
      const finishedMatches = []
      for (const ev of data.events || []) {
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
        finishedMatches.push({
          date: (ev.date || '').slice(0, 10),
          isHome,
          goalsFor: parseInt(myScore, 10),
          goalsAgainst: parseInt(oppScore, 10),
        })
      }
      finishedMatches.sort((a, b) => new Date(b.date) - new Date(a.date))
      const recent = finishedMatches.slice(0, 8)

      if (recent.length === 0) {
        const result = { available: false, matchCount: 0, dataSource: 'ESPN_TEAM_SCHEDULE' }
        teamStatsCache.set(cacheKey, result)
        return result
      }

      const avgScored = recent.reduce((s, m) => s + m.goalsFor, 0) / recent.length
      const avgConceded = recent.reduce((s, m) => s + m.goalsAgainst, 0) / recent.length
      const homeMatches = recent.filter(m => m.isHome)
      const awayMatches = recent.filter(m => !m.isHome)
      const homeAvgScored = homeMatches.length ? homeMatches.reduce((s, m) => s + m.goalsFor, 0) / homeMatches.length : null
      const homeAvgConceded = homeMatches.length ? homeMatches.reduce((s, m) => s + m.goalsAgainst, 0) / homeMatches.length : null
      const awayAvgScored = awayMatches.length ? awayMatches.reduce((s, m) => s + m.goalsFor, 0) / awayMatches.length : null
      const awayAvgConceded = awayMatches.length ? awayMatches.reduce((s, m) => s + m.goalsAgainst, 0) / awayMatches.length : null
      const dataQuality = recent.length >= 8 ? 'HIGH' : 'MEDIUM' // ≥4 par construction du fenêtrage

      const result = { available: true, dataSource: 'ESPN_TEAM_SCHEDULE', matchCount: recent.length, dataQuality, avgScored, avgConceded, homeAvgScored, homeAvgConceded, awayAvgScored, awayAvgConceded }
      teamStatsCache.set(cacheKey, result)
      return result
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)))
        continue
      }
    }
  }
  const result = { available: false, matchCount: 0, dataSource: 'ESPN_TEAM_SCHEDULE' }
  teamStatsCache.set(cacheKey, result)
  return result
}

// ─── Pool de concurrence borné ───
async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ─── Construction des lignes de payload ───
export function genMatchId(home, away, date) {
  // Les chiffres sont conservés (ex. « 1860 Munich », « Club 1 ») — sinon deux
  // équipes distinctes tronquées à 8 lettres produiraient le même id.
  const h = home.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const a = away.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return `${h}-vs-${a}-${date}`
}

function assignTier(reliability) {
  if (reliability >= 75) return 'GOLD'
  if (reliability >= 60) return 'SILVER'
  return 'STANDARD'
}

/** Ligne AVEC probabilités — uniquement si les DEUX équipes ont ≥ 4 vrais matchs récents. */
export function buildProbaLine(candidate, homeStats, awayStats) {
  const homeAttackXG = homeStats.homeAvgScored !== null ? homeStats.homeAvgScored : homeStats.avgScored
  const homeDefenseXG = homeStats.homeAvgConceded !== null ? homeStats.homeAvgConceded : homeStats.avgConceded
  const awayAttackXG = awayStats.awayAvgScored !== null ? awayStats.awayAvgScored : awayStats.avgScored
  const awayDefenseXG = awayStats.awayAvgConceded !== null ? awayStats.awayAvgConceded : awayStats.avgConceded

  const homeBonus = 0.15
  const lambdaHome = Math.max(0.50, Math.min(3.00, (homeAttackXG + awayDefenseXG) / 2 + homeBonus))
  const lambdaAway = Math.max(0.50, Math.min(3.00, (awayAttackXG + homeDefenseXG) / 2))

  const bttsProbRaw = bttsRealProb(lambdaHome, lambdaAway)
  const over25ProbRaw = over25RealProb(lambdaHome, lambdaAway)
  const maxProb = Math.max(bttsProbRaw, over25ProbRaw)
  if (maxProb < MIN_PROBA) return { rejected: true, reason: `proba_trop_basse (BTTS ${(bttsProbRaw * 100).toFixed(1)}% / Over ${(over25ProbRaw * 100).toFixed(1)}% < 35%)` }

  const xgHome = +lambdaHome.toFixed(2)
  const xgAway = +lambdaAway.toFixed(2)
  const xgTotal = +(lambdaHome + lambdaAway).toFixed(2)

  let xgScore = xgTotal >= 3.2 ? 95 : xgTotal >= 2.8 ? 85 : xgTotal >= 2.4 ? 75 : xgTotal >= 2.0 ? 60 : 45
  const qualityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  const homeQuality = homeStats.dataQuality
  const awayQuality = awayStats.dataQuality
  const dataQuality = qualityRank[homeQuality] <= qualityRank[awayQuality] ? homeQuality : awayQuality
  const qualityScore = dataQuality === 'HIGH' ? 100 : 70
  const bttsScore = Math.min(100, bttsProbRaw * 100 * 1.25)
  const reliability = +((bttsScore * 0.35) + (xgScore * 0.25) + (qualityScore * 0.30) + (50 * 0.10)).toFixed(2)

  const matchId = genMatchId(candidate.home, candidate.away, candidate.date)
  return {
    rejected: false,
    line: {
      id: matchId,
      match: `${candidate.home} vs ${candidate.away}`,
      home: candidate.home,
      away: candidate.away,
      league: candidate.league,
      date: candidate.date,
      time: candidate.time || '',
      type: 'BTTS',
      prediction: bttsProbRaw >= 0.50 ? 'Oui' : 'Non',
      proba: +bttsProbRaw.toFixed(4),
      confidence: Math.round(Math.max(40, Math.min(95, bttsProbRaw * 100))),
      matchSemantic: matchId,
      source: 'poisson-v92-real-data',
      matchSource: candidate.source,
      homeLogo: candidate.homeLogo,
      awayLogo: candidate.awayLogo,
      tier: assignTier(reliability),
      reliabilityScore: reliability,
      dataQuality,
      dataSource: 'ESPN_TEAM_SCHEDULE',
      matchCountHome: homeStats.matchCount,
      matchCountAway: awayStats.matchCount,
      h2hAvailable: false,
      xgHome, xgAway, xgTotal,
      estimatedCote: +(1 / Math.max(0.20, bttsProbRaw)).toFixed(2),
      estimatedCoteOver: +(1 / Math.max(0.20, over25ProbRaw)).toFixed(2),
      predictions: [
        { type: 'BTTS', prediction: bttsProbRaw >= 0.50 ? 'Oui' : 'Non', confidence: Math.round(Math.max(40, Math.min(95, bttsProbRaw * 100))), bttsProb: +bttsProbRaw.toFixed(4), homeLambda: xgHome, awayLambda: xgAway },
        { type: 'Over 2.5', prediction: over25ProbRaw >= 0.50 ? 'Oui' : 'Non', confidence: Math.round(Math.max(40, Math.min(95, over25ProbRaw * 100))), over25Prob: +over25ProbRaw.toFixed(4), homeLambda: xgHome, awayLambda: xgAway },
      ],
      bttsProb: +bttsProbRaw.toFixed(4),
      over25Prob: +over25ProbRaw.toFixed(4),
      homeLambda: xgHome,
      awayLambda: xgAway,
    },
  }
}

/** Ligne « données limitées » — match réel SANS probabilité, SANS λ, SANS cote. */
export function buildLimitedLine(candidate) {
  const matchId = genMatchId(candidate.home, candidate.away, candidate.date)
  return {
    id: matchId,
    match: `${candidate.home} vs ${candidate.away}`,
    home: candidate.home,
    away: candidate.away,
    league: candidate.league,
    date: candidate.date,
    time: candidate.time || '',
    type: null,
    prediction: null,
    proba: null,
    confidence: null,
    matchSemantic: matchId,
    source: 'listing-real-match',
    matchSource: candidate.source,
    homeLogo: candidate.homeLogo,
    awayLogo: candidate.awayLogo,
    tier: null,
    reliabilityScore: null,
    dataQuality: 'LOW',
    dataLimited: true,
    dataSource: candidate.source === 'TheSportsDB' ? 'THESPORTSDB_EVENTS' : 'ESPN_SCOREBOARD',
    matchCountHome: 0,
    matchCountAway: 0,
    h2hAvailable: false,
    xgHome: null,
    xgAway: null,
    xgTotal: null,
    estimatedCote: null,
    estimatedCoteOver: null,
    predictions: [],
    bttsProb: null,
    over25Prob: null,
    homeLambda: null,
    awayLambda: null,
  }
}

const QUALITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 }

/**
 * Cœur pur du pipeline : candidats déjà classés → payload + journal.
 * Aucun réseau ici — entièrement testable.
 */
export function buildPayload({ candidates, todayISO, now = new Date(), maxFree = MAX_FREE, maxVip = MAX_VIP }) {
  const journal = {
    generatedAt: new Date(now.getTime()).toISOString(),
    date: todayISO,
    receivedRaw: candidates.length,
    rejected: [],
    duplicates: 0,
  }
  const bump = (reason) => {
    const r = journal.rejected.find(x => x.reason === reason)
    if (r) r.count++
    else journal.rejected.push({ reason, count: 1, examples: [] })
  }
  const addReject = (reason, candidate, extra = '') => {
    bump(reason)
    const bucket = journal.rejected.find(x => x.reason === reason)
    if (bucket.examples.length < 15) {
      bucket.examples.push(`${candidate.home} vs ${candidate.away} [${candidate.league}] ${candidate.date}${extra ? ' — ' + extra : ''}`)
    }
  }

  const scoredProba = []
  const limited = []

  for (const item of candidates) {
    const c = item.candidate
    if (item.noStatsWindow) {
      limited.push(buildLimitedLine(c))
      continue
    }
    const homeUsable = item.homeStats?.available && item.homeStats.matchCount >= 4
    const awayUsable = item.awayStats?.available && item.awayStats.matchCount >= 4
    if (!homeUsable || !awayUsable) {
      limited.push(buildLimitedLine(c))
      continue
    }
    const built = buildProbaLine(c, item.homeStats, item.awayStats)
    if (built.rejected) {
      addReject('proba_trop_basse', c, built.reason)
      continue
    }
    scoredProba.push(built.line)
  }

  // Tri : date asc → qualité desc → fiabilité desc → heure asc
  scoredProba.sort((a, b) => {
    const dc = (a.date || '').localeCompare(b.date || '')
    if (dc !== 0) return dc
    const qc = QUALITY_RANK[b.dataQuality] - QUALITY_RANK[a.dataQuality]
    if (qc !== 0) return qc
    const rc = (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1)
    if (rc !== 0) return rc
    return `${a.date}T${a.time || '23:59'}`.localeCompare(`${b.date}T${b.time || '23:59'}`)
  })
  limited.sort((a, b) => `${a.date}T${a.time || '23:59'}`.localeCompare(`${b.date}T${b.time || '23:59'}`))

  // Fusion date/qualité : les lignes limitées d'une date passent après les lignes
  // avec probabilité de la même date, avant les lignes proba des jours suivants.
  const merged = []
  let pi = 0, li = 0
  while (pi < scoredProba.length || li < limited.length) {
    const nextProba = scoredProba[pi]
    const nextLimited = limited[li]
    if (!nextLimited || (nextProba && nextProba.date <= nextLimited.date)) { merged.push(nextProba); pi++ }
    else { merged.push(nextLimited); li++ }
  }

  const published = merged.slice(0, maxFree)

  let truncated = 0
  // VIP : lignes prédictives au-delà du cap free, matchs du jour priorisés.
  // Partition STRICTE : free ∪ vip ∪ tronqués = acceptés (aucun double comptage).
  const overflow = merged.slice(maxFree)
  const overflowProba = overflow.filter(p => typeof p.proba === 'number')
  overflowProba.sort((a, b) => ((b.date === todayISO ? 1 : 0) - (a.date === todayISO ? 1 : 0)) || (b.reliabilityScore - a.reliabilityScore))
  const vipPreview = overflowProba.slice(0, maxVip).map(p => ({ ...p, vip: true }))
  const vipIds = new Set(vipPreview.map(p => p.id))
  const truncatedByDate = {}
  for (const line of overflow) {
    if (vipIds.has(line.id)) continue
    truncated++
    truncatedByDate[line.date] = (truncatedByDate[line.date] || 0) + 1
  }
  if (truncated > 0) journal.rejected.push({ reason: 'cap_affichage', count: truncated, examples: Object.entries(truncatedByDate).slice(0, 15).map(([d, n]) => `${n} ligne(s) du ${d}`) })

  const free = published

  const sourcesUsed = [...new Set(published.map(p => p.matchSource).filter(Boolean))]
  const probaPublished = published.filter(p => typeof p.proba === 'number').length + vipPreview.length

  const payload = {
    date: todayISO,
    lastUpdated: journal.generatedAt,
    source: sourcesUsed.length > 0 ? sourcesUsed.join(' + ') : 'ESPN',
    free,
    vipPreview,
    stats: {
      avgReliability: scoredProba.length > 0 ? +(scoredProba.reduce((s, p) => s + p.reliabilityScore, 0) / scoredProba.length).toFixed(2) : 0,
      receivedRaw: candidates.length,
      totalAnalyzed: candidates.length - journal.rejected.filter(r => ['sans_donnees_competition', 'sans_equipes', 'termine', 'reporte', 'annule', 'sans_date', 'date_passee', 'deja_commence'].includes(r.reason)).reduce((s, r) => s + r.count, 0) - (journal.duplicates),
      totalRejected: journal.rejected.reduce((s, r) => s + r.count, 0) + journal.duplicates,
      totalAccepted: free.length + vipPreview.length,
      freeCount: free.length,
      vipCount: vipPreview.length,
      displayOnly: free.filter(p => p.dataLimited === true).length,
      probaLines: probaPublished,
      geminiEligible: Math.min(GEMINI_MAX_LINES, probaPublished),
      rejections: { doublons: journal.duplicates, byReason: journal.rejected.reduce((acc, r) => { acc[r.reason] = r.count; return acc }, {}) },
    },
    predictions: free,
  }

  // Invariant de cohérence : reçu = publié + rejeté (hors doublons comptés à part)
  const rejectedTotal = journal.rejected.reduce((s, r) => s + r.count, 0)
  if (candidates.length !== free.length + vipPreview.length + rejectedTotal + journal.duplicates) {
    throw new Error(`[v92] Compteurs incohérents: reçu ${candidates.length} ≠ publié ${free.length + vipPreview.length} + rejeté ${rejectedTotal} + doublons ${journal.duplicates}`)
  }

  return { payload, journal }
}

// ─── Réseau : sources ───
async function fetchJSON(url, ms = 10000) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTTSPredict/1.0)' }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Scoreboard ESPN appel-par-appel (la syntaxe de plage `dates=A-B` est
 * silencieusement vide côté ESPN — vérifié 2026-10-20). Horizon J0..J+3 pour
 * borner le budget de requêtes ; retries + dégradation gracieuse par ligue.
 */
async function fetchESPNBoard(slug, dateParam) {
  // 3 tentatives avec backoff — ESPN limite les rafales (429/403 Akamai) ;
  // sans retry, un pool parallèle perdrait des journées entières.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateParam}`)
      return { events: data.events || [], leagueName: data.leagues?.[0]?.name || ESPN_SLUGS[slug] || slug }
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return { events: [], leagueName: ESPN_SLUGS[slug] || slug, failed: true }
}

// Clés TheSportsDB : « 3 » (historique, 403 depuis 2026) puis « 123 » (démo, 3 événements max).
const TSB_KEYS = ['3', '123']
let tsbWorkingKey = null

async function fetchTheSportsDBDay(dateISO) {
  const keys = tsbWorkingKey ? [tsbWorkingKey, ...TSB_KEYS.filter(k => k !== tsbWorkingKey)] : TSB_KEYS
  for (const key of keys) {
    try {
      const data = await fetchJSON(`https://www.thesportsdb.com/api/v1/json/${key}/eventsday.php?d=${dateISO}&s=Soccer`)
      tsbWorkingKey = key
      return data.events || []
    } catch {
      continue
    }
  }
  return []
}

// ─── Main ───
async function quickUpdate() {
  const t0 = Date.now()
  const today = getTodayISO()
  const now = new Date()
  console.log(`[v92] Agrégateur de couverture — aujourd'hui (Dakar) = ${today}`)

  const dateParams = []
  for (let i = 0; i < FUTURE_DAYS; i++) {
    dateParams.push(new Date(now.getTime() + i * 86400000).toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ }))
  }
  const tsbDates = [...dateParams, ...Array.from({ length: 3 }, (_, i) => new Date(now.getTime() + (FUTURE_DAYS + i) * 86400000).toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ }))]

  // ─── Étape 1 : ESPN — 76 ligues × J0..J+3, pool borné + retries ───
  const boardJobs = []
  for (const slug of Object.keys(ESPN_SLUGS)) {
    for (const dateParam of dateParams) boardJobs.push({ slug, dateParam: dateParam.replace(/-/g, '') })
  }
  const boards = await mapPool(boardJobs, 6, async job => ({ job, board: await fetchESPNBoard(job.slug, job.dateParam) }))

  const candidates = []
  let receivedRaw = 0
  const ctxBase = { todayISO: today, now }
  for (const { job, board } of boards) {
    for (const ev of board.events) {
      receivedRaw++
      const res = classifyESPNEvent(ev, { ...ctxBase, slug: job.slug, leagueName: ESPN_SLUGS[job.slug] || board.leagueName })
      if (res.status === 'kept') candidates.push(res.candidate)
    }
  }
  const slugOk = new Set(boards.filter(b => b.board.events.length > 0).map(b => b.job.slug))
  const boardFailures = boards.filter(b => b.board.failed).length
  console.log(`[v92] ESPN: ${receivedRaw} événements reçus sur ${boardJobs.length} requêtes (${slugOk.size} slugs actifs, ${boardFailures} échecs après retries)`)

  // ─── Étape 2 : TheSportsDB — secours dégradé (source conservée par ligne) ───
  let tsbRaw = 0
  for (const dateISO of tsbDates) {
    const events = await fetchTheSportsDBDay(dateISO)
    tsbRaw += events.length
    for (const ev of events) {
      const res = classifyTSBEvent(ev, ctxBase)
      if (res.status === 'kept') candidates.push(res.candidate)
    }
    await new Promise(r => setTimeout(r, 350)) // politesse rate-limit
  }
  console.log(`[v92] TheSportsDB: ${tsbRaw} événements (clé utilisée: ${tsbWorkingKey || 'aucune'})`)

  // ─── Étape 3 : dédoublonnage (équipes normalisées + date ; ESPN prioritaire) ───
  candidates.sort((a, b) => (a.source === 'ESPN' ? 0 : 1) - (b.source === 'ESPN' ? 0 : 1))
  const { kept, duplicates } = dedupCandidates(candidates)
  console.log(`[v92] Candidats ${candidates.length} → uniques ${kept.length} (doublons inter-sources: ${duplicates.length})`)
  if (kept.length === 0) {
    throw new Error(`[v92] Aucun match planifié reçu des sources pour ${today} ; predictions.json existant conservé`)
  }

  // ─── Étape 4 : stats d'équipe réelles pour la fenêtre J0..J+2 (hors fenêtre → ligne limitée) ───
  const statsWindowEnd = new Date(now.getTime() + (STATS_WINDOW_DAYS - 1) * 86400000).toLocaleDateString('sv-SE', { timeZone: DISPLAY_TZ })
  const enriched = await mapPool(kept, 8, async (c) => {
    if (c.source !== 'ESPN' || !c.slug || !c.homeTeamId || !c.awayTeamId || c.date > statsWindowEnd) {
      return { candidate: c, noStatsWindow: c.date > statsWindowEnd || c.source !== 'ESPN' }
    }
    const [homeStats, awayStats] = await Promise.all([
      fetchTeamStats(c.slug, c.homeTeamId),
      fetchTeamStats(c.slug, c.awayTeamId),
    ])
    return { candidate: c, homeStats, awayStats }
  })
  const statCalls = enriched.filter(e => e.homeStats).length
  console.log(`[v92] Stats d'équipe réelles: ${statCalls} matchs enrichis (fenêtre J0..J+${STATS_WINDOW_DAYS - 1}), ${enriched.length - statCalls} lignes « données limitées »`)

  // ─── Étape 5 : payload + journal ───
  const { payload, journal } = buildPayload({ candidates: enriched, todayISO: today, now })
  journal.duplicates = duplicates.length
  journal.duplicateExamples = duplicates.slice(0, 15).map(d => `${d.dropped.home} vs ${d.dropped.away} [${d.dropped.league}] ${d.dropped.date} (doublon de ${d.source === d.dropped.source ? 'même source' : 'source ' + d.source})`)
  // Recalcul des compteurs avec les doublons
  payload.stats.rejections.doublons = duplicates.length
  payload.stats.totalRejected = journal.rejected.reduce((s, r) => s + r.count, 0) + duplicates.length
  payload.stats.totalAnalyzed = candidates.length - journal.rejected.filter(r => ['sans_donnees_competition', 'sans_equipes', 'termine', 'reporte', 'annule', 'sans_date', 'date_passee', 'deja_commence'].includes(r.reason)).reduce((s, r) => s + r.count, 0) - duplicates.length

  const rejectedSourceExamples = journal.rejected.filter(r => r.examples?.length)
  console.log(`\n[v92] ===== RÉSULTATS =====`)
  console.log(`Reçus des sources        : ${candidates.length} (uniques, doublons retirés)`)
  console.log(`Publiés                  : ${payload.stats.totalAccepted} (free ${payload.stats.freeCount} + VIP ${payload.stats.vipCount})`)
  console.log(`  - avec probabilités    : ${payload.stats.probaLines - payload.stats.vipCount}`)
  console.log(`  - données limitées     : ${payload.stats.displayOnly}`)
  console.log(`Rejetés (total journalisé): ${payload.stats.totalRejected}`)
  for (const r of journal.rejected) console.log(`  - ${r.reason}: ${r.count}`)
  console.log(`Doublons dédupliqués     : ${duplicates.length}`)
  console.log(`Éligibles Gemini         : ≤ ${payload.stats.geminiEligible} lignes`)

  console.log(`\n--- REJETS (exemples) ---`)
  for (const r of rejectedSourceExamples.slice(0, 8)) {
    console.log(`  ${r.reason}: ${r.examples.slice(0, 3).join(' | ')}`)
  }
  console.log(`\n--- FREE (aujourd'hui ${today}) ---`)
  payload.free.filter(p => p.date === today).slice(0, 25).forEach(p => console.log(`  ${p.match} | ${p.league} | ${p.time || 'heure n/c'} | ${p.dataLimited ? 'DONNÉES LIMITÉES' : `BTTS ${(p.bttsProb * 100).toFixed(1)}%`} | ${p.dataSource}`))

  // ─── Validation bloquante ───
  const validationErrors = validatePredictionPayload(payload, { today, requireTimestamp: true, checkKickoff: true, now })
  if (validationErrors.length > 0) {
    throw new Error(`[v92] Refus de publier un payload invalide :\n${validationErrors.join('\n')}`)
  }

  writeJsonAtomically(PREDICTIONS_FILE, payload)
  console.log(`\n[v92] Écrit: predictions.json (${payload.stats.freeCount} free dont ${payload.stats.displayOnly} données limitées, ${payload.stats.vipCount} VIP) — ${(fs.statSync(PREDICTIONS_FILE).size / 1024).toFixed(1)} KB`)

  // Journal des rejets (audit de couverture)
  writeJsonAtomically(REJECTS_FILE, journal)
  console.log(`[v92] Journal des rejets: predictions-rejects.json (${journal.rejected.reduce((s, r) => s + r.count, 0)} rejets)`)

  // ─── Archive quotidienne : UNIQUEMENT les lignes prédictives (jamais les
  // lignes « données limitées » — elles ne sont pas des pronostics et ne
  // doivent pas entrer dans le suivi public vérifié). ───
  const archiveProbaFree = payload.free.filter(p => typeof p.proba === 'number')
  const archiveData = {
    date: payload.date,
    lastUpdated: payload.lastUpdated,
    source: payload.source,
    free: archiveProbaFree,
    vipPreview: payload.vipPreview,
    stats: payload.stats,
    predictions: archiveProbaFree,
  }
  const archiveFile = path.join(ARCHIVE_DIR, `${today}.json`)
  writeJsonAtomically(archiveFile, archiveData)
  console.log(`[v92] Archivé: predictions-archive/${today}.json (${archiveProbaFree.length} pronostics prédictifs)`)
  console.log(`\n[v92] Terminé en ${((Date.now() - t0) / 1000).toFixed(0)}s.`)
}

// Exports pour les tests (aucune exécution réseau à l'import)
export { fetchTeamStats, mapPool }

const isMain = typeof process.argv[1] === 'string' && process.argv[1].length > 0
  && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  quickUpdate().catch(err => {
    console.error('[v92] FATAL:', err)
    process.exit(1)
  })
}
