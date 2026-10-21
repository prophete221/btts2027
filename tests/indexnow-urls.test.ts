import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIndexNowUrls } from '../scripts/indexnow-urls.mjs'
import { main } from '../scripts/submit-indexnow.mjs'

const ORIGIN = 'https://bttspredict.com'
const tempDirs: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'indexnow-test-'))
  tempDirs.push(root)
  const outputDir = path.join(root, 'out')
  await mkdir(path.join(outputDir, 'en'), { recursive: true })
  await mkdir(path.join(outputDir, 'ar'), { recursive: true })
  await writeFile(path.join(outputDir, 'index.html'), `<link rel="canonical" href="${ORIGIN}">`)
  await writeFile(path.join(outputDir, 'en.html'), `<link rel="canonical" href="${ORIGIN}/en">`)
  await writeFile(path.join(outputDir, 'ar.html'), `<link rel="canonical" href="${ORIGIN}/ar">`)
  return { root, outputDir }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const validSitemap = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${ORIGIN}/</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="${ORIGIN}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/en" />
    <xhtml:link rel="alternate" hreflang="ar" href="${ORIGIN}/ar" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />
  </url>
</urlset>`

describe('IndexNow sitemap URLs', () => {
  it('maps only canonical FR/EN/AR pages and validates each built HTML canonical', async () => {
    const { outputDir } = await fixture()
    const urls = await getIndexNowUrls({ sitemapXml: validSitemap, outputDir })
    expect(urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/en`, `${ORIGIN}/ar`])
  })

  it('rejects offsite URLs and localized paths incorrectly labeled as French', async () => {
    const { outputDir } = await fixture()
    const offsite = validSitemap.replace(`${ORIGIN}/en"`, 'https://evil.example/en"')
    await expect(getIndexNowUrls({ sitemapXml: offsite, outputDir })).rejects.toThrow(/must be a clean HTTPS URL/)
    const wrongLocale = validSitemap.replace(`<loc>${ORIGIN}/</loc>`, `<loc>${ORIGIN}/en</loc>`)
    await expect(getIndexNowUrls({ sitemapXml: wrongLocale, outputDir })).rejects.toThrow(/French canonical URL/)
  })

  it('keeps French-only canonical pages and rejects mismatched canonicals', async () => {
    const { outputDir } = await fixture()
    await writeFile(path.join(outputDir, 'historique.html'), `<link rel="canonical" href="${ORIGIN}/historique">`)
    const frenchOnly = `<url><loc>${ORIGIN}/historique</loc></url>`
    await expect(getIndexNowUrls({ sitemapXml: validSitemap.replace('</urlset>', `${frenchOnly}</urlset>`), outputDir }))
      .resolves.toEqual([`${ORIGIN}/`, `${ORIGIN}/en`, `${ORIGIN}/ar`, `${ORIGIN}/historique`])
    await writeFile(path.join(outputDir, 'ar.html'), `<link rel="canonical" href="https://evil.example/ar">`)
    await expect(getIndexNowUrls({ sitemapXml: validSitemap, outputDir })).rejects.toThrow(/canonical must be a clean HTTPS URL/)
  })

  it('runs --dry-run with zero network calls and returns nonzero for invalid sitemap data', async () => {
    const { root } = await fixture()
    const sitemapPath = path.join(root, 'out', 'sitemap.xml')
    await writeFile(sitemapPath, validSitemap)
    const fetchImpl = vi.fn(() => { throw new Error('unexpected network') })
    const log = vi.fn()
    const error = vi.fn()

    expect(await main({ args: ['--dry-run'], cwd: root, fetchImpl, log, error })).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('aucune requête réseau'))

    await writeFile(sitemapPath, validSitemap.replace(`${ORIGIN}/ar"`, 'https://evil.example/ar"'))
    expect(await main({ args: ['--dry-run'], cwd: root, fetchImpl, log, error })).toBe(1)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Échec'))
  })
})
