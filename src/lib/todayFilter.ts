/**
 * Filtres de date « jour » — fuseau unique Africa/Dakar (UTC+0).
 *
 * La chaîne `todayStr` provient de getDakarDateString() (lib dakar-date).
 * Mission couverture :
 *   - la page /btts/predictions/today n'affiche JAMAIS un match d'une autre
 *     date (le 24 octobre n'apparaît pas sur la page du 20 octobre) ;
 *   - les matchs d'autres dates restent réservés aux pages tomorrow / archives ;
 *   - une ligne sans date exploitable est rejetée du flux du jour.
 */

export type DatedRow = { date?: string | null }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Lignes dont la date Dakar est EXACTEMENT todayStr (strict). */
export function filterDakarTodayRows<T extends DatedRow>(rows: readonly T[], todayStr: string): T[] {
  return (rows || []).filter(r => typeof r?.date === 'string' && ISO_DATE.test(r.date) && r.date === todayStr)
}

/** Lignes postérieures à todayStr (réservées aux pages tomorrow / week / archives). */
export function filterDakarFutureRows<T extends DatedRow>(rows: readonly T[], todayStr: string): T[] {
  return (rows || []).filter(r => typeof r?.date === 'string' && ISO_DATE.test(r.date) && r.date > todayStr)
}

/** Lignes sans date exploitable (jamais affichées, jamais revendiquées comme « à venir »). */
export function filterDakarUndatedRows<T extends DatedRow>(rows: readonly T[]): T[] {
  return (rows || []).filter(r => !(typeof r?.date === 'string' && ISO_DATE.test(r.date)))
}
