import { readFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ORIGIN = 'https://bttspredict.com'

function decodeXml(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  })[entity])
}

function attributes(tag) {
  const result = {}
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  for (const match of tag.matchAll(attrPattern)) result[match[1].toLowerCase()] = decodeXml(match[2] ?? match[3])
  return result
}

function assertSiteUrl(value, { origin, label }) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} is not a valid absolute URL: ${value}`)
  }
  if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error(`${label} must be a clean HTTPS URL on ${origin}: ${value}`)
  }
  if (url.pathname !== '/' && (url.pathname.endsWith('/') || url.pathname.includes('//'))) {
    throw new Error(`${label} has a non-canonical path: ${value}`)
  }
  if (/%2f|%5c|\\|(?:^|\/)\.{1,2}(?:\/|$)/i.test(url.pathname)) {
    throw new Error(`${label} has an unsafe path: ${value}`)
  }
  return url
}

function canonicalPath(url) {
  return url.pathname === '/' ? '/' : url.pathname
}

function exportedHtmlPath(outputDir, pathname) {
  const relative = pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`
  const filePath = path.resolve(outputDir, relative)
  const root = path.resolve(outputDir) + path.sep
  if (filePath !== path.resolve(outputDir, 'index.html') && !filePath.startsWith(root)) {
    throw new Error(`URL path escapes static export: ${pathname}`)
  }
  return filePath
}

async function assertExportedCanonical(url, outputDir, label) {
  const filePath = exportedHtmlPath(outputDir, url.pathname)
  let html
  try {
    html = await readFile(filePath, 'utf8')
  } catch {
    throw new Error(`${label} has no built static page (${filePath})`)
  }

  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]))
  const canonicals = linkTags.filter((attrs) => (attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))
  if (canonicals.length !== 1 || !canonicals[0].href) {
    throw new Error(`${label} must have exactly one canonical link in ${filePath}`)
  }
  const canonical = assertSiteUrl(canonicals[0].href, { origin: url.origin, label: `${label} canonical` })
  if (canonicalPath(canonical) !== canonicalPath(url)) {
    throw new Error(`${label} canonical does not match sitemap URL (${canonical.href})`)
  }
}

function parseSitemap(sitemapXml) {
  if (!/<urlset\b/i.test(sitemapXml) || !/<\/urlset\s*>/i.test(sitemapXml)) {
    throw new Error('Sitemap XML is missing a valid urlset')
  }
  const entries = [...sitemapXml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi)]
  if (entries.length === 0) throw new Error('Sitemap contains no URL entries')

  return entries.map(([wholeEntry, body], index) => {
    const locs = [...body.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)]
    if (locs.length !== 1) throw new Error(`Sitemap entry ${index + 1} must contain exactly one loc`)
    const loc = decodeXml(locs[0][1].trim())
    const alternates = {}
    for (const match of body.matchAll(/<\s*xhtml:link\b[^>]*>/gi)) {
      const attrs = attributes(match[0])
      if ((attrs.rel ?? '').toLowerCase() !== 'alternate' || !attrs.hreflang || !attrs.href) continue
      const language = attrs.hreflang.toLowerCase()
      if (alternates[language]) throw new Error(`Duplicate ${language} alternate for ${loc}`)
      alternates[language] = attrs.href
    }
    return { loc, alternates, source: wholeEntry }
  })
}

/**
 * Resolve sitemap entries to only validated, built French/English/Arabic canonical pages.
 * Valid French-only pages remain eligible; locale alternates are validated when present.
 */
export async function getIndexNowUrls({ sitemapXml, outputDir, origin = DEFAULT_ORIGIN }) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) {
    throw new Error(`Invalid IndexNow site origin: ${origin}`)
  }
  const entries = parseSitemap(sitemapXml)
  const urls = []
  const seen = new Set()

  for (const [index, entry] of entries.entries()) {
    const fr = assertSiteUrl(entry.loc, { origin: base.origin, label: `Sitemap entry ${index + 1} loc` })
    if (fr.pathname.startsWith('/en/') || fr.pathname === '/en' || fr.pathname.startsWith('/ar/') || fr.pathname === '/ar') {
      throw new Error(`Sitemap loc must be the French canonical URL: ${entry.loc}`)
    }
    if (entry.alternates.fr && entry.alternates.fr !== entry.loc) {
      throw new Error(`French alternate does not match sitemap loc: ${entry.loc}`)
    }

    const expectedPath = fr.pathname === '/' ? '' : fr.pathname
    const group = [['fr', fr]]
    for (const locale of ['en', 'ar']) {
      if (!entry.alternates[locale]) continue
      const translated = assertSiteUrl(entry.alternates[locale], { origin: base.origin, label: `${locale} alternate for ${entry.loc}` })
      if (translated.pathname !== `/${locale}${expectedPath}`) throw new Error(`Locale alternate does not map to the French page: ${entry.loc}`)
      group.push([locale, translated])
    }
    if (entry.alternates['x-default'] && entry.alternates['x-default'] !== entry.loc) {
      throw new Error(`x-default alternate does not match French canonical: ${entry.loc}`)
    }

    for (const [locale, url] of group) {
      await assertExportedCanonical(url, outputDir, `${locale.toUpperCase()} page ${url.href}`)
      if (seen.has(url.href)) continue
      seen.add(url.href)
      urls.push(url.href)
    }
  }

  if (urls.length === 0) throw new Error('Sitemap contains no valid built canonical pages')
  return urls
}

export async function loadIndexNowUrls({ sitemapPath = 'out/sitemap.xml', outputDir = 'out', origin } = {}) {
  const sitemapXml = await readFile(sitemapPath, 'utf8')
  return getIndexNowUrls({ sitemapXml, outputDir, ...(origin ? { origin } : {}) })
}
