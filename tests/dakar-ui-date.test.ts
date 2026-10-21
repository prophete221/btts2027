import { describe, expect, test } from 'vitest'
import { getDakarDayDiff, hasDakarKickoffPassed } from '@/lib/dakar-date'

describe('dates des interfaces selon le calendrier Dakar', () => {
  test('calcule le jour métier autour de minuit Dakar sans dépendre du fuseau local', () => {
    const previousTimezone = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      const now = new Date('2026-08-12T23:30:00.000Z')
      expect(getDakarDayDiff('2026-08-12', now)).toBe(0)
      expect(getDakarDayDiff('2026-08-13', now)).toBe(1)
      expect(getDakarDayDiff('2026-08-11', now)).toBe(-1)
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ
      else process.env.TZ = previousTimezone
    }
  })

  test('exclut un coup d’envoi déjà passé sans prétendre connaître le résultat', () => {
    const now = new Date('2026-08-12T18:00:00.000Z')
    expect(hasDakarKickoffPassed('2026-08-12', '17:59', now)).toBe(true)
    expect(hasDakarKickoffPassed('2026-08-12', '18:01', now)).toBe(false)
    expect(hasDakarKickoffPassed('2026-08-13', '00:01', now)).toBe(false)
    expect(hasDakarKickoffPassed('2026-08-12', '--:--', now)).toBe(false)
  })
})
