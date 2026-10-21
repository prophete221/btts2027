import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { directNewsPublicationDate } from './direct-news-dates.mjs';

const WINDOW_MS = 30 * 86400000;
export const DIRECT_NEWS_UA = 'BTTSPredictDirectNews/1.0 (+https://bttspredict.com/mentions-legales)';
export const DIRECT_NEWS_VERSION = 'direct-html-allowlist-v1';

/** @type {{ sources: object[], audit: object[] }} */
let registry = { sources: [], audit: [] };
try {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/direct-news-sources.json'), 'utf8'));
  if (parsed && Array.isArray(parsed.sources) && Array.isArray(parsed.audit)) registry = parsed;
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
export const directNewsRegistry = registry;

function safeOrigin(url) {
  try {
    const parsed = new URL(url);
    const authority = String(url).match(/^https:\/\/([^/?#]*)/i)?.[1] ?? '';
    return parsed.protocol === 'https:' && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(parsed.hostname)
      && !/\.(?:localhost|local|internal|invalid|test)$/i.test(parsed.hostname)
      && !/^\d+(?:\.\d+){3}$/.test(parsed.hostname) && !parsed.hostname.includes(':')
      && !authority.includes('@') && !authority.includes(':')
      && !parsed.username && !parsed.password && !parsed.port && !parsed.hash ? parsed : null;
  } catch { return null; }
}

export function directNewsUrlAllowed(value, source, prefix = source?.articlePathPrefix) {
  try {
    const url = new URL(value);
    const sourceUrl = safeOrigin(source?.url);
    if (!sourceUrl || !safeOrigin(value) || url.origin !== sourceUrl.origin || url.search.length > 2048) return false;
    return typeof prefix === 'string' && prefix.startsWith('/')
      && (prefix === '/' || url.pathname === prefix || url.pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));
  } catch { return false; }
}

/** Approval requires currently reviewed commercial headline/date/link permission and reproducible evidence. */
export function approvedDirectNewsSource(source, now = Date.now()) {
  const reviewed = Date.parse(source?.reviewedAt ?? '');
  const expires = Date.parse(source?.reviewExpiresAt ?? '');
  const sourceUrl = safeOrigin(source?.url);
  const termsUrl = safeOrigin(source?.termsUrl);
  return Boolean(source?.status === 'approved' && typeof source.id === 'string' && source.id.trim()
    && typeof source.publisher === 'string' && source.publisher.trim()
    && source.format === 'html' && Array.isArray(source.teamNames) && source.teamNames.length > 0
    && source.teamNames.every((name) => typeof name === 'string' && name.trim())
    && Number.isFinite(reviewed) && reviewed <= now && expires > now && expires - reviewed <= WINDOW_MS
    && source.permissions?.automatedCollection === true && source.permissions?.commercialHeadlines === true
    && source.permissions?.datesAndLinks === true && termsUrl && sourceUrl && termsUrl.origin === sourceUrl.origin
    && /^https:\/\//.test(source.termsUrl) && /^[a-f0-9]{64}$/.test(source.termsSha256 ?? '')
    && typeof source.permissionQuote === 'string' && source.permissionQuote.trim().length >= 8
    && typeof source.license === 'string' && source.license.trim() && source.licenseUrl === source.termsUrl
    && typeof source.articlePathPrefix === 'string' && source.articlePathPrefix.startsWith('/')
    && directNewsUrlAllowed(source.url, source, '/'));
}

export function isPermittedDirectNewsItem(item, { now = Date.now(), sources = directNewsRegistry.sources, team = '' } = {}) {
  const source = sources.find((entry) => entry.id === item?.sourceId);
  if (!approvedDirectNewsSource(source, now) || item?.source !== 'Official') return false;
  const date = directNewsPublicationDate(item.publishedAt);
  const published = date ? Date.parse(date) : NaN;
  return Boolean(typeof item.title === 'string' && item.title.trim() && item.title.length <= 240
    && !/<[^>]*>|[\u0000-\u001f\u007f]/.test(item.title)
    && !/^(?:Official publication|External article|News)$/i.test(item.title.trim())
    && date && Number.isFinite(published) && published <= now && now - published <= WINDOW_MS
    && directNewsUrlAllowed(item.url, source) && item.attributionUrl === item.url
    && item.publisher === source.publisher && item.license === source.license && item.licenseUrl === source.licenseUrl
    && Array.isArray(item.teamNames) && item.teamNames.length > 0
    && item.teamNames.every((name) => source.teamNames.includes(name))
    && (!team || item.teamNames.includes(team)));
}

export function directNewsTermsMatch(terms, source) {
  if (typeof terms !== 'string' || createHash('sha256').update(terms).digest('hex') !== source.termsSha256) return false;
  const plain = terms.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
  return plain.includes(source.permissionQuote.replace(/\s+/g, ' ').trim());
}
