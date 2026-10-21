import { describe, expect, it } from 'vitest';
import { allowedCreativeCommons, NEWS_SOURCE_VERSION, findRecentWikinews, findTeamLinks, findRecentGdelt, imageCacheFresh, matchesTeamNames, newsCacheFresh, isPermittedNewsItem } from '../scripts/team-context-sources.mjs';

describe('team-context Wikimedia sources', () => {
  it('accepts only known reusable licenses and preserves license provenance', () => {
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } }))
      .toEqual({ license: 'CC BY', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } }))
      .toEqual({ license: 'CC BY-SA', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC0 1.0' }, LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' } })).not.toBeNull();
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC0 1.0' }, LicenseUrl: { value: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' } })).toEqual({ license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' });
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY-NC 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-nc/4.0/' } })).toBeNull();
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY-ND 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-nd/4.0/' } })).toBeNull();
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'GFDL' }, LicenseUrl: { value: 'https://www.gnu.org/copyleft/fdl.html' } })).toBeNull();
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://example.org/license' } })).toBeNull();
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'Public domain' } })).toBeNull();
  });

  it('returns only recently created articles explicitly in Published, not drafts or revised old articles', async () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    const apiCalls: URL[] = [];
    const fakeRequest = async (raw: string) => {
      const url = new URL(raw);
      apiCalls.push(url);
      if (url.searchParams.get('list') === 'search') return { query: { search: [
        { pageid: 1, title: 'Football report on Exact Team' },
        { pageid: 2, title: 'Old report about Exact Team' },
        { pageid: 3, title: 'Draft about Exact Team' },
      ] } };
      if (url.searchParams.get('prop') === 'categories') return { query: { pages: {
        1: { categories: [{ title: 'Category:Published' }] },
        2: { categories: [{ title: 'Category:Published' }] },
        3: { categories: [{ title: 'Category:Draft' }] },
      } } };
      const pageid = url.searchParams.get('pageids');
      return { query: { pages: { [pageid!]: { revisions: [{ timestamp: pageid === '1' ? '2026-10-01T09:00:00Z' : '2026-09-01T09:00:00Z' }] } } } };
    };
    const news = await findRecentWikinews('Exact Team', { now, requestFn: fakeRequest as never });
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ title: 'Football report on Exact Team', publishedAt: '2026-10-01T09:00:00Z', source: 'Wikinews', license: 'CC BY 4.0' });
    expect(news[0].url).toContain('en.wikinews.org/wiki/');
    expect(apiCalls).toHaveLength(4);
  });

  it('enforces cache windows and only trusts successful news cache states', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(newsCacheFresh({ checkedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), newsStatus: 'empty', news: [], sourceVersion: NEWS_SOURCE_VERSION }, now)).toBe(true);
    expect(newsCacheFresh({ checkedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(), newsStatus: 'ok', news: [], sourceVersion: NEWS_SOURCE_VERSION }, now)).toBe(false);
    expect(newsCacheFresh({ checkedAt: new Date(now).toISOString(), newsStatus: 'error', news: [], sourceVersion: NEWS_SOURCE_VERSION }, now)).toBe(false);
    expect(imageCacheFresh({ cachedAt: new Date(now - 29 * 86400000).toISOString() }, now)).toBe(true);
    expect(imageCacheFresh({ cachedAt: new Date(now - 31 * 86400000).toISOString() }, now)).toBe(false);
    expect(imageCacheFresh({ cachedAt: new Date(now + 86400000).toISOString() }, now)).toBe(false);
    expect(newsCacheFresh({ checkedAt: new Date(now + 86400000).toISOString(), newsStatus: 'empty', news: [], sourceVersion: NEWS_SOURCE_VERSION }, now)).toBe(false);
  });

  it('rejects retired RSS content in fresh caches and preserves licensed/link-only sources', () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    const rss = { title: 'Legacy publisher headline', source: 'ESPN', url: 'https://www.espn.com/soccer/story/1' }
    const cache = { checkedAt: new Date(now).toISOString(), newsStatus: 'ok', news: [rss], sourceVersion: NEWS_SOURCE_VERSION }
    expect(newsCacheFresh(cache, now)).toBe(false)
    expect(isPermittedNewsItem(rss)).toBe(false)
    expect(isPermittedNewsItem({ ...rss, source: 'GDELT' })).toBe(false)
    expect(isPermittedNewsItem({ source: 'Official', url: 'https://fk-austria.at/news/vorschau-auf-das-auswärtsspiel-in-ried-2' })).toBe(false)
    expect(isPermittedNewsItem({ source: 'Wikinews', title: 'Football report', url: 'https://en.wikinews.org/wiki/Football_report', publishedAt: '2026-10-21T11:00:00Z', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' }, now)).toBe(true)
    expect(matchesTeamNames({ title: 'Alpha FC report' }, ['Alpha FC'])).toBe(true)
    expect(matchesTeamNames({ title: 'Alpha FC report' }, ['Different club'])).toBe(false)
  })

  it('returns neutral GDELT publisher links with seen dates, rejecting unrelated, stale and unsafe hits', async () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    let requested = ''
    const fakeRequest = (async (raw: string, options: any) => {
      requested = raw
      expect(options.retries).toBe(0)
      return { articles: [
        { title: 'Alpha FC soccer report', url: 'https://news.example.com/story', domain: 'example.com', seendate: '20261021T110000Z', socialimage: 'https://example.com/photo.jpg' },
        { title: 'Unrelated football', url: 'https://news.example.com/other', domain: 'example.com', seendate: '20261021T110000Z' },
        { title: 'Alpha FC old', url: 'https://news.example.com/old', domain: 'example.com', seendate: '20261001T110000Z' },
        { title: 'Alpha FC ESPN story', url: 'https://www.espn.com/soccer/story/1', domain: 'espn.com', seendate: '20261021T110000Z' },
        { title: 'Alpha FC unsafe', url: 'http://news.example.com/story', domain: 'example.com', seendate: '20261021T110000Z' },
      ] }
    }) as never
    const items = await findRecentGdelt('Alpha FC', { now, sleepFn: async () => { throw new Error('unexpected wait') }, requestFn: fakeRequest })
    const api = new URL(requested)
    expect(api.searchParams.get('mode')).toBe('artlist')
    expect(api.searchParams.get('format')).toBe('json')
    expect(api.searchParams.get('timespan')).toBe('7d')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: 'External article', publisher: 'example.com', seenAt: '2026-10-21T11:00:00.000Z', source: 'GDELT' })
    expect(items[0]).not.toHaveProperty('publishedAt')
    expect(JSON.stringify(items)).not.toContain('Alpha FC soccer report')
    expect(JSON.stringify(items)).not.toContain('socialimage')
  })

  it('invalidates old caches after retiring the RSS source', () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    const base = { checkedAt: new Date(now).toISOString(), newsStatus: 'empty', news: [] }
    expect(newsCacheFresh(base, now)).toBe(false)
    expect(newsCacheFresh({ ...base, sourceVersion: 'espn-rss-v1-gdelt-v1' }, now)).toBe(false)
    expect(newsCacheFresh({ ...base, sourceVersion: NEWS_SOURCE_VERSION }, now)).toBe(true)
  })

  it('uses the explicitly verified curated identity instead of ambiguous name search', async () => {
    let requests = 0;
    const fakeRequest = async () => {
      requests += 1;
      return { search: [
        { id: 'Q868', label: 'Athletic Club', description: 'Spanish association football team from Bilbao, Spain' },
        { id: 'Q9636189', label: 'Athletic Club', description: 'Brazilian football club' },
      ] };
    };
    expect(await findTeamLinks('Athletic Club', { requestFn: fakeRequest as never }))
      .toEqual({ officialUrl: null, entityUrl: 'https://www.wikidata.org/wiki/Q8687' });
    expect(requests).toBe(1);
  });
});
