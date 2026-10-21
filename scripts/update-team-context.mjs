import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ESPN_RSS_URL, NEWS_SOURCE_VERSION, findRecentWikinews, findTeamImage, findTeamLinks, imageCacheFresh, matchEspnNewsToTeam, newsCacheFresh, parseEspnRss, publicNewsItem, findRecentGdelt, findCuratedOfficialNews, request } from './team-context-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREDICTIONS = path.join(ROOT, 'public/predictions.json');
const OUTPUT = path.join(ROOT, 'public/team-context.json');
const MEDIA_DIR = path.join(ROOT, 'public/team-media');
const isoNow = () => new Date().toISOString();

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function freeMatches(file) {
  const predictions = file?.free;
  if (!Array.isArray(predictions)) throw new Error('public/predictions.json has no free predictions array');
  return [...new Set(predictions.flatMap((match) => [match?.home, match?.away]).filter((name) => typeof name === 'string' && name.trim()))].sort((a, b) => a.localeCompare(b));
}

async function archiveMatches(now = new Date()) {
  const dir = path.join(ROOT, 'public/predictions-archive');
  const names = new Set();
  const files = await fs.readdir(dir).catch(() => []);
  for (const filename of files) {
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!dateMatch) continue;
    const age = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.parse(`${dateMatch[1]}T00:00:00Z`)) / 86400000;
    if (age < 0 || age > 14) continue;
    try {
      const archive = JSON.parse(await fs.readFile(path.join(dir, filename), 'utf8'));
      for (const match of archive.free ?? []) for (const team of [match?.home, match?.away]) {
        if (typeof team === 'string' && team.trim()) names.add(team.trim());
      }
    } catch { /* Ignore malformed local archive files. */ }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

async function cachedLocalImage(image) {
  if (!image?.url?.startsWith('/team-media/')) return false;
  const local = path.resolve(ROOT, 'public', image.url.slice(1));
  if (!local.startsWith(`${MEDIA_DIR}${path.sep}`)) return false;
  try {
    const stat = await fs.stat(local);
    return stat.isFile() && imageCacheFresh(image);
  } catch { return false; }
}

async function downloadImage(image, team) {
  if (!image?.url || !image.sourceUrl) return null;
  const remote = new URL(image.url);
  if (remote.protocol !== 'https:' || remote.hostname !== 'upload.wikimedia.org') throw new Error('Refusing non-Wikimedia image URL');
  const bytes = await request(remote.href, { responseType: 'bytes' });
  if (bytes.length < 100 || bytes.length > 12_000_000) throw new Error('Wikimedia thumbnail size outside safe bounds');
  const signatures = [
    ['.jpg', bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))],
    ['.png', bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
    ['.webp', bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'],
  ];
  const extension = signatures.find(([, valid]) => valid)?.[0];
  if (!extension) throw new Error('Unsupported image bytes; only raster Wikimedia thumbnails are accepted');
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const key = createHash('sha256').update(`${team}\n${image.sourceUrl}\n${image.licenseUrl}`).digest('hex').slice(0, 20);
  const filename = `${key}${extension}`;
  await fs.writeFile(path.join(MEDIA_DIR, filename), bytes);
  return {
    url: `/team-media/${filename}`,
    sourceUrl: image.sourceUrl,
    author: image.author,
    license: image.license,
    licenseUrl: image.licenseUrl,
    caption: image.caption,
    kind: image.kind,
    date: image.date,
    title: image.fileName,
    cachedAt: isoNow(),
  };
}

async function main() {
  const predictions = await readJson(PREDICTIONS, null);
  const existing = await readJson(OUTPUT, { teams: {} });
  const currentNames = freeMatches(predictions);
  const archiveNames = await archiveMatches();
  // Current matchup names have priority; include only a bounded local archive roster.
  const names = [...new Set([...currentNames, ...archiveNames])].slice(0, 150);
  const teams = {};
  console.log(`ESPN RSS lookup: ${ESPN_RSS_URL}; ${names.length} exact match-feed names (max 150, current=${currentNames.length}, archive=${archiveNames.length}).`);

  let espnItems = [];
  let espnFetchedAt = null;
  let feedFailed = false;
  try {
    const xml = await request(ESPN_RSS_URL, { responseType: 'text' });
    espnItems = parseEspnRss(xml);
    espnFetchedAt = isoNow();
  } catch (error) {
    feedFailed = true;
    console.warn(`ESPN RSS lookup failed: ${error.message}`);
    if (existing.sourceVersion === NEWS_SOURCE_VERSION && Date.parse(existing.espnFetchedAt) <= Date.now()) {
      const age = Date.now() - Date.parse(existing.espnFetchedAt);
      if (age < 6 * 60 * 60 * 1000) {
        espnItems = (existing.globalNews ?? []).map((item) => ({ ...item, _matchText: item.title }));
        espnFetchedAt = existing.espnFetchedAt;
      }
    }
  }
  const globalNews = espnItems.slice(0, 3).map(publicNewsItem);
  const currentSet = new Set(currentNames);
  let gdeltStopped = false;

  for (const name of names) {
    const previous = existing.teams?.[name];
    const teamEspn = espnItems.filter((item) => matchEspnNewsToTeam(item, [name])).slice(0, 3);
    const officialNews = findCuratedOfficialNews(name);
    let teamGdelt = [];
    let gdeltError = null;
    let gdeltDidCheck = false;
    if (currentSet.has(name) && !gdeltStopped) {
      const checked = Date.parse(previous?.gdeltCheckedAt ?? '');
      if (Number.isFinite(checked) && checked <= Date.now() && Date.now() - checked < 6 * 60 * 60 * 1000 && previous?.sourceVersion === NEWS_SOURCE_VERSION) {
        teamGdelt = previous.gdeltNews ?? [];
      } else {
        try { teamGdelt = await findRecentGdelt(name); gdeltDidCheck = true; }
        catch (error) { gdeltError = error; if (error?.status === 429) gdeltStopped = true; console.warn(`GDELT lookup failed for ${name}: ${error.message}`); }
      }
    }
    const entry = { name, checkedAt: isoNow(), newsStatus: 'error', news: [], image: null, officialUrl: null, entityUrl: null, sourceVersion: NEWS_SOURCE_VERSION, gdeltNews: teamGdelt, gdeltCheckedAt: gdeltDidCheck ? isoNow() : previous?.gdeltCheckedAt ?? null };
    if (teamGdelt.length) { entry.news = teamGdelt; entry.newsStatus = 'ok'; }
    else if (officialNews.length) { entry.news = officialNews; entry.newsStatus = 'ok'; }
    else if (teamEspn.length) {
      entry.news = teamEspn.map(publicNewsItem);
      entry.newsStatus = 'ok';
    } else if (newsCacheFresh(previous, Date.now(), NEWS_SOURCE_VERSION)) {
      // Preserve the original checkedAt: serving a cached result is not a source check.
      entry.checkedAt = previous.checkedAt;
      entry.news = previous.news;
      entry.newsStatus = previous.newsStatus;
    } else if (currentSet.has(name)) {
      try {
        entry.news = await findRecentWikinews(name);
        entry.newsStatus = entry.news.length ? 'ok' : 'empty';
      } catch (error) {
        entry.newsStatus = 'error';
        console.warn(`Wikinews fallback lookup failed for ${name}: ${error.message}`);
      }
    } else {
      entry.newsStatus = feedFailed || gdeltError || gdeltStopped ? 'error' : 'empty';
    }

    // Expensive identity/image lookups are limited to the teams on current free matches.
    if (currentSet.has(name)) {
      try { Object.assign(entry, await findTeamLinks(name)); }
      catch (error) { console.warn(`Wikidata profile lookup failed for ${name}: ${error.message}`); }
      if (previous?.image && await cachedLocalImage(previous.image)) entry.image = previous.image;
      else {
        try {
          const candidate = await findTeamImage(name);
          if (candidate) entry.image = await downloadImage(candidate, name);
        } catch (error) { console.warn(`Image lookup failed for ${name}: ${error.message}`); }
      }
    } else if (previous?.image && await cachedLocalImage(previous.image)) {
      entry.image = previous.image;
    }
    teams[name] = entry;
    console.log(`${name}: news=${entry.newsStatus}/${entry.news.length}, image=${entry.image ? entry.image.kind : 'null'}`);
  }

  const result = { updatedAt: isoNow(), sourceVersion: NEWS_SOURCE_VERSION, espnFetchedAt, globalNews, teams };
  await fs.writeFile(`${OUTPUT}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
  await fs.rename(`${OUTPUT}.tmp`, OUTPUT);
  const summary = Object.values(teams).reduce((acc, team) => {
    acc.news += team.news.length;
    acc.espn += team.news.filter((item) => item.source === 'ESPN').length;
    acc.wikinews += team.news.filter((item) => item.source === 'Wikinews').length;
    acc.image += Number(Boolean(team.image));
    acc.status[team.newsStatus] = (acc.status[team.newsStatus] ?? 0) + 1;
    return acc;
  }, { news: 0, espn: 0, wikinews: 0, image: 0, status: {} });
  console.log(`Saved ${OUTPUT}: ${summary.image}/${currentNames.length} current images; team news=${summary.news} (ESPN=${summary.espn}, Wikinews=${summary.wikinews}); global ESPN=${globalNews.length}; statuses=${JSON.stringify(summary.status)}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
