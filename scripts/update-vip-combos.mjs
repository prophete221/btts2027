import fs from 'node:fs/promises'
const API_KEY = process.env.ODDS_API_KEY
// Aucun choix privé dans public/ ni dans le dépôt GitHub public.
// Un service authentifié distinct sera nécessaire pour distribuer ces données.
const OUTPUT = '.private/vip-combos.json'
const API_BASE = 'https://api.odds-api.io/v3'
const TIME_ZONE = 'Africa/Dakar'
// Keep a measured lead time before kickoff. The page also re-checks every leg
// at render time and hides any combo whose match has already started.
const MIN_PUBLISH_LEAD_MS = 30 * 60 * 1000
const BOOKMAKERS = process.env.ODDS_BOOKMAKERS || 'Bet365,Unibet'

function dakarDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function asDecimal(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1.01 && n <= 100 ? Number(n.toFixed(2)) : null
}

function extractLegs(event, oddsResponse) {
  const legs = []
  const bookmakers = oddsResponse?.bookmakers || {}
  for (const [bookmaker, markets] of Object.entries(bookmakers)) {
    for (const market of Array.isArray(markets) ? markets : []) {
      const marketName = String(market?.name || '').toLowerCase()
      const odds = Array.isArray(market?.odds) ? market.odds : []
      const isPeriodMarket = /(?:^|\s)(ht|1h|2h|half|period|first half|second half)(?:\s|$)/i.test(marketName)
      const isBttsMarket = marketName === 'btts' || marketName === 'both teams to score'
      const isTotalsMarket = marketName === 'totals' || marketName === 'total goals'
      if (isPeriodMarket || (!isBttsMarket && !isTotalsMarket)) continue
      for (const quote of odds) {
        let selection = null
        let price = null
        if (marketName.includes('btts') || marketName.includes('both teams')) {
          selection = quote.yes != null ? 'BTTS — Oui' : quote.no != null ? 'BTTS — Non' : null
          price = asDecimal(quote.yes ?? quote.no)
        } else if (isTotalsMarket) {
          const label = String(quote.label || '2.5')
          if (!/2[.,]5/.test(label) && !/over\s*2[.,]5/.test(marketName)) continue
          const over = quote.over ?? quote.Over
          if (over != null) { selection = 'Over 2.5'; price = asDecimal(over) }
        }
        if (selection && price) {
          legs.push({
            eventId: String(event.id), home: event.home, away: event.away,
            league: event.league?.name || event.league?.slug || 'Football',
            kickoff: event.date, bookmaker, market: market.name, selection,
            odds: price, source: 'Odds-API.io', updatedAt: market.updatedAt || oddsResponse.updatedAt || new Date().toISOString(),
          })
        }
      }
    }
  }
  const unique = new Map()
  for (const leg of legs) unique.set(`${leg.eventId}:${leg.bookmaker}:${leg.market}:${leg.selection}`, leg)
  return [...unique.values()]
}

function chooseCombo(legs, target) {
  const min = target === 2 ? 1.85 : 4.5
  const max = target === 2 ? 2.2 : 5.5
  const maxLegs = target === 2 ? 4 : 6
  let best = null
  function walk(start, chosen, product) {
    if (chosen.length >= 2 && product >= min && product <= max) {
      const score = Math.abs(product - target) + chosen.length * 0.01
      if (!best || score < best.score) best = { legs: [...chosen], totalOdds: Number(product.toFixed(2)), score }
      return
    }
    if (chosen.length >= maxLegs || product > max) return
    for (let i = start; i < legs.length; i++) {
      if (chosen.some(x => x.eventId === legs[i].eventId)) continue
      walk(i + 1, [...chosen, legs[i]], product * legs[i].odds)
    }
  }
  walk(0, [], 1)
  if (!best) return null
  const { score, ...combo } = best
  return combo
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function getJson(url, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    if (response.ok) return response.json()
    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const resetAt = Date.parse(response.headers.get('x-ratelimit-reset') || '')
      const resetDelay = Number.isFinite(resetAt) ? Math.max(resetAt - Date.now(), 5_000) : 0
      const delay = Math.min(Math.max(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : resetDelay || 15_000, 5_000), 60 * 60 * 1000)
      console.warn(`[vip-combos] Odds API HTTP 429; retry ${attempt + 1}/${maxAttempts} in ${Math.ceil(delay / 1000)}s`)
      await sleep(delay)
      continue
    }
    throw new Error(`Odds API HTTP ${response.status}`)
  }
  throw new Error('Odds API request exhausted')
}

function chunks(items, size) {
  const result = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

async function readExisting() {
  try { return JSON.parse(await fs.readFile(OUTPUT, 'utf8')) } catch { return null }
}

function hasFutureLegs(combo) {
  return Array.isArray(combo?.legs) && combo.legs.length > 0 && combo.legs.every(leg => {
    const kickoff = Date.parse(leg?.kickoff)
    return Number.isFinite(kickoff) && kickoff > Date.now()
  })
}

async function writeUnavailable(reason, candidateCombos = null) {
  const today = dakarDate()
  const now = new Date().toISOString()
  const existing = await readExisting()
  const sameDayCombos = existing?.date === today ? existing.combos : null
  const target2 = hasFutureLegs(candidateCombos?.target2) ? candidateCombos.target2 : hasFutureLegs(sameDayCombos?.target2) ? sameDayCombos.target2 : null
  const target5 = hasFutureLegs(candidateCombos?.target5) ? candidateCombos.target5 : hasFutureLegs(sameDayCombos?.target5) ? sameDayCombos.target5 : null
  if (target2 || target5) {
    const partial = {
      date: today, timezone: TIME_ZONE, source: 'Odds-API.io', fetchedAt: now,
      status: 'partial_verified_odds', reason, combos: { target2, target5 },
    }
    await fs.writeFile(OUTPUT, `${JSON.stringify(partial, null, 2)}\n`)
    console.warn(`[vip-combos] ${reason}; published the verified future combo(s) available`)
    return true
  }
  await fs.writeFile(OUTPUT, `${JSON.stringify({ date: today, timezone: TIME_ZONE, source: 'Odds-API.io', fetchedAt: now, status: 'unavailable', reason, combos: { target2: null, target5: null } }, null, 2)}\n`)
  return false
}

async function main() {
  await fs.mkdir('.private', { recursive: true, mode: 0o700 })
  const today = dakarDate()
  if (!API_KEY) {
    console.warn('[vip-combos] ODDS_API_KEY absent — no combo published')
    await writeUnavailable('missing_api_key')
    return
  }
  const from = `${today}T00:00:00Z`
  const to = `${today}T23:59:59Z`
  const eventBookmaker = BOOKMAKERS.split(',')[0].trim()
  const events = await getJson(`${API_BASE}/events?apiKey=${encodeURIComponent(API_KEY)}&sport=football&status=pending&bookmaker=${encodeURIComponent(eventBookmaker)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100`)
  const eventList = Array.isArray(events) ? events : events?.events || []
  // Odds-API.io is the source of truth for event identity here. ESPN and bookmaker
  // names are not stable enough for an exact join; filtering by ESPN caused events=0.
  const now = Date.now()
  const candidates = eventList.filter(e => {
    const kickoff = Date.parse(e?.date)
    return e?.id && e?.home && e?.away && e?.date && Number.isFinite(kickoff) && kickoff > now + MIN_PUBLISH_LEAD_MS && dakarDate(new Date(kickoff)) === today
  })
  const legs = []
  for (const eventBatch of chunks(candidates.slice(0, 40), 10)) {
    try {
      const eventIds = eventBatch.map(event => event.id).join(',')
      const data = await getJson(`${API_BASE}/odds/multi?apiKey=${encodeURIComponent(API_KEY)}&eventIds=${encodeURIComponent(eventIds)}&bookmakers=${encodeURIComponent(BOOKMAKERS)}`)
      const oddsEvents = Array.isArray(data) ? data : data?.events || []
      for (const oddsEvent of oddsEvents) {
        const sourceEvent = eventBatch.find(event => String(event.id) === String(oddsEvent?.id))
        if (!sourceEvent || !oddsEvent?.bookmakers) continue
        const mergedEvent = { ...sourceEvent, ...oddsEvent, id: oddsEvent.id ?? sourceEvent.id, date: oddsEvent.date ?? sourceEvent.date }
        legs.push(...extractLegs(mergedEvent, oddsEvent))
      }
    } catch (error) {
      console.warn(`[vip-combos] odds batch unavailable (${eventBatch.length} events): ${error.message}`)
    }
  }
  const payload = {
    date: today, timezone: TIME_ZONE, source: 'Odds-API.io', fetchedAt: new Date().toISOString(),
    eventCount: candidates.length, legCount: legs.length,
    status: 'available', combos: { target2: chooseCombo(legs, 2), target5: chooseCombo(legs, 5) },
  }
  if (!payload.combos.target2 || !payload.combos.target5) {
    const preserved = await writeUnavailable('insufficient_verified_odds', payload.combos)
    if (preserved) return
    payload.status = 'insufficient_verified_odds'
  }
  await fs.writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`[vip-combos] ${payload.status}; events=${candidates.length}; legs=${legs.length}`)
}

main().catch(async error => {
  console.error(`[vip-combos] fatal: ${error.message}`)
  try { await writeUnavailable('provider_request_failed') } catch {}
  process.exit(1)
})
