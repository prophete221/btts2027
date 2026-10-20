/**
 * Match slug utility library — generates stable, SEO-friendly URLs for match pages.
 *
 * Slug format: {home}-{away}-{YYYY-MM-DD}
 * Example: "arsenal-vs-chelsea-2026-08-15"
 *
 * Used by:
 *  - src/app/match/[slug]/page.tsx (static generation)
 *  - Internal links from /btts/predictions/today cards
 *  - Sitemap generator
 */

import fs from 'fs'
import path from 'path'
import { generateMatchSlug } from './match-slug'

export { generateMatchSlug } from './match-slug'

export interface VerifiedHistoryEntry {
  match?: string
  date?: string
  market?: string
  type?: string
  status?: string
  isWon?: boolean
  finalScore?: string
  score?: string
  verifiedAt?: string
  source?: string
}

function normalizeMatchName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function marketKey(value: string | undefined): string {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized.includes('btts')) return 'btts'
  if (normalized.includes('over25') || normalized.includes('o25')) return 'over25'
  return normalized
}

/** Read only the public verified history for a specific match. */
export function getVerifiedHistoryForMatch(home: string, away: string, date?: string): VerifiedHistoryEntry[] {
  const historyPath = path.join(process.cwd(), 'public', 'win-history.json')
  if (!fs.existsSync(historyPath)) return []
  try {
    const payload = JSON.parse(fs.readFileSync(historyPath, 'utf8')) as { history?: VerifiedHistoryEntry[] }
    const expected = `${normalizeMatchName(home)} vs ${normalizeMatchName(away)}`
    return (payload.history || []).filter(entry => {
      const match = normalizeMatchName(entry.match || '')
      const sameTeams = match === expected
      const sameDate = !date || !entry.date || entry.date.slice(0, 10) === date.slice(0, 10)
      return sameTeams && sameDate
    })
  } catch {
    return []
  }
}

export function verifiedMarketKey(value: string | undefined): string {
  return marketKey(value)
}

export interface MatchData {
  slug: string
  home: string
  away: string
  league: string
  date: string
  time?: string
  homeLogo?: string
  awayLogo?: string
  predictions: Array<{
    type: string
    market: string
    prediction: string
    proba: number
    confidence: number
    tier: string
    status?: string
    isWon?: boolean
    finalScore?: string
    verifiedAt?: string
    source?: string
  }>
  aiExactScore?: string
  exactScoreProb?: string
  aiBttsProb?: string
  aiOver25Prob?: string
  aiKeyFact?: string
  aiAnalysis?: string
  bttsProb?: number
  over25Prob?: number
  homeLambda?: number
  awayLambda?: number
  xgTotal?: number
  // Qualité / provenance des données (mission : page match transparente)
  dataQuality?: string
  dataSource?: string
  matchCountHome?: number
  matchCountAway?: number
  aiRisk?: string
  formBtts?: string
  // Date de publication réelle du snapshot de données (predictions.json / archives).
  // Remplace toute date de source codée en dur dans l'UI.
  lastUpdated?: string
}

/**
 * Parse a slug back to { home, away, date }.
 * Imperfect — only used for debugging.
 */
export function parseMatchSlug(slug: string): { home: string; away: string; date: string } | null {
  const m = slug.match(/^(.+)-vs-(.+)-(\d{4}-\d{2}-\d{2})$/)
  if (!m) return null
  return { home: m[1].replace(/-/g, ' '), away: m[2].replace(/-/g, ' '), date: m[3] }
}

/**
 * Load all archived predictions and group by match.
 * Returns a Map of slug → MatchData.
 */
export function loadAllMatches(): Map<string, MatchData> {
  const archiveDir = path.join(process.cwd(), 'public', 'predictions-archive')
  const matches = new Map<string, MatchData>()

  if (!fs.existsSync(archiveDir)) return matches

  const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json')).sort().slice(-14) // last 14 days only — reduce inode pressure on shared hosting

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf8'))
      const preds = data.predictions || data
      if (!Array.isArray(preds)) continue

      for (const p of preds) {
        const home = p.home || ''
        const away = p.away || ''
        const date = (p.date || '').slice(0, 10)
        if (!home || !away || !date) continue

        const slug = generateMatchSlug(home, away, date)
        const snapshotPublishedAt = data.lastUpdated || data.date || file.replace(/\.json$/, '')
        if (!matches.has(slug)) {
          matches.set(slug, {
            slug,
            home,
            away,
            league: p.league || '',
            date,
            time: p.time || '',
            homeLogo: p.homeLogo,
            awayLogo: p.awayLogo,
            predictions: [],
            aiExactScore: p.ai_exact_score,
            exactScoreProb: p.exact_score_prob,
            aiBttsProb: p.ai_btts_prob,
            aiOver25Prob: p.ai_over25_prob,
            aiKeyFact: p.ai_key_fact,
            aiAnalysis: p.ai_analysis,
            bttsProb: p.bttsProb,
            over25Prob: p.over25Prob,
            homeLambda: p.homeLambda,
            awayLambda: p.awayLambda,
            xgTotal: p.xgTotal,
            dataQuality: p.dataQuality,
            dataSource: p.dataSource,
            matchCountHome: p.matchCountHome,
            matchCountAway: p.matchCountAway,
            aiRisk: p.ai_risk,
            formBtts: p.formBTTS,
            lastUpdated: snapshotPublishedAt,
          })
        }

        const match = matches.get(slug)!
        if (!match.aiExactScore && p.ai_exact_score) match.aiExactScore = p.ai_exact_score
        if (!match.exactScoreProb && p.exact_score_prob) match.exactScoreProb = p.exact_score_prob
        if (!match.aiBttsProb && p.ai_btts_prob) match.aiBttsProb = p.ai_btts_prob
        if (!match.aiOver25Prob && p.ai_over25_prob) match.aiOver25Prob = p.ai_over25_prob
        if (!match.aiKeyFact && p.ai_key_fact) match.aiKeyFact = p.ai_key_fact
        if (!match.aiAnalysis && p.ai_analysis) match.aiAnalysis = p.ai_analysis
        if (match.bttsProb == null && p.bttsProb != null) match.bttsProb = p.bttsProb
        if (match.over25Prob == null && p.over25Prob != null) match.over25Prob = p.over25Prob
        if (match.homeLambda == null && p.homeLambda != null) match.homeLambda = p.homeLambda
        if (match.awayLambda == null && p.awayLambda != null) match.awayLambda = p.awayLambda
        if (match.xgTotal == null && p.xgTotal != null) match.xgTotal = p.xgTotal
        if (!match.dataQuality && p.dataQuality) match.dataQuality = p.dataQuality
        if (!match.dataSource && p.dataSource) match.dataSource = p.dataSource
        if (match.matchCountHome == null && p.matchCountHome != null) match.matchCountHome = p.matchCountHome
        if (match.matchCountAway == null && p.matchCountAway != null) match.matchCountAway = p.matchCountAway
        if (!match.aiRisk && p.ai_risk) match.aiRisk = p.ai_risk
        if (!match.formBtts && p.formBTTS) match.formBtts = p.formBTTS
        if (!match.lastUpdated && snapshotPublishedAt) match.lastUpdated = snapshotPublishedAt
        match.predictions.push({
          type: p.type || p.market || '',
          market: p.type || p.market || '',
          prediction: p.prediction || '',
          proba: p.proba || p.confidence / 100 || 0.62,
          confidence: p.confidence || 62,
          tier: p.tier || 'STANDARD',
          status: p.status,
          isWon: p.isWon,
          finalScore: p.finalScore,
          verifiedAt: p.verifiedAt,
          source: p.source || '',
        })
      }
    } catch (e) {
      continue
    }
  }

  // Current predictions may contain richer AI fields than archived snapshots.
  // Merge those fields into the same stable match records so every live prediction
  // can link to a detailed static match page without changing the data source.
  const currentPath = path.join(process.cwd(), 'public', 'predictions.json')
  if (fs.existsSync(currentPath)) {
    try {
      const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'))
      const currentPredictions = current?.free || current?.predictions || []
      if (Array.isArray(currentPredictions)) {
        for (const p of currentPredictions) {
          // Mission couverture : les lignes « données limitées » (match réel sans
          // pronostic) ne génèrent PAS de page match — éviter des pages fines
          // indexables sans analyse. Elles restent visibles sur la page du jour.
          if (p.dataLimited === true) continue
          const home = p.home || ''
          const away = p.away || ''
          const date = (p.date || '').slice(0, 10)
          if (!home || !away || !date) continue
          const slug = generateMatchSlug(home, away, date)
          let match = matches.get(slug)
          if (!match) {
            match = {
              slug,
              home,
              away,
              league: p.league || '',
              date,
              time: p.time || '',
              homeLogo: p.homeLogo,
              awayLogo: p.awayLogo,
              predictions: [],
              lastUpdated: current.lastUpdated || current.date || undefined,
            }
            matches.set(slug, match)
          }
          if (!match.lastUpdated && current.lastUpdated) match.lastUpdated = current.lastUpdated
          if (!match.aiExactScore && p.ai_exact_score) match.aiExactScore = p.ai_exact_score
          if (!match.exactScoreProb && p.exact_score_prob) match.exactScoreProb = p.exact_score_prob
          if (!match.aiBttsProb && p.ai_btts_prob) match.aiBttsProb = p.ai_btts_prob
          if (!match.aiOver25Prob && p.ai_over25_prob) match.aiOver25Prob = p.ai_over25_prob
          if (!match.aiKeyFact && p.ai_key_fact) match.aiKeyFact = p.ai_key_fact
          if (!match.aiAnalysis && p.ai_analysis) match.aiAnalysis = p.ai_analysis
          if (match.bttsProb == null && p.bttsProb != null) match.bttsProb = p.bttsProb
          if (match.over25Prob == null && p.over25Prob != null) match.over25Prob = p.over25Prob
          if (match.homeLambda == null && p.homeLambda != null) match.homeLambda = p.homeLambda
          if (match.awayLambda == null && p.awayLambda != null) match.awayLambda = p.awayLambda
          if (match.xgTotal == null && p.xgTotal != null) match.xgTotal = p.xgTotal
          const sourceMarkets = Array.isArray(p.predictions) && p.predictions.length > 0
            ? p.predictions
            : [p]
          for (const sourcePrediction of sourceMarkets) {
            const marketType = sourcePrediction.type || sourcePrediction.market || p.type || p.market || 'BTTS'
            const hasMarket = match.predictions.some(existing =>
              (existing.type || existing.market || '').toLowerCase() === String(marketType).toLowerCase(),
            )
            if (hasMarket) continue
            match.predictions.push({
              type: marketType,
              market: marketType,
              prediction: sourcePrediction.prediction || p.prediction || '',
              proba: sourcePrediction.proba || sourcePrediction.bttsProb || sourcePrediction.over25Prob || p.proba || p.confidence / 100 || 0.62,
              confidence: sourcePrediction.confidence || p.confidence || 62,
              tier: sourcePrediction.tier || p.tier || 'STANDARD',
              status: sourcePrediction.status || p.status,
              isWon: sourcePrediction.isWon ?? p.isWon,
              finalScore: sourcePrediction.finalScore || p.finalScore,
              verifiedAt: sourcePrediction.verifiedAt || p.verifiedAt,
              source: sourcePrediction.source || p.source || '',
            })
          }
        }
      }
    } catch {
      // Keep archived match pages available if the live data file is unavailable.
    }
  }

  return matches
}

/**
 * Get a single match by slug.
 */
export function getMatchBySlug(slug: string): MatchData | null {
  const matches = loadAllMatches()
  let decodedSlug = slug
  try {
    decodedSlug = decodeURIComponent(slug)
  } catch {
    // Keep the original slug when a malformed URL segment is supplied.
  }
  return matches.get(decodedSlug) || null
}

/**
 * Get all slugs for static generation.
 */
export function getAllMatchSlugs(): string[] {
  const matches = loadAllMatches()
  return Array.from(matches.keys())
}
