const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  return [
    ...(Array.isArray(payload?.free) ? payload.free : []),
    ...(Array.isArray(payload?.vipPreview) ? payload.vipPreview : []),
  ]
}

export function validatePredictionPayload(payload, options = {}) {
  const errors = []
  const today = options.today || new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Dakar' })
  const requireTimestamp = options.requireTimestamp === true
  const checkKickoff = options.checkKickoff === true
  const now = options.now instanceof Date ? options.now : new Date()

  if (!payload || typeof payload !== 'object') {
    return ['payload must be an object']
  }
  if (!ISO_DATE.test(payload.date || '')) errors.push('top-level date must be YYYY-MM-DD')
  else if (payload.date !== today) errors.push('top-level date is not Africa/Dakar today')
  if (requireTimestamp && !ISO_TIMESTAMP.test(payload.lastUpdated || '')) {
    errors.push('lastUpdated must be an ISO UTC timestamp')
  }

  const rows = rowsFromPayload(payload)
  if (rows.length === 0) errors.push('payload must contain at least one free or vipPreview prediction')

  rows.forEach((prediction, index) => {
    const prefix = `prediction[${index}]`
    // Ligne « données limitées » (match réel sans pronostic) : pas de probabilité,
    // pas de λ, pas de cote — seuls les champs d'identité et de traçabilité sont exigés.
    const isLimitedRow = prediction?.dataLimited === true
    const identityFields = ['id', 'match', 'home', 'away', 'league', 'date']
    const requiredFields = isLimitedRow ? identityFields : [...identityFields, 'type', 'prediction']
    for (const field of requiredFields) {
      if (typeof prediction?.[field] !== 'string' || prediction[field].trim() === '') {
        errors.push(`${prefix}.${field} is required`)
      }
    }
    if (isLimitedRow && (typeof prediction?.type === 'string' && prediction.type.trim() !== '')) {
      errors.push(`${prefix}.type must be null for a limited-data listing row`)
    }
    if (isLimitedRow && (prediction?.proba != null || prediction?.bttsProb != null || prediction?.over25Prob != null || prediction?.estimatedCote != null)) {
      errors.push(`${prefix} is marked dataLimited but carries a probability or odds — invented values are forbidden`)
    }
    if (!ISO_DATE.test(prediction?.date || '')) errors.push(`${prefix}.date must be YYYY-MM-DD`)
    else if (prediction.date < today) errors.push(`${prefix}.date is older than Africa/Dakar today`)
    if (typeof prediction?.proba !== 'number' || prediction.proba < 0 || prediction.proba > 1) {
      if (!isLimitedRow || prediction?.proba != null) errors.push(`${prefix}.proba must be between 0 and 1`)
    }
    if (typeof prediction?.reliabilityScore !== 'number' || prediction.reliabilityScore < 0 || prediction.reliabilityScore > 100) {
      if (!isLimitedRow || prediction?.reliabilityScore != null) errors.push(`${prefix}.reliabilityScore must be between 0 and 100`)
    }
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(prediction?.dataQuality)) {
      errors.push(`${prefix}.dataQuality must be HIGH, MEDIUM or LOW`)
    }
    if (typeof prediction?.dataSource !== 'string' || prediction.dataSource.trim() === '') {
      errors.push(`${prefix}.dataSource is required`)
    }
    if (prediction?.time && !/^\d{2}:\d{2}$/.test(prediction.time)) {
      errors.push(`${prefix}.time must be HH:MM when present`)
    }
    if (checkKickoff && prediction?.date === today && /^\d{2}:\d{2}$/.test(prediction.time || '')) {
      const kickoff = Date.parse(`${prediction.date}T${prediction.time}:00Z`)
      if (Number.isFinite(kickoff) && kickoff <= now.getTime()) {
        errors.push(`${prefix}.time is already started in Africa/Dakar`)
      }
    }
  })

  return errors
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] || 'public/predictions.json'
  const payload = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(file, 'utf8')))
  const errors = validatePredictionPayload(payload, {
    requireTimestamp: process.argv.includes('--require-timestamp'),
    checkKickoff: true,
  })
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else {
    console.log(`Valid predictions payload: ${file}`)
  }
}
