import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { approvedDirectNewsSource, directNewsRegistry, isPermittedDirectNewsItem } from '../scripts/direct-news-policy.mjs'
import { directNewsPublicationDate } from '../scripts/direct-news-dates.mjs'
import { collectDirectNews, fetchDirectNewsText, parseDirectNewsHtml, parseDirectNewsRobots } from '../scripts/direct-news-collector.mjs'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const TERMS = 'Fixture permission: automated commercial reuse of headlines, publication dates and article links.'
const source = {
  id: 'fixture', status: 'approved', publisher: 'Example Club', url: 'https://club.example/news/',
  articlePathPrefix: '/news/', format: 'html', teamNames: ['Alpha FC'],
  termsUrl: 'https://club.example/terms', termsSha256: createHash('sha256').update(TERMS).digest('hex'),
  reviewedAt: '2026-10-20T10:00:00Z', reviewExpiresAt: '2026-11-01T00:00:00Z', permissionQuote: TERMS,
  permissions: { automatedCollection: true, commercialHeadlines: true, datesAndLinks: true },
  license: 'Fixture commercial permission', licenseUrl: 'https://club.example/terms',
}
const robotsText = 'User-agent: *\nAllow: /\n'
const jsonld = (rows: unknown[]) => `<html><script type="application/ld+json">${JSON.stringify({ '@graph': rows })}</script></html>`
const article = (title: string, url: string, date = '2026-10-21T10:00:00Z') => ({ '@type': 'NewsArticle', headline: title, url, datePublished: date, dateModified: '2026-10-21T11:00:00Z', articleBody: 'BODY MUST NOT LEAK', image: 'https://club.example/photo.jpg' })

const requestFixture = (html = jsonld([article('Team update', '/news/update')])) => vi.fn(async (url: string) => {
  if (url.endsWith('/robots.txt')) return robotsText
  if (url === source.termsUrl) return TERMS
  if (url === source.url) return html
  throw new Error('unexpected requested URL')
})

describe('direct commercial HTML metadata collector', () => {
  it('approves only explicitly licensed, reviewed HTML sources and an empty production registry makes no requests', async () => {
    expect(directNewsRegistry.sources).toEqual([])
    expect(approvedDirectNewsSource(source, NOW)).toBe(true)
    for (const patch of [
      { permissionQuote: '' }, { termsSha256: '' }, { status: 'excluded' },
      { reviewExpiresAt: '2026-10-20' }, { reviewedAt: '2026-10-22' },
      { permissions: { ...source.permissions, commercialHeadlines: false } },
      { format: 'rss' }, { licenseUrl: 'https://other.example/terms' },
    ]) expect(approvedDirectNewsSource({ ...source, ...patch }, NOW)).toBe(false)
    const requestText = vi.fn()
    expect(await collectDirectNews(['Alpha FC'], { sources: [], now: NOW, requestText })).toMatchObject({ newsByTeam: { 'Alpha FC': [] }, checks: [] })
    expect(requestText).not.toHaveBeenCalled()
  })

  it('extracts JSON-LD datePublished/title/link only, rejects stale/future/off-path and modified-only metadata', () => {
    const html = jsonld([
      article('Alpha FC & opponent: team news', '/news/team-news'),
      { '@type': 'NewsArticle', headline: 'Modified only', url: '/news/modified', dateModified: '2026-10-21T10:00:00Z' },
      article('Stale', '/news/stale', '2026-09-01T10:00:00Z'),
      article('Future', '/news/future', '2026-10-22T10:00:00Z'),
      article('Off path', '/newsroom/escape'),
      article('Other origin', 'https://evil.example/news/story'),
    ])
    const items = parseDirectNewsHtml(html, source, { now: NOW })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: 'Alpha FC & opponent: team news', publishedAt: '2026-10-21T10:00:00Z', sourceId: 'fixture' })
    expect(Object.keys(items[0]).sort()).toEqual(['title', 'url', 'publishedAt', 'source', 'sourceId', 'publisher', 'license', 'licenseUrl', 'teamNames', 'attributionUrl'].sort())
    expect(JSON.stringify(items)).not.toContain('BODY MUST NOT LEAK')
    expect(JSON.stringify(items)).not.toContain('photo.jpg')
    expect(isPermittedDirectNewsItem(items[0], { now: NOW, sources: [source], team: 'Alpha FC' })).toBe(true)
    expect(isPermittedDirectNewsItem(items[0], { now: NOW, sources: [source], team: 'Other FC' })).toBe(false)
  })

  it('supports only explicitly configured card title/link/time selectors and meta article publication dates', () => {
    const cardSource = { ...source, selectors: { card: '.card', title: '.title', link: 'a', time: 'time' } }
    const html = `<div class="card"><h2 class="title">Card headline</h2><a href="/news/card">link label ignored</a><time datetime="2026-10-21T09:00:00Z">visible body</time><img src="private.jpg"></div>`
    expect(parseDirectNewsHtml(html, cardSource, { now: NOW }).map(({ title, url }) => ({ title, url }))).toEqual([{ title: 'Card headline', url: 'https://club.example/news/card' }])
    const meta = '<meta property="og:title" content="Meta headline"><meta property="article:published_time" content="2026-10-21T08:00:00Z"><link rel="canonical" href="/news/meta">'
    expect(parseDirectNewsHtml(meta, source, { now: NOW })[0]).toMatchObject({ title: 'Meta headline', url: 'https://club.example/news/meta' })
    expect(parseDirectNewsHtml('<title>Must not infer</title><p>body</p>', source, { now: NOW })).toEqual([])
  })

  it('limits each source to three headlines and rejects unsafe URL origins, paths and generic titles', () => {
    const html = jsonld(Array.from({ length: 6 }, (_, index) => article(`Story ${index}`, `/news/${index}`)))
    expect(parseDirectNewsHtml(html, source, { now: NOW })).toHaveLength(3)
    for (const badUrl of ['https://club.example.evil.test/news/x', 'https://127.0.0.1/news/x', 'https://club.example:443/news/x', 'https://user@club.example/news/x']) {
      expect(parseDirectNewsHtml(jsonld([article('Bad URL', badUrl)]), source, { now: NOW })).toEqual([])
    }
    expect(parseDirectNewsHtml(jsonld([article('Official publication', '/news/x')]), source, { now: NOW })).toEqual([])
    expect(parseDirectNewsHtml(jsonld([article('<script>leak</script>', '/news/x')]), source, { now: NOW })).toEqual([])
  })

  it('uses strict dates and rejects impossible, timezone-free or out-of-window values', () => {
    for (const date of ['2026-02-31', '2026-10-21T10:00:00', '2026-10-21T24:00:00Z', '2026-10-21T12:00:00+14:30']) expect(directNewsPublicationDate(date)).toBeNull()
    expect(directNewsPublicationDate('2024-02-29')).toBe('2024-02-29')
  })

  it('fails closed on robots denial, missing/malformed robots or changed legal evidence', async () => {
    const deny = vi.fn(async (url: string) => url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /news/' : TERMS)
    const blocked = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: deny, sleepFn: async () => {} })
    expect(blocked.newsByTeam['Alpha FC']).toEqual([])
    expect(deny).toHaveBeenCalledTimes(1)
    const missingAgent = vi.fn(async (url: string) => url.endsWith('/robots.txt') ? 'User-agent: OtherBot\nAllow: /' : TERMS)
    expect((await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: missingAgent, sleepFn: async () => {} })).checks[0].status).toBe('error')
    const changed = vi.fn(async (url: string) => url.endsWith('/robots.txt') ? robotsText : url.endsWith('/terms') ? 'Changed permission terms' : '')
    expect((await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: changed, sleepFn: async () => {} })).checks[0].reason).toMatch(/evidence changed/)
    expect(parseDirectNewsRobots(robotsText, undefined, 'https://club.example/robots.txt').isAllowed('https://club.example/news/story')).toBe(true)
    expect(parseDirectNewsRobots('User-agent: *\nDisallow: /news/', undefined, 'https://club.example/robots.txt').isAllowed('https://club.example/news/story')).toBe(false)
    expect(() => parseDirectNewsRobots('<html>challenge</html>')).toThrow()
    expect(() => parseDirectNewsRobots('')).toThrow()
  })

  it('checks robots and terms before a single source-page fetch; performs no retries or redirects', async () => {
    const requestText = requestFixture()
    const result = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText, sleepFn: async () => {} })
    expect(requestText.mock.calls.map(([url]) => url)).toEqual(['https://club.example/robots.txt', source.termsUrl, source.url])
    expect(result.newsByTeam['Alpha FC']).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({ status: 'ok', count: 1, cache: 'disabled' })
    for (const response of [new Response('', { status: 302 }), new Response('x', { headers: { 'content-length': '1000001' } }), new Response('x'.repeat(1000001))]) {
      const fetchImpl = vi.fn(async () => response)
      await expect(fetchDirectNewsText('https://club.example/news/', { fetchImpl })).rejects.toThrow()
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    }
  })

  it('uses only explicitly injected cache; rechecks robots/terms, retains true checkedAt and caches empty outcomes', async () => {
    const cache = new Map<string, unknown>()
    const adapter = { read: vi.fn(async (key: string) => cache.get(key)), write: vi.fn(async (key: string, value: unknown) => { cache.set(key, value) }) }
    const firstRequest = requestFixture(jsonld([article('Cached headline', '/news/cached')]))
    const first = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: firstRequest, sleepFn: async () => {}, cache: adapter })
    expect(adapter.write).toHaveBeenCalledTimes(1)
    const originalCheckedAt = first.checks[0].checkedAt
    const secondRequest = requestFixture('')
    const second = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW + 1000, requestText: secondRequest, sleepFn: async () => {}, cache: adapter, cacheTtlMs: 60_000 })
    expect(secondRequest.mock.calls.map(([url]) => url)).toEqual(['https://club.example/robots.txt', source.termsUrl])
    expect(second.newsByTeam['Alpha FC']).toHaveLength(1)
    expect(second.checks[0]).toMatchObject({ checkedAt: originalCheckedAt, cache: 'hit' })

    const emptyCache = new Map<string, unknown>()
    const emptyAdapter = { read: async (key: string) => emptyCache.get(key), write: async (key: string, value: unknown) => { emptyCache.set(key, value) } }
    const emptyFirst = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: requestFixture('<p>no metadata</p>'), sleepFn: async () => {}, cache: emptyAdapter })
    const emptySecondRequest = requestFixture()
    const emptySecond = await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW + 1000, requestText: emptySecondRequest, sleepFn: async () => {}, cache: emptyAdapter })
    expect(emptyFirst.checks[0].count).toBe(0)
    expect(emptySecond.checks[0]).toMatchObject({ count: 0, cache: 'hit', checkedAt: emptyFirst.checks[0].checkedAt })
    expect(emptySecondRequest).toHaveBeenCalledTimes(2)
  })

  it('revalidates allowlist policy on cache use and caps configured cache TTL at six hours', async () => {
    const cache = new Map<string, unknown>()
    const adapter = { read: async (key: string) => cache.get(key), write: async (key: string, value: unknown) => { cache.set(key, value) } }
    await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW, requestText: requestFixture(), sleepFn: async () => {}, cache: adapter })
    const requests = vi.fn()
    const result = await collectDirectNews(['Alpha FC'], { sources: [{ ...source, status: 'excluded' }], now: NOW + 1000, requestText: requests, cache: adapter })
    expect(result.newsByTeam['Alpha FC']).toEqual([])
    expect(requests).not.toHaveBeenCalled()
    const changedConfig = await collectDirectNews(['Alpha FC'], { sources: [{ ...source, selectors: { card: '.item', title: '.headline', link: 'a', time: 'time' } }], now: NOW + 1000, requestText: requestFixture(), sleepFn: async () => {}, cache: adapter })
    expect(changedConfig.checks[0].cache).toBe('miss')
    expect(await collectDirectNews(['Alpha FC'], { sources: [source], now: NOW + 7 * 60 * 60 * 1000, requestText: requestFixture(), sleepFn: async () => {}, cache: adapter, cacheTtlMs: 24 * 60 * 60 * 1000 })).toMatchObject({ checks: [{ cache: 'miss' }] })
  })
})
