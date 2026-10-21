import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { publicPredictionPayload, observedFormBtts } from '../scripts/public-predictions.mjs'
import { sanitizePublicData } from '../scripts/sanitize-public-data.mjs'
import { loadAllMatches } from '../src/lib/matches'

const roots: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'btts-public-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'public', 'predictions-archive'), { recursive: true })
  return root
}
const free = { id: 'free', home: 'Home', away: 'Away', date: '2026-10-21', type: 'BTTS', prediction: 'Oui', proba: 0.54, confidence: 54 }
const vip = { ...free, id: 'private', home: 'Private', vip: true, ai_exact_score: '3-2', analysis: 'Private selection', predictions: [{ prediction: 'Non' }] }

describe('frontière publique des données VIP', () => {
  it('retire les chiffres Gemini hérités du flux courant sans réécrire les preuves archivées', () => {
    const row = { ...free, ai_exact_score: '4-0', ai_btts_prob: '99%', ai_winner: 'Home' }
    const payload = { free: [row], predictions: [row] }
    const current = publicPredictionPayload(payload, { retireLegacyAiNumbers: true })
    expect(current.free[0].proba).toBe(0.54)
    expect(current.free[0]).not.toHaveProperty('ai_exact_score')
    expect(current.free[0]).not.toHaveProperty('ai_btts_prob')
    expect(current.free[0]).not.toHaveProperty('ai_winner')
    expect(current.free[0].formBTTS).toBeNull()
    expect(publicPredictionPayload({ free: [{ ...row, matchCountHome: 2, matchCountAway: 8 }] }, { retireLegacyAiNumbers: true }).free).toEqual([])
    expect(observedFormBtts({ formBTTS: 80, formHome: { bttsRate: 0.4 }, formAway: { bttsRate: 0.8 } })).toBe(60)
    expect(publicPredictionPayload(payload).free[0]).toEqual(row)
  })

  it('ne publie que le calendrier VIP sur une liste blanche, jamais de choix imbriqué', () => {
    const safe = publicPredictionPayload({ free: [free, vip], predictions: [free, vip], vipPreview: [vip], vip: [vip], combos: [{ legs: [vip] }] })
    expect(safe.free).toEqual([free])
    expect(safe.predictions).toEqual([free])
    expect(safe.vipPreview).toEqual([{ vip: true, id: 'private', home: 'Private', away: 'Away', date: '2026-10-21' }])
    expect(safe).not.toHaveProperty('vip')
    expect(safe).not.toHaveProperty('combos')
    expect(JSON.stringify(safe)).not.toContain('Private selection')
  })
  it('nettoie aussi les archives et les combinés, de façon idempotente', () => {
    const root = workspace(), publicDir = path.join(root, 'public')
    const payload = { free: [free], predictions: [free], vipPreview: [vip] }
    fs.writeFileSync(path.join(publicDir, 'predictions.json'), JSON.stringify(payload))
    fs.writeFileSync(path.join(publicDir, 'predictions-archive', '2026-10-21.json'), JSON.stringify(payload))
    fs.writeFileSync(path.join(publicDir, 'vip-combos.json'), JSON.stringify({ combos: [vip] }))
    expect(sanitizePublicData(publicDir)).toBe(3)
    expect(sanitizePublicData(publicDir)).toBe(0)
    expect(fs.readFileSync(path.join(publicDir, 'predictions-archive', '2026-10-21.json'), 'utf8')).not.toContain('ai_exact_score')
    expect(JSON.parse(fs.readFileSync(path.join(publicDir, 'vip-combos.json'), 'utf8')).combos).toEqual([])
  })
  it('les pages match reprennent exactement les champs du flux courant et ses marchés', () => {
    const root = workspace()
    fs.writeFileSync(path.join(root, 'public', 'predictions-archive', '2026-10-21.json'), JSON.stringify({ predictions: [{ ...free, proba: 0.9, ai_analysis: 'Ancien texte' }] }))
    fs.writeFileSync(path.join(root, 'public', 'predictions.json'), JSON.stringify({ lastUpdated: '2026-10-21T10:00:00Z', free: [{ ...free, ai_analysis: 'Texte actuel', predictions: [{ type: 'BTTS', prediction: 'Oui', proba: 0.54, confidence: 54 }, { type: 'Over 2.5', prediction: 'Non', proba: 0.42, confidence: 42 }] }, vip] }))
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    const matches = [...loadAllMatches().values()]
    expect(matches).toHaveLength(1)
    expect(matches[0].aiAnalysis).toBe('Texte actuel')
    expect(matches[0].predictions.map(row => row.proba)).toEqual([0.54, 0.42])
    expect(matches[0].lastUpdated).toBe('2026-10-21T10:00:00Z')
  })
})
