import { describe, expect, it } from 'vitest';
import { allowedCreativeCommons, findRecentWikinews, findTeamLinks, imageCacheFresh, newsCacheFresh } from '../scripts/team-context-sources.mjs';

describe('team-context Wikimedia sources', () => {
  it('accepts only known reusable licenses and preserves license provenance', () => {
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } }))
      .toEqual({ license: 'CC BY', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } }))
      .toEqual({ license: 'CC BY-SA', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    expect(allowedCreativeCommons({ LicenseShortName: { value: 'CC0 1.0' }, LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' } })).not.toBeNull();
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
      return { query: { pages: {
        1: { categories: [{ title: 'Category:Published' }], revisions: [{ timestamp: '2026-10-01T09:00:00Z' }] },
        2: { categories: [{ title: 'Category:Published' }], revisions: [{ timestamp: '2026-09-01T09:00:00Z' }, { timestamp: '2026-10-20T09:00:00Z' }] },
        3: { categories: [{ title: 'Category:Draft' }], revisions: [{ timestamp: '2026-10-02T09:00:00Z' }] },
      } } };
    };
    const news = await findRecentWikinews('Exact Team', { now, requestFn: fakeRequest as never });
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ title: 'Football report on Exact Team', publishedAt: '2026-10-01T09:00:00Z', source: 'Wikinews', license: 'CC BY 4.0' });
    expect(news[0].url).toContain('en.wikinews.org/wiki/');
    expect(apiCalls).toHaveLength(2);
  });

  it('enforces cache windows and only trusts successful news cache states', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    expect(newsCacheFresh({ checkedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), newsStatus: 'empty', news: [] }, now)).toBe(true);
    expect(newsCacheFresh({ checkedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(), newsStatus: 'ok', news: [] }, now)).toBe(false);
    expect(newsCacheFresh({ checkedAt: new Date(now).toISOString(), newsStatus: 'error', news: [] }, now)).toBe(false);
    expect(imageCacheFresh({ cachedAt: new Date(now - 29 * 86400000).toISOString() }, now)).toBe(true);
    expect(imageCacheFresh({ cachedAt: new Date(now - 31 * 86400000).toISOString() }, now)).toBe(false);
    expect(imageCacheFresh({ cachedAt: new Date(now + 86400000).toISOString() }, now)).toBe(false);
    expect(newsCacheFresh({ checkedAt: new Date(now + 86400000).toISOString(), newsStatus: 'empty', news: [] }, now)).toBe(false);
  });

  it('does not attach identity links to an exact-name club with multiple football-team candidates', async () => {
    let requests = 0;
    const fakeRequest = async () => {
      requests += 1;
      return { search: [
        { id: 'Q868', label: 'Athletic Club', description: 'Spanish association football team from Bilbao, Spain' },
        { id: 'Q9636189', label: 'Athletic Club', description: 'Brazilian football club' },
      ] };
    };
    expect(await findTeamLinks('Athletic Club', { requestFn: fakeRequest as never }))
      .toEqual({ officialUrl: null, entityUrl: null });
    expect(requests).toBe(1);
  });
});
