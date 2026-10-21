// Un export statique n'est pas un contrôle d'accès : aucun choix VIP ne doit y figurer.
export function isVipRow(row) {
  return row?.vip === true || row?.isVip === true || String(row?.tier || '').toUpperCase() === 'VIP'
}

const FIXTURE_FIELDS = ['id', 'home', 'away', 'league', 'date', 'time', 'kickoff']
export function publicVipFixture(row) {
  const fixture = { vip: true }
  for (const field of FIXTURE_FIELDS) {
    if (typeof row?.[field] === 'string') fixture[field] = row[field]
  }
  return fixture
}

const LEGACY_AI_CHOICES = [
  'ai_exact_score', 'exact_score_prob', 'ai_btts_prob', 'ai_over25_prob',
  'ai_winner', 'ai_winner_prob', 'ai_team_over15', 'ai_double_chance', 'ai_main_prediction', 'ai_risk',
]
export function observedFormBtts(row) {
  const rates = [row?.formHome?.bttsRate, row?.formAway?.bttsRate]
    .filter(rate => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1)
  return rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length * 100) : null
}
// Une ligne publiée doit reposer sur des données réelles suffisantes
// (≥ 4 matchs enregistrés par équipe) — sinon elle est retenue à l'export.
// Les lignes sans aucun compteur (ancien schéma) restent tolérées.
export function sufficientRecordedEvidence(row) {
  if (!('matchCountHome' in row) && !('matchCountAway' in row)) return true
  return Number.isFinite(row.matchCountHome) && row.matchCountHome >= 4 &&
    Number.isFinite(row.matchCountAway) && row.matchCountAway >= 4
}
function withoutLegacyAiChoices(row) {
  const safe = { ...row }
  for (const field of LEGACY_AI_CHOICES) delete safe[field]
  // Ne pas réutiliser le taux v91 calculé depuis une moyenne de buts.
  safe.formBTTS = observedFormBtts(row)
  return safe
}

export function publicPredictionPayload(payload, { retireLegacyAiNumbers = false } = {}) {
  if (Array.isArray(payload)) return payload.filter(row => !isVipRow(row))
  if (!payload || typeof payload !== 'object') return payload
  const result = { ...payload }
  const vipRows = [payload.vip, payload.vipPredictions, payload.vipPreview]
    .filter(Array.isArray).flat().filter(isVipRow)
  const seen = new Set()
  const previews = vipRows.filter(row => {
    const key = row.id || `${row.home}|${row.away}|${row.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(publicVipFixture)
  if (['vip', 'vipPredictions', 'vipPreview'].some(field => field in payload)) result.vipPreview = previews
  delete result.vip
  delete result.vipPredictions
  // Ces conteneurs ne sont jamais distribués par le site statique.
  delete result.combos
  for (const field of ['free', 'predictions']) {
    if (Array.isArray(payload[field])) result[field] = payload[field].filter(row => !isVipRow(row) && (!retireLegacyAiNumbers || sufficientRecordedEvidence(row))).map(row => retireLegacyAiNumbers ? withoutLegacyAiChoices(row) : row)
  }
  if (retireLegacyAiNumbers && Array.isArray(result.free) && result.stats) {
    result.stats = { ...result.stats, freeCount: result.free.length }
  }
  return result
}
