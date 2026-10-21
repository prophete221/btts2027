'use client'

/**
 * Graphiques SVG purs partagés (Vague 2) — aucune dépendance externe.
 * Règle : jamais de donnée inventée — chaque composant reçoit des valeurs
 * réelles et affiche son dénominateur quand un taux est présenté.
 */

export function fmtPct(value: number | string | null | undefined, lang: string): string {
  if (value === null || value === undefined || value === '') return '—'
  const s = String(value)
  return lang === 'fr' ? s.replace('.', ',') : s
}

/** Barre horizontale de répartition (valeur réelle, libellé + dénominateur). */
export function RateBar({ label, rate, won, lost, lang, color = '#2F7DFF', note }: {
  label: string
  rate: number | null
  won: number
  lost: number
  lang: string
  color?: string
  note?: string
}) {
  const total = won + lost
  const pct = rate !== null && total > 0 ? Math.max(0, Math.min(100, rate)) : null
  const verifiedWord = lang === 'fr' ? `vérifié${total > 1 ? 's' : ''}` : lang === 'ar' ? 'موثقة' : 'verified'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-sm font-bold text-[#F2F6FA]">{label}</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {pct !== null ? `${fmtPct(pct.toFixed(1), lang)} %` : '—'}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[#0B0F14] border border-[#223041] overflow-hidden" role="img"
        aria-label={`${label} : ${pct !== null ? fmtPct(pct.toFixed(1), lang) : '—'} % — ${won} WIN / ${lost} LOST / ${total} ${verifiedWord}`}>
        {pct !== null && (
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        )}
      </div>
      <div className="mt-1 text-xs text-[#9DABBB]">
        {won} WIN · {lost} LOST · {total} {verifiedWord}
        {total > 0 && total < 30 && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[12px]" style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#FBBF24' }}>
            {lang === 'fr' ? 'échantillon faible' : lang === 'ar' ? 'عينة صغيرة' : 'small sample'}
          </span>
        )}
        {note && <span className="ml-2">{note}</span>}
      </div>
    </div>
  )
}

/** Barre de composition unique (WIN / LOST — segments optionnels masqués si vides). */
export function CompositionBar({ won, lost, pending = 0, unverifiable = 0, labels, lang = 'fr' }: {
  won: number
  lost: number
  pending?: number
  unverifiable?: number
  labels: { won: string; lost: string; pending?: string; unverifiable?: string }
  lang?: string
}) {
  const total = won + lost + pending + unverifiable
  if (total === 0) return null
  const seg = (v: number) => `${(v / total) * 100}%`
  const verifiedWord = lang === 'fr' ? 'vérifiés' : lang === 'ar' ? 'موثقة' : 'verified'
  const pendingWord = lang === 'fr' ? 'en attente' : lang === 'ar' ? 'قيد الانتظار' : 'pending'
  const unverifiableWord = lang === 'fr' ? 'non vérifiables' : lang === 'ar' ? 'غير قابلة للتحقق' : 'unverifiable'
  return (
    <div>
      <div className="h-4 rounded-full overflow-hidden flex border border-[#223041]" role="img"
        aria-label={`${won} WIN, ${lost} LOST${pending > 0 ? `, ${pending} ${pendingWord}` : ''}${unverifiable > 0 ? `, ${unverifiable} ${unverifiableWord}` : ''} / ${total} ${verifiedWord}`}>
        <div style={{ width: seg(won), backgroundColor: '#34D399' }} />
        <div style={{ width: seg(lost), backgroundColor: '#F87171' }} />
        {pending > 0 && <div style={{ width: seg(pending), backgroundColor: '#FBBF24' }} />}
        {unverifiable > 0 && <div style={{ width: seg(unverifiable), backgroundColor: '#55637A' }} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9DABBB]">
        <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: '#34D399' }} />{labels.won} : {won}</span>
        <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: '#F87171' }} />{labels.lost} : {lost}</span>
        {pending > 0 && labels.pending && (
          <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: '#FBBF24' }} />{labels.pending} : {pending}</span>
        )}
        {unverifiable > 0 && labels.unverifiable && (
          <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ backgroundColor: '#55637A' }} />{labels.unverifiable} : {unverifiable}</span>
        )}
        <span className="text-[#6B7A8C]">/ {total} {verifiedWord}</span>
      </div>
    </div>
  )
}

/** Évolution cumulée des résultats vérifiés (lignes WIN / LOST, données réelles). */
export function CumulativeLine({ points, lang }: {
  points: Array<{ date: string; cumWon: number; cumLost: number }>
  lang: string
}) {
  if (points.length < 2) {
    return <p className="text-xs text-[#9DABBB] py-6 text-center">{lang === 'fr' ? 'Données insuffisantes pour tracer une évolution.' : lang === 'ar' ? 'بيانات غير كافية لتتبع التطور.' : 'Not enough data to plot a trend.'}</p>
  }
  const W = 640, H = 200, PAD_L = 34, PAD_R = 10, PAD_T = 12, PAD_B = 26
  const maxY = Math.max(...points.map(p => Math.max(p.cumWon, p.cumLost)), 1)
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - v / maxY) * (H - PAD_T - PAD_B)
  const path = (key: 'cumWon' | 'cumLost') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const yTicks = [0, Math.round(maxY / 2), maxY]
  const fmtDate = (d: string) => d.slice(5).replace('-', '/')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${lang === 'fr' ? 'Évolution cumulée' : lang === 'ar' ? 'التطور التراكمي' : 'Cumulative trend'} : ${points[points.length - 1].cumWon} WIN, ${points[points.length - 1].cumLost} LOST ${lang === 'fr' ? 'au' : lang === 'ar' ? 'حتى' : 'as of'} ${fmtDate(points[points.length - 1].date)}`}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="#223041" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B7A8C">{t}</text>
          </g>
        ))}
        <path d={path('cumWon')} fill="none" stroke="#34D399" strokeWidth="2.5" />
        <path d={path('cumLost')} fill="none" stroke="#F87171" strokeWidth="2.5" />
        <text x={x(points.length - 1)} y={y(points[points.length - 1].cumWon) - 6} textAnchor="end" fontSize="11" fill="#34D399" fontWeight="bold">
          {points[points.length - 1].cumWon} WIN
        </text>
        <text x={x(points.length - 1)} y={y(points[points.length - 1].cumLost) + 14} textAnchor="end" fontSize="11" fill="#F87171" fontWeight="bold">
          {points[points.length - 1].cumLost} LOST
        </text>
        <text x={PAD_L} y={H - 8} fontSize="11" fill="#6B7A8C">{fmtDate(points[0].date)}</text>
        <text x={W - PAD_R} y={H - 8} textAnchor="end" fontSize="11" fill="#6B7A8C">{fmtDate(points[points.length - 1].date)}</text>
      </svg>
      <p className="text-xs text-[#6B7A8C] mt-1">
        {lang === 'fr' ? 'Cumul des résultats vérifiés, du premier au dernier vérifié. Aucune projection.' :
          lang === 'en' ? 'Cumulative verified results, from first to last verified. No projection.' :
            'النتائج الموثقة التراكمية من الأولى إلى الأخيرة. لا توجد توقعات مستقبلية.'}
      </p>
    </div>
  )
}

/** Barres empilées par jour (WIN au-dessus de LOST) — uniquement des jours réels. */
export function DailyBars({ days, lang }: {
  days: Array<{ date: string; won: number; lost: number }>
  lang: string
}) {
  if (days.length === 0) {
    return <p className="text-xs text-[#9DABBB] py-6 text-center">{lang === 'fr' ? 'Aucune vérification sur la période.' : lang === 'ar' ? 'لا يوجد تحقق خلال الفترة.' : 'No verification over this period.'}</p>
  }
  const max = Math.max(...days.map(d => d.won + d.lost), 1)
  return (
    <div>
      <div className="flex items-end gap-1 h-32" role="img"
        aria-label={days.map(d => `${d.date} : ${d.won} WIN, ${d.lost} LOST`).join('; ')}>
        {days.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            title={`${d.date} — ${d.won} WIN / ${d.lost} LOST`}>
            <div className="w-full flex flex-col justify-end" style={{ height: `${((d.won + d.lost) / max) * 100}%`, minHeight: '4px' }}>
              {d.won > 0 && <div className="w-full rounded-t-sm" style={{ height: `${(d.won / (d.won + d.lost)) * 100}%`, backgroundColor: '#34D399' }} />}
              {d.lost > 0 && <div className="w-full" style={{ height: `${(d.lost / (d.won + d.lost)) * 100}%`, backgroundColor: '#F87171' }} />}
            </div>
            <div className="text-[12px] text-[#6B7A8C] mt-1 hidden sm:block truncate w-full text-center">{d.date.slice(5)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#6B7A8C] mt-2">
        {lang === 'fr' ? `${days.length} jour(s) avec au moins une vérification — WIN en vert, LOST en rouge. Aucun jour inventé.` :
          lang === 'en' ? `${days.length} day(s) with at least one verification — WIN in green, LOST in red. No fabricated days.` :
            `${days.length} يوم بتحقق واحد على الأقل — الأخضر فوز والأحمر خسارة. لا توجد أيام مؤلفة.`}
      </p>
    </div>
  )
}
