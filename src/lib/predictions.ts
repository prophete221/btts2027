/**
 * Predictions utility library — single source of truth for prediction deduplication,
 * probability fallback, and data quality scoring.
 *
 * Used by:
 *  - src/components/bttsbet/FreePredictions.tsx
 *  - src/components/bttsbet/FreePredictionsWidget.tsx
 *  - src/app/btts/predictions/today/page.tsx (via FreePredictions)
 *  - src/app/historique/HistoriqueClient.tsx (via win-history.json)
 *  - scripts/verify-results.mjs (consistency check)
 */

export interface Prediction {
  // Identity
  match?: string
  home?: string
  away?: string
  date?: string
  time?: string
  league?: string
  // Market
  type?: string
  market?: string
  prediction?: string
  // Probability
  proba?: number
  probability?: number
  confidence?: number
  analysis?: {
    bttsProb?: number
    over25Prob?: number
    homeLambda?: number
    awayLambda?: number
    homeForm?: { scoredIn?: number; concededIn?: number }
    awayForm?: { scoredIn?: number; concededIn?: number }
    dataQuality?: number
    hasRealData?: boolean
  }
  // Metadata
  tier?: string
  source?: string
  matchSemantic?: string
  // Verification
  status?: 'WON' | 'LOST' | 'PENDING' | string
  isWon?: boolean
  finalScore?: string
  verifiedAt?: string
  verifiedSource?: string
  // Cotes
  coteProposee?: number
  odds?: number
  coteCloture?: number
  bookmaker?: string
}

/**
 * Stable deduplication key for a prediction.
 * Format: `${matchId}-${market}-${modelVersion}`
 * - matchId: lowercase home+away+date (normalized)
 * - market: 'btts' | 'over25'
 * - modelVersion: from tracking-period.json (default 'V3-Reliability')
 *
 * Two predictions with the same key are duplicates.
 */
export function predictionKey(p: Prediction, modelVersion = 'V3-Reliability'): string {
  const home = (p.home || p.match || '').toLowerCase().trim().replace(/\s+/g, '-')
  const away = (p.away || '').toLowerCase().trim().replace(/\s+/g, '-')
  const date = (p.date || '').slice(0, 10)
  const market = normalizeMarket(p.type || p.market || '')
  return `${home}__${away}__${date}__${market}__${modelVersion}`
}

/**
 * Normalize market string to 'btts' | 'over25'.
 */
export function normalizeMarket(m: string): string {
  const s = (m || '').toLowerCase()
  if (s.includes('btts') || s.includes('both teams')) return 'btts'
  if (s.includes('over') || s.includes('o2.5') || s.includes('o25') || s.includes('over 2.5')) return 'over25'
  return s || 'unknown'
}

/**
 * Probability fallback chain. Zero means no usable probability was supplied.
 *
 * Order:
 *  1. p.proba
 *  2. p.probability
 *  3. p.analysis.bttsProb (if market is BTTS)
 *  4. p.analysis.over25Prob (if market is Over 2.5)
 *  5. p.confidence / 100
 *  6. Default: 0 (unknown)
 */
export function getProba(p: Prediction): number {
  const market = normalizeMarket(p.type || p.market || '')
  const validProbability = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

  if (validProbability(p.proba)) return p.proba
  if (validProbability(p.probability)) return p.probability

  if (p.analysis) {
    if (market === 'btts' && validProbability(p.analysis.bttsProb)) return p.analysis.bttsProb
    if (market === 'over25' && validProbability(p.analysis.over25Prob)) return p.analysis.over25Prob
    const fallback = [p.analysis.bttsProb, p.analysis.over25Prob].filter(validProbability)
    if (fallback.length) return Math.max(...fallback)
  }

  if (typeof p.confidence === 'number' && Number.isFinite(p.confidence) && p.confidence >= 0 && p.confidence <= 100) {
    return p.confidence / 100
  }

  return 0
}

/**
 * Confidence level — zero means unknown when no source value exists.
 */
export function getConfidence(p: Prediction): number {
  if (typeof p.confidence === 'number' && Number.isFinite(p.confidence) && p.confidence >= 0 && p.confidence <= 100) {
    return p.confidence
  }
  return Math.round(getProba(p) * 100)
}

/**
 * Data quality level — 1 to 5.
 *
 * 5 = real Poisson data with homeLambda/awayLambda + form data
 * 4 = real Poisson data without form
 * 3 = predicted with fallback
 * 2 = partial data
 * 1 = insufficient data (probability unknown)
 */
export function getDataQuality(p: Prediction): number {
  if (p.analysis?.hasRealData && p.analysis.homeLambda && p.analysis.awayLambda && p.analysis.homeForm && p.analysis.awayForm) {
    return 5
  }
  if (p.analysis?.homeLambda && p.analysis.awayLambda) {
    return 4
  }
  if (p.proba || p.analysis?.bttsProb || p.analysis?.over25Prob) {
    return 3
  }
  if (p.confidence) {
    return 2
  }
  return 1
}

/**
 * Get tier — GOLD or STANDARD.
 *
 * GOLD: proba >= 0.75 OR (proba >= 0.70 + HIGH_BTTS league + BTTS Oui)
 */
const HIGH_BTTS_KEYWORDS = [
  'bundesliga', 'eredivisie', 'jupiler', 'swiss', 'mls', 'championship',
  'premier league', 'liga portugal', 'austrian', 'scottish',
]

export function getTier(p: Prediction): 'GOLD' | 'STANDARD' {
  if (p.tier && p.tier.toUpperCase() === 'GOLD') return 'GOLD'

  const proba = getProba(p)
  const league = (p.league || '').toLowerCase()
  const isHigh = HIGH_BTTS_KEYWORDS.some(k => league.includes(k))
  const market = (p.type || p.market || '').toLowerCase()
  const isBttsYes = market.includes('btts') && (p.prediction || '').toLowerCase() !== 'non'

  if (proba >= 0.75) return 'GOLD'
  if (proba >= 0.70 && isHigh && isBttsYes) return 'GOLD'
  return 'STANDARD'
}

/**
 * Deduplicate an array of predictions using stable keys.
 * If duplicates exist, keeps the one with the highest proba.
 *
 * @returns A new array with no duplicates.
 */
export function deduplicatePredictions(predictions: Prediction[], modelVersion = 'V3-Reliability'): Prediction[] {
  const map = new Map<string, Prediction>()

  for (const p of predictions) {
    const key = predictionKey(p, modelVersion)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, p)
    } else {
      // Keep the one with the highest proba
      const existingProba = getProba(existing)
      const newProba = getProba(p)
      if (newProba > existingProba) {
        map.set(key, p)
      }
    }
  }

  return Array.from(map.values())
}

/**
 * Validate that a prediction has the minimum required fields.
 * Used by tests and by the verification pipeline.
 */
export interface ValidationError {
  field: string
  message: string
}

export function validatePrediction(p: Prediction): ValidationError[] {
  const errors: ValidationError[] = []

  if (!p.match && !p.home) {
    errors.push({ field: 'match', message: 'Match or home team is required' })
  }
  if (!p.date) {
    errors.push({ field: 'date', message: 'Date is required' })
  }
  if (!p.type && !p.market) {
    errors.push({ field: 'market', message: 'Type or market is required' })
  }
  if (p.status === 'WON' || p.status === 'LOST' || p.isWon !== undefined) {
    // Verified prediction must have a final score
    if (!p.finalScore || p.finalScore === '-' || p.finalScore === '') {
      errors.push({ field: 'finalScore', message: 'Verified prediction must have a final score' })
    }
    // And a verifiedAt timestamp
    if (!p.verifiedAt && !p.verifiedSource) {
      errors.push({ field: 'verifiedAt', message: 'Verified prediction must have verification metadata' })
    }
  }

  return errors
}

/**
 * Filter predictions to only those within the new tracking period.
 * @param startDate ISO date string (YYYY-MM-DD)
 */
export function filterByTrackingPeriod(predictions: Prediction[], startDate: string): Prediction[] {
  const startTs = new Date(startDate + 'T00:00:00Z').getTime()
  return predictions.filter(p => {
    if (!p.date) return false
    const dateTs = new Date(p.date + 'T00:00:00Z').getTime()
    return dateTs >= startTs
  })
}

/**
 * Count predictions by status (WON, LOST, PENDING).
 * Returns a single source of truth for all UI counters.
 */
export interface PredictionCounts {
  published: number
  verified: number
  won: number
  lost: number
  pending: number
  cancelled: number
  goldVerified: number
  goldWon: number
  goldLost: number
  standardVerified: number
  bttsVerified: number
  over25Verified: number
}

export function countPredictions(predictions: Prediction[]): PredictionCounts {
  const counts: PredictionCounts = {
    published: predictions.length,
    verified: 0,
    won: 0,
    lost: 0,
    pending: 0,
    cancelled: 0,
    goldVerified: 0,
    goldWon: 0,
    goldLost: 0,
    standardVerified: 0,
    bttsVerified: 0,
    over25Verified: 0,
  }

  for (const p of predictions) {
    const status = (p.status || '').toUpperCase()
    const isWon = status === 'WON' || (!status && p.isWon === true)
    const isLost = status === 'LOST' || (!status && p.isWon === false)
    const isCancelled = p.status === 'CANCELLED' || p.status === 'POSTPONED'

    if (isWon) {
      counts.won++
      counts.verified++
      const tier = getTier(p)
      if (tier === 'GOLD') { counts.goldWon++; counts.goldVerified++ }
      else counts.standardVerified++
      const market = normalizeMarket(p.type || p.market || '')
      if (market === 'btts') counts.bttsVerified++
      else if (market === 'over25') counts.over25Verified++
    } else if (isLost) {
      counts.lost++
      counts.verified++
      const tier = getTier(p)
      if (tier === 'GOLD') { counts.goldLost++; counts.goldVerified++ }
      else counts.standardVerified++
      const market = normalizeMarket(p.type || p.market || '')
      if (market === 'btts') counts.bttsVerified++
      else if (market === 'over25') counts.over25Verified++
    } else if (isCancelled) {
      counts.cancelled++
    } else {
      counts.pending++
    }
  }

  return counts
}
