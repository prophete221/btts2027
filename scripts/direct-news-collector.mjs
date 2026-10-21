import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
import { directNewsPublicationDate } from './direct-news-dates.mjs';
import {
  approvedDirectNewsSource, directNewsTermsMatch, directNewsUrlAllowed, DIRECT_NEWS_UA,
  directNewsRegistry, isPermittedDirectNewsItem,
} from './direct-news-policy.mjs';

const MAX_BYTES = 1_000_000;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_CANDIDATES = 200;
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

/** No redirects, cookies, retries, proxy rotation or browser/protection bypass. */
export async function fetchDirectNewsText(url, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': DIRECT_NEWS_UA, Accept: 'text/html, text/plain, application/ld+json' },
    redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BYTES) throw new Error('Response too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Response too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function configuredSelector(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256 ? value : '';
}

function htmlCandidates(html, source) {
  const $ = load(html);
  const candidates = [];
  let visitedNodes = 0;
  const seenNodes = new WeakSet();
  const walk = (node, depth = 0) => {
    if (depth > 20 || ++visitedNodes > 1000) return;
    if (Array.isArray(node)) { for (const child of node.slice(0, MAX_CANDIDATES)) walk(child, depth + 1); return; }
    if (!node || typeof node !== 'object' || seenNodes.has(node)) return;
    seenNodes.add(node);
    if (asArray(node['@type']).some((type) => ['NewsArticle', 'Article', 'BlogPosting'].includes(type))) {
      const pageUrl = typeof node.url === 'string' ? node.url : node.mainEntityOfPage?.['@id'];
      candidates.push({ title: node.headline, date: node.datePublished, url: pageUrl });
    }
    for (const key of ['@graph', 'itemListElement', 'item']) if (node[key]) walk(node[key], depth + 1);
  };
  $('script[type="application/ld+json"]').slice(0, 50).each((_, element) => {
    try { walk(JSON.parse($(element).text())); } catch { /* One invalid metadata block does not invalidate other evidence. */ }
  });

  const selectors = source.selectors && typeof source.selectors === 'object' ? source.selectors : {};
  const cardSelector = configuredSelector(selectors.card);
  const titleSelector = configuredSelector(selectors.title);
  const linkSelector = configuredSelector(selectors.link);
  const timeSelector = configuredSelector(selectors.time);
  if (cardSelector && titleSelector && linkSelector && timeSelector) {
    try {
      $(cardSelector).slice(0, MAX_CANDIDATES).each((_, card) => {
        const root = $(card);
        const title = root.find(titleSelector).first().text();
        const link = root.find(linkSelector).first().attr('href');
        const date = root.find(timeSelector).first().attr('datetime');
        candidates.push({ title, url: link, date });
      });
    } catch { /* Invalid registry selector fails closed for this selector family. */ }
  }

  // Article-page metadata is read only if an approved page happens to be the fetched listing; no article is followed.
  const metaTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content');
  const metaDate = $('meta[property="article:published_time"]').attr('content');
  const metaUrl = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content');
  if (metaTitle && metaDate && metaUrl) candidates.push({ title: metaTitle, date: metaDate, url: metaUrl });

  return candidates.slice(0, MAX_CANDIDATES).map((candidate) => ({ ...candidate, title: cleanText(candidate.title) }));
}

/** Parse only title, publication date and URL from HTML metadata; article bodies and media are discarded. */
export function parseDirectNewsHtml(html, source, { now = Date.now() } = {}) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > MAX_BYTES || !approvedDirectNewsSource(source, now)) return [];
  const unique = new Map();
  for (const candidate of htmlCandidates(html, source)) {
    if (!candidate.title || typeof candidate.date !== 'string' || typeof candidate.url !== 'string') continue;
    const publishedAt = directNewsPublicationDate(candidate.date);
    if (!publishedAt) continue;
    let url;
    try {
      if (/^https?:\/\//i.test(candidate.url) && !directNewsUrlAllowed(candidate.url, source)) continue;
      url = new URL(candidate.url, source.url).href;
    } catch { continue; }
    const item = {
      title: candidate.title, url, publishedAt, source: 'Official', sourceId: source.id,
      publisher: source.publisher, license: source.license, licenseUrl: source.licenseUrl,
      teamNames: [...source.teamNames], attributionUrl: url,
    };
    if (isPermittedDirectNewsItem(item, { now, sources: [source] })) unique.set(url, item);
  }
  return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
}

/** Use robots-parser, but fail closed on missing/malformed content or no matching agent group. */
export function parseDirectNewsRobots(text, userAgent = DIRECT_NEWS_UA, robotsUrl = 'https://direct-news.invalid/robots.txt') {
  if (typeof text !== 'string' || !text.trim() || /<\s*(?:!doctype|html|body)\b/i.test(text)) throw new Error('Invalid robots.txt');
  const agentToken = userAgent.toLowerCase().split(/[ /]/, 1)[0];
  const agentLines = text.split(/\r?\n/).map((line) => line.split('#', 1)[0].trim())
    .filter((line) => /^user-agent\s*:/i.test(line)).map((line) => line.replace(/^user-agent\s*:\s*/i, '').toLowerCase());
  if (!agentLines.some((agent) => agent === '*' || (agent && agentToken.includes(agent)))) throw new Error('robots.txt has no applicable user-agent group');
  const parser = robotsParser(robotsUrl, text);
  return {
    isAllowed: (url) => parser.isAllowed(url, userAgent) === true,
    crawlDelay: parser.getCrawlDelay(userAgent) ?? 0,
  };
}

const cacheKey = (source) => createHash('sha256').update(JSON.stringify(source)).digest('hex');

async function readCache({ cache, cacheFile }, key) {
  if (cache?.read) return cache.read(key);
  if (!cacheFile) return null;
  try {
    const data = JSON.parse(await readFile(cacheFile, 'utf8'));
    return data && typeof data === 'object' ? data[key] ?? null : null;
  } catch (error) { if (error?.code === 'ENOENT') return null; return null; }
}

async function writeCache({ cache, cacheFile }, key, record) {
  if (cache?.write) return cache.write(key, record);
  if (!cacheFile) return;
  let data = {};
  try { data = JSON.parse(await readFile(cacheFile, 'utf8')) || {}; } catch { /* An invalid explicit cache is replaced with a clean cache. */ }
  data[key] = record;
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(data), 'utf8');
}

function validCacheRecord(record, source, now, ttlMs) {
  const checked = Date.parse(record?.checkedAt ?? '');
  return Number.isFinite(checked) && checked <= now && now - checked <= ttlMs
    && Array.isArray(record.items) && record.items.length <= 3
    && record.items.every((item) => isPermittedDirectNewsItem(item, { now, sources: [source] }));
}

/**
 * Cache is off unless cache/cacheFile is explicitly injected; even hits recheck source permission, terms and robots.
 * @param {string[]} teamNames
 * @param {{sources?: object[], now?: number, requestText?: (url: string) => Promise<string>, sleepFn?: (delay: number) => Promise<void>, cache?: {read?: (key: string) => Promise<unknown>, write?: (key: string, record: unknown) => Promise<void>}, cacheFile?: string, cacheTtlMs?: number}} options
 */
export async function collectDirectNews(teamNames, {
  sources = directNewsRegistry.sources, now = Date.now(), requestText = fetchDirectNewsText,
  sleepFn = async (delay) => { await sleep(delay); }, cache, cacheFile, cacheTtlMs = MAX_AGE_MS,
} = {}) {
  const newsByTeam = Object.fromEntries(teamNames.map((team) => [team, []]));
  const checks = [];
  const ttl = Math.max(0, Math.min(MAX_AGE_MS, Number.isFinite(cacheTtlMs) ? cacheTtlMs : MAX_AGE_MS));
  const cacheConfig = { cache, cacheFile };
  const seenIds = new Set();
  for (const source of sources) {
    if (!approvedDirectNewsSource(source, now) || !source.teamNames.some((team) => teamNames.includes(team)) || seenIds.has(source.id)) continue;
    seenIds.add(source.id);
    const check = { sourceId: source.id, status: 'error', count: 0, checkedAt: new Date(now).toISOString() };
    checks.push(check);
    try {
      if (!directNewsUrlAllowed(source.termsUrl, source, '/') || !directNewsUrlAllowed(source.url, source, '/')) throw new Error('Source evidence URL outside approved origin');
      const robotsUrl = new URL('/robots.txt', source.url).href;
      const robotsText = await requestText(robotsUrl);
      const robots = parseDirectNewsRobots(robotsText, DIRECT_NEWS_UA, robotsUrl);
      if (!robots.isAllowed(source.url) || !robots.isAllowed(source.termsUrl)) throw new Error('robots.txt denies source or permission evidence');
      const delayMs = Math.max(1000, robots.crawlDelay * 1000);
      if (!Number.isFinite(delayMs) || delayMs > 30000) throw new Error('robots crawl delay exceeds collection limit');
      await sleepFn(delayMs);
      const terms = await requestText(source.termsUrl);
      if (!directNewsTermsMatch(terms, source)) throw new Error('Permission evidence changed or quote not present');

      const key = cacheKey(source);
      const cached = ttl > 0 ? await readCache(cacheConfig, key) : null;
      if (validCacheRecord(cached, source, now, ttl)) {
        const news = cached.items.filter((item) => robots.isAllowed(item.url));
        for (const team of source.teamNames) if (newsByTeam[team]) newsByTeam[team].push(...news);
        check.status = 'ok';
        check.count = news.length;
        check.checkedAt = cached.checkedAt;
        check.cache = 'hit';
        continue;
      }

      await sleepFn(delayMs);
      const html = await requestText(source.url);
      const news = parseDirectNewsHtml(html, source, { now }).filter((item) => robots.isAllowed(item.url));
      for (const team of source.teamNames) if (newsByTeam[team]) newsByTeam[team].push(...news);
      check.status = 'ok';
      check.count = news.length;
      check.cache = ttl > 0 && (cache?.write || cacheFile) ? 'miss' : 'disabled';
      if (ttl > 0 && (cache?.write || cacheFile)) {
        await writeCache(cacheConfig, key, { checkedAt: check.checkedAt, items: news });
      }
    } catch (error) {
      check.reason = error instanceof Error ? error.message.slice(0, 180) : 'Collection failed';
    }
  }
  for (const team of teamNames) {
    newsByTeam[team] = [...new Map(newsByTeam[team].map((item) => [item.url, item])).values()]
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
  }
  return { newsByTeam, checks };
}
