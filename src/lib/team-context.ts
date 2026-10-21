import { isPermittedOfficialNews } from '../../scripts/official-news-policy.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TeamNewsItem = {
  sourceId?: string
  title: string
  url: string
  publishedAt?: string
  source: string
  license?: string
  licenseUrl?: string
  attributionUrl?: string
  teamNames?: string[]
  publisher?: string
  seenAt?: string
}

export type TeamImage = {
  url: string
  sourceUrl: string
  author: string
  license: string
  licenseUrl: string
  caption: string
  kind: 'team' | 'stadium'
  date: string
}

export type TeamContextEntry = {
  name: string
  checkedAt: string
  newsStatus: string
  news: TeamNewsItem[]
  image: TeamImage | null
  officialUrl?: string
  entityUrl?: string
}

export type TeamContextDocument = {
  updatedAt: string
  sourceVersion?: string
  globalNews: TeamNewsItem[]
  teams: Record<string, TeamContextEntry>
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const WIKINEWS_HOSTS = new Set(['en.wikinews.org'])
const COMMONS_HOSTS = new Set(['commons.wikimedia.org'])
const CC_HOSTS = new Set(['creativecommons.org', 'www.creativecommons.org'])

function cleanString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function safeHttpsUrl(value: unknown, allowedHosts: Set<string>): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function safeLicenseUrl(value: unknown): string | null {
  const safeUrl = safeHttpsUrl(value, CC_HOSTS)
  if (!safeUrl) return null
  const path = new URL(safeUrl).pathname.toLowerCase().replace(/\/+$/, '')
  const isBySa = /^\/licenses\/by-sa(?:\/|$)/.test(path)
  const isBy = !isBySa && /^\/licenses\/by(?:\/|$)/.test(path)
  const isCc0 = /^\/publicdomain\/zero\/1\.0$/.test(path)
  const isPublicDomainMark = /^\/publicdomain\/mark\/1\.0$/.test(path)
  return isBySa || isBy || isCc0 || isPublicDomainMark ? safeUrl : null
}

function licenseMatchesUrl(license: string, licenseUrl: string): boolean {
  if (/\b(?:NC|ND)\b|non-commercial|noncommercial|no derivatives/i.test(license)) return false
  const path = new URL(licenseUrl).pathname.toLowerCase().replace(/\/+$/, '')
  if (/^\/licenses\/by-sa(?:\/|$)/.test(path)) return /\bby-sa\b/i.test(license)
  if (/^\/licenses\/by(?:\/|$)/.test(path)) return /\bby\b/i.test(license) && !/\bby-sa\b/i.test(license)
  if (/^\/publicdomain\/zero\/1\.0$/.test(path)) return /\bcc0\b/i.test(license)
  if (/^\/publicdomain\/mark\/1\.0$/.test(path)) return /public domain|\bpd mark\b/i.test(license)
  return false
}

function validDate(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return value
}

function normalizeNews(value: unknown, now: number, teamName?: string): TeamNewsItem[] {
  if (!Array.isArray(value)) return []
  const accepted: TeamNewsItem[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue
    const item = candidate as Record<string, unknown>
    const publishedAt = validDate(item.publishedAt)
    const source = cleanString(item.source, 100)
    const rawTitle = typeof item.title === 'string' ? item.title : ''
    const title = cleanString(rawTitle, 240)
    const license = cleanString(item.license, 100)
    let url: string | null = null
    let licenseUrl: string | null = null
    let publisher: string | undefined
    let attributionUrl: string | undefined
    if (source === 'Official') {
      if (!teamName || !isPermittedOfficialNews(item, { now, team: teamName })) continue
      url = String(item.url)
      attributionUrl = String(item.attributionUrl)
      publisher = String(item.publisher)
      licenseUrl = String(item.licenseUrl)
    } else if (source === 'Wikinews') {
      url = safeHttpsUrl(item.url, WIKINEWS_HOSTS)
      licenseUrl = safeLicenseUrl(item.licenseUrl)
      if (!licenseUrl || !licenseMatchesUrl(license, licenseUrl)) continue
    } else {
      continue
    }
    const effectiveDate = publishedAt
    if (!url || (source !== 'Official' && !licenseUrl) || !effectiveDate || !title || !source || !license) continue
    const timestamp = Date.parse(effectiveDate)
    const windowMs = THIRTY_DAYS_MS
    if (timestamp > now || now - timestamp > windowMs) continue
    accepted.push({ title, url, ...(publishedAt ? { publishedAt } : {}), source, license, ...(licenseUrl ? { licenseUrl } : {}), ...(publisher ? { publisher } : {}), ...(attributionUrl ? { attributionUrl } : {}), ...(source === 'Official' ? { teamNames: [teamName!], sourceId: String(item.sourceId) } : {}) })
    if (accepted.length === 3) break
  }
  return accepted
}

function normalizeImage(value: unknown): TeamImage | null {
  if (!value || typeof value !== 'object') return null
  const image = value as Record<string, unknown>
  const url = typeof image.url === 'string' && /^\/team-media\/[a-zA-Z0-9._/-]+$/.test(image.url) && !image.url.includes('..')
    ? image.url
    : null
  const sourceUrl = safeHttpsUrl(image.sourceUrl, COMMONS_HOSTS)
  const licenseUrl = safeLicenseUrl(image.licenseUrl)
  const author = cleanString(image.author, 160)
  const license = cleanString(image.license, 100)
  const caption = cleanString(image.caption, 240)
  const date = validDate(image.date)
  const kind = image.kind === 'team' || image.kind === 'stadium' ? image.kind : null
  if (!url || !sourceUrl || !licenseUrl || !author || !license || !licenseMatchesUrl(license, licenseUrl) || !caption || !date || !kind) return null
  return { url, sourceUrl, author, license, licenseUrl, caption, kind, date }
}

/** Validate and sanitize untrusted, statically collected context data at render time. */
export function normalizeTeamContext(value: unknown, now = Date.now()): TeamContextDocument {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawTeams = root.teams && typeof root.teams === 'object' ? root.teams as Record<string, unknown> : {}
  const teams: Record<string, TeamContextEntry> = {}

  for (const [key, rawValue] of Object.entries(rawTeams)) {
    if (!rawValue || typeof rawValue !== 'object') continue
    const item = rawValue as Record<string, unknown>
    const name = cleanString(item.name, 100)
    const checkedAt = validDate(item.checkedAt)
    if (!key || !name || !checkedAt) continue
    teams[key] = {
      name,
      checkedAt,
      newsStatus: cleanString(item.newsStatus, 80) || 'ok',
      news: normalizeNews(item.news, now, name),
      image: normalizeImage(item.image),
      officialUrl: safeOfficialUrl(item.officialUrl),
      entityUrl: safeWikidataUrl(item.entityUrl),
    }
  }

  return {
    updatedAt: validDate(root.updatedAt) ?? '',
    sourceVersion: cleanString(root.sourceVersion, 80) || undefined,
    globalNews: normalizeNews(root.globalNews, now).slice(0, 3),
    teams,
  }
}

/** Read the collector-owned JSON from public/ at request/render time; never fetches the network. */
export function loadTeamContext(): TeamContextDocument | null {
  try {
    const contents = readFileSync(join(process.cwd(), 'public', 'team-context.json'), 'utf8')
    return normalizeTeamContext(JSON.parse(contents))
  } catch {
    return null
  }
}
function safeOfficialUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? ''
    if (url.protocol !== 'https:' || url.username || url.password || url.port || /:\d+$/.test(authority)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function safeWikidataUrl(value: unknown): string | undefined {
  const url = safeHttpsUrl(value, new Set(['www.wikidata.org', 'wikidata.org']))
  if (!url || !/^\/wiki\/Q\d+$/.test(new URL(url).pathname)) return undefined
  return url
}
