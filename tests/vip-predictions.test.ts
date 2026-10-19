import { describe, expect, it } from 'vitest'
import { onlyVipPredictions } from '@/lib/vipPredictions'

describe('VIP prediction separation', () => {
  it('keeps only explicitly VIP-marked data', () => {
    const rows = [
      { home: 'VIP FC', date: '2026-10-20', market: 'BTTS', vip: true },
      { home: 'Free FC', date: '2026-10-20', market: 'BTTS', tier: 'GOLD' },
      { home: 'Another Free FC', date: '2026-10-20', market: 'Over 2.5' },
    ]

    expect(onlyVipPredictions(rows).map((row) => row.home)).toEqual(['VIP FC'])
  })
})
