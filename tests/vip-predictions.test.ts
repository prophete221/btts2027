import { describe, expect, it } from 'vitest'
import { onlyVipFixtures, onlyVipPredictions } from '@/lib/vipPredictions'

describe('VIP prediction separation', () => {
  it('keeps only explicitly VIP-marked data', () => {
    const rows = [
      { home: 'VIP FC', date: '2026-10-20', market: 'BTTS', vip: true },
      { home: 'Free FC', date: '2026-10-20', market: 'BTTS', tier: 'GOLD' },
      { home: 'Another Free FC', date: '2026-10-20', market: 'Over 2.5' },
    ]

    expect(onlyVipPredictions(rows).map((row) => row.home)).toEqual(['VIP FC'])
  })

  it('ignores free and generic prediction arrays', () => {
    const payload = {
      vip: [{ home: 'VIP FC', away: 'VIP United', vip: true }],
      free: [{ home: 'Free FC', away: 'Free United' }],
      predictions: [{ home: 'Generic FC', away: 'Generic United', tier: 'GOLD' }],
    }

    expect(onlyVipFixtures(payload).map((row) => row.home)).toEqual(['VIP FC'])
    expect(onlyVipFixtures({ free: payload.free, predictions: payload.predictions })).toEqual([])
  })
})
