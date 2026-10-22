'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { localizedPath } from '@/lib/i18n'
import { COMBO_I18N } from '@/lib/i18n-extras'
import { generateMatchSlug } from '@/lib/match-slug'
import { hasDakarKickoffPassed } from '@/lib/dakar-date'

/**
 * ComboBuilder — Générateur de Combiné Intelligente (AI Combo Builder).
 *
 * Widget interactif placé en tête du Match Center :
 *  - l'utilisateur choisit une cote cible (1.80 / 2.50 / 3.00 / 5.00 / 8.00)
 *    et le nombre de matchs du combiné (2 à 5) ;
 *  - le moteur assemble automatiquement, parmi les sélections à venir du jour
 *    et des jours suivants, la combinaison dont le produit de cotes est le plus
 *    proche de la cote cible, en ne retenant QUE les probabilités ≥ 65 % et en
 *    maximisant la probabilité combinée à qualité de cote égale.
 *
 * Données 100 % réelles (predictions.json) : BTTS et Over 2.5 du modèle Poisson,
 * cotes bookmaker ESPN/DraftKings quand disponibles, estimation Poisson sinon.
 * Un seul pick par match ; recherche exhaustive bornée (≤ C(16,5) = 4 368
 * combinaisons) exécutée côté client, sans aucun appel réseau.
 */

interface ComboSource {
  match: string
  home: string
  away: string
  league: string
  date: string
  time: string
  homeLogo?: string
  awayLogo?: string
  bttsProb?: number
  over25Prob?: number
  estimatedCoteBTTS?: number
  estimatedCoteOver?: number
  odds?: { provider?: string; over25?: number | null } | null
}

interface ComboPick {
  key: string
  match: string
  home: string
  away: string
  league: string
  date: string
  time: string
  homeLogo?: string
  awayLogo?: string
  market: 'BTTS' | 'O2.5'
  label: string
  prob: number
  odds: number
  href: string
}

const MIN_PROB = 0.65
const TARGET_ODDS = [1.8, 2.5, 3.0, 5.0, 8.0] as const
const MATCH_COUNTS = [2, 3, 4, 5] as const
const MAX_CANDIDATES = 16
const STAKE = 10

const round2 = (v: number) => Math.round(v * 100) / 100

/** Candidats réels : un pick BTTS + un pick Over 2.5 par match à venir, prob ≥ 65 %. */
function buildCandidates(items: ComboSource[], lang: Locale): ComboPick[] {
  const yes = lang === 'en' ? 'Yes' : lang === 'ar' ? 'نعم' : 'Oui'
  const picks: ComboPick[] = []
  for (const m of items || []) {
    if (!m.home || !m.away || !m.date) continue
    // Aucun match déjà commencé — le combiné ne propose que des coups d'envoi futurs.
    if (hasDakarKickoffPassed(m.date, m.time)) continue
    const href = localizedPath(`/match/${generateMatchSlug(m.home, m.away, m.date)}`, lang)
    const base = {
      key: '', match: m.match, home: m.home, away: m.away, league: m.league,
      date: m.date, time: m.time, homeLogo: m.homeLogo, awayLogo: m.awayLogo, href,
    }

    const bttsProb = m.bttsProb ?? 0
    const bttsOdds = m.estimatedCoteBTTS ?? (bttsProb > 0 ? round2(1 / bttsProb) : 0)
    if (bttsProb >= MIN_PROB && bttsOdds > 1.01) {
      picks.push({ ...base, key: `${m.home}|${m.away}|${m.date}|BTTS`, market: 'BTTS', prob: bttsProb, odds: bttsOdds, label: yes })
    }

    const o25Prob = m.over25Prob ?? 0
    const o25Odds = m.odds?.over25 ?? m.estimatedCoteOver ?? (o25Prob > 0 ? round2(1 / o25Prob) : 0)
    if (o25Prob >= MIN_PROB && o25Odds > 1.01) {
      picks.push({ ...base, key: `${m.home}|${m.away}|${m.date}|O25`, market: 'O2.5', prob: o25Prob, odds: o25Odds, label: yes })
    }
  }
  // Meilleures probabilités d'abord, volume borné pour la recherche exhaustive.
  return picks.sort((a, b) => b.prob - a.prob).slice(0, MAX_CANDIDATES)
}

/**
 * Recherche exhaustive (bornée) : combinaison de n picks, un seul par match,
 * produit de cotes le plus proche de la cible (en échelle log), tie-break
 * probabilité combinée maximale.
 */
function bestCombo(cands: ComboPick[], n: number, target: number): ComboPick[] | null {
  if (cands.length < n) return null
  type ComboResult = { picks: ComboPick[]; score: number; prob: number }
  // Wrapper immuable : TS rétrécit mal une variable let mutée dans une closure.
  const best: { current: ComboResult | null } = { current: null }
  const chosen: ComboPick[] = []
  const usedMatches = new Set<string>()
  const matchKey = (p: ComboPick) => `${p.home}|${p.away}|${p.date}`

  const rec = (start: number) => {
    if (chosen.length === n) {
      let odds = 1
      let prob = 1
      for (const p of chosen) { odds *= p.odds; prob *= p.prob }
      const score = Math.abs(Math.log(odds) - Math.log(target))
      const current = best.current
      if (!current || score < current.score - 1e-9 || (Math.abs(score - current.score) < 1e-9 && prob > current.prob)) {
        best.current = { picks: [...chosen], score, prob }
      }
      return
    }
    for (let i = start; i < cands.length; i++) {
      if (cands.length - i < n - chosen.length) break
      const cand = cands[i]
      const mk = matchKey(cand)
      if (usedMatches.has(mk)) continue
      chosen.push(cand)
      usedMatches.add(mk)
      rec(i + 1)
      chosen.pop()
      usedMatches.delete(mk)
    }
  }
  rec(0)
  return best.current?.picks ?? null
}

export default function ComboBuilder({ items, lang }: { items: ComboSource[]; lang: Locale }) {
  const t = COMBO_I18N[lang]
  const [target, setTarget] = useState<number>(3.0)
  const [count, setCount] = useState<number>(3)
  const [copied, setCopied] = useState(false)

  const candidates = useMemo(() => buildCandidates(items, lang), [items, lang])

  const combo = useMemo(() => bestCombo(candidates, count, target), [candidates, count, target])

  const combinedOdds = combo ? round2(combo.reduce((s, p) => s * p.odds, 1)) : 0
  const combinedProb = combo ? combo.reduce((s, p) => s * p.prob, 1) : 0

  const pct = (v: number, digits = 1) =>
    `${(v * 100).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR', { maximumFractionDigits: digits })} %`
  const fmtOdds = (v: number) => v.toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const comboText = combo
    ? `${t.title} — ${t.targetOdds} ${fmtOdds(target)}\n` +
      combo.map(p => `${p.home} vs ${p.away} — ${p.market === 'BTTS' ? 'BTTS' : 'Over 2.5'} ${p.label} @${fmtOdds(p.odds)} (${pct(p.prob)})`).join('\n') +
      `\n${t.combinedOdds}: ${fmtOdds(combinedOdds)} · ${t.combinedProb}: ${pct(combinedProb)} · bttspredict.com`
    : ''

  const onCopy = async () => {
    if (!comboText) return
    try {
      await navigator.clipboard.writeText(comboText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch { /* clipboard indisponible — silencieux */ }
  }

  return (
    <div className="combox rounded-2xl border border-[#223041] bg-gradient-to-b from-[#141C25] to-[#10161D] p-4 sm:p-5 mb-6" data-component="combo-builder">
      {/* En-tête */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#2F7DFF]">{t.eyebrow}</span>
        <h3 className="text-lg font-bold text-[#F2F6FA]" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.title}</h3>
      </div>
      <p className="text-xs text-[#9DABBB] mb-4 leading-relaxed">{t.subtitle}</p>

      {/* Contrôles : cote cible + nombre de matchs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div role="group" aria-label={t.targetOdds}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9DABBB] mb-1.5">{t.targetOdds}</p>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_ODDS.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(v)}
                aria-pressed={target === v}
                className={`cbx-chip${target === v ? ' is-active' : ''}`}
              >
                {fmtOdds(v)}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label={t.matchCount}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9DABBB] mb-1.5">{t.matchCount}</p>
          <div className="flex flex-wrap gap-1.5">
            {MATCH_COUNTS.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setCount(v)}
                aria-pressed={count === v}
                className={`cbx-chip${count === v ? ' is-active' : ''}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Résultat */}
      {combo ? (
        <div className="rounded-xl border border-[#223041] bg-[#0B0F14] overflow-hidden">
          {/* Bandeau métriques */}
          <div className="grid grid-cols-3 divide-x divide-[#223041] border-b border-[#223041] bg-[#141C25]">
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9DABBB] font-bold">{t.combinedOdds}</p>
              <p className="text-lg font-bold text-[#6EE787] font-mono leading-tight">{fmtOdds(combinedOdds)}</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9DABBB] font-bold">{t.combinedProb}</p>
              <p className="text-lg font-bold text-[#F2F6FA] font-mono leading-tight">{pct(combinedProb)}</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[#9DABBB] font-bold">{t.potentialReturn}</p>
              <p className="text-lg font-bold text-[#F2F6FA] font-mono leading-tight">{round2(combinedOdds * STAKE).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR')}</p>
            </div>
          </div>
          {/* Sélections */}
          <ul className="divide-y divide-[#1B2733]">
            {combo.map(p => (
              <li key={p.key} className="flex items-center gap-2.5 px-3 py-2.5">
                <span className="flex -space-x-1.5 shrink-0" aria-hidden="true">
                  {p.homeLogo && <img src={p.homeLogo} alt="" width={20} height={20} loading="lazy" className="rounded-full bg-[#141C25]" />}
                  {p.awayLogo && <img src={p.awayLogo} alt="" width={20} height={20} loading="lazy" className="rounded-full bg-[#141C25]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-[#F2F6FA] truncate">
                    {p.home} — {p.away}
                  </span>
                  <span className="block text-[11px] text-[#9DABBB] truncate">{p.league} · {p.date} {p.time ? `· ${p.time}` : ''}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] font-bold text-[#2F7DFF]">{p.market === 'BTTS' ? 'BTTS' : 'Over 2.5'} {p.label}</span>
                  <span className="block text-[10px] text-[#9DABBB] font-mono">{pct(p.prob, 0)} @ {fmtOdds(p.odds)}</span>
                </span>
                <a href={p.href} className="cbx-link shrink-0" data-cta={`combo-open-${p.market}`}>{t.openAnalysis}</a>
              </li>
            ))}
          </ul>
          {/* Pied : copie + disclaimer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#223041] bg-[#141C25] px-3 py-2.5">
            <button type="button" onClick={onCopy} className="cbx-copy" data-cta="combo-copy">
              {copied ? t.copied : t.copy}
            </button>
            <span className="text-[10px] text-[#9DABBB]">{t.disclaimer}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#223041] bg-[#0B0F14] px-4 py-5 text-center">
          <p className="text-xs text-[#9DABBB] leading-relaxed">{t.none}</p>
          <p className="text-[10px] text-[#5B6B7C] mt-2">{t.minProbLabel} : ≥ 65 % · {t.selections} : {candidates.length}</p>
        </div>
      )}
    </div>
  )
}
