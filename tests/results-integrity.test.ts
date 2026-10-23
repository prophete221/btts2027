/**
 * Intégrité des résultats — verify-results V6 + update-win-history V8.3
 *
 * Bug corrigé (2026-10-23, « les matchs gagnés n'apparaissent pas ») :
 *  1. verify-results interrogeait ESPN à la date de l'ARCHIVE au lieu de la
 *     date RÉELLE du match — un match publié le 22/10 et joué le 25/10
 *     restait PENDING à vie. V6 interroge p.date (+ la veille : ESPN regroupe
 *     les matchs US du soir sous la date américaine) ;
 *  2. le verdict est PROPAGÉ à toutes les copies du même prono présentes
 *     dans la fenêtre d'archives (un match publié plusieurs jours de suite
 *     n'est plus « WON dans une archive, PENDING dans les autres ») ;
 *  3. update-win-history DÉDUPLIQUE les copies : chaque match compte une
 *     seule fois, avec sa vraie date de match dans l'historique.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { runVerifyResults, prevDayISO, effDateOf, predictionKey } from '../scripts/verify-results.mjs'
import { runWinHistory, validateWinHistoryPayload } from '../scripts/update-win-history.mjs'

let verifyDir = ''
let historyDir = ''

beforeAll(() => {
  verifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-results-'))
  historyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-history-dedup-'))
})

afterAll(() => {
  if (verifyDir) fs.rmSync(verifyDir, { recursive: true, force: true })
  if (historyDir) fs.rmSync(historyDir, { recursive: true, force: true })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeArchive(dir: string, name: string, predictions: unknown[]) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify({ predictions }, null, 2))
}

function readArchive(dir: string, name: string) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).predictions as Array<Record<string, unknown>>
}

const psvRow = (over: Record<string, unknown> = {}) => ({
  id: 'psveindh-vs-feyenoo-2026-10-25',
  match: 'PSV Eindhoven vs Feyenoord Rotterdam',
  home: 'PSV Eindhoven', away: 'Feyenoord Rotterdam',
  league: 'Eredivisie', type: 'BTTS', prediction: 'Oui', proba: 0.66,
  date: '2026-10-25', time: '13:30',
  ...over,
})

const altachRow = (over: Record<string, unknown> = {}) => ({
  id: 'rheindorf-vs-austria-2026-10-23',
  match: 'SC Rheindorf Altach vs Austria Vienna',
  home: 'SC Rheindorf Altach', away: 'Austria Vienna',
  league: 'Austrian Bundesliga', type: 'BTTS', prediction: 'Non', proba: 0.45,
  date: '2026-10-23', time: '18:30',
  ...over,
})

/** Scores injectés : PSV 2-1 le 25/10 ; Altach 1-1 le 23/10. Rien les autres jours. */
const injectedScores = async (dateISO: string) => {
  if (dateISO === '2026-10-25') {
    return [{ home: 'PSV', away: 'Feyenoord', hs: 2, as: 1 }]
  }
  if (dateISO === '2026-10-23') {
    return [{ home: 'SC Rheindorf Altach', away: 'Austria Vienna', hs: 1, as: 1 }]
  }
  return []
}

// ── Helpers de dates ─────────────────────────────────────────────────────────

describe('verify-results V6 — helpers de date', () => {
  it('prevDayISO retourne la veille, y compris aux frontières de mois', () => {
    expect(prevDayISO('2026-10-25')).toBe('2026-10-24')
    expect(prevDayISO('2026-03-01')).toBe('2026-02-28')
    expect(prevDayISO('2027-01-01')).toBe('2026-12-31')
  })

  it('prevDayISO refuse une date invalide', () => {
    expect(prevDayISO('bogus')).toBeNull()
    expect(prevDayISO('')).toBeNull()
  })

  it('effDateOf privilégie la vraie date du match, sinon la date d’archive', () => {
    expect(effDateOf({ date: '2026-10-25' }, '2026-10-22')).toBe('2026-10-25')
    expect(effDateOf({}, '2026-10-22')).toBe('2026-10-22')
    expect(effDateOf({ date: 'pas-une-date' }, '2026-10-22')).toBe('2026-10-22')
  })

  it('predictionKey est stable pour les copies d’un même match', () => {
    const a = predictionKey(psvRow())
    const b = predictionKey(psvRow({ status: 'PENDING' }))
    expect(a).toBe(b)
    expect(a).toBe('2026-10-25|PSV Eindhoven vs Feyenoord Rotterdam|btts')
  })
})

// ── Vérification sur la date réelle + propagation ────────────────────────────

describe('verify-results V6 — date réelle du match et propagation', () => {
  beforeAll(() => {
    // Le match PSV (joué le 25/10) est archivé les 22 ET 23/10 — comme en production.
    writeArchive(verifyDir, '2026-10-22.json', [psvRow(), altachRow()])
    writeArchive(verifyDir, '2026-10-23.json', [psvRow()])
  })

  it('vérifie un match sur sa date réelle, pas sur la date de l’archive', async () => {
    const summary = await runVerifyResults({
      dir: verifyDir, write: true, getScores: injectedScores, log: () => {},
    })

    expect(summary.verified).toBe(2)
    expect(summary.won).toBe(1)    // PSV : BTTS Oui, 2-1 → WON
    expect(summary.lost).toBe(1)   // Altach : BTTS Non, 1-1 → LOST

    const arch22 = readArchive(verifyDir, '2026-10-22.json')
    expect(arch22[0]).toMatchObject({ status: 'WON', finalScore: '2-1' })
    expect(arch22[1]).toMatchObject({ status: 'LOST', finalScore: '1-1' })
  })

  it('propage le verdict à toutes les copies du même prono (anti-doublons)', async () => {
    const arch23 = readArchive(verifyDir, '2026-10-23.json')
    expect(arch23[0]).toMatchObject({ status: 'WON', finalScore: '2-1' })
    expect(typeof arch23[0].verifiedAt).toBe('string')
  })

  it('ne juge jamais un match sans score fini (pas d’invention)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-noscore-'))
    try {
      writeArchive(dir, '2026-10-22.json', [psvRow()])
      const summary = await runVerifyResults({
        dir, write: true,
        getScores: async () => [], // aucune donnée
        log: () => {},
      })
      expect(summary.verified).toBe(0)
      const rows = readArchive(dir, '2026-10-22.json')
      expect(rows[0].status).toBe('PENDING')
      expect(rows[0].finalScore).toBeUndefined()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── Déduplication win-history ────────────────────────────────────────────────

describe('update-win-history V8.3 — déduplication des copies de matchs', () => {
  const NOW = Date.parse('2026-10-26T12:00:00Z')

  function buildHistory() {
    return runWinHistory({ write: false, dir: historyDir, now: NOW })!
  }

  beforeAll(() => {
    // Le même match PSV archivé 3 jours de suite (copies PENDING puis vérifiée) ;
    // + un second match unique pour la baseline ; copies conflictuelles testées.
    writeArchive(historyDir, '2026-10-22.json', [
      psvRow(),
      { ...psvRow({ id: 'psv-x2', match: 'PSV Eindhoven vs Feyenoord Rotterdam (b)' }), match: 'PSV Eindhoven vs Feyenoord Rotterdam (b)', home: 'PSV Eindhoven', away: 'Feyenoord Rotterdam (b)' },
    ])
    writeArchive(historyDir, '2026-10-23.json', [psvRow()])
    writeArchive(historyDir, '2026-10-25.json', [
      psvRow({ status: 'WON', finalScore: '2-1', verifiedAt: '2026-10-25T21:00:00.000Z' }),
    ])
  })

  it('compte le match dupliqué UNE SEULE FOIS (total/won/archivedTotal)', () => {
    const out = buildHistory()
    expect(out.stats.won).toBe(1)
    expect(out.stats.total).toBe(1)
    expect(out.stats.archivedTotal).toBe(2) // 2 matchs uniques, pas 4 copies
    expect(out.stats.total + out.stats.pending + out.stats.unverifiable).toBe(out.stats.archivedTotal)
  })

  it('l’historique porte la VRAIE date du match et le côté prédit', () => {
    const out = buildHistory()
    const hist = out.history as Array<Record<string, unknown>>
    expect(hist).toHaveLength(1)
    expect(hist[0].date).toBe('2026-10-25') // date réelle, pas la date d’archive
    expect(hist[0].status).toBe('WON')
    expect(hist[0].finalScore).toBe('2-1')
    expect(hist[0].prediction).toBe('Oui')
  })

  it('le payload dédupliqué passe la validation de schéma', () => {
    expect(() => validateWinHistoryPayload(buildHistory())).not.toThrow()
  })

  it('en cas de copies conflictuelles, le premier statut vérifié gagne (chronologie)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-history-conflict-'))
    try {
      writeArchive(dir, '2026-10-22.json', [psvRow({ status: 'LOST', finalScore: '0-3', verifiedAt: '2026-10-25T21:00:00.000Z' })])
      writeArchive(dir, '2026-10-23.json', [psvRow({ status: 'WON', finalScore: '2-1', verifiedAt: '2026-10-25T22:00:00.000Z' })])
      const out = runWinHistory({ write: false, dir, now: NOW })!
      expect(out.stats.won).toBe(0)
      expect(out.stats.lost).toBe(1)
      const hist = out.history as Array<Record<string, unknown>>
      expect(hist[0].finalScore).toBe('0-3')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
