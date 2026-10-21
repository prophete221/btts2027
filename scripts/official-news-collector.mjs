import { strictPublicationDate } from './official-news-dates.mjs';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import robotsParser from 'robots-parser';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { load } from 'cheerio';
import { approvedSource, isPermittedOfficialNews, officialNewsRegistry, OFFICIAL_NEWS_UA, sameSourceUrl } from './official-news-policy.mjs';

const MAX_BYTES = 2_000_000;
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

/** No redirects, credentials, retries, cookies, proxy rotation, or protection bypass. */
export async function fetchOfficialText(url, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': OFFICIAL_NEWS_UA, Accept: 'text/html, application/rss+xml, application/atom+xml, text/plain' },
    redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Response too large');
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

/** Parse only headline/date/link. Never return body, summary, images, or author photographs. */
export function parseOfficialNews(text, source, { now = Date.now() } = {}) {
  let candidates = [];
  if (source.format === 'rss' || source.format === 'atom') {
    // Disable entities and reject DTDs, rather than resolving external or recursive declarations.
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error('Unsafe or malformed XML');
    const xml = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(text);
    if (source.format === 'rss') {
      candidates = asArray(xml.rss?.channel?.item).map((item) => ({ title: item.title, date: item.pubDate, url: item.link }));
    } else {
      candidates = asArray(xml.feed?.entry).map((item) => ({
        title: item.title?.['#text'] ?? item.title, date: item.published,
        url: asArray(item.link).find((link) => !link['@_rel'] || link['@_rel'] === 'alternate')?.['@_href'],
      }));
    }
  } else if (source.format === 'jsonld') {
    const $ = load(text);
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      const types = asArray(node['@type']);
      if (types.some((type) => ['NewsArticle', 'Article', 'BlogPosting'].includes(type))) {
        candidates.push({ title: node.headline, date: node.datePublished, url: node.url ?? node.mainEntityOfPage?.['@id'] });
      }
      // Only traverse structured graph/list wrappers; do not turn dateModified into publication dates.
      for (const key of ['@graph', 'itemListElement', 'item']) if (node[key]) walk(node[key]);
    };
    $('script[type="application/ld+json"]').each((_, element) => {
      try { walk(JSON.parse($(element).text())); } catch { /* Ignore invalid isolated metadata blocks. */ }
    });
  }
  const unique = new Map();
  for (const candidate of candidates.slice(0, 200)) {
    if (typeof candidate.title !== 'string' || typeof candidate.date !== 'string' || typeof candidate.url !== 'string') continue;
    const publishedAt = strictPublicationDate(candidate.date, source.format === 'rss' ? 'rss' : 'iso');
    if (!publishedAt) continue;
    const item = {
      title: load(`<body>${candidate.title}</body>`).text().replace(/\s+/g, ' ').trim(),
      url: '', publishedAt,
      source: 'Official', sourceId: source.id, publisher: source.publisher,
      license: source.license, licenseUrl: source.licenseUrl, teamNames: source.teamNames,
    };
    try { item.url = new URL(candidate.url, source.url).href; } catch { continue; }
    item.attributionUrl = item.url;
    if (isPermittedOfficialNews(item, { now, sources: [source] })) unique.set(item.url, item);
  }
  return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
}

/** Fetch each reviewed source once per run, not once for each opponent/archive entry. */
export async function collectOfficialNews(teamNames, {
  sources = officialNewsRegistry.sources, now = Date.now(), requestText = fetchOfficialText, sleepFn = async (delay) => { await sleep(delay); },
} = {}) {
  const newsByTeam = Object.fromEntries(teamNames.map((name) => [name, []]));
  const checks = [];
  for (const source of sources) {
    if (!approvedSource(source, now) || !source.teamNames.some((team) => teamNames.includes(team))) continue;
    const check = { sourceId: source.id, status: 'error', count: 0, checkedAt: new Date(now).toISOString() };
    checks.push(check);
    try {
      if (!sameSourceUrl(source.termsUrl, source, '/')) throw new Error('Terms must be on the reviewed source origin');
      const robotsUrl = new URL('/robots.txt', source.url).href;
      const robotsText = await requestText(robotsUrl);
      if (/^\s*</.test(robotsText)) throw new Error('robots.txt returned HTML');
      const robots = robotsParser(robotsUrl, robotsText);
      if (robots.isAllowed(source.url, OFFICIAL_NEWS_UA) !== true || robots.isAllowed(source.termsUrl, OFFICIAL_NEWS_UA) !== true) throw new Error('robots.txt denies or cannot confirm access');
      const delay = Math.max(1000, Number(robots.getCrawlDelay(OFFICIAL_NEWS_UA) ?? 0) * 1000);
      if (!Number.isFinite(delay) || delay > 30000) throw new Error('Crawl delay exceeds bounded collection budget');
      await sleepFn(delay);
      const terms = await requestText(source.termsUrl);
      if (createHash('sha256').update(terms).digest('hex') !== source.termsSha256) throw new Error('Terms changed; manual permission review required');
      const plainTerms = load(terms).text().replace(/\s+/g, ' ').trim();
      if (!plainTerms.includes(source.permissionQuote.replace(/\s+/g, ' ').trim())) throw new Error('Permission quotation not present in reviewed terms');
      await sleepFn(delay);
      const text = await requestText(source.url);
      const news = parseOfficialNews(text, source, { now }).filter((item) => robots.isAllowed(item.url, OFFICIAL_NEWS_UA) === true);
      for (const team of source.teamNames) if (newsByTeam[team]) newsByTeam[team].push(...news);
      check.status = 'ok';
      check.count = news.length;
    } catch (error) { check.reason = error.message; }
  }
  for (const team of teamNames) {
    newsByTeam[team] = [...new Map(newsByTeam[team].map((item) => [item.url, item])).values()]
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
  }
  return { newsByTeam, checks };
}
