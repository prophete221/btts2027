import { strictPublicationDate } from './official-news-dates.mjs';
import registry from './official-news-sources.json' with { type: 'json' };

/** @type {{ sources: Array<Record<string, any>>, audit: Array<Record<string, any>> }} */
export const officialNewsRegistry = registry;
export const OFFICIAL_NEWS_UA = 'BTTSPredictNews/1.0 (+https://bttspredict.com/mentions-legales)';
export const OFFICIAL_NEWS_VERSION = 'official-allowlist-v1';
const WINDOW_MS = 30 * 86400000;

export function sameSourceUrl(value, source, prefix = source.articlePathPrefix) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)
      && !/\.(?:localhost|local|internal|invalid|test)$/i.test(url.hostname) && url.origin === new URL(source.url).origin
      && !url.username && !url.password && !url.port && !url.hash
      && typeof prefix === 'string' && prefix.startsWith('/') && (prefix === '/' || url.pathname === prefix || url.pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
  } catch { return false; }
}

/** A reviewed permission is mandatory. robots.txt alone never licenses republication. */
export function approvedSource(source, now = Date.now()) {
  const reviewed = Date.parse(source?.reviewedAt ?? '');
  const expires = Date.parse(source?.reviewExpiresAt ?? '');
  return Boolean(source?.status === 'approved' && source.id && source.publisher
    && ['rss', 'atom', 'jsonld'].includes(source.format)
    && Array.isArray(source.teamNames) && source.teamNames.length
    && Number.isFinite(reviewed) && reviewed <= now && expires > now && expires - reviewed <= WINDOW_MS
    && source.permissions?.automatedCollection === true && source.permissions?.commercialHeadlines === true
    && source.permissions?.datesAndLinks === true
    && /^https:\/\//.test(source.termsUrl ?? '') && /^[a-f0-9]{64}$/.test(source.termsSha256 ?? '')
    && typeof source.permissionQuote === 'string' && source.permissionQuote.trim()
    && source.license && source.licenseUrl === source.termsUrl
    && sameSourceUrl(source.url, source, '/') && typeof source.articlePathPrefix === 'string'
    && source.articlePathPrefix.startsWith('/'));
}

export function isPermittedOfficialNews(item, { now = Date.now(), sources = officialNewsRegistry.sources, team = '' } = {}) {
  const source = sources.find((entry) => entry.id === item?.sourceId);
  if (!approvedSource(source, now) || item?.source !== 'Official') return false;
  const strictDate = strictPublicationDate(item.publishedAt);
  const published = strictDate ? Date.parse(strictDate) : NaN;
  return Boolean(typeof item.title === 'string' && item.title.trim() && item.title.length <= 240
    && !/<[^>]*>|[\u0000-\u001f\u007f]/.test(item.title)
    && !/^(?:Official publication|External article)$/i.test(item.title.trim())
    && strictDate
    && Number.isFinite(published) && published <= now && now - published <= WINDOW_MS
    && sameSourceUrl(item.url, source) && item.attributionUrl === item.url
    && item.publisher === source.publisher && item.license === source.license && item.licenseUrl === source.licenseUrl
    && Array.isArray(item.teamNames) && item.teamNames.length > 0
    && item.teamNames.every((name) => source.teamNames.includes(name))
    && (!team || item.teamNames.includes(team)));
}
