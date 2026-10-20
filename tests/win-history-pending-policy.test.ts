/**
 * Politique pending 48 h — update-win-history V8.2
 *
 * Règle : sans statut WON/LOST, un match reste « en attente » (pending)
 * pendant exactement 48 h après son coup d'envoi ; au-delà, sans score
 * vérifiable, il devient « non vérifiable » (unverifiable) — compté à part,
 * jamais gagné/perdu/en attente, exclu du compteur public « en attente ».
 * Règle date seule : la grâce court depuis la fin de la journée UTC du match.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  PENDING_GRACE_HOURS,
  SCHEMA_VERSION,
  classifyUnverified,
  resolveGraceCutoff,
  runWinHistory,
  validateWinHistoryPayload,
  WinHistoryValidationError,
} from '../scripts/update-win-history.mjs'

// Horloge figée : 2026-10-20T12:00:00Z
const NOW = Date.parse('2026-10-20T12:00:00Z')

// ── Fabrication d'une archive de test ────────────────────────────────────────
function pred(over: Record<string, unknown>) {
  return {
    id: 't-vs-t', match: 'Team T vs Team T2', home: 'Team T', away: 'Team T2',
    league: 'Test League', type: 'BTTS', prediction: 'Oui', proba: 0.72,
    tier: 'GOLD', source: 'test', ...over,
  }
}

const ARCHIVES: Record<string, unknown[]> = {
  // Futur : coup d'envoi dans 4 jours → pending
  '2026-10-24.json': [pred({ date: '2026-10-24', time: '18:45' })],
  // Récent : coup d'envoi 6 h avant NOW → grâce non écoulée → pending
  '2026-10-20.json': [pred({ date: '2026-10-20', time: '06:00' })],
  // Passé de ~5 jours sans statut → unverifiable ; + 1 WON + 1 LOST vérifiés
  // (noms de matchs distincts : la clé naturelle de l’historique est date|match|marché)
  '2026-10-15.json': [
    pred({ date: '2026-10-15', time: '18:45' }),
    pred({ match: 'Team W vs Team W2', home: 'Team W', away: 'Team W2', id: 'w-vs-w2', date: '2026-10-15', time: '20:00', status: 'WON', finalScore: '2-1', verifiedAt: '2026-10-16T03:00:00.000Z' }),
    pred({ match: 'Team L vs Team L2', home: 'Team L', away: 'Team L2', id: 'l-vs-l2', date: '2026-10-15', time: '17:00', status: 'LOST', finalScore: '0-0', verifiedAt: '2026-10-16T03:00:00.000Z' }),
  ],
  // Passé, date seule (pas d'heure) → règle fin de journée UTC + 48 h → unverifiable
  '2026-10-14.json': [pred({ date: '2026-10-14' })],
  // Avant le suivi public (2026-08-08) → bucket legacy (privé), passé → unverifiable
  '2026-08-01.json': [pred({ date: '2026-08-01', time: '19:00' })],
}

let tmpDir = ''
let outDir = ''

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-vh-'))
  outDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-vh-out-'))
  for (const [file, preds] of Object.entries(ARCHIVES)) {
    fs.writeFileSync(path.join(tmpDir, file), JSON.stringify({ predictions: preds }, null, 2))
  }
})

afterAll(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
})

function build(): NonNullable<ReturnType<typeof runWinHistory>> {
  const out = runWinHistory({ write: false, dir: tmpDir, now: NOW })
  if (!out) throw new Error('runWinHistory a retourné undefined (dossier d’archives absent ?)')
  return out
}

// ── Scénarios obligatoires ──────────────────────────────────────────────────

describe('politique pending 48 h — classification unitaire', () => {
  it('un match futur sans statut → pending', () => {
    expect(classifyUnverified({ date: '2026-10-24', time: '18:45' }, NOW)).toBe('pending')
  })

  it('un match récent de moins de 48 h sans statut → pending', () => {
    // coup d'envoi 6 h avant NOW
    expect(classifyUnverified({ date: '2026-10-20', time: '06:00' }, NOW)).toBe('pending')
    // exactement à la limite des 48 h (grâce inclusive) → encore pending
    expect(classifyUnverified({ date: '2026-10-18', time: '12:00' }, NOW)).toBe('pending')
    // 1 ms après la limite → unverifiable
    expect(classifyUnverified({ date: '2026-10-18', time: '11:59' }, NOW)).toBe('unverifiable')
  })

  it('un match passé de plus de 48 h sans statut → unverifiable', () => {
    expect(classifyUnverified({ date: '2026-10-17', time: '18:45' }, NOW)).toBe('unverifiable')
  })

  it('date seule : la grâce court depuis la fin de la journée UTC (règle documentée)', () => {
    expect(resolveGraceCutoff({ date: '2026-10-15' })).toBe(Date.parse('2026-10-17T23:59:59.999Z'))
    expect(classifyUnverified({ date: '2026-10-15' }, NOW)).toBe('unverifiable')
    // date seule du jour même → toujours pending
    expect(classifyUnverified({ date: '2026-10-20' }, NOW)).toBe('pending')
  })

  it('date absente ou inexploitable → unverifiable (jamais gonflé dans pending)', () => {
    expect(classifyUnverified({}, NOW)).toBe('unverifiable')
    expect(classifyUnverified({ date: 'pas-une-date' }, NOW)).toBe('unverifiable')
  })
})

describe('politique pending 48 h — pipeline complet (compteurs)', () => {
  it('un match WON → won inchangé ; un match LOST → lost inchangé', () => {
    const out = build()
    expect(out.stats.won).toBe(1)
    expect(out.stats.lost).toBe(1)
    expect(out.stats.total).toBe(2)
    expect(out.stats.rate).toBe(50)
    // Les 2 vérifiés sont les seuls dans l'historique public, intacts
    const hist = out.history as Array<{ status: string; finalScore: string }>
    expect(hist).toHaveLength(2)
    expect(hist.map(h => h.status).sort()).toEqual(['LOST', 'WON'])
    expect(hist.map(h => h.finalScore).sort()).toEqual(['0-0', '2-1'])
  })

  it('compteurs : pending (futur + récent) séparé d’unverifiable (passé > 48 h)', () => {
    const out = build()
    expect(out.stats.pending).toBe(2)          // futur 10-24 + récent 10-20 06:00
    expect(out.stats.unverifiable).toBe(2)     // 10-15 18:45 + date seule 10-14
    expect(out.stats.archivedTotal).toBe(6)
    // Invariant : total + pending + unverifiable = published
    expect(out.stats.total + out.stats.pending + out.stats.unverifiable).toBe(out.stats.archivedTotal)
    // Aucun statut intermédiaire ne fuite dans l’historique public
    const statuses = (out.history as Array<{ status: string }>).map(h => h.status)
    expect(statuses.every(s => ['WON', 'LOST'].includes(s))).toBe(true)
    // Le bucket legacy (privé) applique la même politique
    expect((out.legacyStats as { unverifiable?: number }).unverifiable).toBe(1)
  })

  it('politique explicite embarquée : pendingPolicy.graceHours = 48', () => {
    const out = build()
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(4)
    expect((out.pendingPolicy as { graceHours: number }).graceHours).toBe(PENDING_GRACE_HOURS)
    expect(PENDING_GRACE_HOURS).toBe(48)
  })
})

describe('politique pending 48 h — idempotence', () => {
  it('relancer le script → mêmes compteurs, historique identique, aucun doublon', () => {
    const run1 = build()
    const run2 = build()
    // generatedAt dérive de l’horloge injectée → payloads profondément identiques
    expect(run2).toEqual(run1)
    // Clé naturelle unique dans l’historique (date + match + marché) → zéro doublon
    const keys = (run1.history as Array<{ date: string; match: string; market: string }>)
      .map(h => `${h.date}|${h.match}|${h.market}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('écriture disque : deux exécutions → fichier identique, aucune archive source supprimée', () => {
    // Sortie HORS du dossier d’archives : écrire dedans polluerait le 2e run
    const outPath = path.join(outDir, 'win-history-out.json')
    const prevEnv = process.env.WIN_HISTORY_OUT
    process.env.WIN_HISTORY_OUT = outPath
    try {
      runWinHistory({ write: true, dir: tmpDir, now: NOW })
      const first = fs.readFileSync(outPath, 'utf8')
      const filesBefore = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json')).sort()
      runWinHistory({ write: true, dir: tmpDir, now: NOW })
      const second = fs.readFileSync(outPath, 'utf8')
      expect(second).toBe(first)
      const filesAfter = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json')).sort()
      expect(filesAfter).toEqual(filesBefore)
    } finally {
      if (prevEnv === undefined) delete process.env.WIN_HISTORY_OUT
      else process.env.WIN_HISTORY_OUT = prevEnv
    }
  })
})

describe('politique pending 48 h — validation du schéma win-history.json', () => {
  it('le payload produit passe validateWinHistoryPayload', () => {
    expect(() => validateWinHistoryPayload(build())).not.toThrow()
  })

  it('le fichier public réel (schéma v4) passe la validation et respecte les invariants', () => {
    const real = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/win-history.json'), 'utf8'))
    expect(() => validateWinHistoryPayload(real)).not.toThrow()
    expect(real.schemaVersion).toBe(4)
    expect(real.pendingPolicy.graceHours).toBe(48)
    expect(real.stats.total).toBe(real.stats.won + real.stats.lost)
    expect(real.stats.total + real.stats.pending + real.stats.unverifiable).toBe(real.stats.archivedTotal)
    expect(real.history.every((h: { status: string }) => ['WON', 'LOST'].includes(h.status))).toBe(true)
  })

  it('rejette une graceHours ≠ 48, un unverifiable manquant et des compteurs incohérents', () => {
    const base = build()
    const badPolicy = JSON.parse(JSON.stringify(base))
    badPolicy.pendingPolicy.graceHours = 24
    expect(() => validateWinHistoryPayload(badPolicy)).toThrow(WinHistoryValidationError)

    const badCounters = JSON.parse(JSON.stringify(base))
    badCounters.stats.unverifiable = 99 // casserait l’invariant total+pending+unverifiable = archivedTotal
    expect(() => validateWinHistoryPayload(badCounters)).toThrow(/incohérence compteurs/)

    const badNegative = JSON.parse(JSON.stringify(base))
    badNegative.stats.unverifiable = -1
    expect(() => validateWinHistoryPayload(badNegative)).toThrow(/unverifiable invalide/)
  })
})
