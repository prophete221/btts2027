import { describe, expect, it } from 'vitest'
import { humanMethodLabel, predictionQuality, shouldPublishPrediction } from '@/lib/predictionQuality'

describe('prediction quality guard', () => {
  it('rejects a prediction with no evidence instead of inventing confidence', () => {
    const prediction = { match: 'Unknown FC', date: '2026-10-20', market: 'BTTS' }
    expect(predictionQuality(prediction)).toBe('insufficient')
    expect(shouldPublishPrediction(prediction)).toBe(false)
    expect(humanMethodLabel('insufficient')).toBe('Données insuffisantes')
  })

  it('recognizes the real nested ESPN payload used by predictions.json', () => {
    expect(predictionQuality({
      match: 'Real FC', proba: 0.68, source: 'poisson-v92-real-data', dataSource: 'ESPN_TEAM_SCHEDULE',
      dataQuality: 'HIGH', matchCountHome: 8, matchCountAway: 8,
      xgHome: 1.8, xgAway: 1.4,
      analysisData: { homeLambda: 1.8, awayLambda: 1.4 },
    })).toBe('reliable')
  })

  it('distinguishes limited data from a fully supported signal', () => {
    expect(predictionQuality({ match: 'Limited FC', proba: 0.64 })).toBe('limited')
    expect(predictionQuality({
      match: 'Supported FC', proba: 0.68, source: 'ESPN',
      analysis: { homeLambda: 1.2, awayLambda: 1.1, homeForm: { scoredIn: 4 }, awayForm: { scoredIn: 4 }, hasRealData: true },
    })).toBe('reliable')
  })
})
