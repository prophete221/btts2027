import { loadTeamContext, type TeamContextEntry } from '@/lib/team-context'

export type TeamContextProps = {
  home: string
  away: string
  locale: string
}

const COPY = {
  fr: {
    heading: 'Contexte des équipes',
    news: 'Actualités récentes',
    empty: 'Aucune actualité récente admissible dans les sources consultées',
    error: 'Actualités temporairement indisponibles',
    original: 'Titre original (anglais)',
    checked: 'Sources consultées le',
    image: 'Image',
    team: 'Équipe',
    stadium: (name: string) => `Stade de ${name}`,
    credit: 'Crédit photo',
    source: 'Source',
    license: 'Licence',
    official: (name: string) => `Consulter le site officiel de ${name}`,
    wikidata: 'Fiche de référence Wikidata',
    officialSource: 'Source officielle',
  },
  en: {
    heading: 'Team context',
    news: 'Recent news',
    empty: 'No eligible recent news in the sources consulted',
    error: 'News temporarily unavailable',
    original: 'Original title (English)',
    checked: 'Sources checked',
    image: 'Image',
    team: 'Team',
    stadium: (name: string) => `${name} stadium`,
    credit: 'Photo credit',
    source: 'Source',
    license: 'License',
    official: (name: string) => `Visit ${name}'s official website`,
    wikidata: 'Wikidata reference entry',
    officialSource: 'Official source',
  },
  ar: {
    heading: 'سياق الفريقين',
    news: 'أخبار حديثة',
    empty: 'لا تتوفر أخبار حديثة مسموح بإعادة نشرها في المصادر التي تمت مراجعتها',
    error: 'الأخبار غير متاحة مؤقتًا',
    original: 'العنوان الأصلي (بالإنجليزية)',
    checked: 'تاريخ مراجعة المصادر',
    image: 'صورة',
    team: 'الفريق',
    stadium: (name: string) => `ملعب ${name}`,
    credit: 'حقوق الصورة',
    source: 'المصدر',
    license: 'الترخيص',
    official: (name: string) => `زيارة الموقع الرسمي لفريق ${name}`,
    wikidata: 'صفحة مرجعية في ويكي بيانات',
    officialSource: 'المصدر الرسمي',
  },
} as const

export function displayDate(value: string, locale: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  try {
    // A source giving only a month/year must never acquire an invented day.
    if (/^\d{4}$/.test(value)) return value
    if (/^\d{4}-\d{2}$/.test(value)) return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0] ?? '?').slice(0, 2)).toLocaleUpperCase()
}

function TeamCard({ team, name, locale, copy, readError }: {
  team: TeamContextEntry | undefined
  name: string
  locale: string
  copy: (typeof COPY)[keyof typeof COPY]
  readError: boolean
}) {
  const unavailable = readError || Boolean(team && ['error', 'failed', 'unavailable'].includes(team.newsStatus.toLowerCase()))
  const news = team?.news ?? []

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{team?.name ?? name}</h3>
      {team?.image ? (
        <figure className="mb-4 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          {/* Collector-managed local artwork; attribution remains visible beneath the image. */}
          <img src={team.image.url} alt={team.image.caption} className="aspect-[16/9] w-full object-contain" loading="lazy" />
          <figcaption className="space-y-1 p-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-medium">{team.image.kind === 'stadium' ? copy.stadium(team.name) : copy.team}: {team.image.caption}</p>
            <p>{copy.credit}: {team.image.author} · {displayDate(team.image.date, locale)}</p>
            <p><a className="underline" href={team.image.sourceUrl} target="_blank" rel="noopener noreferrer">{copy.source}: Commons</a> · <a className="underline" href={team.image.licenseUrl} target="_blank" rel="noopener noreferrer">{copy.license}: {team.image.license}</a></p>
          </figcaption>
        </figure>
      ) : (
        <div aria-label={team?.name ?? name} className="mb-4 flex aspect-[16/9] items-center justify-center rounded-lg bg-slate-100 text-3xl font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {initials(team?.name ?? name)}
        </div>
      )}

      <h4 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">{copy.news}</h4>
      {unavailable ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{copy.error}</p>
      ) : news.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {news.slice(0, 3).map((item, index) => (
            <li key={`${item.url}-${index}`} className="border-t border-slate-100 pt-2 text-sm dark:border-slate-700">
              <a className="font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-300" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.source === 'Official' ? `${item.publisher} · ${displayDate(item.publishedAt ?? '', locale)}` : `${copy.original} · ${item.source} · ${displayDate(item.publishedAt ?? '', locale)}`}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{item.source === 'Official' ? <a className="underline" href={item.attributionUrl} target="_blank" rel="noopener noreferrer">{copy.officialSource}</a> : <a className="underline" href={item.licenseUrl ?? item.url} target="_blank" rel="noopener noreferrer">{copy.license}: {item.license}</a>}</p>
            </li>
          ))}
        </ul>
      )}
      {team?.officialUrl && <p className="mt-3 text-sm"><a className="font-medium text-blue-700 underline dark:text-blue-300" href={team.officialUrl} target="_blank" rel="noopener noreferrer">{copy.official(team.name)}</a></p>}
      {team?.entityUrl && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><a className="underline" href={team.entityUrl} target="_blank" rel="noopener noreferrer">{copy.wikidata}</a></p>}
      {team?.checkedAt && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{copy.checked}: {displayDate(team.checkedAt, locale)}</p>}
    </article>
  )
}

/** Server component: reads only the local public JSON and never makes network requests. */
export default function TeamContext({ home, away, locale }: TeamContextProps) {
  const copy = locale.toLowerCase().startsWith('ar') ? COPY.ar : locale.toLowerCase().startsWith('en') ? COPY.en : COPY.fr
  const document = loadTeamContext()
  const teams = document?.teams ?? {}
  const direction = locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'

  return (
    <section aria-label={copy.heading} dir={direction} className="my-6">
      <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{copy.heading}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TeamCard team={teams[home]} name={home} locale={locale} copy={copy} readError={document === null} />
        <TeamCard team={teams[away]} name={away} locale={locale} copy={copy} readError={document === null} />
      </div>
    </section>
  )
}
