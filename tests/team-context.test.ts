import { describe, expect, it } from 'vitest'
import { normalizeTeamContext } from '../src/lib/team-context'

const NOW = Date.parse('2026-10-21T12:00:00.000Z')
const fixture = {
  updatedAt: '2026-10-21T10:00:00.000Z',
  teams: {
    'Alpha FC': {
      name: 'Alpha FC',
      checkedAt: '2026-10-21T10:00:00.000Z',
      newsStatus: 'ok',
      news: [
        {
          title: 'A recent English report',
          url: 'https://en.wikinews.org/wiki/Recent_report',
          publishedAt: '2026-10-01T08:00:00.000Z',
          source: 'Wikinews',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        },
      ],
      image: {
        url: '/team-media/alpha.webp',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alpha.jpg',
        author: 'Contributor A',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        caption: 'Club grounds',
        kind: 'stadium',
        date: '2026-09-01',
      },
      officialUrl: undefined as string | undefined,
      entityUrl: undefined as string | undefined,
    },
  },
}

describe('normalizeTeamContext', () => {
  it('keeps current Wikinews content and correctly licensed Commons metadata', () => {
    const result = normalizeTeamContext(fixture, NOW)
    expect(result.teams['Alpha FC'].news).toHaveLength(1)
    expect(result.teams['Alpha FC'].image).toMatchObject({
      url: '/team-media/alpha.webp',
      kind: 'stadium',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alpha.jpg',
    })
  })

  it('accepts canonical CC0 and public-domain-mark license URLs', () => {
    const cc0 = structuredClone(fixture)
    cc0.teams['Alpha FC'].image.license = 'CC0 1.0'
    cc0.teams['Alpha FC'].image.licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/'
    expect(normalizeTeamContext(cc0, NOW).teams['Alpha FC'].image?.licenseUrl).toContain('/publicdomain/zero/1.0/')

    const pdMark = structuredClone(fixture)
    pdMark.teams['Alpha FC'].image.license = 'Public Domain Mark 1.0'
    pdMark.teams['Alpha FC'].image.licenseUrl = 'https://creativecommons.org/publicdomain/mark/1.0/'
    expect(normalizeTeamContext(pdMark, NOW).teams['Alpha FC'].image?.licenseUrl).toContain('/publicdomain/mark/1.0/')
  })

  it('keeps safe official-site and Wikidata links and rejects unsafe variants', () => {
    const data = structuredClone(fixture)
    data.teams['Alpha FC'].officialUrl = 'https://alphafc.example/'
    data.teams['Alpha FC'].entityUrl = 'https://www.wikidata.org/wiki/Q12345'
    let team = normalizeTeamContext(data, NOW).teams['Alpha FC']
    expect(team.officialUrl).toBe('https://alphafc.example/')
    expect(team.entityUrl).toBe('https://www.wikidata.org/wiki/Q12345')

    data.teams['Alpha FC'].officialUrl = 'https://user:pass@alphafc.example:8443/'
    data.teams['Alpha FC'].entityUrl = 'https://example.org/wiki/Q12345'
    team = normalizeTeamContext(data, NOW).teams['Alpha FC']
    expect(team.officialUrl).toBeUndefined()
    expect(team.entityUrl).toBeUndefined()
  })

  it('removes articles older than 30 days and dates in the future using the supplied now', () => {
    const data = structuredClone(fixture)
    data.teams['Alpha FC'].news.push(
      { ...data.teams['Alpha FC'].news[0], title: 'Too old', publishedAt: '2026-09-20T11:59:59.999Z' },
      { ...data.teams['Alpha FC'].news[0], title: 'Future article', publishedAt: '2026-10-21T12:00:00.001Z' },
    )
    expect(normalizeTeamContext(data, NOW).teams['Alpha FC'].news.map((item) => item.title)).toEqual(['A recent English report'])
  })

  it('rejects non-Wikinews URLs, non-HTTPS URLs, and non-approved licenses', () => {
    const data = structuredClone(fixture)
    data.teams['Alpha FC'].news = [
      { ...data.teams['Alpha FC'].news[0], url: 'https://example.com/news' },
      { ...data.teams['Alpha FC'].news[0], url: 'http://en.wikinews.org/wiki/Report' },
      { ...data.teams['Alpha FC'].news[0], license: 'CC BY-NC', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/' },
      { ...data.teams['Alpha FC'].news[0], license: 'CC BY-NC 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
    ]
    data.teams['Alpha FC'].image = {
      ...data.teams['Alpha FC'].image,
      license: 'CC BY-ND',
      licenseUrl: 'https://creativecommons.org/licenses/by-nd/4.0/',
    }
    const team = normalizeTeamContext(data, NOW).teams['Alpha FC']
    expect(team.news).toEqual([])
    expect(team.image).toBeNull()
  })

  it('strips markup from visible metadata and rejects remote/non-local image files', () => {
    const data = structuredClone(fixture)
    data.teams['Alpha FC'].name = '<script>alert(1)</script> Alpha FC'
    data.teams['Alpha FC'].image.url = 'https://commons.wikimedia.org/image.jpg'
    const team = normalizeTeamContext(data, NOW).teams['Alpha FC']
    expect(team.name).toBe('alert(1) Alpha FC')
    expect(team.image).toBeNull()
  })

  it('returns an empty safe document for malformed input', () => {
    expect(normalizeTeamContext(null, NOW)).toEqual({ updatedAt: '', teams: {} })
  })
})
