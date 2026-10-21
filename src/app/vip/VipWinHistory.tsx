'use client'

/**
 * VipWinHistory — « Historique VIP » : les 15 dernières victoires VÉRIFIÉES
 * issues du suivi public (win-history.json, même source que /resultats-verifies).
 *
 * Intégrité :
 *  - Aucune donnée inventée : chaque ligne provient du fichier public généré
 *    par le pipeline (verify-results.mjs / update-win-history.mjs).
 *  - La sélection ne montre que des matchs GAGNÉS (demande produit), mais le
 *    bloc affiche explicitement le taux global réel (gagnés / perdus) et un
 *    lien vers l'historique complet — rien n'est masqué côté données.
 *  - L'historique principal et le reste du site ne sont PAS modifiés.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/components/bttsbet/LanguageSwitcher'
import { localizedPath } from '@/lib/i18n'

interface WinRecord {
  date: string
  match: string
  league?: string
  market?: string
  tier?: string
  proba?: number
  status: string
  finalScore?: string
}

interface WinHistoryPayload {
  stats?: { total?: number; won?: number; lost?: number; rate?: number }
  history?: WinRecord[]
}

const COPY = {
  fr: {
    eyebrow: 'Historique VIP',
    title: 'Les 15 dernières victoires vérifiées',
    sub: 'Sélection réelle des derniers matchs gagnés du suivi public vérifié.',
    date: 'Date',
    match: 'Match',
    market: 'Marché',
    score: 'Score',
    proba: 'Probabilité',
    disclosure: (w: string, l: string, n: string, r: string) =>
      `Historique complet : ${w} gagnés / ${l} perdus sur ${n} résultats vérifiés (${r}, pertes incluses) — tous restent publiés et vérifiables.`,
    cta: 'Voir l\u2019historique complet',
    loading: 'Chargement de l\u2019historique…',
  },
  en: {
    eyebrow: 'VIP history',
    title: 'The last 15 verified wins',
    sub: 'Real selection of the latest winning matches from the public verified tracking.',
    date: 'Date',
    match: 'Match',
    market: 'Market',
    score: 'Score',
    proba: 'Probability',
    disclosure: (w: string, l: string, n: string, r: string) =>
      `Full record: ${w} won / ${l} lost across ${n} verified results (${r}, losses included) — all remain published and verifiable.`,
    cta: 'View the full history',
    loading: 'Loading history…',
  },
  ar: {
    eyebrow: 'سجل VIP',
    title: 'آخر 15 فوزاً موثقاً',
    sub: 'اختيار حقيقي لآخر المباريات الرابحة من التتبع العام الموثق.',
    date: 'التاريخ',
    match: 'المباراة',
    market: 'السوق',
    score: 'النتيجة',
    proba: 'الاحتمال',
    disclosure: (w: string, l: string, n: string, r: string) =>
      `السجل الكامل: ${w} فوز / ${l} خسارة من أصل ${n} نتيجة موثقة (${r}، والخسائر مشمولة) — جميعها منشورة وقابلة للتحقق.`,
    cta: 'عرض السجل الكامل',
    loading: 'جار تحميل السجل…',
  },
} as const

export default function VipWinHistory() {
  const { lang } = useLanguage()
  const t = COPY[lang]
  const [rows, setRows] = useState<WinRecord[] | null>(null)
  const [stats, setStats] = useState<{ won: string; lost: string; total: string; rate: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/win-history.json')
      .then(r => r.json())
      .then((d: WinHistoryPayload) => {
        if (!alive) return
        const won = (d.history ?? []).filter(rec => rec.status === 'WON').slice(0, 15)
        setRows(won)
        const s = d.stats ?? {}
        const verified = Number(s.won ?? 0) + Number(s.lost ?? 0)
        setStats({
          won: String(s.won ?? 0),
          lost: String(s.lost ?? 0),
          total: String(verified),
          rate: verified > 0 ? `${((Number(s.won ?? 0) / verified) * 100).toFixed(1)}%` : '—',
        })
      })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [])

  if (rows !== null && rows.length === 0) return null

  const fmtDate = (d: string) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${d}T12:00:00Z`))
    } catch { return d }
  }
  const marketLabel = (m?: string) =>
    m === 'btts' ? 'BTTS' : m === 'over25' ? (lang === 'fr' ? 'Over 2,5' : 'Over 2.5') : (m ?? '—').toUpperCase()

  return (
    <section className="vipx-shell" aria-labelledby="vip-win-history-title">
      <header className="vipx-section-head">
        <span className="vipx-eyebrow"><i aria-hidden="true" />{t.eyebrow}</span>
        <h2 id="vip-win-history-title">{t.title}</h2>
        <p style={{ color: '#9DABBB', fontSize: 14, marginTop: 6 }}>{t.sub}</p>
      </header>

      <div
        className="vipx-card"
        style={{ overflowX: 'auto' }}
        role="region"
        aria-label={t.title}
      >
        {rows === null ? (
          <p style={{ padding: '1.25rem', color: '#9DABBB', fontSize: 13 }}>{t.loading}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ color: '#6B7A8C', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.12em', textAlign: 'left' }}>
                <th scope="col" style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #223041' }}>{t.date}</th>
                <th scope="col" style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #223041' }}>{t.match}</th>
                <th scope="col" style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #223041' }}>{t.market}</th>
                <th scope="col" style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #223041', textAlign: 'center' }}>{t.score}</th>
                <th scope="col" style={{ padding: '0.75rem 0.85rem', borderBottom: '1px solid #223041', textAlign: 'right' }}>{t.proba}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.match}-${r.date}-${i}`} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(34,48,65,0.5)' : 'none' }}>
                  <td style={{ padding: '0.7rem 0.85rem', color: '#9DABBB', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: '0.7rem 0.85rem', color: '#F2F6FA', fontWeight: 600 }}>
                    {r.match}
                    {r.league ? <span style={{ color: '#6B7A8C', fontWeight: 400 }}> · {r.league}</span> : null}
                  </td>
                  <td style={{ padding: '0.7rem 0.85rem', whiteSpace: 'nowrap' }}>
                    <span className="vipx-market-chip" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#34D399', backgroundColor: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)' }}>
                      {marketLabel(r.market)}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.85rem', textAlign: 'center', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#34D399', whiteSpace: 'nowrap' }}>{r.finalScore ?? '—'}</td>
                  <td style={{ padding: '0.7rem 0.85rem', textAlign: 'right', color: '#9DABBB', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {typeof r.proba === 'number' ? `${Math.round(r.proba * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats && (
        <p style={{ color: '#8FA3B8', fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>
          {t.disclosure(stats.won, stats.lost, stats.total, stats.rate)}{' '}
          <a href={localizedPath('/resultats-verifies', lang)} style={{ color: '#2F7DFF', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            {t.cta} →
          </a>
        </p>
      )}
    </section>
  )
}
