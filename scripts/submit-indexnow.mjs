#!/usr/bin/env node
/**
 * IndexNow URL report/submission from the built static sitemap.
 * Defaults to a network-free dry run; use --submit to send explicitly.
 */
import { loadIndexNowUrls } from './indexnow-urls.mjs'

const HOST = 'bttspredict.com'
const INDEXNOW_KEY = 'ba48253f4d8544b3a93cc49a1498381a'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'

function parseArgs(args) {
  const options = { submit: false, sitemapPath: 'out/sitemap.xml' }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run') options.submit = false
    else if (arg === '--submit') options.submit = true
    else if (arg === '--sitemap') {
      const value = args[index + 1]
      if (!value || value.startsWith('--')) throw new Error('--sitemap requires a file path')
      options.sitemapPath = value
      index += 1
    } else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

export async function main({ args = process.argv.slice(2), cwd = process.cwd(), fetchImpl = globalThis.fetch, log = console.log, error = console.error } = {}) {
  try {
    const options = parseArgs(args)
    const sitemapPath = new URL(options.sitemapPath, `file://${cwd.replace(/\/$/, '')}/`).pathname
    const urls = await loadIndexNowUrls({ sitemapPath, outputDir: `${cwd}/out` })

    log(`[IndexNow] Sitemap validé : ${urls.length} URL canoniques FR/EN/AR (${urls.length / 3} groupes complets).`)
    for (const url of urls) log(url)

    if (!options.submit) {
      log('[IndexNow] Dry-run : aucune requête réseau effectuée. Utilisez --submit pour envoyer explicitement.')
      return 0
    }

    if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable; no IndexNow request was sent')
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    })
    if (response.status !== 200 && response.status !== 202) {
      throw new Error(`IndexNow rejected the request (${response.status} ${response.statusText})`)
    }
    log(`[IndexNow] Requête acceptée (HTTP ${response.status}).`)
    return 0
  } catch (err) {
    error(`[IndexNow] Échec : ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const code = await main()
  if (code !== 0) process.exitCode = code
}
