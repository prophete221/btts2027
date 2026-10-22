#!/usr/bin/env node
/**
 * ftp-diff.mjs — Réduction du temps de déploiement FTP (bttspredict.com).
 *
 * Le miroir lftp complet (~10 000 fichiers, --parallel=1) était le principal
 * goulot du déploiement (plusieurs heures) : pendant l'upload, le site mélange
 * pages fraîches et périmées et les matchs semblaient « disparaître ».
 *
 * Ce script produit la liste RESTREINTE des fichiers dont le contenu a réellement
 * changé depuis le déploiement précédent, via un manifeste sha256 versionné sur
 * le serveur :
 *
 *   prepare  : génère out/deploy-manifest.json (hash de tous les fichiers out/)
 *              et le compare à out/deploy-manifest.prev.json (manifeste du
 *              déploiement précédent, téléchargé du serveur par le workflow).
 *              Sortie : out/deploy-list.txt — motifs regex lftp (un par ligne)
 *              des fichiers modifiés/nouveaux.
 *   finish   : (réservé) copie le manifeste courant vers .prev.
 *
 * Sécurité : si le manifeste précédent est absent ou illisible (premier
 * déploiement, serveur vide), la liste contient TOUS les fichiers → le miroir
 * se comporte comme un déploiement complet (comportement historique).
 */

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'out')
const MANIFEST = path.join(OUT, 'deploy-manifest.json')
const PREV = path.join(OUT, 'deploy-manifest.prev.json')
const LIST = path.join(OUT, 'deploy-list.txt')

/** Échappe les caractères spéciaux regex (chunks `[slug]`, `+`, etc.). */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function walk(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, acc)
    else if (entry.isFile()) acc.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return acc
}

function buildManifest() {
  const files = walk(OUT).filter(f =>
    f !== 'deploy-manifest.json' && f !== 'deploy-manifest.prev.json' && f !== 'deploy-list.txt'
  )
  const manifest = { generatedAt: new Date().toISOString(), fileCount: files.length, files: {} }
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(OUT, rel))
    manifest.files[rel] = {
      hash: createHash('sha256').update(buf).digest('hex').slice(0, 16),
      size: buf.length,
    }
  }
  return manifest
}

function cmdPrepare() {
  if (!fs.existsSync(OUT)) {
    console.error('[ftp-diff] out/ introuvable — exécuter le build Next.js avant prepare.')
    process.exit(1)
  }
  const manifest = buildManifest()
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest))

  let prev = null
  try { prev = JSON.parse(fs.readFileSync(PREV, 'utf8')) } catch { prev = null }
  const prevFiles = prev?.files && typeof prev.files === 'object' ? prev.files : null

  const changed = []
  for (const [rel, meta] of Object.entries(manifest.files)) {
    if (!prevFiles || prevFiles[rel]?.hash !== meta.hash) changed.push(rel)
  }

  const patterns = changed.map(rel => `^${escapeRe(rel)}$`)
  fs.writeFileSync(LIST, patterns.length ? patterns.join('\n') + '\n' : '')
  console.log(
    `[ftp-diff] ${changed.length}/${Object.keys(manifest.files).length} fichiers modifiés ` +
    `(prev=${prevFiles ? Object.keys(prevFiles).length : 'aucun'}) → ${LIST}`
  )
  if (changed.length === 0) {
    console.log('[ftp-diff] Aucun fichier modifié — le miroir ne transferera que le manifeste.')
  }
}

function cmdFinish() {
  try {
    fs.copyFileSync(MANIFEST, PREV)
    console.log('[ftp-diff] manifeste courant copié → .prev')
  } catch (e) {
    console.error(`[ftp-diff] finish échoué: ${e.message}`)
    process.exitCode = 1
  }
}

const cmd = process.argv[2] || 'prepare'
if (cmd === 'prepare') cmdPrepare()
else if (cmd === 'finish') cmdFinish()
else {
  console.error('Usage: node scripts/ftp-diff.mjs [prepare|finish]')
  process.exit(1)
}
