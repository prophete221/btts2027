import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findRecentWikinews, findTeamImage, findTeamLinks, imageCacheFresh, newsCacheFresh, request } from './team-context-sources.mjs';

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
  const names = freeMatches(predictions);
  const teams = {};
  console.log(`Wikimedia lookup: ${names.length} unique teams from public/predictions.json free home/away fields.`);

  for (const name of names) {
    const previous = existing.teams?.[name];
    const entry = { name, checkedAt: isoNow(), newsStatus: 'error', news: [], image: null, officialUrl: null, entityUrl: null };
    if (newsCacheFresh(previous)) {
      entry.checkedAt = previous.checkedAt;
      entry.news = previous.news;
      entry.newsStatus = previous.newsStatus;
    } else {
      try {
        entry.news = await findRecentWikinews(name);
        entry.newsStatus = entry.news.length ? 'ok' : 'empty';
      } catch (error) {
        entry.newsStatus = 'error';
        console.warn(`News lookup failed for ${name}: ${error.message}`);
      }
    }

    try {
      Object.assign(entry, await findTeamLinks(name));
    } catch (error) {
      console.warn(`Wikidata profile lookup failed for ${name}: ${error.message}`);
    }

    if (previous?.image && await cachedLocalImage(previous.image)) {
      entry.image = previous.image;
    } else {
      try {
        const candidate = await findTeamImage(name);
        if (candidate) entry.image = await downloadImage(candidate, name);
      } catch (error) {
        console.warn(`Image lookup failed for ${name}: ${error.message}`);
      }
    }
    teams[name] = entry;
    console.log(`${name}: news=${entry.newsStatus}/${entry.news.length}, image=${entry.image ? entry.image.kind : 'null'}`);
  }

  const result = { updatedAt: isoNow(), teams };
  await fs.writeFile(`${OUTPUT}.tmp`, `${JSON.stringify(result, null, 2)}\n`);
  await fs.rename(`${OUTPUT}.tmp`, OUTPUT);
  const summary = Object.values(teams).reduce((acc, team) => {
    acc.news += team.news.length;
    acc.image += Number(Boolean(team.image));
    acc.status[team.newsStatus] = (acc.status[team.newsStatus] ?? 0) + 1;
    return acc;
  }, { news: 0, image: 0, status: {} });
  console.log(`Saved ${OUTPUT}: ${summary.image}/${names.length} images; ${summary.news} news; statuses ${JSON.stringify(summary.status)}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
