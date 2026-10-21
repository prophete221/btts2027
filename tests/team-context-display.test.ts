import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { displayDate } from '../src/components/bttsbet/TeamContext'
import { normalizeTeamContext } from '../src/lib/team-context'

const NOW = Date.parse('2026-10-21T13:00:00Z')

describe('permission-gated headlines and honest image dates', () => {
  it('rejects legacy official links with no commercial permission, even on an official host', () => {
    const news = [{
      title: 'Official publication', source: 'Official',
      url: 'https://www.fccincinnati.com/news/old-link', attributionUrl: 'https://www.fccincinnati.com/news/old-link',
      publisher: 'fccincinnati.com', teamNames: ['FC Cincinnati'], publishedAt: '2026-10-20T15:00:09.771Z',
    }]
    const root = { teams: { 'FC Cincinnati': { name: 'FC Cincinnati', checkedAt: new Date(NOW).toISOString(), news, newsStatus: 'ok' } } }
    expect(normalizeTeamContext(root, NOW).teams['FC Cincinnati'].news).toEqual([])
  })
  it('does not present unlicensed GDELT links as recent headlines', () => {
    const root = { teams: { Alpha: { name: 'Alpha', checkedAt: new Date(NOW).toISOString(), news: [{
      source: 'GDELT', title: 'External article', url: 'https://publisher.example/article',
      seenAt: '2026-10-21T12:00:00Z', publisher: 'publisher.example', license: 'GDELT attribution', licenseUrl: 'https://www.gdeltproject.org/',
    }] } } }
    expect(normalizeTeamContext(root, NOW).teams.Alpha.news).toEqual([])
  })
  it('renders actual validated item titles rather than generic publication labels', () => {
    const code = readFileSync('src/components/bttsbet/TeamContext.tsx', 'utf8')
    expect(code).toContain('{item.title}</a>')
    expect(code).not.toMatch(/officialPublication|externalArticle|Official publication/)
    expect(code).toContain('Aucune actualité récente admissible')
    expect(code).toContain('href={team.officialUrl}')
    const pipeline = readFileSync('scripts/update-team-context.mjs', 'utf8')
    expect(pipeline).toContain('collectOfficialNews(currentNames)')
    expect(pipeline).not.toMatch(/findRecentGdelt|findCuratedOfficialNews/)
  })
  it('does not turn a month-only or year-only photo date into an invented day', () => {
    expect(displayDate('2018-08', 'fr')).toBe('août 2018')
    expect(displayDate('2018-08', 'en')).toBe('August 2018')
    expect(displayDate('2018', 'fr')).toBe('2018')
    expect(displayDate('2026-10-16', 'fr')).toContain('16')
  })
})
