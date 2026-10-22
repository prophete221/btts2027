'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScrollAnimation } from '@/hooks/useAnimations'
import { AFFILIATE } from '@/lib/constants'
import { resolveTeamLogo } from '@/lib/teamLogos'
import PremiumButton from './PremiumButton'
import { useLanguage } from './LanguageSwitcher'
import { translationsFor, type Locale, localizedPath } from '@/lib/i18n'
import { generateMatchSlug } from '@/lib/match-slug'
import { trackAffiliateAction } from '@/lib/affiliateTracking'
import { humanMethodLabel, predictionQuality, type PredictionQuality as DataQuality } from '@/lib/predictionQuality'
import { analysisHeading } from '@/lib/predictionPresentation'
import { getDakarDayDiff, getDakarMatchStatus, parseDakarDateTime } from '@/lib/dakar-date'

// ─── Helpers ────────────────────────────────────────────────────────────
function getMatchStatus(date: string, time?: string): 'live' | 'upcoming' | 'past' {
  const status = getDakarMatchStatus(date, time)
  return status === 'finished' ? 'past' : status
}

function getTimeUntil(date: string, time?: string): { value: string; label: string } | null {
  if (!date || !time || time === '--:--' || !/^\d{2}:\d{2}$/.test(time)) return null
  try {
    const matchDateTime = parseDakarDateTime(date, time)
    if (!matchDateTime) return null
    const diffMs = matchDateTime.getTime() - Date.now()
    if (diffMs < 0) return null
    const diffMin = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays > 0) return { value: `J-${diffDays}j`, label: 'dans' }
    if (diffHours > 0) return { value: `${diffHours}h${diffMin % 60 ? ` ${diffMin % 60}m` : ''}`, label: 'dans' }
    return { value: `${diffMin}min`, label: 'dans' }
  } catch { return null }
}

function formatDateShort(dateStr: string, lang: 'fr' | 'en' | 'ar' = 'fr') {
  if (!dateStr) return ''
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: 'Africa/Dakar' }).format(d)
    const month = new Intl.DateTimeFormat('en-GB', { month: '2-digit', timeZone: 'Africa/Dakar' }).format(d)
    const diffDays = getDakarDayDiff(dateStr)
    const labels = lang === 'en' ? { today: 'Today', tomorrow: 'Tomorrow', weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] } : lang === 'ar' ? { today: 'اليوم', tomorrow: 'غداً', weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] } : { today: "Aujourd'hui", tomorrow: 'Demain', weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] }
    if (diffDays === 0) return labels.today
    if (diffDays === 1) return labels.tomorrow
    return `${labels.weekdays[d.getUTCDay()]} ${day}/${month}`
  } catch { return dateStr }
}

interface Prediction {
  type: string
  prediction: string
  confidence: number
  bttsProb?: number
  over25Prob?: number
  homeLambda?: number
  awayLambda?: number
}

interface MatchData {
  match: string
  league: string
  date: string
  time: string
  homeLogo: string
  awayLogo: string
  predictions: Prediction[]
  reliabilityScore?: number
  xgTotal?: number
  analysis?: string
  aiExactScore?: string
  exactScoreProb?: string
  aiBttsProb?: string
  aiOver25Prob?: string
  aiKeyFact?: string
  aiAnalysis?: string
  aiFormSummary?: string
  aiAbsences?: string
  aiOddsInsight?: string
  // Traductions anglaises générées par le pipeline (fallback : champ français)
  aiKeyFactEn?: string
  aiAnalysisEn?: string
  aiFormSummaryEn?: string
  aiAbsencesEn?: string
  aiOddsInsightEn?: string
  odds?: { provider?: string; home?: number | null; draw?: number | null; away?: number | null; over25?: number | null; under25?: number | null } | null
  quality?: DataQuality
}

// ─── Probability Bar — visual representation of Poisson model ────────────
function ProbabilityBar({ value, prediction, color = 'green' }: { value: number; prediction: string; color?: 'green' | 'gold' }) {
  const percentage = Math.round(value * 100)
  const isPositive = prediction === 'Oui'
  const fillColor = color === 'gold' ? 'var(--color-gold)' : 'var(--color-success)'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-bold ${isPositive ? 'text-success-light' : 'text-cendre'}`}>
          {prediction}
        </span>
        <span className="text-cendre tabular-nums mono font-semibold">{percentage}%</span>
      </div>
      <div className="relative h-2 bg-dark-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${fillColor}aa, ${fillColor})`,
            boxShadow: `0 0 12px ${fillColor}66`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Team Logo ──────────────────────────────────────────────────────────
function TeamLogo({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const initials = name?.slice(0, 3).toUpperCase() || '?'

  if (!src || imgError) {
    return (
      <div
        className="rounded-xl bg-gradient-to-br from-papier to-papier border border-edge flex items-center justify-center text-success font-bold flex-shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.28 }}
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`${name} logo`}
      className="rounded-xl object-contain flex-shrink-0 border border-edge bg-dark-800 p-1"
      style={{ width: size, height: size }}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setImgError(true)}
    />
  )
}

// ─── Prediction Card — main component (rich, with BTTS + O2.5 separately) ─
// ─── Poisson: recompute a missing market ONLY from real lambdas ─────────
// If a match has BTTS but not Over 2.5 (or vice versa) AND the payload
// carries real expected goals, we compute the missing market from those
// real lambdas. No invented lambda, no clamped percentage: without real
// inputs the card shows an honest "Données insuffisantes" state.

function poissonP(k: number, lambda: number): number {
  return Math.pow(lambda, k) * Math.exp(-lambda) / factorial(k)
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/**
 * Compute P(Over 2.5) from home/away lambdas.
 * P(Over 2.5) = 1 - P(0) - P(1) - P(2) where P(total) = sum over i+j=total of P_home(i)*P_away(j)
 */
function computeOver25(homeLambda: number, awayLambda: number): number {
  // P(total goals = n) = sum_{i=0..n} P_home(i) * P_away(n-i)
  const pTotal = (n: number): number => {
    let sum = 0
    for (let i = 0; i <= n; i++) {
      const j = n - i
      sum += poissonP(i, homeLambda) * poissonP(j, awayLambda)
    }
    return sum
  }
  // P(Over 2.5) = 1 - P(0) - P(1) - P(2)
  return Math.max(0, Math.min(1, 1 - pTotal(0) - pTotal(1) - pTotal(2)))
}

/**
 * Compute P(BTTS) from home/away lambdas.
 * P(BTTS) = 1 - P(home=0) - P(away=0) + P(home=0 AND away=0)
 * P(home=0) = exp(-homeLambda), P(away=0) = exp(-awayLambda)
 * P(home=0 AND away=0) = exp(-homeLambda) * exp(-awayLambda)
 */
function computeBtts(homeLambda: number, awayLambda: number): number {
  const pHome0 = Math.exp(-homeLambda)
  const pAway0 = Math.exp(-awayLambda)
  const pBoth0 = pHome0 * pAway0
  // P(BTTS) = 1 - P(home=0) - P(away=0) + P(both=0)
  return Math.max(0, Math.min(1, 1 - pHome0 - pAway0 + pBoth0))
}

// ─── PredictionCard ──────────────────────────────────────────────────────
function PredictionCard({ match, index, initialLocale }: { match: MatchData; index: number; initialLocale?: Locale }) {
  const [expanded, setExpanded] = useState(false)
  const { lang: detectedLang } = useLanguage()
  const lang = initialLocale ?? detectedLang
  const t = translationsFor(lang)
  const teams = match.match.split(/\s+vs?\s+/i)
  const home = teams[0]?.trim() || ''
  const away = teams[1]?.trim() || ''
  const homeLogo = match.homeLogo || resolveTeamLogo(home)
  const awayLogo = match.awayLogo || resolveTeamLogo(away)
  // Slug officiel partagé avec le SSG de /match/[slug] (src/lib/match-slug.ts)
  // — garantit un lien interne sans 404, préfixé par la locale courante.
  const matchDate = (match.date || '').slice(0, 10)
  const matchHref = home && away && matchDate ? localizedPath(`/match/${generateMatchSlug(home, away, matchDate)}`, lang) : ''

  // Sur les pages EN, le pipeline fournit désormais des analyses anglaises
  // (champs *_en) — repli sur le champ français si absent.
  const pick = (fr?: string, en?: string) => (lang === 'en' && en ? en : fr)
  const vKeyFact = pick(match.aiKeyFact, match.aiKeyFactEn)
  const vAnalysis = pick(match.aiAnalysis, match.aiAnalysisEn)
  const vFormSummary = pick(match.aiFormSummary, match.aiFormSummaryEn)
  const vAbsences = pick(match.aiAbsences, match.aiAbsencesEn)
  const vOddsInsight = pick(match.aiOddsInsight, match.aiOddsInsightEn)

  const status = getMatchStatus(match.date, match.time)
  const timeUntil = getTimeUntil(match.date, match.time)
  const dateLabel = formatDateShort(match.date, lang)

  // ─── Données réelles uniquement — aucun lambda inventé, aucun clamp ──
  // Les lignes affichées proviennent du payload réel (pipeline Poisson v92
  // sur données ESPN). Un marché manquant est recalculé uniquement si des
  // lambdas réels existent ; sinon l'état est "Données insuffisantes".

  // Get predictions data
  const rawBtts = match.predictions.find(p => p.type === 'BTTS')
  const rawOver25 = match.predictions.find(p => p.type.includes('Over'))

  // Extract real lambdas (from either prediction — they're the same model)
  const homeLambda = rawBtts?.homeLambda ?? rawOver25?.homeLambda
  const awayLambda = rawBtts?.awayLambda ?? rawOver25?.awayLambda

  // Build BTTS prediction (use existing, or compute from real lambdas only)
  const bttsProb = rawBtts?.bttsProb ?? (homeLambda != null && awayLambda != null ? computeBtts(homeLambda, awayLambda) : undefined)
  const bttsPred = rawBtts ?? (bttsProb != null && homeLambda != null && awayLambda != null ? {
    type: 'BTTS',
    prediction: bttsProb >= 0.48 ? 'Oui' : 'Non',
    confidence: Math.round(bttsProb * 100),
    bttsProb,
    homeLambda,
    awayLambda,
  } : null)

  // Build Over 2.5 prediction (use existing, or compute from real lambdas only)
  const over25Prob = rawOver25?.over25Prob ?? (homeLambda != null && awayLambda != null ? computeOver25(homeLambda, awayLambda) : undefined)
  const over25Pred = rawOver25 ?? (over25Prob != null && homeLambda != null && awayLambda != null ? {
    type: 'Over 2.5',
    prediction: over25Prob >= 0.49 ? 'Oui' : 'Non',
    confidence: Math.round(over25Prob * 100),
    over25Prob,
    homeLambda,
    awayLambda,
  } : null)

  // Qualité des données — libellé humain, jamais un pourcentage inventé
  const dataQuality: DataQuality = match.quality ?? (bttsPred || over25Pred ? 'limited' : 'insufficient')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.2) }}
      className="prediction-match-card prediction-match-card--compact squircle-lg overflow-hidden hover:border-success/30 transition-all"
    >
      {/* Top accent line */}
      <div className="prediction-match-card__accent h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="prediction-match-card__body p-4 sm:p-5">
        {/* Header row: status + league */}
        <div className="prediction-match-card__meta flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {status === 'live' && (
              <span className="badge badge-live">
                <span className="v31-ticker-dot live" /> <span className="live-text">LIVE</span>
              </span>
            )}
            {status === 'upcoming' && (
              <span className="text-xs text-cendre mono tabular-nums">{match.time || '--:--'}</span>
            )}
            {status === 'past' && (
              <span className="text-xs text-cendre mono tabular-nums">{match.time || '--:--'}</span>
            )}
            <span className="text-xs text-cendre uppercase tracking-widest font-semibold truncate">
              {match.league}
            </span>
          </div>
          <span className="text-xs text-cendre mono whitespace-nowrap">{dateLabel}</span>
        </div>

        {/* Teams */}
        <div className="prediction-match-card__teams grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          {/* Home */}
          <div className="prediction-match-card__team flex flex-col items-center text-center gap-2">
            <TeamLogo src={homeLogo} name={home} size={40} />
            <span className="text-sm font-semibold text-papier truncate max-w-full leading-tight">{home}</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-tertiary-muted mono tabular-nums" style={{ color: '#6B7A8C' }}>VS</span>
          </div>

          {/* Away */}
          <div className="prediction-match-card__team flex flex-col items-center text-center gap-2">
            <TeamLogo src={awayLogo} name={away} size={40} />
            <span className="text-sm font-semibold text-papier truncate max-w-full leading-tight">{away}</span>
          </div>
        </div>

        {/* ═══ UNIFIED PREDICTION — BTTS + Over 2.5 in ONE block (Oui/Non only) ═══ */}
        <div className="prediction-match-card__analysis bg-dark-900 border border-edge rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-success/15 border border-success/30 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2F7DFF" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              {/* Libellé humain de la section d'analyse */}
              <span className="text-xs uppercase tracking-widest font-semibold text-cendre">{analysisHeading(lang)}</span>
            </div>
            <span className="text-xs text-cendre">BTTS + Over 2.5</span>
          </div>

          {/* Two markets side by side — Oui/Non only */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* BTTS column */}
            <div className="space-y-2 text-center">
              <div className="text-xs uppercase tracking-widest font-semibold text-primary">BTTS</div>
              <div className="text-2xl sm:text-3xl font-bold" style={{ color: bttsPred?.prediction === 'Oui' ? '#2F7DFF' : '#9DABBB' }}>
                {bttsPred ? (bttsPred.prediction === 'Oui' ? t.predictions.bttsYes : t.predictions.bttsNo) : '—'}
              </div>
            </div>

            {/* Over 2.5 column */}
            <div className="space-y-2 text-center border-l border-[#223041] pl-3 sm:pl-4">
              <div className="text-xs uppercase tracking-widest font-semibold text-primary">Over 2.5</div>
              <div className="text-2xl sm:text-3xl font-bold" style={{ color: over25Pred?.prediction === 'Oui' ? '#2F7DFF' : '#9DABBB' }}>
                {over25Pred ? (over25Pred.prediction === 'Oui' ? t.predictions.bttsYes : t.predictions.bttsNo) : '—'}
              </div>
            </div>
          </div>

          {/* Qualité des données — « Basé sur les données récentes » / « Données limitées » / « Données insuffisantes »
              (affiché uniquement quand les données sont réellement insuffisantes pour le dernier cas) */}
          <p className="text-[11px] text-cendre mt-2 text-center">{humanMethodLabel(dataQuality, lang)}</p>
        </div>

        {/* Expandable analysis section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-edge space-y-3">
                {/* Enrichissement — libellé humain */}
                {(vKeyFact || match.aiExactScore) && (
                  <div className="bg-[#2F7DFF]/5 rounded-lg p-3 border border-[#2F7DFF]/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2F7DFF" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                        <span className="text-xs uppercase tracking-widest font-semibold text-[#4A90FF]">{lang === 'en' ? 'Match analysis' : lang === 'ar' ? 'تحليل المباراة' : 'Analyse du match'}</span>
                      </div>
                      {match.aiExactScore && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs uppercase tracking-wider text-cendre">{t.predictions.predictedScore}</span>
                          <span className="text-sm font-black font-mono text-[#2F7DFF] px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(199,244,100,0.12)' }}>
                            {match.aiExactScore}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Probability row */}
                    {(match.aiExactScore || match.aiBttsProb || match.aiOver25Prob) && (
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {match.aiExactScore && match.exactScoreProb && (
                          <div className="text-center rounded p-1.5" style={{ backgroundColor: 'rgba(199,244,100,0.08)' }}>
                            <div className="text-xs uppercase text-cendre">Score</div>
                            <div className="text-sm font-bold text-[#2F7DFF]">{match.exactScoreProb}</div>
                          </div>
                        )}
                        {match.aiBttsProb && (
                          <div className="text-center rounded p-1.5" style={{ backgroundColor: 'rgba(52, 211, 153,0.08)' }}>
                            <div className="text-xs uppercase text-cendre">BTTS</div>
                            <div className="text-sm font-bold text-[#2F7DFF]">{match.aiBttsProb}</div>
                          </div>
                        )}
                        {match.aiOver25Prob && (
                          <div className="text-center rounded p-1.5" style={{ backgroundColor: 'rgba(91, 169, 255,0.08)' }}>
                            <div className="text-xs uppercase text-cendre">Over 2.5</div>
                            <div className="text-sm font-bold text-[#2F7DFF]">{match.aiOver25Prob}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {vKeyFact && (
                      <p className="text-sm text-[#F2F6FA] font-semibold mb-2">📊 {vKeyFact}</p>
                    )}

                    {/* Forme récente des deux équipes */}
                    {vFormSummary && (
                      <div className="rounded-lg p-2.5 mb-2 border border-white/5" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <div className="text-[10px] uppercase tracking-widest text-cendre mb-1">{lang === 'en' ? 'Recent form' : lang === 'ar' ? 'الفورمة الأخيرة' : 'Forme récente (5 derniers matchs)'}</div>
                        <p className="text-[12px] text-[#C8D2DC] leading-relaxed">📈 {vFormSummary}</p>
                      </div>
                    )}

                    {/* Cotes réelles du marché (sans clé API — ESPN/bookmaker) */}
                    {match.odds && (match.odds.home || match.odds.away) && (
                      <div className="rounded-lg p-2.5 mb-2 border border-[#2F7DFF]/15" style={{ backgroundColor: 'rgba(47,125,255,0.06)' }}>
                        <div className="text-[10px] uppercase tracking-widest text-cendre mb-1.5">
                          {lang === 'en' ? 'Market odds' : lang === 'ar' ? 'أودز السوق' : 'Cotes marché'}{match.odds.provider ? ` · ${match.odds.provider}` : ''}
                        </div>
                        <div className="flex items-center gap-2 text-center">
                          <div className="flex-1 rounded p-1" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            <div className="text-[9px] uppercase text-cendre">1</div>
                            <div className="text-[13px] font-bold text-[#F2F6FA] font-mono">{match.odds.home ?? '—'}</div>
                          </div>
                          <div className="flex-1 rounded p-1" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            <div className="text-[9px] uppercase text-cendre">N</div>
                            <div className="text-[13px] font-bold text-[#F2F6FA] font-mono">{match.odds.draw ?? '—'}</div>
                          </div>
                          <div className="flex-1 rounded p-1" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            <div className="text-[9px] uppercase text-cendre">2</div>
                            <div className="text-[13px] font-bold text-[#F2F6FA] font-mono">{match.odds.away ?? '—'}</div>
                          </div>
                          {match.odds.over25 && (
                            <div className="flex-1 rounded p-1" style={{ backgroundColor: 'rgba(199,244,100,0.10)' }}>
                              <div className="text-[9px] uppercase text-cendre">O2.5</div>
                              <div className="text-[13px] font-bold text-[#C7F464] font-mono">{match.odds.over25}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {vAnalysis && (
                      <p className="text-[13px] text-[#9DABBB] leading-relaxed mb-2">{vAnalysis}</p>
                    )}

                    {/* Lecture des cotes par l'IA */}
                    {vOddsInsight && (
                      <p className="text-[12px] text-[#8FA3B8] leading-relaxed mb-1.5">💰 {vOddsInsight}</p>
                    )}

                    {/* Disponibilités / absents */}
                    {vAbsences && (
                      <p className="text-[12px] text-[#8FA3B8] leading-relaxed">🩹 {vAbsences}</p>
                    )}
                  </div>
                )}

                {/* CTA — Linebet principal, 888starz secondaire (mission : pas de double CTA agressif) */}
                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold text-cendre mb-2">{t.predictions.betMatch}</div>
                  <div className="flex flex-col gap-2">
                    <PremiumButton
                      variant="linebet"
                      href={AFFILIATE.linebet}
                      size="sm"
                      fullWidth
                      onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'match-card', { match: match.match, market: 'BTTS', lang })}
                    >
                      Linebet
                    </PremiumButton>
                    <a
                      href={AFFILIATE.star888}
                      target="_blank"
                      rel="noopener noreferrer nofollow sponsored"
                      onClick={() => trackAffiliateAction('888starz', 'signup_cta_click', 'match-card-secondary', { match: match.match, market: 'BTTS', lang })}
                      className="text-center text-[10px] text-cendre underline decoration-dotted hover:text-[#F5F8F3] transition-colors"
                    >
                      888starz
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer toggle — CTA contextualisé avec noms d'équipes */}
        <div className="flex items-stretch gap-2 mt-3 pt-3 border-t border-edge">
          <button
            onClick={() => {
              const opening = !expanded
              setExpanded(e => !e)
              if (opening) {
                trackAffiliateAction('linebet', 'prediction_view', `card-expand:${window.location.pathname}`, {
                  match: match.match,
                  market: 'BTTS',
                  lang,
                })
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[13px] text-cendre hover:text-success transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? (lang === 'en' ? `Show less analysis for ${home} – ${away}` : lang === 'ar' ? `عرض تحليل أقل لـ ${home} – ${away}` : `Voir moins d'analyse pour ${home} – ${away}`) : (lang === 'en' ? `View analysis for ${home} – ${away}` : lang === 'ar' ? `عرض التحليل ${home} – ${away}` : `Voir l'analyse ${home} – ${away}`)}
          >
            {expanded ? (
              <>{t.predictions.analysis} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg></>
            ) : (
              <>{t.predictions.analysis} <span className="truncate max-w-[140px]">{home} – {away}</span> <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg></>
            )}
          </button>
          {/* Lien vers la page d'analyse détaillée du match (tunnel PRÉDICTION → ANALYSE) */}
          {matchHref && (
            <a
              href={matchHref}
              className="flex items-center gap-1 px-3 text-[11px] font-semibold text-[#B8FF1A] hover:text-[#D4FF66] transition-colors whitespace-nowrap"
              aria-label={lang === 'en' ? `Detailed analysis ${home} – ${away}` : lang === 'ar' ? `تحليل مفصل ${home} – ${away}` : `Analyse détaillée ${home} – ${away}`}
            >
              {t.predictions.matchPage || 'Match'} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function FreePredictions({ initialLocale }: { initialLocale?: Locale } = {}) {
  const [ref, isVisible] = useScrollAnimation()
  const { lang: detectedLang } = useLanguage()
  const lang = initialLocale ?? detectedLang

  // Vue du feed de prédictions (1×/session et par page) — funnel : PRÉDICTION.
  useEffect(() => {
    if (typeof window === 'undefined') return
    trackAffiliateAction('linebet', 'prediction_view', `feed:${window.location.pathname}`, { lang })
  }, [lang])
  const t = translationsFor(lang)
  const intelligenceTitle = lang === 'en' ? "Today's intelligence" : lang === 'ar' ? 'ذكاء اليوم' : 'Intelligence du jour'
  const intelligenceSubtitle = lang === 'en' ? 'Live selections, market signals and match analysis' : lang === 'ar' ? 'اختيارات مباشرة وإشارات السوق وتحليل المباريات' : 'Sélections en direct, signaux de marché et analyse des matchs'
  const [matches, setMatches] = useState<MatchData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/predictions.json')
      .then(r => r.json())
      .then(data => {
        // v91: data.free is an array of matches, each with predictions[] containing BOTH BTTS + Over 2.5
        const rawPredictions = data?.free || data?.predictions || []
        if (!rawPredictions || rawPredictions.length === 0) {
          setLoading(false)
          return
        }
        const matchMap = new Map<string, MatchData>()
        for (const p of rawPredictions) {
          // Qualité des données calculée sur la ligne réelle du payload (format ESPN v92 reconnu)
          const rowQuality: DataQuality = predictionQuality(p)
          // v91: each prediction already groups both markets under p.predictions[]
          // If p.predictions[] exists, use it directly. Otherwise build from legacy fields.
          const preds = Array.isArray(p.predictions) && p.predictions.length > 0
            ? p.predictions.map(pr => ({
                type: pr.type,
                prediction: pr.prediction,
                confidence: pr.confidence,
                bttsProb: pr.bttsProb ?? p.bttsProb,
                over25Prob: pr.over25Prob ?? p.over25Prob,
                homeLambda: pr.homeLambda ?? p.homeLambda ?? p.xgHome,
                awayLambda: pr.awayLambda ?? p.awayLambda ?? p.xgAway,
              }))
            : [{
                type: p.type || 'BTTS',
                prediction: p.prediction,
                confidence: p.confidence,
                bttsProb: p.bttsProb,
                over25Prob: p.over25Prob,
                homeLambda: p.homeLambda ?? p.xgHome,
                awayLambda: p.awayLambda ?? p.xgAway,
              }]

          const key = p.match
          if (!matchMap.has(key)) {
            matchMap.set(key, {
              match: p.match,
              league: p.league,
              date: p.date,
              time: p.time || '--:--',
              homeLogo: p.homeLogo || '',
              awayLogo: p.awayLogo || '',
              predictions: preds,
              quality: rowQuality,
              reliabilityScore: p.reliabilityScore,
              xgTotal: p.xgTotal,
              analysis: p.analysis,
              aiKeyFact: p.ai_key_fact,
              aiAnalysis: p.ai_analysis,
              aiFormSummary: p.ai_form_summary,
              aiAbsences: p.ai_absences,
              aiOddsInsight: p.ai_odds_insight,
              aiKeyFactEn: p.ai_key_fact_en,
              aiAnalysisEn: p.ai_analysis_en,
              aiFormSummaryEn: p.ai_form_summary_en,
              aiAbsencesEn: p.ai_absences_en,
              aiOddsInsightEn: p.ai_odds_insight_en,
              odds: p.odds || null,
              aiExactScore: p.ai_exact_score,
              exactScoreProb: p.exact_score_prob,
              aiBttsProb: p.ai_btts_prob,
              aiOver25Prob: p.ai_over25_prob,
            })
          }
        }
        const all = [...matchMap.values()].sort((a, b) => {
          const sa = getMatchStatus(a.date, a.time)
          const sb = getMatchStatus(b.date, b.time)
          if (sa === 'live' && sb !== 'live') return -1
          if (sb === 'live' && sa !== 'live') return 1
          const da = `${a.date}T${a.time || '23:59'}`
          const db = `${b.date}T${b.time || '23:59'}`
          return da.localeCompare(db)
        })
        // La section s'intitule « Intelligence du jour » : on affiche d'abord les
        // matchs du jour (Africa/Dakar). Si la journée est pauvre, on complète
        // avec les prochaines affiches à venir pour ne jamais rendre la section
        // vide — les cartes affichent la date réelle de chaque match.
        const todayAll = all.filter(m => getDakarDayDiff(m.date) === 0)
        const upcomingFill = todayAll.length < 6
          ? all.filter(m => getDakarDayDiff(m.date) > 0).slice(0, 12)
          : []
        setMatches([...todayAll, ...upcomingFill])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stats = useMemo(() => ({
    total: matches.length,
    btts: matches.filter(m => m.predictions.some(p => p.type === 'BTTS')).length,
    o25: matches.filter(m => m.predictions.some(p => p.type.includes('Over'))).length,
    live: matches.filter(m => getMatchStatus(m.date, m.time) === 'live').length,
  }), [matches])

  return (
    <section ref={ref} id="free-predictions" className="section-pad overflow-x-hidden" style={{ paddingTop: 'clamp(1.5rem, 4vw, 3rem)', paddingBottom: 'clamp(2rem, 5vw, 4rem)' }}>
      <div className="mx-auto max-w-[980px] px-4 sm:px-6">
        <div className="prediction-section-heading mb-5 flex items-end justify-between gap-4">
          <div>
            <span className="prediction-section-heading__eyebrow">{t.hero.liveData}</span>
            <h2 className="prediction-section-heading__title">{intelligenceTitle}</h2>
            <p className="prediction-section-heading__subtitle">{intelligenceSubtitle}</p>
          </div>
          <span className="prediction-section-heading__count hidden sm:inline-flex">{stats.total} {lang === 'en' ? 'matches' : lang === 'ar' ? 'مباريات' : 'matchs'}</span>
        </div>

        {/* Cartes de matchs réels du jour */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="squircle-lg h-72 animate-pulse" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="squircle-xl p-10 text-center">
            <div className="w-14 h-14 bg-dark-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-edge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F7DFF" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <p className="text-papier text-sm font-bold mb-2">{t.predictions.noMatches}</p>
            <p className="text-cendre text-xs">{lang === 'ar' ? 'جرّب فلترًا آخر أو عد لاحقاً.' : lang === 'en' ? 'Try another filter or come back later.' : 'Essaie un autre filtre ou reviens plus tard.'}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            {matches.map((m, i) => (
              <PredictionCard key={`${m.match}-${m.date}-${m.time}`} match={m} index={i} initialLocale={lang} />
            ))}
          </div>
        )}

        <p className="text-center text-sm text-cendre mt-6">
          {lang === 'ar' ? 'توقع إحصائي مبني على البيانات الأخيرة ونموذجنا الإحصائي. لا توجد ضمانات مستقبلية. 18+' : lang === 'en' ? 'Statistical prediction based on recent data and our statistical model. No future guarantee. 18+.' : 'Prévision statistique basée sur les données récentes et notre modèle statistique. Aucune garantie future. 18+'}
        </p>

        {/* CTA — Voir tous les pronostics du jour (page dédiée) */}
        <div className="text-center mt-5">
          <a
            href={localizedPath('/btts/predictions/today', lang)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, #2F7DFF, #2F7DFF)',
              color: '#FFFFFF',
              boxShadow: '0 4px 16px rgba(127, 162, 198, 0.30)',
            }}
          >
            {t.predictions.seeAll} →
          </a>
        </div>
      </div>
    </section>
  )
}
