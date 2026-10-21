import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { approvedSource, isPermittedOfficialNews, officialNewsRegistry } from '../scripts/official-news-policy.mjs'
import { strictPublicationDate } from '../scripts/official-news-dates.mjs'
import { collectOfficialNews, fetchOfficialText, parseOfficialNews } from '../scripts/official-news-collector.mjs'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const TERMS = 'Fixture permission: automated collection and commercial headline/date/link reuse permitted.'
// Deliberately fictional test source: never part of the production allowlist.
const source = {
  id: 'fixture', status: 'approved', publisher: 'club.example', url: 'https://club.example/news/feed',
  articlePathPrefix: '/news/', format: 'rss', teamNames: ['Alpha FC'],
  termsUrl: 'https://club.example/terms', termsSha256: createHash('sha256').update(TERMS).digest('hex'),
  reviewedAt: '2026-10-21T10:00:00Z', reviewExpiresAt: '2026-11-01T00:00:00Z', permissionQuote: TERMS,
  permissions: { automatedCollection: true, commercialHeadlines: true, datesAndLinks: true },
  license: 'Fixture permission', licenseUrl: 'https://club.example/terms',
}
const rss = `<rss version="2.0"><channel>
<item><title><![CDATA[Alpha FC &amp; opponent: team news]]></title><link>https://club.example/news/team-news</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description>Do not copy article body</description><enclosure url="https://club.example/image.jpg" /></item>
<item><title>Stale</title><link>https://club.example/news/stale</link><pubDate>Sun, 01 Feb 2026 10:00:00 GMT</pubDate></item>
<item><title>Future</title><link>https://club.example/news/future</link><pubDate>Thu, 22 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Off-site</title><link>https://other.example/news/story</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`

describe('permission-gated official news collection', () => {
  it('production approves only explicitly evidenced, unexpired permissions', () => {
    for (const entry of officialNewsRegistry.sources) {
      if (entry.status === 'approved') expect(approvedSource(entry, NOW)).toBe(true)
    }
    expect(approvedSource(source, NOW)).toBe(true)
    for (const patch of [
      { status: 'excluded' }, { permissionQuote: '' }, { termsSha256: '' },
      { reviewExpiresAt: '2026-10-20' }, { reviewedAt: '2026-10-22' },
      { permissions: { ...source.permissions, commercialHeadlines: false } },
    ]) expect(approvedSource({ ...source, ...patch }, NOW)).toBe(false)
  })
  it('returns actual headlines, source dates and links only, with no body or image', () => {
    const items = parseOfficialNews(rss, source, { now: NOW })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: 'Alpha FC & opponent: team news', publishedAt: '2026-10-21T10:00:00.000Z', sourceId: 'fixture' })
    expect(Object.keys(items[0]).sort()).toEqual(['title', 'url', 'publishedAt', 'source', 'sourceId', 'publisher', 'license', 'licenseUrl', 'teamNames', 'attributionUrl'].sort())
    expect(isPermittedOfficialNews(items[0], { now: NOW, sources: [source], team: 'Alpha FC' })).toBe(true)
    expect(isPermittedOfficialNews(items[0], { now: NOW, sources: [source], team: 'Other FC' })).toBe(false)
    expect(isPermittedOfficialNews({ ...items[0], title: 'Official publication' }, { now: NOW, sources: [source] })).toBe(false)
    expect(parseOfficialNews(rss, { ...source, status: 'excluded' }, { now: NOW })).toEqual([])
  })
  it('supports Atom published dates but never substitutes updated dates', () => {
    const atom = `<feed><entry><title>Alpha FC prepares</title><link href="https://club.example/news/atom"/><published>2026-10-21T08:00:00Z</published></entry><entry><title>No publication date</title><link href="https://club.example/news/missing"/><updated>2026-10-21T09:00:00Z</updated></entry></feed>`
    expect(parseOfficialNews(atom, { ...source, format: 'atom' }, { now: NOW })).toHaveLength(1)
  })
  it('extracts HTML structured metadata without fetching linked articles', () => {
    const html = `<html><script type="application/ld+json">${JSON.stringify({ '@graph': [
      { '@type': 'NewsArticle', headline: 'Actual official title', datePublished: '2026-10-21', url: '/news/jsonld', image: 'forbidden.jpg', articleBody: 'Not copied' },
      { '@type': 'NewsArticle', headline: 'Missing publication date', dateModified: '2026-10-21', url: '/news/modified' },
    ] })}</script></html>`
    const items = parseOfficialNews(html, { ...source, format: 'jsonld' }, { now: NOW })
    expect(items).toHaveLength(1)
    expect(items[0].publishedAt).toBe('2026-10-21')
    expect(JSON.stringify(items)).not.toContain('Not copied')
    expect(JSON.stringify(items)).not.toContain('forbidden.jpg')
  })
  it('rejects malformed XML, DTD/entity declarations, unsafe hosts and generic titles', () => {
    expect(() => parseOfficialNews('<rss><item></rss>', source, { now: NOW })).toThrow()
    expect(() => parseOfficialNews('<!DOCTYPE rss><rss/>', source, { now: NOW })).toThrow()
    expect(parseOfficialNews(rss.replaceAll('club.example/news/team-news', 'club.example.evil.test/news/team-news'), source, { now: NOW })).toEqual([])
    expect(parseOfficialNews(rss.replace('Alpha FC &amp; opponent: team news', 'Official publication'), source, { now: NOW })).toEqual([])
  })
  it('rejects impossible calendars and timestamps without a source timezone', () => {
    for (const value of ['2026-02-31', '2026-10-21T10:00:00', '2026-10-21T24:00:00Z', '2026-10-21T12:00:00+14:30']) expect(strictPublicationDate(value)).toBeNull()
    expect(strictPublicationDate('31 Feb 2026 12:00:00 GMT', 'rss')).toBeNull()
    expect(strictPublicationDate('21 Oct 2026 12:00:00', 'rss')).toBeNull()
    expect(strictPublicationDate('2024-02-29')).toBe('2024-02-29')
    expect(strictPublicationDate('21 Oct 2026 12:00:00 +0200', 'rss')).toBe('2026-10-21T10:00:00.000Z')
  })
  it('enforces path-segment boundaries and refuses local/private IP origins', () => {
    expect(parseOfficialNews(rss.replace('/news/team-news', '/newsroom/story'), { ...source, articlePathPrefix: '/news' }, { now: NOW })).toEqual([])
    for (const host of ['127.0.0.1', '192.168.1.1', 'localhost', 'club.local', 'club.internal']) {
      expect(approvedSource({ ...source, url: `https://${host}/news/feed` }, NOW)).toBe(false)
    }
  })
  it('performs no requests for excluded, expired, unverified or unrelated sources', async () => {
    const requestText = vi.fn()
    for (const entry of [{ ...source, status: 'excluded' }, { ...source, reviewExpiresAt: '2026-10-20' }, { ...source, teamNames: ['Other FC'] }]) {
      const result = await collectOfficialNews(['Alpha FC'], { sources: [entry], now: NOW, requestText })
      expect(result.newsByTeam['Alpha FC']).toEqual([])
    }
    expect(requestText).not.toHaveBeenCalled()
  })
  it('checks robots then unchanged reviewed terms before a single source request', async () => {
    const requestText = vi.fn(async (url: string) => url.endsWith('/robots.txt') ? 'User-agent: *\nAllow: /\n' : url.endsWith('/terms') ? TERMS : rss)
    const sleepFn = vi.fn(async () => {})
    const result = await collectOfficialNews(['Alpha FC'], { sources: [source], now: NOW, requestText, sleepFn })
    expect(requestText.mock.calls.map(([url]) => url)).toEqual(['https://club.example/robots.txt', source.termsUrl, source.url])
    expect(result.newsByTeam['Alpha FC']).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({ status: 'ok', count: 1 })
    expect(sleepFn).toHaveBeenCalledWith(1000)
  })
  it('fails closed on robots denial, missing robots, changed terms and publisher errors', async () => {
    for (const mode of ['deny', 'missing', 'html', 'changed', '429']) {
      const requestText = vi.fn(async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          if (mode === 'missing') throw new Error('HTTP 404')
          return mode === 'deny' ? 'User-agent: *\nDisallow: /news/' : mode === 'html' ? '<html>Challenge</html>' : 'User-agent: *\nAllow: /'
        }
        if (url.endsWith('/terms')) return mode === 'changed' ? 'Changed legal terms' : TERMS
        throw new Error('HTTP 429')
      })
      const result = await collectOfficialNews(['Alpha FC'], { sources: [source], now: NOW, requestText, sleepFn: async () => {} })
      expect(result.newsByTeam['Alpha FC']).toEqual([])
      expect(result.checks[0].status).toBe('error')
      expect(requestText.mock.calls.length).toBeLessThanOrEqual(3)
      if (['deny', 'missing', 'html'].includes(mode)) expect(requestText).toHaveBeenCalledTimes(1)
      if (mode === 'changed') expect(requestText).toHaveBeenCalledTimes(2)
    }
  })
  it('rejects redirect and oversize HTTP responses without retrying', async () => {
    for (const response of [new Response('', { status: 302 }), new Response('x', { headers: { 'content-length': '2000001' } }), new Response('x'.repeat(2000001))]) {
      const fetchImpl = vi.fn(async () => response)
      await expect(fetchOfficialText('https://club.example/news/feed', { fetchImpl })).rejects.toThrow()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(fetchImpl.mock.calls[0]).toHaveLength(2)
    }
  })
})
