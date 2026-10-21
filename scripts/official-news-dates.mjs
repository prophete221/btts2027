const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function calendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1970 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Reject impossible calendars and ambiguous local times; never use modification/match dates. */
export function strictPublicationDate(value, format = 'iso') {
  if (typeof value !== 'string') return null;
  if (format === 'rss') {
    const match = value.trim().match(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(GMT|UTC|[+-]\d{4})$/i);
    if (!match) return null;
    const [, day, monthName, year, hour, minute, second = '0', zone] = match;
    const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
    if (!calendarDate(+year, month, +day) || +hour > 23 || +minute > 59 || +second > 59) return null;
    let offset = 0;
    if (/^[+-]/.test(zone)) {
      const zoneHour = +zone.slice(1, 3);
      const zoneMinute = +zone.slice(3, 5);
      if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return null;
      offset = (zoneHour * 60 + zoneMinute) * (zone[0] === '+' ? 1 : -1);
    }
    return new Date(Date.UTC(+year, month - 1, +day, +hour, +minute - offset, +second)).toISOString();
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/);
  if (!match || !calendarDate(+match[1], +match[2], +match[3])) return null;
  if (match[4] !== undefined) {
    if (+match[4] > 23 || +match[5] > 59 || +match[6] > 59) return null;
    const zone = match[7];
    if (zone !== 'Z' && (+zone.slice(1, 3) > 14 || +zone.slice(4, 6) > 59 || (+zone.slice(1, 3) === 14 && +zone.slice(4, 6) !== 0))) return null;
  }
  return Number.isFinite(Date.parse(value)) ? value : null;
}
