import { describe, expect, it } from 'vitest'
import { displayDate } from '../src/components/bttsbet/TeamContext'
import { normalizeTeamContext } from '../src/lib/team-context'
import { findCuratedOfficialNews } from '../scripts/team-context-sources.mjs'

const NOW = Date.parse('2026-10-21T13:00:00Z')

describe('verified official links and honest image dates', () => {
  it('preserves a verified publication timestamp rather than substituting the match date', () => {
    const news = findCuratedOfficialNews('FC Cincinnati', { now: NOW })
    expect(news).toHaveLength(1)
    expect(news[0]).toMatchObject({
      title: 'Official publication', source: 'Official',
      publishedAt: '2026-10-20T15:00:09.771Z', publisher: 'fccincinnati.com',
    })
    expect(news[0].url).toContain('2026-10-21')
    expect(news[0]).not.toHaveProperty('image')
    expect(news[0]).not.toHaveProperty('summary')
    expect(findCuratedOfficialNews('FC Cincinnati', { now: Date.parse('2026-12-01') })).toEqual([])
    expect(findCuratedOfficialNews('Unrelated club', { now: NOW })).toEqual([])
  })
  it('shows official publisher links only for the explicitly verified club', () => {
    const news = findCuratedOfficialNews('Austria Vienna', { now: NOW })
    const root = { teams: {
      'Austria Vienna': { name: 'Austria Vienna', checkedAt: new Date(NOW).toISOString(), news, newsStatus: 'ok' },
      'Other club': { name: 'Other club', checkedAt: new Date(NOW).toISOString(), news, newsStatus: 'ok' },
    } }
    const normalized = normalizeTeamContext(root, NOW)
    expect(normalized.teams['Austria Vienna'].news).toHaveLength(1)
    expect(normalized.teams['Austria Vienna'].news[0].publishedAt).toBe('2026-10-16')
    expect(normalized.teams['Other club'].news).toHaveLength(0)
  })
  it('does not turn a month-only or year-only photo date into an invented day', () => {
    expect(displayDate('2018-08', 'fr')).toBe('août 2018')
    expect(displayDate('2018-08', 'en')).toBe('August 2018')
    expect(displayDate('2018', 'fr')).toBe('2018')
    expect(displayDate('2026-10-16', 'fr')).toContain('16')
  })
})
