import { describe, expect, it } from 'vitest'
import { humanMethodLabel, predictionQuality, shouldPublishPrediction } from '@/lib/predictionQuality'

describe('prediction quality guard', () => {
  it('rejects a prediction with no evidence instead of inventing confidence', () => {
    const prediction = { match: 'Unknown FC', date: '2026-10-20', market: 'BTTS' }
    expect(predictionQuality(prediction)).toBe('insufficient')
    expect(shouldPublishPrediction(prediction)).toBe(false)
    expect(humanMethodLabel('insufficient')).toBe('Données insuffisantes')
  })

  it('distinguishes limited data from a fully supported signal', () => {
    expect(predictionQuality({ match: 'Limited FC', proba: 0.64 })).toBe('limited')
    expect(predictionQuality({
      match: 'Supported FC',
      proba: 0.68,
      source: 'ESPN',
      analysis: {
        homeLambda: 1.2,
        awayLambda: 1.1,
        homeForm: { scoredIn: 4 },
        awayForm: { scoredIn: 4 },
        hasRealData: true,
      },
    })).toBe('reliable')
  })
})
