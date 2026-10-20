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

  it('accepts vipPreview rows only when each row is explicitly flagged VIP', () => {
    const payload = {
      vipPreview: [
        { home: 'Heidenheim', away: 'Cottbus', tier: 'GOLD', vip: true },
        { home: 'Real Madrid', away: 'Barcelona', tier: 'GOLD', vip: true },
      ],
      free: [{ home: 'Free FC', away: 'Free United', tier: 'GOLD' }],
      predictions: [{ home: 'High Proba FC', away: 'Someone', proba: 0.98 }],
    }

    expect(onlyVipFixtures(payload).map((row) => row.home)).toEqual(['Heidenheim', 'Real Madrid'])
  })

  it('rejects GOLD-tier vipPreview rows without an explicit VIP flag', () => {
    const payload = {
      vipPreview: [
        { home: 'Gold FC', away: 'Gold United', tier: 'GOLD', proba: 0.87 },
        { home: 'Flagged FC', away: 'Flagged United', tier: 'GOLD', vip: true },
      ],
    }

    expect(onlyVipFixtures(payload).map((row) => row.home)).toEqual(['Flagged FC'])
  })

  it('never leaks free mirror rows (vipMirror) into the VIP feed', () => {
    const payload = {
      vipPreview: [
        { home: 'Mirror FC', away: 'Mirror United', tier: 'GOLD', vipMirror: true, vip: false },
        { home: 'True VIP', away: 'True VIP United', tier: 'GOLD', vip: true },
      ],
    }

    expect(onlyVipFixtures(payload).map((row) => row.home)).toEqual(['True VIP'])
  })

  it('returns an empty list (→ « Aucune sélection VIP disponible aujourd’hui ») when vipPreview is unflagged', () => {
    const payload = {
      vipPreview: [
        { home: 'Unflagged FC', away: 'Unflagged United', tier: 'GOLD', proba: 0.92 },
      ],
    }

    expect(onlyVipFixtures(payload)).toEqual([])
    expect(onlyVipFixtures(null)).toEqual([])
    expect(onlyVipFixtures({})).toEqual([])
  })

  it('prefers vip / vipPredictions over vipPreview when present', () => {
    expect(
      onlyVipFixtures({
        vip: [{ home: 'From Vip', vip: true }],
        vipPreview: [{ home: 'From Preview', vip: true }],
      }).map((row) => row.home),
    ).toEqual(['From Vip'])
    expect(
      onlyVipFixtures({
        vipPredictions: [{ home: 'From VipPredictions', vip: true }],
        vipPreview: [{ home: 'From Preview', vip: true }],
      }).map((row) => row.home),
    ).toEqual(['From VipPredictions'])
  })
})
