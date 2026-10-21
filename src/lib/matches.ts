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
import { isVipRow, observedFormBtts } from '../../scripts/public-predictions.mjs'
import { getProba, getConfidence } from './predictions'

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
  formBtts?: string | number
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
  const ingest = (data: any, fallbackDate: string, current = false) => {
    const rows = Array.isArray(data) ? data : (data.free || data.predictions || [])
    if (!Array.isArray(rows)) return
    const refreshed = new Set<string>()
    for (const p of rows) {
      if (isVipRow(p)) continue
      const home = p.home || '', away = p.away || '', date = (p.date || '').slice(0, 10)
      if (!home || !away || !date) continue
      const slug = generateMatchSlug(home, away, date)
      const snapshotPublishedAt = p.publishedAt || data.lastUpdated || data.date || fallbackDate
      // Le flux actuel est prioritaire pour TOUS les champs, pas seulement les champs vides.
      // Il est lui-même restauré depuis la première publication par le finaliseur d'archives.
      if (!matches.has(slug) || (current && !refreshed.has(slug))) {
        matches.set(slug, {
          slug, home, away, date, league: p.league || '', time: p.time || '',
          homeLogo: p.homeLogo, awayLogo: p.awayLogo, predictions: [],
          // Les anciens chiffres Gemini ne constituent pas des sorties du modèle.
          aiKeyFact: p.ai_key_fact, aiAnalysis: p.ai_analysis,
          bttsProb: p.bttsProb, over25Prob: p.over25Prob,
          homeLambda: p.homeLambda, awayLambda: p.awayLambda, xgTotal: p.xgTotal,
          dataQuality: p.dataQuality, dataSource: p.dataSource,
          matchCountHome: p.matchCountHome, matchCountAway: p.matchCountAway,
          aiRisk: p.ai_risk, formBtts: observedFormBtts(p) ?? undefined, lastUpdated: snapshotPublishedAt,
        })
        refreshed.add(slug)
      }
      const match = matches.get(slug)!
      const markets = Array.isArray(p.predictions) && p.predictions.length ? p.predictions : [p]
      for (const market of markets) {
        if (isVipRow(market)) continue
        const type = market.type || market.market || p.type || p.market || ''
        const existing = match.predictions.findIndex(row => marketKey(row.type) === marketKey(type))
        const probability = market.proba ?? (marketKey(type) === 'btts' ? market.bttsProb : market.over25Prob)
        const combined = { ...p, ...market, type, proba: probability ?? p.proba }
        const row = {
          type, market: type, prediction: market.prediction || p.prediction || '',
          proba: getProba(combined), confidence: getConfidence(combined),
          tier: market.tier || p.tier || 'STANDARD', status: market.status || p.status,
          isWon: market.isWon ?? p.isWon, finalScore: market.finalScore || p.finalScore,
          verifiedAt: market.verifiedAt || p.verifiedAt, source: market.source || p.source || '',
        }
        if (existing < 0) match.predictions.push(row)
        else if (current) match.predictions[existing] = row
      }
    }
  }
  if (fs.existsSync(archiveDir)) {
    const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json')).sort().slice(-14)
    for (const file of files) {
      try { ingest(JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf8')), file.replace(/\.json$/, '')) }
      catch { /* Une archive illisible ne doit pas supprimer les autres pages. */ }
    }
  }
  const currentPath = path.join(process.cwd(), 'public', 'predictions.json')
  if (fs.existsSync(currentPath)) {
    try { ingest(JSON.parse(fs.readFileSync(currentPath, 'utf8')), '', true) }
    catch { /* Conserver les archives si le flux courant est indisponible. */ }
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
