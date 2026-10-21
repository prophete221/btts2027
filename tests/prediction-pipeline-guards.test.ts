import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { deriveFormBtts, hasSufficientTeamStats } from '../scripts/prediction-model.mjs'
import { finalizeArchive } from '../scripts/finalize-predictions.mjs'
import { validatePredictionPayload } from '../scripts/validate-predictions.mjs'

const temporaryDirectories: string[] = []
function tempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'btts-pipeline-'))
  temporaryDirectories.push(directory)
  return directory
}
function writePayload(file: string, payload: unknown) {
  fs.writeFileSync(file, JSON.stringify(payload, null, 2))
}
function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('prediction model evidence guards', () => {
  it('requires at least four real matches per team and does not allow a league fallback', () => {
    expect(hasSufficientTeamStats({ available: false, matchCount: 0 })).toBe(false)
    expect(hasSufficientTeamStats({ available: true, matchCount: 3, avgScored: 1.4, avgConceded: 1 })).toBe(false)
    expect(hasSufficientTeamStats({ available: true, matchCount: 4, avgScored: 1.4, avgConceded: 1 })).toBe(true)
  })

  it('averages observed BTTS match rates rather than converting average goals', () => {
    const home = { available: true, form: { bttsRate: 0.4 } }
    const away = { available: true, form: { bttsRate: 0.8 } }
    expect(deriveFormBtts(home, away)).toBe(60)
    expect(deriveFormBtts(home, null)).toBe(40)
    expect(deriveFormBtts(null, null)).toBeNull()
  })
})

describe('archive finalization immutability', () => {
  it('locks first-published fields, adds new fixtures, allows result updates, and locks across dates', () => {
    const root = tempDir()
    const archiveDir = path.join(root, 'archive')
    const predictionsFile = path.join(root, 'predictions.json')
    const published = {
      id: 'fixture-1', type: 'BTTS', date: '2026-11-01', home: 'A', away: 'B',
      proba: 0.61, confidence: 61, ai_analysis: 'First editorial text',
    }
    writePayload(predictionsFile, { date: '2026-11-01', free: [published], predictions: [published], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })

    const edited = { ...published, proba: 0.12, confidence: 12, ai_analysis: 'Changed editorial text' }
    const addition = { ...published, id: 'fixture-2', home: 'C', proba: 0.72 }
    writePayload(predictionsFile, {
      date: '2026-11-01', free: [edited, addition], predictions: [edited, addition], vipPreview: [],
    })
    finalizeArchive({ predictionsFile, archiveDir })

    let current = readJson(predictionsFile)
    expect(current.free).toHaveLength(2)
    expect(current.free[0]).toMatchObject({ proba: 0.61, confidence: 61, ai_analysis: 'First editorial text' })
    expect(current.free[1].proba).toBe(0.72)
    expect(readJson(path.join(archiveDir, '2026-11-01.json')).predictions).toHaveLength(2)

    // A subsequent day's refresh cannot rewrite an already-published fixture.
    const nextDay = { ...edited, date: '2026-11-02', time: '15:00' }
    writePayload(predictionsFile, { date: '2026-11-02', free: [nextDay], predictions: [nextDay], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })
    current = readJson(predictionsFile)
    expect(current.free[0]).toMatchObject({ date: '2026-11-01', proba: 0.61, ai_analysis: 'First editorial text' })
    expect(current.free).toHaveLength(1) // old archived fixtures are not resurrected in today's list

    // Results (including explicit boolean false) are the only allowed edits.
    const verified = { ...current.free[0], status: 'LOST', finalScore: '0-0', verifiedAt: '2026-11-02T20:00:00.000Z', isWon: false }
    writePayload(predictionsFile, { date: '2026-11-02', free: [verified], predictions: [verified], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })
    const result = readJson(path.join(archiveDir, '2026-11-02.json')).predictions[0]
    expect(result).toMatchObject({ proba: 0.61, status: 'LOST', finalScore: '0-0', isWon: false })

    const stalePending = { ...verified, status: 'PENDING', isWon: false }
    writePayload(predictionsFile, { date: '2026-11-02', free: [stalePending], predictions: [stalePending], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })
    expect(readJson(path.join(archiveDir, '2026-11-02.json')).predictions[0].status).toBe('LOST')
  })

  it('supersedes a legacy insufficient-evidence freeze when the current republication has sufficient evidence', () => {
    const root = tempDir()
    const archiveDir = path.join(root, 'archive')
    const predictionsFile = path.join(root, 'predictions.json')
    // Publication héritée (ancien régime) : compteurs de preuve insuffisants.
    const legacy = {
      id: 'cup-1', type: 'BTTS', date: '2026-11-01', home: 'Bayern', away: 'Arsenal',
      proba: 0.61, confidence: 61, matchCountHome: 2, matchCountAway: 2, ai_analysis: 'Legacy text',
    }
    writePayload(predictionsFile, { date: '2026-11-01', free: [legacy], predictions: [legacy], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })

    // Republication courante : stats domestiques réelles suffisantes.
    const refreshed = {
      ...legacy,
      proba: 0.53, confidence: 53, matchCountHome: 7, matchCountAway: 8, ai_analysis: 'Domestic text',
    }
    writePayload(predictionsFile, { date: '2026-11-01', free: [refreshed], predictions: [refreshed], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })

    const current = readJson(predictionsFile)
    expect(current.free[0]).toMatchObject({ proba: 0.53, matchCountHome: 7, matchCountAway: 8, ai_analysis: 'Domestic text' })
  })

  it('keeps the freeze when the first publication already had sufficient evidence', () => {
    const root = tempDir()
    const archiveDir = path.join(root, 'archive')
    const predictionsFile = path.join(root, 'predictions.json')
    const legacyOk = {
      id: 'lg-1', type: 'BTTS', date: '2026-11-01', home: 'C', away: 'D',
      proba: 0.55, confidence: 55, matchCountHome: 8, matchCountAway: 7, ai_analysis: 'Original text',
    }
    writePayload(predictionsFile, { date: '2026-11-01', free: [legacyOk], predictions: [legacyOk], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })

    // Une republication retouchée ne doit PAS passer même avec preuve suffisante.
    const tampered = { ...legacyOk, proba: 0.9, confidence: 90, ai_analysis: 'Tampered text' }
    writePayload(predictionsFile, { date: '2026-11-01', free: [tampered], predictions: [tampered], vipPreview: [] })
    finalizeArchive({ predictionsFile, archiveDir })

    expect(readJson(predictionsFile).free[0]).toMatchObject({ proba: 0.55, confidence: 55, ai_analysis: 'Original text' })
  })
})

describe('payload validation for honest abstention and VIP fixture previews', () => {
  it('accepts an empty selection and fixture-only VIP preview metadata', () => {
    const today = '2026-11-01'
    expect(validatePredictionPayload({ date: today, free: [], vipPreview: [] }, { today })).toEqual([])
    expect(validatePredictionPayload({
      date: today,
      free: [],
      vipPreview: [{ vip: true, id: 'fixture', home: 'A', away: 'B', league: 'League', date: today, time: '18:30' }],
    }, { today })).toEqual([])
  })
})
