import { setTimeout as sleep } from 'node:timers/promises';
import { readFileSync } from 'node:fs';

const USER_AGENT = 'BTTSPredict/1.0 (+https://bttspredict.com/mentions-legales; open-content context)';
const MIN_GAP_MS = 250;
const TIMEOUT_MS = 20_000;
const NEWS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const curatedMedia = JSON.parse(readFileSync('scripts/curated-team-media.json', 'utf8'));
const curatedAliases = { Levante: 'Levante UD' };
export const NEWS_SOURCE_VERSION = 'open-news-v3-official-allowlist';
import { isPermittedOfficialNews } from './official-news-policy.mjs';
export const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
export const GDELT_ATTRIBUTION_URL = 'https://www.gdeltproject.org/';
let lastGdeltRequestAt = 0;
let lastRequestAt = 0;

export const apiHosts = {
  wikinews: 'https://en.wikinews.org/w/api.php',
  wikimedia: 'https://www.wikidata.org/w/api.php',
  commons: 'https://commons.wikimedia.org/w/api.php',
};

function retryDelay(response, attempt) {
  const value = response.headers.get('retry-after');
  if (value) {
    const seconds = Number(value);
    const dateDelay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return Math.min(30_000, 1000 * (2 ** attempt));
}

/** All HTTP, including media downloads, goes through this serialized, paced, UA-bearing client. */
export async function request(url, { responseType = 'json', fetchImpl = fetch, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: responseType === 'json' ? 'application/json' : '*/*' },
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
      }
      if (!response.ok) {
        const error = new Error(`Wikimedia HTTP ${response.status} for ${new URL(url).hostname}`);
        error.status = response.status;
        throw error;
      }
      if (responseType === 'bytes') return Buffer.from(await response.arrayBuffer());
      if (responseType === 'text') return await response.text();
      const payload = await response.json();
      if (payload?.error) {
        const code = String(payload.error.code ?? 'apierror');
        if (['maxlag', 'ratelimited', 'readonly'].includes(code) && attempt < retries) {
          const seconds = Number(payload.error.lag);
          await sleep(Number.isFinite(seconds) ? Math.max(1000, seconds * 1000) : Math.min(30_000, 1000 * (2 ** attempt)));
          continue;
        }
        const error = new Error(`Wikimedia API ${code}: ${payload.error.info ?? 'request failed'}`);
        error.status = 403;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      if (error?.status >= 400 && error.status < 500 && error.status !== 429) break;
      if (attempt >= retries || error?.name === 'AbortError') break;
      await sleep(Math.min(30_000, 1000 * (2 ** attempt)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('Wikimedia request failed');
}

function apiUrl(base, params) {
  const url = new URL(base);
  url.searchParams.set('maxlag', '5');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.href;
}

function norm(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function allowedCreativeCommons(metadata = {}) {
  const short = metadata.LicenseShortName?.value ?? metadata.LicenseShortName ?? '';
  let url = metadata.LicenseUrl?.value ?? metadata.LicenseUrl ?? '';
  const text = `${short} ${url}`.toLowerCase();
  if (/\b(cc0|public domain|pd\b)/i.test(short) || /creativecommons\.org\/publicdomain\/(zero|mark)/i.test(url)) {
    if (/^http:\/\/commons\.wikimedia\.org\//i.test(url)) url = url.replace(/^http:/i, 'https:');
    // Commons sometimes exposes the CC0 deed page over http; normalize only this known canonical CC0 URL.
    if (/^http:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/deed\.en\/?$/i.test(url)) url = url.replace(/^http:/i, 'https:').replace(/\/deed\.en\/?$/i, '/');
    if (!/^https:\/\/(?:commons\.wikimedia\.org\/wiki\/Template:|creativecommons\.org\/publicdomain\/)/i.test(url)) return null;
    return { license: short || 'Public domain', licenseUrl: url };
  }
  const match = text.match(/\bcc\s*by\s*(?:[- ]sa\s*)?(?:([1-4](?:\.0)?))?/i);
  if (!match || /nc|nd|gfdl|non.?commercial|no.?derivatives/i.test(`${short} ${url}`)) return null;
  const sa = /sa/i.test(short) || /by-sa/i.test(url);
  const license = sa ? 'CC BY-SA' : 'CC BY';
  if (!/^https:\/\/creativecommons\.org\/licenses\/(by|by-sa)\/[0-9.]+\/?$/i.test(url)) return null;
  return { license, licenseUrl: url };
}

function normalizeMatchText(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function parseGdeltSeenDate(value) {
  const match = String(value ?? '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  const timestamp = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safePublisherArticleUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || !host || parsed.username || parsed.password || parsed.port
      || host === 'espn.com' || host.endsWith('.espn.com')
      || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || parsed.href !== value) return null;
    return value;
  } catch { return null; }
}

/** GDELT is an index only: never retain or display its publisher headline or social image. */
export async function findRecentGdelt(team, { now = Date.now(), requestFn = request, sleepFn = sleep } = {}) {
  const wait = Math.max(0, lastGdeltRequestAt + 6000 - Date.now());
  if (wait) await sleepFn(wait);
  lastGdeltRequestAt = Date.now();
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set('query', `"${String(team).replaceAll('"', '')}" (soccer OR football)`);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('timespan', '7d');
  url.searchParams.set('maxrecords', '5');
  const payload = await requestFn(url.href, { responseType: 'json', retries: 0 });
  const results = Array.isArray(payload?.articles) ? payload.articles : [];
  const after = now - 7 * 24 * 60 * 60 * 1000;
  const accepted = [];
  for (const result of results) {
    const urlValue = safePublisherArticleUrl(result?.url);
    const publisher = String(result?.domain ?? '').toLowerCase();
    const seenAt = parseGdeltSeenDate(result?.seendate);
    const timestamp = seenAt ? Date.parse(seenAt) : NaN;
    if (!urlValue || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(publisher) || !seenAt || timestamp > now || timestamp < after) continue;
    const host = new URL(urlValue).hostname.toLowerCase();
    if (host !== publisher && !host.endsWith(`.${publisher}`)) continue;
    // Use title internally only to reject unrelated search hits; do not retain it in output.
    if (!matchesTeamNames({ title: result?.title }, [team])) continue;
    accepted.push({ title: 'External article', url: urlValue, seenAt, publisher, source: 'GDELT', license: 'GDELT attribution', licenseUrl: GDELT_ATTRIBUTION_URL });
  }
  return accepted.sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt)).slice(0, 3);
}

/** Exact aliases only: caller supplies verified match-feed names; no fuzzy or inferred team identities. */
export function matchesTeamNames(item, aliases) {
  const haystack = ` ${normalizeMatchText(item?._matchText ?? item?.title)} `;
  return (Array.isArray(aliases) ? aliases : [aliases]).some((alias) => {
    const needle = normalizeMatchText(alias);
    return needle.length > 1 && haystack.includes(` ${needle} `);
  });
}

export async function findRecentWikinews(team, { now = Date.now(), requestFn = request } = {}) {
  const after = new Date(now - NEWS_WINDOW_MS).toISOString();
  const search = await requestFn(apiUrl(apiHosts.wikinews, {
    action: 'query', format: 'json', list: 'search', srnamespace: 0,
    srsearch: `"${team.replaceAll('"', '')}" incategory:Published`, srlimit: 20, srprop: 'timestamp|snippet',
  }));
  const entries = search?.query?.search ?? [];
  if (!entries.length) return [];
  const pages = await requestFn(apiUrl(apiHosts.wikinews, {
    action: 'query', format: 'json', prop: 'categories',
    pageids: entries.map((entry) => entry.pageid).join('|'), cllimit: 'max',
  }));
  const resolved = [];
  for (const entry of entries) {
    const page = pages?.query?.pages?.[entry.pageid];
    const categories = (page?.categories ?? []).map((c) => c.title);
    if (!categories.some((category) => /category:published$/i.test(category)) || categories.some((category) => /draft/i.test(category))) continue;
    // The first revision is the page's creation timestamp; never use the current/last revision.
    // MediaWiki's rvdir=newer requires a single page; query each eligible candidate to get its true first revision.
    const revisions = await requestFn(apiUrl(apiHosts.wikinews, {
      action: 'query', format: 'json', prop: 'revisions', pageids: entry.pageid,
      rvprop: 'timestamp', rvdir: 'newer', rvlimit: 1,
    }));
    const publishedAt = revisions?.query?.pages?.[entry.pageid]?.revisions?.[0]?.timestamp;
    if (!publishedAt || publishedAt < after || Date.parse(publishedAt) > now) continue;
    resolved.push({
      title: entry.title,
      url: `https://en.wikinews.org/wiki/${encodeURIComponent(entry.title.replaceAll(' ', '_'))}`,
      publishedAt,
      source: 'Wikinews',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    });
  }
  return resolved.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
}

async function wikidataEntityForTeam(team, requestFn) {
  const curatedKey = curatedAliases[team] ?? team;
  const curated = curatedMedia[curatedKey];
  if (curated?.entityId && curated?.verificationSource) return { id: curated.entityId, label: curatedKey, description: 'verified association football club' };
  const search = await requestFn(apiUrl(apiHosts.wikimedia, {
    action: 'wbsearchentities', format: 'json', language: 'en', uselang: 'en', type: 'item', limit: 10, search: team,
  }));
  const results = search?.search ?? [];
  // Require a unique exact label among association-football clubs/teams; namesakes are unsafe.
  const exact = results.filter((item) => norm(item.label) === norm(team)
    && /\b(?:association )?football (?:club|team)\b|\bsoccer (?:club|team)\b/i.test(item.description ?? ''));
  return exact.length === 1 ? exact[0] : null;
}

async function commonsImage(fileName, { team, kind, requestFn }) {
  const title = `File:${fileName}`;
  const data = await requestFn(apiUrl(apiHosts.commons, {
    action: 'query', format: 'json', prop: 'imageinfo', titles: title,
    iiprop: 'url|extmetadata', iiurlwidth: 960,
  }));
  const page = Object.values(data?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const metadata = info.extmetadata ?? {};
  const licenseInfo = allowedCreativeCommons(metadata);
  const urls = [info.thumburl, info.url, info.descriptionurl].filter(Boolean).map((value) => {
    try { return new URL(value); } catch { return null; }
  }).filter(Boolean);
  if (!licenseInfo || !urls.some((url) => url.protocol === 'https:' && ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname))
      || !urls.some((url) => url.protocol === 'https:' && url.hostname === 'commons.wikimedia.org')) return null;
  const text = `${page.title ?? ''} ${metadata.ImageDescription?.value ?? ''}`;
  if (/\b(?:logo|crest|badge|emblem|flag|shirt|jersey|kit)\b/i.test(text)) return null;
  const decode = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const author = decode(metadata.Artist?.value || metadata.Credit?.value || '');
  if (!author) return null;
  const caption = decode(metadata.ImageDescription?.value || (kind === 'stadium' ? `${team} stadium` : team));
  const thumbnailUrl = new URL(info.thumburl);
  if (thumbnailUrl.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(thumbnailUrl.hostname)) return null;
  // Keep the Commons-provided raster thumbnail and use its approved upload.wikimedia.org alias.
  if (thumbnailUrl.hostname === 'thumb.wikimedia.org') thumbnailUrl.hostname = 'upload.wikimedia.org';
  const dateRaw = decode(metadata.DateTimeOriginal?.value || metadata.DateTime?.value || '');
  const date = Number.isFinite(Date.parse(dateRaw)) ? new Date(Date.parse(dateRaw)).toISOString() : null;
  return {
    url: thumbnailUrl.href,
    sourceUrl: info.descriptionurl,
    author,
    ...licenseInfo,
    caption: kind === 'stadium' ? `${team} — stade : ${caption}` : caption,
    kind,
    date,
    fileName: page.title,
  };
}

export async function findTeamImage(team, { requestFn = request } = {}) {
  const curatedKey = curatedAliases[team] ?? team;
  const curated = curatedMedia[curatedKey];
  if (curated?.fileName && curated?.stadium) {
    const photo = await commonsImage(curated.fileName.replace(/^File:/, ''), { team, kind: 'stadium', requestFn });
    if (photo) return { ...photo, date: curated.photoDate ?? photo.date, sourceUrl: curated.sourceUrl, caption: `${team} — stade ${curated.stadium}: ${photo.caption.replace(/^.*?: /, '')}` };
  }
  const entity = await wikidataEntityForTeam(team, requestFn);
  if (!entity) return null;
  const entityData = await requestFn(apiUrl(apiHosts.wikimedia, {
    action: 'wbgetentities', format: 'json', ids: entity.id, props: 'claims|labels', languages: 'en',
  }));
  const claims = entityData?.entities?.[entity.id]?.claims ?? {};
  // Only a specifically labeled stadium photo is allowed as fallback; never a player's portrait.
  const stadiums = (claims.P115 ?? []).filter(claim => {
    if (claim.rank === 'deprecated') return false;
    const ended = claim.qualifiers?.P582?.some(item => {
      const raw = item.datavalue?.value?.time;
      return raw && Number.isFinite(Date.parse(raw.replace(/^\+/, ''))) && Date.parse(raw.replace(/^\+/, '')) <= Date.now();
    });
    return !ended;
  }).sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'));
  for (const stadium of stadiums) {
    const stadiumId = stadium.mainsnak?.datavalue?.value?.id;
    if (!stadiumId) continue;
    const stadiumData = await requestFn(apiUrl(apiHosts.wikimedia, {
      action: 'wbgetentities', format: 'json', ids: stadiumId, props: 'claims|labels', languages: 'en',
    }));
    const stadiumEntity = stadiumData?.entities?.[stadiumId];
    const stadiumLabel = stadiumEntity?.labels?.en?.value;
    if (!stadiumLabel) continue;
    for (const claim of stadiumEntity.claims?.P18 ?? []) {
      const file = claim.mainsnak?.datavalue?.value;
      if (!file) continue;
      const photo = await commonsImage(file, { team, kind: 'stadium', requestFn });
      if (photo) return { ...photo, caption: `${team} — stade ${stadiumLabel}: ${photo.caption.replace(/^.*?— stade : /, '')}` };
    }
  }
  const photos = (claims.P18 ?? []).map((claim) => claim.mainsnak?.datavalue?.value).filter(Boolean);
  for (const file of photos) {
    const photo = await commonsImage(file, { team, kind: 'team', requestFn });
    if (photo) return photo;
  }
  return null;
}

export async function findTeamLinks(team, { requestFn = request } = {}) {
  const entity = await wikidataEntityForTeam(team, requestFn);
  if (!entity) return { officialUrl: null, entityUrl: null };
  const data = await requestFn(apiUrl(apiHosts.wikimedia, {
    action: 'wbgetentities', format: 'json', ids: entity.id, props: 'claims',
  }));
  const urls = (data?.entities?.[entity.id]?.claims?.P856 ?? [])
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value) => typeof value === 'string');
  const officialUrl = urls.find((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }) ?? null;
  return { officialUrl, entityUrl: `https://www.wikidata.org/wiki/${entity.id}` };
}

export function isPermittedNewsItem(item, now = Date.now()) {
  if (item?.source === 'Official') return isPermittedOfficialNews(item, { now });
  if (item?.source !== 'Wikinews' || item.license !== 'CC BY 4.0'
    || item.licenseUrl !== 'https://creativecommons.org/licenses/by/4.0/'
    || typeof item.title !== 'string' || !item.title.trim()) return false;
  try {
    const url = new URL(item.url);
    const published = Date.parse(item.publishedAt ?? '');
    return url.protocol === 'https:' && url.hostname === 'en.wikinews.org' && !url.username && !url.password && !url.port
      && url.pathname.startsWith('/wiki/') && Number.isFinite(published) && published <= now && now - published <= NEWS_WINDOW_MS;
  } catch { return false; }
}

export function newsCacheFresh(teamEntry, now = Date.now(), sourceVersion = NEWS_SOURCE_VERSION) {
  const checked = Date.parse(teamEntry?.checkedAt ?? '');
  return Number.isFinite(checked) && checked <= now && now - checked < 6 * 60 * 60 * 1000
    && teamEntry.sourceVersion === sourceVersion && ['ok', 'empty'].includes(teamEntry.newsStatus)
    && Array.isArray(teamEntry.news) && teamEntry.news.every((item) => item.source === 'Wikinews' && isPermittedNewsItem(item, now));
}

export function imageCacheFresh(image, now = Date.now()) {
  const date = Date.parse(image?.cachedAt ?? '');
  return Boolean(image && Number.isFinite(date) && date <= now && now - date < 30 * 24 * 60 * 60 * 1000);
}
