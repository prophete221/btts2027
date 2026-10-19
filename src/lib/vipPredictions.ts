import type { Prediction } from './predictions'

/**
 * VIP content must be explicitly marked by the data source.
 * Never promote a free prediction to VIP because it has a high probability,
 * a GOLD tier, or happens to be displayed on the VIP page.
 */
export function isExplicitVipPrediction(prediction: Prediction & Record<string, unknown>): boolean {
  return prediction.vip === true || prediction.isVip === true || prediction.tier?.toString().toUpperCase() === 'VIP'
}

export function onlyVipPredictions<T extends Prediction & Record<string, unknown>>(predictions: T[]): T[] {
  return predictions.filter(isExplicitVipPrediction)
}
