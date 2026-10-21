import { describe, expect, test } from 'vitest'
import { validatePredictionPayload } from '../scripts/validate-predictions.mjs'

const validPrediction = {
  id: 'team-a-vs-team-b-2026-08-12',
  match: 'Team A vs Team B',
  home: 'Team A',
  away: 'Team B',
  league: 'Test League',
  date: '2026-08-12',
  type: 'BTTS',
  prediction: 'Oui',
  proba: 0.64,
  reliabilityScore: 72,
  dataQuality: 'MEDIUM',
  dataSource: 'ESPN_TEAM_SCHEDULE',
  time: '18:00',
}

function payload(overrides = {}) {
  return {
    date: '2026-08-12',
    lastUpdated: '2026-08-12T12:00:00.000Z',
    free: [{ ...validPrediction, ...overrides }],
    vipPreview: [],
  }
}

describe('validatePredictionPayload', () => {
  test('accepte un payload valide avec timestamp et date locale', () => {
    expect(validatePredictionPayload(payload(), {
      today: '2026-08-12',
      requireTimestamp: true,
    })).toEqual([])
  })

  test('refuse un payload dont la date métier est obsolète', () => {
    const errors = validatePredictionPayload(payload(), {
      today: '2026-08-13',
      requireTimestamp: true,
    })
    expect(errors).toContain('top-level date is not Africa/Dakar today')
  })

  test('refuse un match antérieur à la date Africa/Dakar', () => {
    const errors = validatePredictionPayload(payload({ date: '2026-08-11' }), {
      today: '2026-08-12',
      requireTimestamp: true,
    })
    expect(errors).toContain('prediction[0].date is older than Africa/Dakar today')
  })

  test('refuse un coup d’envoi déjà passé le même jour', () => {
    const errors = validatePredictionPayload(payload({ time: '09:00' }), {
      today: '2026-08-12',
      requireTimestamp: true,
      checkKickoff: true,
      now: new Date('2026-08-12T10:00:00.000Z'),
    })
    expect(errors).toContain('prediction[0].time is already started in Africa/Dakar')
  })

  test('refuse un timestamp manquant et une probabilité hors limites', () => {
    const invalid = payload({ proba: 1.2 }) as Omit<ReturnType<typeof payload>, 'lastUpdated'> & {
      lastUpdated?: string
    }
    delete invalid.lastUpdated
    const errors = validatePredictionPayload(invalid, {
      today: '2026-08-12',
      requireTimestamp: true,
    })
    expect(errors).toContain('lastUpdated must be an ISO UTC timestamp')
    expect(errors).toContain('prediction[0].proba must be between 0 and 1')
  })

  test('accepte un payload vide lorsque le moteur s’abstient faute de données suffisantes', () => {
    expect(validatePredictionPayload({
      date: '2026-08-12',
      lastUpdated: '2026-08-12T12:00:00.000Z',
      free: [],
      vipPreview: [],
    }, { today: '2026-08-12', requireTimestamp: true })).toEqual([])
  })
})
