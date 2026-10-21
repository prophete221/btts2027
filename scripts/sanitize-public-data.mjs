import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicPredictionPayload } from './public-predictions.mjs'

export function sanitizePublicData(root) {
  let changed = 0
  const files = ['predictions.json']
  const archiveDir = path.join(root, 'predictions-archive')
  if (fs.existsSync(archiveDir)) {
    files.push(...fs.readdirSync(archiveDir).filter(file => file.endsWith('.json')).map(file => `predictions-archive/${file}`))
  }
  for (const relative of files) {
    const file = path.join(root, relative)
    if (!fs.existsSync(file)) continue
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
    // Les archives conservent leurs pronostics gratuits originaux comme preuve.
    // Le flux courant ne présente plus d'anciens chiffres rédigés par Gemini.
    const safe = publicPredictionPayload(payload, { retireLegacyAiNumbers: relative === 'predictions.json' })
    if (JSON.stringify(payload) !== JSON.stringify(safe)) {
      fs.writeFileSync(file, JSON.stringify(safe, null, 2) + '\n')
      changed++
    }
  }
  const combosPath = path.join(root, 'vip-combos.json')
  if (fs.existsSync(combosPath)) {
    const original = JSON.parse(fs.readFileSync(combosPath, 'utf8'))
    const safe = { date: original.date, timezone: 'Africa/Dakar', status: 'unavailable', reason: 'Les sélections privées ne sont pas distribuées par cet export statique.', combos: [] }
    if (JSON.stringify(original) !== JSON.stringify(safe)) {
      fs.writeFileSync(combosPath, JSON.stringify(safe, null, 2) + '\n')
      changed++
    }
  }
  return changed
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(process.argv[2] || 'public')
  if (!fs.existsSync(root)) throw new Error(`Répertoire absent : ${root}`)
  console.log(`Protection publique : ${sanitizePublicData(root)} fichier(s) nettoyé(s) dans ${root}`)
}
