export const DAKAR_TIME_ZONE = 'Africa/Dakar'

function getDateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAKAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  }
}

/** Retourne la date métier courante au format ISO dans le fuseau Africa/Dakar. */
export function getDakarDateString(now = new Date()): string {
  const { year, month, day } = getDateParts(now)
  return `${year}-${month}-${day}`
}

/** Écart calendaire entre une date métier et aujourd'hui à Dakar. */
export function getDakarDayDiff(date: string, now = new Date()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 999
  const dateMs = Date.parse(`${date}T12:00:00Z`)
  const todayMs = Date.parse(`${getDakarDateString(now)}T12:00:00Z`)
  if (!Number.isFinite(dateMs) || !Number.isFinite(todayMs)) return 999
  return Math.round((dateMs - todayMs) / 86_400_000)
}

/**
 * Convertit une date et une heure de calendrier Africa/Dakar en instant.
 * Dakar est UTC+0 ; Date.UTC conserve donc exactement le calendrier métier.
 */
export type DakarMatchStatus = 'upcoming' | 'live' | 'finished'

export function parseDakarDateTime(date: string, time = '12:00'): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null

  const result = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0))
  return Number.isNaN(result.getTime()) ? null : result
}

/** Classe un match selon son horaire de coup d’envoi Africa/Dakar. */
export function getDakarMatchStatus(date: string, time?: string, now = new Date()): DakarMatchStatus {
  if (!date) return 'finished'
  const today = getDakarDateString(now)
  if (date < today) return 'finished'
  if (date > today) return 'upcoming'
  if (!time || time === '--:--' || !/^\d{2}:\d{2}$/.test(time)) return 'upcoming'

  const matchDateTime = parseDakarDateTime(date, time)
  if (!matchDateTime) return 'finished'
  const diffMs = matchDateTime.getTime() - now.getTime()
  if (diffMs < 0 && diffMs >= -(150 * 60 * 1000)) return 'live'
  if (diffMs < 0) return 'finished'
  return 'upcoming'
}

/** Indique si un coup d'envoi est passé, sans en déduire que le match est terminé. */
export function hasDakarKickoffPassed(date: string, time?: string, now = new Date()): boolean {
  if (!date) return false
  const today = getDakarDateString(now)
  if (date < today) return true
  if (date > today || !time || time === '--:--') return false
  const kickoff = parseDakarDateTime(date, time)
  return kickoff !== null && kickoff.getTime() < now.getTime()
}

export function formatDakarDateLabel(date: string, now = new Date()): string {
  const today = getDakarDateString(now)
  const match = parseDakarDateTime(date)
  if (!match) return '--:--'

  const diffDays = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)
  if (diffDays === 0) return 'Auj.'
  if (diffDays === 1) return 'Dem.'

  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: DAKAR_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(match)
}

export function getDakarDateSeed(now = new Date()): number {
  return Number(getDakarDateString(now).replaceAll('-', ''))
}
