import fs from 'node:fs'
import path from 'node:path'

const ARCHIVE_DIR = './public/predictions-archive'
const HISTORY_FILE = './public/win-history.json'
const GRACE_HOURS = 48

function isVerified(prediction) {
  return prediction?.status === 'WON' || prediction?.status === 'LOST' || prediction?.isWon === true || prediction?.isWon === false
}

export function reconcilePending({ now = new Date(), archiveDir = ARCHIVE_DIR, historyFile = HISTORY_FILE, graceHours = GRACE_HOURS, write = true } = {}) {
  const cutoff = now.getTime() - graceHours * 60 * 60 * 1000
  let pending = 0
  let unverifiable = 0
  let archived = 0

  for (const file of fs.readdirSync(archiveDir).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))) {
    const date = file.slice(0, 10)
    const matchTime = new Date(`${date}T23:59:59Z`).getTime()
    const payload = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf8'))
    const predictions = Array.isArray(payload) ? payload : payload.predictions
    if (!Array.isArray(predictions)) continue

    archived += predictions.length
    for (const prediction of predictions) {
      if (isVerified(prediction)) continue
      if (matchTime < cutoff) unverifiable++
      else pending++
    }
  }

  const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'))
  if (history.stats) {
    history.stats.pending = pending
    history.stats.unverifiable = unverifiable
  }
  history.pendingPolicy = {
    graceHours,
    pending: 'Unresolved matches within the grace period only',
    unverifiable: 'Past matches unresolved after the grace period, excluded from public pending count',
  }

  if (write) fs.writeFileSync(historyFile, `${JSON.stringify(history, null, 2)}\n`)
  return { pending, unverifiable, archived, graceHours }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = reconcilePending()
  console.log(`[reconcile-stale-pending] ${result.pending} pending, ${result.unverifiable} unverifiable after ${result.graceHours}h`)
}
