import type { Prediction } from './predictions'

/**
 * VIP content must be explicitly marked by the data source.
 * Never promote free content because of a high probability, GOLD tier,
 * or because it is displayed on the VIP route.
 */
export function isExplicitVipPrediction(prediction: Prediction & Record<string, unknown>): boolean {
  return prediction.vip === true || prediction.isVip === true || prediction.tier?.toString().toUpperCase() === 'VIP'
}

export function onlyVipPredictions<T extends Prediction & Record<string, unknown>>(predictions: T[]): T[] {
  return predictions.filter(isExplicitVipPrediction)
}

export type VipFixture = {
  id?: string
  home?: string
  away?: string
  league?: string
  date?: string
  time?: string
  kickoff?: string
  vip?: boolean
  isVip?: boolean
  tier?: string
}

/**
 * Selects only explicitly VIP-marked fixtures from a payload.
 * `free`, `predictions`, and unmarked rows are intentionally ignored.
 *
 * Containers accepted, in order: `vip` → `vipPredictions` → `vipPreview`.
 * `vipPreview` is only honoured for rows individually flagged by the data
 * pipeline (`vip: true` / `isVip: true` / tier `VIP`) — a GOLD tier, a high
 * probability, or mere membership of any array is never sufficient.
 */
export function onlyVipFixtures(payload: Record<string, unknown> | null | undefined): VipFixture[] {
  if (!payload) return []
  const rows = Array.isArray(payload.vip)
    ? payload.vip
    : Array.isArray(payload.vipPredictions)
      ? payload.vipPredictions
      : Array.isArray(payload.vipPreview)
        ? payload.vipPreview
        : []
  return rows.filter((row): row is VipFixture => Boolean(row && typeof row === 'object' && isExplicitVipPrediction(row as Prediction & Record<string, unknown>)))
}
