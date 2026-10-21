'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

/**
 * WinHistory (V7 — Clean credibility)
 * - No ROI, no Profit, no Cote moy, no Filtre proba displayed
 * - 2 clean cards: All Picks + Gold Picks (or "Phase d'optimisation")
 * - Header: "Historique Vérifié — N matchs vérifiés via ESPN"
 * - Footer: link to /methodologie
 */
export default function WinHistory() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/win-history.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <section id="win-history" className="py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#2F7DFF]/30 border-t-[#2F7DFF] rounded-full animate-spin" />
        </div>
      </section>
    )
  }

  if (!data || !data.stats) {
    return (
      <section id="win-history" className="py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-[#9DABBB]">Données non disponibles.</p>
        </div>
      </section>
    )
  }

  const stats = data.stats
  const verifiedHistory = Array.isArray(data.history)
    ? data.history.filter((h: any) => h.status === 'WON' || h.status === 'LOST')
    : []
  const gold = stats.gold || { total: 0, won: 0, lost: 0, rate: 0 }
  const hasGold = gold.total >= 10
  const goldReady = gold.rate >= 55
  const goldBuilding = gold.total > 0 && gold.total < 10
  const majTime = new Date(data.generatedAt).toLocaleTimeString('fr-FR')

  return (
    <section id="win-history" className="py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F2F6FA]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Historique Vérifié — <span className="text-[#2F7DFF]">{stats.total} matchs vérifiés via ESPN</span>
          </h2>
        </div>

        {/* Bandeau compact */}
        <div className="rounded-[16px] bg-[#1A242F] border border-[#6B7A8C]/50 p-3 flex items-center justify-between text-xs text-[#9DABBB]">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#34D399] rounded-full animate-pulse"></span>
            {stats.total} vérifiés
          </span>
          <span className="text-[#9DABBB]">
            ESPN public · Maj {majTime}
          </span>
        </div>

        {/* KPI Cards: All vs Gold */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Carte 1 — All Picks */}
          <div className="rounded-[16px] bg-[#141C25] border border-[#6B7A8C] p-5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.22)' }}>
            <div className="text-[10px] text-[#9DABBB] uppercase tracking-widest">Tous les pronos</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-white font-mono">{stats.rate}%</div>
              <div className="text-xs text-[#9DABBB]">{stats.won}W/{stats.lost}L</div>
            </div>
            <div className="mt-2 text-[10px] text-[#9DABBB]">
              {stats.total} vérifiés (W+L) • Pertes incluses dans le taux • Vérifié via ESPN • Maj {majTime}
            </div>
            <div className="mt-3 h-1.5 bg-[#0B0F14] rounded-full">
              <div className="h-full bg-[#34D399] rounded-full transition-all duration-700" style={{ width: `${stats.rate}%` }}></div>
            </div>
          </div>

          {/* Carte 2 — Gold Picks */}
          {hasGold && goldReady && (
            <div className="rounded-[16px] bg-[#1A242F] border border-[#2F7DFF]/42 p-5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.22)' }}>
              <div className="text-[10px] text-[#E8C268] uppercase tracking-widest font-bold">Gold Picks</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-bold text-[#F2F6FA] font-mono">{gold.rate}%</div>
                <div className="text-xs text-[#9DABBB]">{gold.won}W/{gold.lost}L</div>
              </div>
              <div className="mt-2 text-[10px] text-[#9DABBB]">
                {gold.total} vérifiés
              </div>
              <div className="mt-3 h-1.5 bg-[#0B0F14] rounded-full">
                <div className="h-full bg-[#34D399] rounded-full transition-all duration-700" style={{ width: `${gold.rate}%` }}></div>
              </div>
            </div>
          )}
          {hasGold && !goldReady && (
            <div className="rounded-[16px] bg-[#1A242F] border border-[#6B7A8C] p-5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.22)' }}>
              <div className="text-[10px] text-[#E8C268] uppercase tracking-widest font-bold">Gold Picks</div>
              <div className="mt-2 text-sm text-[#9DABBB]">
                {gold.total} vérifiés • Phase d'optimisation — Objectif 60%+
              </div>
            </div>
          )}
          {goldBuilding && (
            <div className="rounded-[16px] bg-[#1A242F] border border-[#6B7A8C] p-5">
              <div className="text-[10px] text-[#E8C268] uppercase tracking-widest font-bold">Gold Picks</div>
              <div className="mt-2 text-sm text-[#9DABBB]">
                {gold.total} vérifiés • Phase d'optimisation — Objectif 60%+
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[11px] text-[#9DABBB] px-1">
          Source: ESPN public • Vérifiable match par match ci-dessous •{' '}
          <Link href="/methodologie" className="underline hover:text-[#9DABBB]">Comment on vérifie?</Link>
        </div>

        {/* Trend 14j */}
        {stats.trend14 && stats.trend14.length > 0 && (
          <div className="rounded-[16px] bg-[#141C25] border border-[#6B7A8C] p-4">
            <h3 className="text-sm font-bold text-[#F2F6FA] mb-3">Tendance 14 jours</h3>
            <div className="flex items-end gap-1 h-24">
              {stats.trend14.map((d: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(d.rate, 4)}%`,
                      backgroundColor: d.rate >= 55 ? '#2F7DFF' : d.rate >= 40 ? '#2F7DFF' : '#F87171',
                      minHeight: '4px',
                    }}
                    title={`${d.date}: ${d.rate}% (${d.won}W/${d.lost}L)`}
                  />
                  <span className="text-[10px] text-[#9DABBB]">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History table */}
        {verifiedHistory.length > 0 && (
          <div className="rounded-[16px] bg-[#141C25] border border-[#6B7A8C] p-4">
            <h3 className="text-sm font-bold text-[#F2F6FA] mb-3">Derniers résultats vérifiés</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {verifiedHistory.slice(0, 30).map((h: any, i: number) => {
                const isWon = h.status === 'WON' || h.isWon === true
                const isGold = (h.tier || 'STANDARD').toUpperCase() === 'GOLD'
                const market = (h.type || h.market || '').includes('Over') ? 'O2.5' : (h.type || h.market || 'BTTS')
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-[#6B7A8C]/30">
                    <span className="text-[#9DABBB] font-mono flex-shrink-0">{(h.date || '').slice(5)}</span>
                    <span className="text-[#9DABBB] truncate flex-1">{h.match}</span>
                    <span className="text-[#9DABBB] flex-shrink-0">{market}</span>
                    <span className="text-[#F2F6FA] font-mono flex-shrink-0">{h.finalScore || h.score || '-'}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                        isWon ? 'bg-[#34D399]/14 text-[#34D399]' : 'bg-[#F87171]/14 text-[#F87171]'
                      }`}
                    >
                      {isWon ? 'W' : 'L'}
                    </span>
                    {isGold && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#34D399]/14 text-[#34D399] flex-shrink-0">
                        GOLD
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="text-[10px] text-[#9DABBB] text-center pt-2">
          Les performances passées ne garantissent pas les résultats futurs. 18+ — Jeu responsable.
        </div>
      </div>
    </section>
  )
}
