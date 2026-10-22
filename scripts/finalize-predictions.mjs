#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sufficientRecordedEvidence } from './public-predictions.mjs'

// Verification may change these result fields; all prediction/model/narrative data is immutable.
// last5Home/last5Away (historique détaillé ESPN des 5 derniers matchs, pages /match/)
// sont des données CONTEXTUELLES rafraîchissables, pas des champs de pronostic :
// sans eux dans RESULT_FIELDS, le gel d'immutabilité rétablirait à chaque run la
// première version archivée du match — publiée AVANT l'existence de ces champs —
// et l'historique « Dernière minute » resterait à jamais vide sur le site.
const RESULT_FIELDS = ['status', 'finalScore', 'verifiedAt', 'isWon', 'verifiedSource', 'verificationSource', 'last5Home', 'last5Away']

function predictionKey(prediction) {
  const market = String(prediction?.type ?? '').trim().toLowerCase()
  if (prediction?.id != null && String(prediction.id)) return `id:${prediction.id}|market:${market}`
  const home = String(prediction?.home ?? '').trim().toLowerCase()
  const away = String(prediction?.away ?? '').trim().toLowerCase()
  const date = String(prediction?.date ?? '').trim()
  return home && away && date ? `match:${date}:${home}:${away}|market:${market}` : null
}

function predictionRows(payload) {
  return Array.isArray(payload?.free) ? payload.free : Array.isArray(payload?.predictions) ? payload.predictions : []
}

function resultUpdates(...lists) {
  const updates = new Map()
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      const key = predictionKey(item)
      if (!key) continue
      const fields = updates.get(key) ?? {}
      for (const field of RESULT_FIELDS) {
        if (field === 'status' && item.status === 'PENDING' && ['WON', 'LOST'].includes(fields.status)) continue
        if (Object.hasOwn(item, field)) fields[field] = item[field]
      }
      updates.set(key, fields)
    }
  }
  return updates
}

function findFirstPublications(archiveDir) {
  const first = new Map()
  const resultLists = []
  const files = fs.readdirSync(archiveDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
  for (const name of files) {
    let payload
    try {
      payload = JSON.parse(fs.readFileSync(path.join(archiveDir, name), 'utf8'))
    } catch {
      continue
    }
    const rows = predictionRows(payload)
    resultLists.push(rows)
    for (const row of rows) {
      const key = predictionKey(row)
      if (key && !first.has(key)) first.set(key, structuredClone(row))
    }
  }
  return { first, resultLists }
}

function freezeCurrentRows(rows, firstPublications, updates) {
  return rows.map((row) => {
    const key = predictionKey(row)
    const first = key ? firstPublications.get(key) : null
    if (!first) return structuredClone(row)
    // Politique « withhold insufficient evidence » : une publication héritée
    // dont les compteurs de preuve sont insuffisants (< 4 matchs réels par
    // équipe — ancien régime à moyennes de ligue fabriquées) n'est PAS
    // verrouillée lorsque la republication courante repose sur des données
    // suffisantes (ex. résolution domestique des coupes). Sans cette
    // exception, le gel rétablirait mc=2 et le filtre d'export éliminerait
    // le match du site (régression du 21/10 : 6 matchs UCL masqués).
    // Les champs de résultat restent maîtrisés par `updates` dans les deux cas.
    if (!sufficientRecordedEvidence(first) && sufficientRecordedEvidence(row)) {
      const refreshed = structuredClone(row)
      const allowed = updates.get(key)
      if (allowed) {
        for (const field of RESULT_FIELDS) {
          if (Object.hasOwn(allowed, field)) refreshed[field] = allowed[field]
        }
      }
      return refreshed
    }
    const frozen = structuredClone(first)
    const allowed = updates.get(key)
    if (allowed) {
      for (const field of RESULT_FIELDS) {
        if (Object.hasOwn(allowed, field)) frozen[field] = allowed[field]
      }
    }
    return frozen
  })
}

function mergePublishedSection(previous, incoming, updates = new Map()) {
  const result = Array.isArray(previous) ? previous.map((item) => structuredClone(item)) : []
  const positions = new Map()
  result.forEach((item, index) => {
    const key = predictionKey(item)
    if (key && !positions.has(key)) positions.set(key, index)
  })

  for (const item of Array.isArray(incoming) ? incoming : []) {
    const key = predictionKey(item)
    if (!key || !positions.has(key)) {
      result.push(structuredClone(item))
      if (key) positions.set(key, result.length - 1)
    }
  }

  // Keep published prediction fields; verification results alone may change.
  for (const [key, fields] of updates) {
    const index = positions.get(key)
    if (index === undefined) continue
    for (const field of RESULT_FIELDS) {
      if (Object.hasOwn(fields, field)) result[index][field] = fields[field]
    }
  }
  return result
}

function writeJsonAtomically(file, payload) {
  const tempFile = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tempFile, `${JSON.stringify(payload, null, 2)}\n`)
  fs.renameSync(tempFile, file)
}

/**
 * Finalize an already enriched public payload into its date archive, idempotently.
 * Existing fixture+market predictions are frozen from their earliest archive.
 * The current file is also restored to frozen values (without resurrecting old rows).
 */
export function finalizeArchive({ predictionsFile, archiveDir }) {
  const payload = JSON.parse(fs.readFileSync(predictionsFile, 'utf8'))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date ?? ''))) {
    throw new Error('predictions.json must contain a valid YYYY-MM-DD date')
  }
  const currentFree = predictionRows(payload)
  const vipPreview = Array.isArray(payload.vipPreview) ? payload.vipPreview : []
  fs.mkdirSync(archiveDir, { recursive: true })

  const { first, resultLists } = findFirstPublications(archiveDir)
  const archiveFile = path.join(archiveDir, `${payload.date}.json`)
  const previous = fs.existsSync(archiveFile)
    ? JSON.parse(fs.readFileSync(archiveFile, 'utf8'))
    : null
  const updates = resultUpdates(...resultLists, previous?.predictions, previous?.free, currentFree, payload.predictions)
  const frozenCurrent = freezeCurrentRows(currentFree, first, updates)
  const mergedFree = mergePublishedSection(previous?.free ?? previous?.predictions, frozenCurrent, updates)
  const mergedVipPreview = mergePublishedSection(previous?.vipPreview, vipPreview)

  // Never append expired archive rows to today's selected payload.
  payload.free = frozenCurrent
  payload.predictions = frozenCurrent
  writeJsonAtomically(predictionsFile, payload)

  // For an existing same-date archive, root metadata also remains from first publication.
  const finalized = previous ? { ...previous } : structuredClone(payload)
  finalized.date = previous?.date ?? payload.date
  finalized.free = mergedFree
  finalized.predictions = mergedFree
  finalized.vipPreview = mergedVipPreview
  writeJsonAtomically(archiveFile, finalized)
  return archiveFile
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const root = path.resolve(path.dirname(thisFile), '..')
  const predictionsFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public', 'predictions.json')
  const archiveDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'public', 'predictions-archive')
  try {
    const archiveFile = finalizeArchive({ predictionsFile, archiveDir })
    console.log(`[archive-finalize] Finalized ${archiveFile}`)
  } catch (error) {
    console.error(`[archive-finalize] ${error.message}`)
    process.exitCode = 1
  }
}
