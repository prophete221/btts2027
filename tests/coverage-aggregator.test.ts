/**
 * Mission couverture — agrégateur v92 (quick-update-predictions.mjs)
 *
 * 10 scénarios obligatoires :
 *  1. plusieurs sources → un seul match (dédoublonnage)
 *  2. match d'une petite ligue conservé
 *  3. match réel aux données limitées → LOW, « Données limitées », sans proba
 *  4. match sans date rejeté
 *  5. match du 24 octobre rejeté d'une page du 20 octobre (today + VIP)
 *  6. match gratuit jamais affiché dans VIP
 *  7. aucune probabilité / cote inventée (interdits 0.62, clamp, lambda défaut)
 *  8. vraie source conservée par ligne
 *  9. fuseau Africa/Dakar correct
 * 10. compteurs reçu / accepté / rejeté cohérents + journal motivé
 */
import { describe, expect, it } from 'vitest'
import {
  classifyESPNEvent,
  classifyTSBEvent,
  dakarDateFromISO,
  dakarTimeFromISO,
  dedupCandidates,
  toUTCInstant,
  buildPayload,
  buildLimitedLine,
  MAX_FREE_LINES,
} from '../scripts/quick-update-predictions.mjs'
import { validatePredictionPayload } from '../scripts/validate-predictions.mjs'
import { filterDakarTodayRows, filterDakarFutureRows } from '../src/lib/todayFilter'
import { filterVipFixturesForToday, onlyVipFixtures } from '../src/lib/vipPredictions'

const TODAY = '2026-10-20'

// ─── Fixtures ──────────────────────────────────────────────────────────
function espnCandidate(over: Record<string, unknown> = {}) {
  return {
    home: 'Wolverhampton Wanderers', away: 'Portsmouth',
    league: 'Championship', date: TODAY, time: '18:45',
    homeLogo: 'h.png', awayLogo: 'a.png', slug: 'eng.2',
    homeTeamId: '10', awayTeamId: '20', kickoffISO: `${TODAY}T18:45:00Z`,
    source: 'ESPN', ...over,
  }
}

function tsbCandidate(over: Record<string, unknown> = {}) {
  return {
    home: 'Wolverhampton', away: 'Portsmouth',
    league: 'English Championship', date: TODAY, time: '18:45',
    homeLogo: null, awayLogo: null, slug: null,
    homeTeamId: '999', awayTeamId: '998', kickoffISO: `${TODAY}T18:45:00Z`,
    source: 'TheSportsDB', ...over,
  }
}

function statsFor(count: number, goals = 1.4) {
  return {
    available: true, dataSource: 'ESPN_TEAM_SCHEDULE', matchCount: count,
    dataQuality: count >= 8 ? 'HIGH' : 'MEDIUM',
    avgScored: goals, avgConceded: goals * 0.9,
    homeAvgScored: goals * 1.1, homeAvgConceded: goals * 0.8,
    awayAvgScored: goals * 0.9, awayAvgConceded: goals,
  }
}

function tinyStats() {
  return {
    available: true, dataSource: 'ESPN_TEAM_SCHEDULE', matchCount: 8,
    dataQuality: 'HIGH', avgScored: 0.3, avgConceded: 0.3,
    homeAvgScored: 0.3, homeAvgConceded: 0.3, awayAvgScored: 0.3, awayAvgConceded: 0.3,
  }
}

// ─── Helpers de typage (le moteur est un .mjs non typé) ──────────────
type Row = Record<string, unknown>
type Payload = {
  free: Row[]
  vipPreview: Row[]
  predictions: Row[]
  stats: Record<string, number>
  source: string
  date: string
}
type Journal = {
  receivedRaw: number
  duplicates: number
  rejected: Array<{ reason: string; count: number; examples: unknown[] }>
}
type BuildArgs = {
  candidates: Array<{ candidate: Row; homeStats?: unknown; awayStats?: unknown; noStatsWindow?: boolean }>
  todayISO: string
  now?: Date
  maxFree?: number
  maxVip?: number
}
function runBuild(args: BuildArgs): { payload: Payload; journal: Journal } {
  const { payload, journal } = buildPayload(args)
  return { payload: payload as unknown as Payload, journal: journal as unknown as Journal }
}

// ─── 1. Dédoublonnage multi-sources ────────────────────────────────────
describe('1. dédoublonnage multi-sources', () => {
  it('fusionne ESPN + TheSportsDB en une seule ligne (variante de nom)', () => {
    const { kept, duplicates } = dedupCandidates([espnCandidate(), tsbCandidate()])
    expect(kept).toHaveLength(1)
    expect(kept[0].source).toBe('ESPN') // la source la plus riche gagne
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0].source).toBe('TheSportsDB')
  })

  it('garde deux matchs différents le même jour', () => {
    const { kept } = dedupCandidates([espnCandidate(), espnCandidate({ home: 'Burnley', away: 'Sheffield United' })])
    expect(kept).toHaveLength(2)
  })
})

// ─── 2. Petite ligue conservée ────────────────────────────────────────
describe('2. petite ligue conservée', () => {
  it('publie un match TheSportsDB-only comme ligne réelle affichée', () => {
    const small = tsbCandidate({
      home: 'Phoenix Rising', away: 'Orange County SC',
      league: 'American USL Championship', time: '02:00',
    })
    const { payload } = runBuild({ candidates: [{ candidate: small }], todayISO: TODAY })
    const row = payload.free.find((p: Row) => p.home === 'Phoenix Rising')
    expect(row).toBeTruthy()
    expect(row?.dataLimited).toBe(true)
    expect(row?.dataSource).toBe('THESPORTSDB_EVENTS')
    expect(payload.stats.displayOnly).toBeGreaterThanOrEqual(1)
  })
})

// ─── 3. Données limitées → LOW sans proba ─────────────────────────────
describe('3. données limitées (MEDIUM/LOW)', () => {
  it('une équipe avec < 4 vrais matchs → ligne LOW sans probabilité', () => {
    const { payload } = runBuild({
      candidates: [{ candidate: espnCandidate(), homeStats: statsFor(8), awayStats: statsFor(2) }],
      todayISO: TODAY,
    })
    expect(payload.free).toHaveLength(1)
    const row = payload.free[0]
    expect(row.dataQuality).toBe('LOW')
    expect(row.dataLimited).toBe(true)
    expect(row.proba).toBeNull()
  })

  it('deux équipes avec ≥ 4 vrais matchs → analyse complète (HIGH si ≥ 8)', () => {
    const { payload } = runBuild({
      candidates: [{ candidate: espnCandidate(), homeStats: statsFor(8), awayStats: statsFor(8) }],
      todayISO: TODAY,
    })
    expect(payload.free[0].dataQuality).toBe('HIGH')
    expect(payload.free[0].proba).toBeGreaterThan(0)
    expect(payload.free[0].dataLimited).toBeUndefined()
  })

  it('hors fenêtre de stats → ligne limitée conservée (match réel)', () => {
    const future = espnCandidate({ date: '2026-10-26', kickoffISO: '2026-10-26T19:00:00Z' })
    const { payload } = runBuild({ candidates: [{ candidate: future, noStatsWindow: true }], todayISO: TODAY })
    expect(payload.free).toHaveLength(1)
    expect(payload.free[0].dataLimited).toBe(true)
  })
})

// ─── 4. Match sans date rejeté ────────────────────────────────────────
describe('4. match sans date rejeté', () => {
  it('ESPN sans comp.date → rejet « sans_date »', () => {
    const res = classifyESPNEvent({ competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'A' } }, { homeAway: 'away', team: { displayName: 'B' } }] }] }, { todayISO: TODAY, now: new Date(), slug: 'eng.1' })
    expect(res.status).toBe('rejected')
    expect(res.reason).toBe('sans_date')
  })

  it('TheSportsDB sans strTimestamp ni dateEvent → rejet « sans_date »', () => {
    const res = classifyTSBEvent({ strEvent: 'A vs B', strLeague: 'X' }, { todayISO: TODAY, now: new Date() })
    expect(res.status).toBe('rejected')
    expect(res.reason).toBe('sans_date')
  })
})

// ─── 5. Le 24 octobre n'apparaît pas sur la page du 20 octobre ────────
describe('5. filtrage strict de la date du jour', () => {
  const rows = [
    { home: 'A', date: '2026-10-20' },
    { home: 'B', date: '2026-10-24' },
    { home: 'C', date: null as unknown as string },
  ]
  it('filterDakarTodayRows garde uniquement le 20', () => {
    const today = filterDakarTodayRows(rows, TODAY)
    expect(today).toHaveLength(1)
    expect(today[0].home).toBe('A')
  })
  it('le 24 est réservé aux pages demain / archives, pas « aujourd\'hui »', () => {
    expect(filterDakarFutureRows(rows, TODAY)).toHaveLength(1)
    expect(filterDakarFutureRows(rows, TODAY)[0].home).toBe('B')
  })
  it('VIP : fixture du 24 rejetée de la page du 20 ; sans date → rejetée', () => {
    const vip = [
      { home: 'X', date: '2026-10-24', vip: true },
      { home: 'Y', date: TODAY, vip: true },
      { home: 'Z', date: undefined, vip: true },
    ]
    const todayVip = filterVipFixturesForToday(vip, TODAY)
    expect(todayVip).toHaveLength(1)
    expect(todayVip[0].home).toBe('Y')
  })
})

// ─── 6. Un match gratuit jamais dans VIP ──────────────────────────────
describe('6. séparation free / VIP', () => {
  it('free sans flag vip ; vipPreview = lignes explicitement vip:true, disjointes de free', () => {
    const candidates = Array.from({ length: (MAX_FREE_LINES as number) + 10 }, (_, i) => ({
      candidate: espnCandidate({ home: `Club ${i}`, away: `Rival ${i}`, homeTeamId: String(100 + i), awayTeamId: String(200 + i) }),
      homeStats: statsFor(8, 1.4 + (i % 5) * 0.05),
      awayStats: statsFor(8, 1.2 + (i % 3) * 0.05),
    }))
    const { payload } = runBuild({ candidates, todayISO: TODAY })
    expect(payload.free.every((p: Record<string, unknown>) => p.vip !== true)).toBe(true)
    expect(payload.vipPreview.length).toBeGreaterThan(0)
    expect(payload.vipPreview.every((p: Record<string, unknown>) => p.vip === true)).toBe(true)
    const freeIds = new Set(payload.free.map((p: Record<string, unknown>) => p.id))
    expect(payload.vipPreview.every((p: Record<string, unknown>) => !freeIds.has(p.id as string))).toBe(true)
    // Aucun miroir gratuit : onlyVipFixtures ne retourne que les lignes flaggées
    const vipRows = onlyVipFixtures(payload as unknown as Record<string, unknown>)
    expect(vipRows.length).toBe(payload.vipPreview.length)
    expect(payload.vipPreview.every((p: Record<string, unknown>) => p.vipMirror === undefined)).toBe(true)
  })
})

// ─── 7. Aucune probabilité / cote inventée ────────────────────────────
describe('7. interdits anti-invention', () => {
  it('ligne « données limitées » : ni proba, ni λ, ni cote, ni marché', () => {
    const line = buildLimitedLine(espnCandidate())
    expect(line.proba).toBeNull()
    expect(line.bttsProb).toBeNull()
    expect(line.over25Prob).toBeNull()
    expect(line.homeLambda).toBeNull()
    expect(line.xgTotal).toBeNull()
    expect(line.estimatedCote).toBeNull()
    expect(line.type).toBeNull()
    expect(line.predictions).toEqual([])
    expect(line.dataLimited).toBe(true)
  })

  it('le validateur REFUSE une ligne dataLimited qui porterait une proba inventée', () => {
    const payload = {
      date: TODAY,
      lastUpdated: new Date().toISOString(),
      free: [{ id: 'x', match: 'A vs B', home: 'A', away: 'B', league: 'L', date: TODAY, time: '20:00', dataLimited: true, dataQuality: 'LOW', dataSource: 'ESPN_SCOREBOARD', type: null, prediction: null, proba: 0.62 }],
      vipPreview: [],
    }
    const errors = validatePredictionPayload(payload, { today: TODAY, checkKickoff: true, now: new Date('2026-10-20T12:00:00Z') })
    expect(errors.some(e => e.includes('invented values are forbidden'))).toBe(true)
  })

  it('le validateur ACCEPTE un payload mixte (prédictif + données limitées)', () => {
    const { payload } = runBuild({
      candidates: [
        { candidate: espnCandidate(), homeStats: statsFor(8), awayStats: statsFor(8) },
        { candidate: tsbCandidate({ home: 'Small FC', away: 'Tiny United', league: 'Regional Cup' }) },
      ],
      todayISO: TODAY,
    })
    const errors = validatePredictionPayload(payload as unknown as Record<string, unknown>, { today: TODAY, checkKickoff: true, now: new Date('2026-10-20T12:00:00Z') })
    expect(errors).toEqual([])
  })

  it('probabilités Poisson uniquement depuis de vraies moyennes (pas de lambda par défaut)', () => {
    const built = runBuild({ candidates: [{ candidate: espnCandidate(), homeStats: tinyStats(), awayStats: tinyStats() }], todayISO: TODAY })
    expect(built.payload.free).toHaveLength(0)
    expect(built.journal.rejected.some(r => r.reason === 'proba_trop_basse')).toBe(true)
  })
})

// ─── 8. Vraie source conservée ────────────────────────────────────────
describe('8. source réelle par ligne', () => {
  it('ESPN enrichi / ESPN brut / TheSportsDB restent traçables', () => {
    const { payload } = runBuild({
      candidates: [
        { candidate: espnCandidate(), homeStats: statsFor(8), awayStats: statsFor(8) },
        { candidate: espnCandidate({ date: '2026-10-26' }), noStatsWindow: true },
        { candidate: tsbCandidate({ home: 'USL Club', away: 'USL Rival', league: 'USL Championship' }) },
      ],
      todayISO: TODAY,
    })
    const enriched = payload.free.find((p: Row) => p.id === 'wolverha-vs-portsmou-2026-10-20')
    expect(enriched?.dataSource).toBe('ESPN_TEAM_SCHEDULE')
    expect(enriched?.matchSource).toBe('ESPN')
    const raw = payload.free.find((p: Row) => p.date === '2026-10-26')
    expect(raw?.dataSource).toBe('ESPN_SCOREBOARD')
    expect(raw?.matchSource).toBe('ESPN')
    const tsb = payload.free.find((p: Row) => p.matchSource === 'TheSportsDB')
    expect(tsb?.dataSource).toBe('THESPORTSDB_EVENTS')
    expect(payload.source).toContain('ESPN')
  })
})

// ─── 9. Fuseau Africa/Dakar ───────────────────────────────────────────
describe('9. fuseau Africa/Dakar (UTC+0)', () => {
  it('dakarDateFromISO : 23:30Z le 20 reste le 20 ; 00:15Z passe au 21', () => {
    expect(dakarDateFromISO('2026-10-20T23:30:00Z')).toBe('2026-10-20')
    expect(dakarDateFromISO('2026-10-21T00:15:00Z')).toBe('2026-10-21')
    expect(dakarTimeFromISO('2026-10-20T18:45:00Z')).toBe('18:45')
  })

  it('toUTCInstant tolère les formats TheSportsDB (espace, sans Z)', () => {
    expect(toUTCInstant('2026-10-20 18:45:00')).toBe('2026-10-20T18:45:00Z')
    expect(toUTCInstant('2026-10-20T18:45:00')).toBe('2026-10-20T18:45:00Z')
    expect(toUTCInstant('garbage')).toBeNull()
  })

  it('un événement TSB du 24 porte sa propre date, jamais celle du payload', () => {
    const res = classifyTSBEvent({ strEvent: 'Alpha vs Beta', strLeague: 'L', strTimestamp: '2026-10-24T18:45:00' }, { todayISO: TODAY, now: new Date('2026-10-20T12:00:00Z') })
    expect(res.status).toBe('kept')
    expect(res.candidate?.date).toBe('2026-10-24')
    expect(res.candidate?.time).toBe('18:45')
  })
})

// ─── 10. Compteurs cohérents + journal motivé ─────────────────────────
describe('10. compteurs reçu / accepté / rejeté', () => {
  it('reçu = publié + rejeté ; chaque rejet a une raison et des exemples bornés', () => {
    const candidates: BuildArgs['candidates'] = [
      { candidate: espnCandidate(), homeStats: statsFor(8), awayStats: statsFor(8) },
      { candidate: espnCandidate({ home: 'LowProba A', away: 'LowProba B', homeTeamId: '31', awayTeamId: '32' }), homeStats: tinyStats(), awayStats: tinyStats() },
      { candidate: tsbCandidate({ home: 'Tiny FC', away: 'Small Utd', league: 'Regional Cup' }) },
    ]
    for (let i = 0; i < 90; i++) {
      candidates.push({ candidate: espnCandidate({ home: `Fill ${i}`, away: `Opp ${i}`, date: '2026-10-25', homeTeamId: String(400 + i), awayTeamId: String(500 + i) }), homeStats: statsFor(8, 1.5), awayStats: statsFor(8, 1.3) })
    }
    const { payload, journal } = runBuild({ candidates, todayISO: TODAY })
    expect(journal.receivedRaw).toBe(candidates.length)
    expect(payload.stats.receivedRaw).toBe(candidates.length)
    expect(payload.stats.totalAccepted).toBe(payload.stats.freeCount + payload.stats.vipCount)
    expect(payload.stats.totalRejected).toBe(payload.stats.receivedRaw - payload.stats.totalAccepted)
    expect(payload.stats.totalAccepted + payload.stats.totalRejected).toBe(payload.stats.receivedRaw)
    for (const r of journal.rejected) {
      expect(typeof r.reason).toBe('string')
      expect(r.count).toBeGreaterThan(0)
      expect(r.examples.length).toBeLessThanOrEqual(15)
    }
    expect(journal.rejected.some(r => r.reason === 'proba_trop_basse')).toBe(true)
  })

  it('cap d\'affichage journalisé explicitement (aucune perte silencieuse)', () => {
    const candidates = Array.from({ length: (MAX_FREE_LINES as number) + 10 }, (_, i) => ({
      candidate: espnCandidate({ home: `Cap ${i}`, away: `Opp ${i}`, homeTeamId: String(600 + i), awayTeamId: String(700 + i) }),
      homeStats: statsFor(8), awayStats: statsFor(8),
    }))
    const { payload, journal } = runBuild({ candidates, todayISO: TODAY })
    const cap = journal.rejected.find(r => r.reason === 'cap_affichage')
    expect(cap).toBeTruthy()
    expect(payload.stats.freeCount).toBe(MAX_FREE_LINES)
    // overflow = 10 → 8 retenus en VIP, 2 tronqués et journalisés
    expect(payload.stats.vipCount).toBe(8)
    expect(cap?.count).toBe(2)
    expect(payload.stats.totalAccepted + payload.stats.totalRejected).toBe(candidates.length)
  })
})
