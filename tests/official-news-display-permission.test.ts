import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../scripts/official-news-sources.json', () => ({ default: {
  sources: [{
    id: 'display-fixture', status: 'approved', publisher: 'club.example', url: 'https://club.example/news/feed',
    articlePathPrefix: '/news/', format: 'rss', teamNames: ['Alpha FC'],
    reviewedAt: '2026-10-21T10:00:00Z', reviewExpiresAt: '2026-11-01T00:00:00Z',
    termsUrl: 'https://club.example/terms', termsSha256: 'a'.repeat(64), permissionQuote: 'Fictional test permission',
    permissions: { automatedCollection: true, commercialHeadlines: true, datesAndLinks: true },
    license: 'Fixture permission', licenseUrl: 'https://club.example/terms',
  }], audit: [],
} }))

import * as context from '../src/lib/team-context'
import TeamContext from '../src/components/bttsbet/TeamContext'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const item = {
  title: 'Alpha FC prepares for Saturday', url: 'https://club.example/news/saturday',
  attributionUrl: 'https://club.example/news/saturday', publishedAt: '2026-10-20T08:00:00Z',
  source: 'Official', sourceId: 'display-fixture', publisher: 'club.example', teamNames: ['Alpha FC'],
  license: 'Fixture permission', licenseUrl: 'https://club.example/terms',
}
const document = { teams: {
  'Alpha FC': { name: 'Alpha FC', checkedAt: '2026-10-21T11:00:00Z', newsStatus: 'ok', news: [item], officialUrl: 'https://club.example/' },
  'Other FC': { name: 'Other FC', checkedAt: '2026-10-21T11:00:00Z', newsStatus: 'ok', news: [item] },
} }

describe('actual official headline rendering under an explicit permission fixture', () => {
  it('retains the original title/date/link only for the approved club and source', () => {
    const normalized = context.normalizeTeamContext(document, NOW)
    expect(normalized.teams['Alpha FC'].news[0]).toMatchObject(item)
    expect(normalized.teams['Other FC'].news).toEqual([])
    const forged = structuredClone(document)
    forged.teams['Alpha FC'].news[0].sourceId = 'unreviewed'
    expect(context.normalizeTeamContext(forged, NOW).teams['Alpha FC'].news).toEqual([])
    expect(context.normalizeTeamContext(document, Date.parse('2026-11-02')).teams['Alpha FC'].news).toEqual([])
  })
  it('renders the real headline and date in every locale, not a generic publication label', () => {
    const mock = vi.spyOn(context, 'loadTeamContext').mockReturnValue(context.normalizeTeamContext(document, NOW))
    try {
      for (const locale of ['fr', 'en', 'ar']) {
        const html = renderToStaticMarkup(React.createElement(TeamContext, { home: 'Alpha FC', away: 'Other FC', locale }))
        expect(html).toContain('Alpha FC prepares for Saturday')
        expect(html).toContain('href="https://club.example/news/saturday"')
        expect(html).toContain('href="https://club.example/"')
        expect(html).not.toContain('Official publication')
        expect(html).not.toContain('Publication officielle de')
      }
    } finally { mock.mockRestore() }
  })
})
