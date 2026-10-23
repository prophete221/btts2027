'use client'

/**
 * BttsTodayDashboard — premium predictions dashboard for /btts/predictions/today
 *
 * Visual identity V3 — « plateforme mondiale » : dark glass, liserés animés,
 * barres de probabilité animées au scroll, reveal en cascade (IntersectionObserver),
 * combo IA vedette à bordure conique animée, sheen au survol des cartes.
 * Motion design 100% CSS/IO — reduced-motion : tout est désactivé et visible.
 * NOT a blog article.
 *
 * Data sources (read-only):
 *   - public/predictions.json (fields already produced by the engine)
 *
 * Fields consumed (no recalculation, no fabrication):
 *   match, league, date, time, homeLogo, awayLogo,
 *   home, away,
 *   bttsProb, over25Prob,                  ← Poisson probabilities (0..1)
 *   homeLambda, awayLambda,                ← buts attendus modélisés (λ du modèle Poisson,
 *                                              issus des buts réels récents ESPN — PAS des xG d'un fournisseur)
 *   xgHome, xgAway, xgTotal,               ← fallback affichage λ
 *   reliabilityScore,                      ← 0..100 data confidence (NOT a win chance)
 *   dataSource, dataQuality,               ← ESPN_TEAM_SCHEDULE | LEAGUE_FALLBACK ; HIGH|MEDIUM|LOW
 *   matchCountHome, matchCountAway,        ← real ESPN matches analysed per team
 *   ai_exact_score, exact_score_prob,      ← Gemini exact score view
 *   ai_btts_view, ai_over25_view,          ← Gemini views (displayed, not overriding Poisson)
 *   ai_key_fact, ai_analysis               ← Gemini short text
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { trackAffiliateAction } from '@/lib/affiliateTracking'
import Link from 'next/link'
import { generateMatchSlug } from '@/lib/match-slug'
import { useLanguage } from './LanguageSwitcher'
import { translationsFor, type Locale, localizedPath } from '@/lib/i18n'
import { getDakarDateString, getDakarMatchStatus, getDakarDayDiff } from '@/lib/dakar-date'
import { AFFILIATE } from '@/lib/constants'

// ─── Palette (V3 — bleu analyse, sémantique WIN/LOST/PENDING) ────────────────
const C = {
  bg:       '#0B0F14',
  surface:  '#141C25',
  surface2: '#0B0F14',
  border:   '#223041',
  text:     '#F2F6FA',
  textSec:  '#9DABBB',
  textMute: '#6B7A8C',
  success:  '#34D399',
  warning:  '#FBBF24',
  data:     '#2F7DFF',
  gold:     '#E8C268',
  danger:   '#F87171',
}

// ─── Types ──────────────────────────────────────────────────────────────
interface RawPrediction {
  match?: string
  home?: string
  away?: string
  league?: string
  date?: string
  time?: string
  homeLogo?: string
  awayLogo?: string
  type?: string
  prediction?: string
  confidence?: number
  bttsProb?: number
  over25Prob?: number
  homeLambda?: number
  awayLambda?: number
  xgHome?: number
  xgAway?: number
  xgTotal?: number
  reliabilityScore?: number
  dataSource?: string
  dataQuality?: string
  matchCountHome?: number
  matchCountAway?: number
  ai_exact_score?: string
  exact_score_prob?: string
  ai_btts_view?: string
  ai_over25_view?: string
  ai_key_fact?: string
  ai_analysis?: string
  ai_form_summary?: string
  ai_absences?: string
  ai_odds_insight?: string
  ai_key_fact_en?: string
  ai_analysis_en?: string
  ai_form_summary_en?: string
  ai_absences_en?: string
  ai_odds_insight_en?: string
  odds?: { provider?: string; home?: number | null; draw?: number | null; away?: number | null; over25?: number | null; under25?: number | null } | null
}

interface DashboardLabels {
  exactScore: string
  projection: string
  source: string
  quality: string
  matches: string
  dataConfidence: string
  aiAnalysis: string
  score: string
  xgHome: string
  xgAway: string
  xgTotal: string
  xgHint: string
  openMatch: string
}

interface MatchData {
  key: string
  home: string
  away: string
  league: string
  date: string
  time: string
  homeLogo?: string
  awayLogo?: string
  bttsProb?: number
  over25Prob?: number
  homeLambda?: number
  awayLambda?: number
  xgHome?: number
  xgAway?: number
  xgTotal?: number
  reliabilityScore?: number
  dataSource?: string
  dataQuality?: string
  matchCountHome?: number
  matchCountAway?: number
  aiExactScore?: string
  exactScoreProb?: string
  aiBttsView?: string
  aiOver25View?: string
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
}

type FilterType = 'all' | 'BTTS' | 'O2.5' | 'HIGH' | 'VIP'

type CardStatus = 'live' | 'scheduled' | 'finished'

// ─── AI Combo of the Day — selection type ───────────────────────────────
// A ComboPick is a deterministic selection derived ONLY from data already
// present in predictions.json. The frontend never recalculates probabilities;
// it only filters, ranks, and chooses the higher qualifying market per match.
interface ComboPick {
  match: MatchData
  market: 'BTTS' | 'OVER 2.5'
  probability: number        // Real value from predictions.json (0..1) — untouched
  reliabilityScore: number   // Real value from predictions.json (0..100)
  dataQuality: string         // Real value from predictions.json (HIGH | MEDIUM | LOW)
  matchCountTotal: number    // Real sum of matchCountHome + matchCountAway
}

// ─── Helpers ────────────────────────────────────────────────────────────
function fmtPct(p?: number): string {
  if (p == null || !Number.isFinite(p)) return '—'
  return `${(p * 100).toFixed(1)}%`
}

function fmtNum(n?: number, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function fmtInt(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDate().toString().padStart(2, '0')
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function passesFilter(match: MatchData, activeFilter: FilterType): boolean {
  if (activeFilter === 'BTTS') return (match.bttsProb ?? 0) >= 0.5
  if (activeFilter === 'O2.5') return (match.over25Prob ?? 0) >= 0.5
  if (activeFilter === 'HIGH') return (match.reliabilityScore ?? 0) >= 80
  return true
}

function normalizeDataSource(s?: string): string {
  if (!s) return '—'
  if (s === 'ESPN_TEAM_SCHEDULE') return 'ESPN TEAM SCHEDULE'
  if (s === 'LEAGUE_FALLBACK') return 'LEAGUE FALLBACK'
  return s.toUpperCase().replace(/_/g, ' ')
}

function qualityColor(q?: string): string {
  if (!q) return C.textSec
  const u = q.toUpperCase()
  if (u === 'HIGH') return C.success
  if (u === 'MEDIUM') return C.warning
  if (u === 'LOW') return C.danger
  return C.textSec
}

function hasSufficientData(match: MatchData): boolean {
  const quality = (match.dataQuality || '').toUpperCase()
  const sampleSize = (match.matchCountHome ?? 0) + (match.matchCountAway ?? 0)
  return quality !== 'LOW' && sampleSize >= 2
}

// Largeur de barre de probabilité (0..100%) — clampée, jamais recalculée.
function barWidth(p?: number): string {
  if (p == null || !Number.isFinite(p)) return '0%'
  const clamped = Math.min(100, Math.max(0, p * 100))
  return `${clamped.toFixed(1)}%`
}

// ─── useCountUp — compteur animé (reduced-motion aware) ─────────────────
function useCountUp(target: number, active: boolean, duration = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active || !Number.isFinite(target)) return
    let reduce = false
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* no-op */
    }
    if (reduce) {
      /* Valeur finale sans animation — différé d'un frame pour éviter un
         setState synchrone dans l'effet (cascade de rendus). */
      const id = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])
  return Number.isFinite(target) ? value : 0
}

// ─── Team Logo (compact, dashboard-grade) ───────────────────────────────
function TeamLogo({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false)
  const initial = (name || '?').slice(0, 3).toUpperCase()
  return (
    <div className="btx-team__logo" aria-label={name} title={name}>
      {src && !err ? (
        <img
          src={src}
          alt={`${name} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setErr(true)}
        />
      ) : (
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 900,
            color: C.success,
            letterSpacing: '0.02em',
          }}
        >
          {initial}
        </span>
      )}
    </div>
  )
}

// ─── ProbBar — barre de probabilité animée (marché BTTS / Over 2.5) ─────
function ProbBar({ label, value, color, dim }: { label: string; value?: number; color: string; dim?: boolean }) {
  const noData = value == null || !Number.isFinite(value) || dim
  return (
    <div className="btx-prob">
      <div className="btx-prob__head">
        <span className="btx-prob__label">{label}</span>
        <span className="btx-prob__value" style={{ ['--pc' as string]: color, opacity: noData ? 0.45 : 1 }}>
          {noData ? '—' : fmtPct(value)}
        </span>
      </div>
      <div className="btx-bar" style={{ opacity: noData ? 0.4 : 1 }}>
        <span className="btx-bar__threshold" aria-hidden="true" />
        <span className="btx-bar__fill" style={{ ['--w' as string]: noData ? '0%' : barWidth(value), ['--pc' as string]: color }} />
      </div>
    </div>
  )
}

// ─── StatusChip — LIVE pulsant / Terminé / Heure ────────────────────────
function StatusChip({ status, time, lang, date }: { status: CardStatus; time: string; lang: Locale; date?: string }) {
  if (status === 'live') {
    return (
      <span className="btx-status btx-status--live">
        <span className="btx-status__dot" aria-hidden="true" />
        LIVE
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="btx-status btx-status--done">
        {lang === 'fr' ? 'Terminé' : lang === 'en' ? 'Full time' : 'انتهت'}
      </span>
    )
  }
  // Matchs à venir : afficher la date pour les journées suivantes (J+1 et plus)
  // afin qu'une affiche « 19:00 » de demain ne soit pas confondue avec celle du jour.
  let dayLabel = ''
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const diff = getDakarDayDiff(date)
    if (diff === 1) dayLabel = lang === 'fr' ? 'Demain' : lang === 'en' ? 'Tomorrow' : 'غداً'
    else if (diff > 1) {
      try {
        dayLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang === 'ar' ? 'ar' : 'fr-FR', {
          timeZone: 'Africa/Dakar', day: '2-digit', month: 'short',
        }).format(new Date(`${date}T12:00:00Z`))
      } catch { /* date invalide — libellé absent */ }
    }
  }
  return <span className="btx-status">{dayLabel ? `${dayLabel} · ` : ''}{time || '--:--'}</span>
}

// ─── Match Card — premium V3 (glass, liseré statut, sheen, barres animées) ──
function MatchCard({ match, index, status, lang, insufficientDataLabel, labels, now }: {
  match: MatchData
  index: number
  status: CardStatus
  lang: Locale
  insufficientDataLabel: string
  labels: DashboardLabels
  now: number
}) {
  const [expanded, setExpanded] = useState(false)

  // Textes d'analyse : version EN du pipeline si disponible, sinon FR.
  const vKeyFact = lang === 'en' ? match.aiKeyFactEn || match.aiKeyFact : match.aiKeyFact
  const vAnalysis = lang === 'en' ? match.aiAnalysisEn || match.aiAnalysis : match.aiAnalysis
  const vFormSummary = lang === 'en' ? match.aiFormSummaryEn || match.aiFormSummary : match.aiFormSummary
  const vAbsences = lang === 'en' ? match.aiAbsencesEn || match.aiAbsences : match.aiAbsences
  const vOddsInsight = lang === 'en' ? match.aiOddsInsightEn || match.aiOddsInsight : match.aiOddsInsight

  // Statut fin pour les cartes « programmées » d'aujourd'hui : un match dont
  // l'heure est passée bascule en live/terminé via getDakarMatchStatus.
  const fine: CardStatus = useMemo(() => {
    if (status === 'finished') return 'finished'
    const s = getDakarMatchStatus(match.date, match.time, new Date(now))
    if (s === 'live') return 'live'
    if (s === 'finished') return 'finished'
    return 'scheduled'
  }, [status, match.date, match.time, now])

  const accent =
    fine === 'live' ? 'rgba(52, 211, 153, 0.85)'
    : fine === 'finished' ? 'rgba(107, 122, 140, 0.55)'
    : 'rgba(47, 125, 255, 0.8)'

  const dataSourceLabel = normalizeDataSource(match.dataSource)
  const quality = match.dataQuality?.toUpperCase() || '—'
  const qualityColorVal = qualityColor(match.dataQuality)
  const sufficientData = hasSufficientData(match)

  return (
    <article
      className="btx-card btx-rev"
      style={{ ['--accent' as string]: accent, ['--d' as string]: `${Math.min(index, 8) * 50}ms` }}
      aria-label={`${match.home} vs ${match.away} — ${match.league}`}
    >
      <div className="btx-card__edge" aria-hidden="true" />
      <div className="btx-card__inner">
        {/* ─── TOP : ligue + statut ─── */}
        <div className="btx-card__top">
          <span className="btx-league">{match.league}</span>
          <StatusChip status={fine} time={match.time} lang={lang} date={match.date} />
        </div>

        {/* ─── TEAMS ─── */}
        <div className="btx-teams">
          <div className="btx-team">
            <TeamLogo src={match.homeLogo} name={match.home} />
            <span className="btx-team__name">{match.home}</span>
          </div>
          <div className="btx-vs" aria-hidden="true">
            <span className="btx-vs__line" />
            <span className="btx-vs__chip">VS</span>
            <span className="btx-vs__line" />
          </div>
          <div className="btx-team">
            <TeamLogo src={match.awayLogo} name={match.away} />
            <span className="btx-team__name">{match.away}</span>
          </div>
        </div>

        {/* ─── PROBABILITÉS — barres animées ─── */}
        <div className="btx-probs">
          <ProbBar label="BTTS" value={match.bttsProb} color="#34D399" dim={!sufficientData} />
          <ProbBar label="Over 2.5" value={match.over25Prob} color="#FBBF24" dim={!sufficientData} />
        </div>

        {/* ─── λ buts attendus modélisés ─── */}
        <div className="btx-lambdas">
          <div className="btx-lambda">
            <span className="btx-lambda__label">{labels.xgHome}</span>
            <span className="btx-lambda__value">{sufficientData ? fmtNum(match.homeLambda ?? match.xgHome) : '—'}</span>
          </div>
          <div className="btx-lambda">
            <span className="btx-lambda__label">{labels.xgAway}</span>
            <span className="btx-lambda__value">{sufficientData ? fmtNum(match.awayLambda ?? match.xgAway) : '—'}</span>
          </div>
          <div className="btx-lambda">
            <span className="btx-lambda__label">{labels.xgTotal}</span>
            <span className="btx-lambda__value">
              {sufficientData ? fmtNum(match.xgTotal ?? ((match.homeLambda ?? match.xgHome ?? 0) + (match.awayLambda ?? match.xgAway ?? 0))) : '—'}
            </span>
          </div>
        </div>
        <p className="btx-score__hint" style={{ margin: '-0.4rem 0.9rem 0.85rem' }}>
          {labels.xgHint}
        </p>

        {/* ─── SCORE EXACT ─── */}
        <div className="btx-score">
          <div className="btx-score__head">
            <span className="btx-score__label">{labels.exactScore}</span>
            {match.exactScoreProb && <span className="btx-score__prob">{match.exactScoreProb}</span>}
          </div>
          <div className="btx-score__value">
            {match.aiExactScore ? match.aiExactScore : '— —'}
          </div>
          <p className="btx-score__hint">
            {match.aiExactScore || match.exactScoreProb ? labels.projection : insufficientDataLabel}
          </p>
        </div>

        {/* ─── MÉTA : source / qualité / échantillon ─── */}
        <div className="btx-meta">
          <span className="btx-chip">
            {labels.source} <b style={{ ['--cc' as string]: '#7DB5FF' }}>{dataSourceLabel}</b>
          </span>
          <span className="btx-chip">
            {labels.quality} <b style={{ ['--cc' as string]: qualityColorVal }}>{quality}</b>
          </span>
          <span className="btx-chip">
            {fmtInt(match.matchCountHome)} + {fmtInt(match.matchCountAway)} {labels.matches}
          </span>
        </div>

        {/* ─── CONFIANCE DES DONNÉES ─── */}
        {match.reliabilityScore != null && Number.isFinite(match.reliabilityScore) && (
          <div className="btx-conf">
            <div className="btx-conf__head">
              <span className="btx-conf__label">{labels.dataConfidence}</span>
              <span className="btx-conf__value">{Math.round(match.reliabilityScore)}%</span>
            </div>
            <div className="btx-bar">
              <span className="btx-bar__fill" style={{ ['--w' as string]: `${Math.min(100, Math.max(0, match.reliabilityScore)).toFixed(1)}%` }} />
            </div>
          </div>
        )}

        {/* ─── ANALYSE IA GEMINI ─── */}
        {(match.aiAnalysis || match.aiKeyFact || match.aiBttsView || match.aiOver25View) && (
          <div className="btx-ai">
            <div className="btx-ai__head">
              <span className="btx-ai__dot" aria-hidden="true" />
              <span className="btx-ai__label">{labels.aiAnalysis}</span>
              {match.aiExactScore && (
                <span className="btx-score__prob" style={{ marginLeft: 'auto' }}>
                  {labels.score}: {match.aiExactScore}{match.exactScoreProb ? ` (${match.exactScoreProb})` : ''}
                </span>
              )}
            </div>
            {match.aiBttsView && (
              <div className="btx-ai__views">
                <div className="btx-ai__view">
                  <div className="btx-ai__view-label">{lang === 'en' ? 'BTTS · AI' : lang === 'ar' ? 'BTTS · AI' : 'BTTS · IA'}</div>
                  <div className="btx-ai__view-value" style={{ ['--vc' as string]: '#34D399' }}>{match.aiBttsView}</div>
                </div>
                {match.aiOver25View && (
                  <div className="btx-ai__view btx-ai__view--amber">
                    <div className="btx-ai__view-label">{lang === 'en' ? 'Over 2.5 · AI' : lang === 'ar' ? 'Over 2.5 · AI' : 'Over 2.5 · IA'}</div>
                    <div className="btx-ai__view-value" style={{ ['--vc' as string]: '#FBBF24' }}>{match.aiOver25View}</div>
                  </div>
                )}
              </div>
            )}
            {vKeyFact && <p className="btx-ai__fact">{vKeyFact}</p>}

            {/* Forme récente des deux équipes */}
            {match.aiFormSummary && (
              <div style={{ margin: '0.45rem 0', padding: '0.55rem 0.65rem', borderRadius: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 3 }}>
                  {lang === 'fr' ? 'Forme récente (5 derniers matchs)' : lang === 'en' ? 'Recent form' : 'الفورمة الأخيرة'}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.85 }}>📈 {vFormSummary}</div>
              </div>
            )}

            {/* Cotes réelles du marché (gratuit — ESPN/bookmaker) */}
            {match.odds && (match.odds.home || match.odds.away) && (
              <div style={{ margin: '0.45rem 0' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>
                  {lang === 'fr' ? 'Cotes marché' : lang === 'en' ? 'Market odds' : 'أودز السوق'}{match.odds.provider ? ` · ${match.odds.provider}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 9, opacity: 0.55 }}>1</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{match.odds.home ?? '—'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 9, opacity: 0.55 }}>{lang === 'en' ? 'D' : lang === 'ar' ? 'X' : 'N'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{match.odds.draw ?? '—'}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 9, opacity: 0.55 }}>2</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{match.odds.away ?? '—'}</div>
                  </div>
                  {match.odds.over25 && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 8, background: 'rgba(52,211,153,0.12)' }}>
                      <div style={{ fontSize: 9, opacity: 0.55 }}>O2.5</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#34D399' }}>{match.odds.over25}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {vAnalysis && (
              <p className="btx-ai__text">
                {expanded || vAnalysis.length <= 180 ? vAnalysis : `${vAnalysis.slice(0, 177)}…`}
              </p>
            )}

            {/* Lecture des cotes par l'IA */}
            {vOddsInsight && (
              <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.7, margin: '0.4rem 0 0.2rem' }}>💰 {vOddsInsight}</p>
            )}

            {/* Disponibilités / absents */}
            {vAbsences && (
              <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.7, margin: '0.2rem 0' }}>🩹 {vAbsences}</p>
            )}
            <div className="btx-actions" style={{ paddingInline: 0, borderTop: 'none', paddingTop: '0.55rem' }}>
              {vAnalysis && vAnalysis.length > 180 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  aria-expanded={expanded}
                  aria-label={expanded ? (lang === 'en' ? `Hide the full analysis of ${match.home} vs ${match.away}` : lang === 'ar' ? `إخفاء التحليل الكامل لـ ${match.home} ضد ${match.away}` : `Masquer l'analyse complète de ${match.home} vs ${match.away}`) : (lang === 'en' ? `View the full analysis of ${match.home} vs ${match.away}` : lang === 'ar' ? `عرض التحليل الكامل لـ ${match.home} ضد ${match.away}` : `Voir l'analyse complète de ${match.home} vs ${match.away}`)}
                  className="btx-link"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  {expanded ? '−' : '+'} {expanded ? (lang === 'fr' ? 'Masquer l’analyse' : lang === 'en' ? 'Hide analysis' : 'إخفاء التحليل') : (lang === 'fr' ? 'Voir l’analyse complète' : lang === 'en' ? 'Full analysis' : 'التحليل الكامل')}
                </button>
              )}
              <Link
                href={localizedPath(`/match/${generateMatchSlug(match.home, match.away, match.date)}`, lang)}
                className="btx-link"
              >
                {labels.openMatch} →
              </Link>
            </div>
          </div>
        )}

        {/* Lien page match pour les cartes sans analyse IA */}
        {!(match.aiAnalysis || match.aiKeyFact || match.aiBttsView || match.aiOver25View) && (
          <div className="btx-actions">
            <Link
              href={localizedPath(`/match/${generateMatchSlug(match.home, match.away, match.date)}`, lang)}
              className="btx-link"
            >
              {labels.openMatch} →
            </Link>
          </div>
        )}
      </div>
    </article>
  )
}

// ─── ComboPickRow — vedette « Combo IA du jour » ────────────────────────
function ComboPickRow({ pick, index, lang }: { pick: ComboPick; index: number; lang: Locale }) {
  const num = String(index + 1).padStart(2, '0')
  const marketColor = pick.market === 'BTTS' ? '#34D399' : '#FBBF24'
  const rank = index === 0 ? (lang === 'fr' ? 'N°1' : '#1') : index === 1 ? (lang === 'fr' ? 'N°2' : '#2') : (lang === 'fr' ? 'N°3' : '#3')

  return (
    <div className="btx-combo-row">
      <span className="btx-combo-row__rank" aria-hidden="true">{num}</span>
      <div className="btx-combo-row__body">
        <div className="btx-combo-row__match">
          {pick.match.home} <span style={{ color: C.textSec }}>vs</span> {pick.match.away}
        </div>
        <div className="btx-combo-row__meta">
          {pick.match.league} · {pick.match.time || '--:--'}
          {lang === 'fr' ? ` · choix ${rank}` : lang === 'en' ? ` · pick ${rank}` : ` · اختيار ${rank}`}
        </div>
        <div className="btx-combo-row__foot">
          <span>{normalizeDataSource(pick.match.dataSource)} · {pick.dataQuality}</span>
          <span>
            {lang === 'fr' ? 'Confiance' : lang === 'ar' ? 'الثقة' : 'Confidence'} <span className="btx-combo-row__conf">{Math.round(pick.reliabilityScore)}%</span>
          </span>
        </div>
      </div>
      <span className="btx-market-chip" style={{ ['--mc' as string]: marketColor }}>{pick.market}</span>
      <span className="btx-combo-row__prob" style={{ ['--mc' as string]: marketColor }}>
        {(pick.probability * 100).toFixed(1)}%
      </span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function BttsTodayDashboard({ initialLocale }: { initialLocale?: Locale } = {}) {
  const { lang: detectedLang } = useLanguage()
  // Sur /en|/ar, la locale de l'URL gagne (immunise contre un ancien
  // localStorage 'bttsbet-lang' qui re-franciserait la page).
  const lang = initialLocale ?? detectedLang
  const t = translationsFor(lang)
  const sectionRef = useRef<HTMLElement | null>(null)

  // Vue du dashboard de prédictions (1×/session) — funnel : PRÉDICTION.
  useEffect(() => {
    trackAffiliateAction('linebet', 'prediction_view', `dashboard:${window.location.pathname}`, { lang })
  }, [lang])
  const [matches, setMatches] = useState<MatchData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [generationDate, setGenerationDate] = useState<string | null>(null)
  const [todayMatches, setTodayMatches] = useState<MatchData[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<MatchData[]>([])
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/predictions.json')
      .then(r => r.json())
      .then(data => {
        const raw: RawPrediction[] = data?.free || data?.predictions || []
        // Today's date in Africa/Dakar (Senegal timezone = UTC+0 / GMT)
        // Important: do NOT use UTC blindly — use Intl with explicit timezone to ensure
        // the date matches the site's local day, even if the user's browser uses another TZ.
        const todayStr = getDakarDateString()

        // Group by match (predictions.json stores one row per market — BTTS or Over 2.5)
        const map = new Map<string, MatchData>()
        for (const p of raw) {
          const key = p.match || `${p.home || ''} vs ${p.away || ''} ${p.date || ''}`
          if (!map.has(key)) {
            map.set(key, {
              key,
              home: p.home || '',
              away: p.away || '',
              league: p.league || '—',
              date: p.date || '',
              time: p.time || '--:--',
              homeLogo: p.homeLogo,
              awayLogo: p.awayLogo,
              bttsProb: p.bttsProb,
              over25Prob: p.over25Prob,
              homeLambda: p.homeLambda,
              awayLambda: p.awayLambda,
              xgHome: p.xgHome,
              xgAway: p.xgAway,
              xgTotal: p.xgTotal,
              reliabilityScore: p.reliabilityScore,
              dataSource: p.dataSource,
              dataQuality: p.dataQuality,
              matchCountHome: p.matchCountHome,
              matchCountAway: p.matchCountAway,
              aiExactScore: p.ai_exact_score,
              exactScoreProb: p.exact_score_prob,
              aiBttsView: p.ai_btts_view,
              aiOver25View: p.ai_over25_view,
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
            })
          } else {
            // Merge missing fields from sibling row (BTTS row may carry bttsProb,
            // Over 2.5 row may carry over25Prob)
            const existing = map.get(key)!
            if (existing.bttsProb == null && p.bttsProb != null) existing.bttsProb = p.bttsProb
            if (existing.over25Prob == null && p.over25Prob != null) existing.over25Prob = p.over25Prob
            if (existing.homeLambda == null && p.homeLambda != null) existing.homeLambda = p.homeLambda
            if (existing.awayLambda == null && p.awayLambda != null) existing.awayLambda = p.awayLambda
            if (existing.reliabilityScore == null && p.reliabilityScore != null) existing.reliabilityScore = p.reliabilityScore
            if (existing.dataSource == null && p.dataSource != null) existing.dataSource = p.dataSource
            if (existing.dataQuality == null && p.dataQuality != null) existing.dataQuality = p.dataQuality
            if (existing.matchCountHome == null && p.matchCountHome != null) existing.matchCountHome = p.matchCountHome
            if (existing.matchCountAway == null && p.matchCountAway != null) existing.matchCountAway = p.matchCountAway
            if (existing.aiExactScore == null && p.ai_exact_score != null) existing.aiExactScore = p.ai_exact_score
            if (existing.exactScoreProb == null && p.exact_score_prob != null) existing.exactScoreProb = p.exact_score_prob
            if (existing.aiBttsView == null && p.ai_btts_view != null) existing.aiBttsView = p.ai_btts_view
            if (existing.aiOver25View == null && p.ai_over25_view != null) existing.aiOver25View = p.ai_over25_view
            if (existing.aiKeyFact == null && p.ai_key_fact != null) existing.aiKeyFact = p.ai_key_fact
            if (existing.aiAnalysis == null && p.ai_analysis != null) existing.aiAnalysis = p.ai_analysis
            if (existing.aiFormSummary == null && p.ai_form_summary != null) existing.aiFormSummary = p.ai_form_summary
            if (existing.aiAbsences == null && p.ai_absences != null) existing.aiAbsences = p.ai_absences
            if (existing.aiOddsInsight == null && p.ai_odds_insight != null) existing.aiOddsInsight = p.ai_odds_insight
            if (existing.aiKeyFactEn == null && p.ai_key_fact_en != null) existing.aiKeyFactEn = p.ai_key_fact_en
            if (existing.aiAnalysisEn == null && p.ai_analysis_en != null) existing.aiAnalysisEn = p.ai_analysis_en
            if (existing.aiFormSummaryEn == null && p.ai_form_summary_en != null) existing.aiFormSummaryEn = p.ai_form_summary_en
            if (existing.aiAbsencesEn == null && p.ai_absences_en != null) existing.aiAbsencesEn = p.ai_absences_en
            if (existing.aiOddsInsightEn == null && p.ai_odds_insight_en != null) existing.aiOddsInsightEn = p.ai_odds_insight_en
            if (existing.odds == null && p.odds != null) existing.odds = p.odds
          }
        }

        // Separate today's matches from upcoming matches.
        // - todayMatches: date === todayStr (real today matches, Africa/Dakar)
        // - upcomingMatches: date > todayStr (kept for the "À venir" section)
        // We never show past matches (date < todayStr).
        const all = [...map.values()]
          .filter(m => m.date >= todayStr)
          .sort((a, b) => {
            const da = `${a.date}T${a.time || '23:59'}`
            const db = `${b.date}T${b.time || '23:59'}`
            return da.localeCompare(db)
          })

        setMatches(all)
        setTodayMatches(all.filter(m => m.date === todayStr))
        setUpcomingMatches(all.filter(m => m.date > todayStr))
        if (typeof data?.date === 'string' && data.date.length > 0) setGenerationDate(data.date)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const finishedTodayMatches = useMemo(
    () => todayMatches.filter(m => getDakarMatchStatus(m.date, m.time, new Date(now)) === 'finished'),
    [todayMatches, now],
  )
  const liveTodayMatches = useMemo(
    () => todayMatches.filter(m => getDakarMatchStatus(m.date, m.time, new Date(now)) === 'live'),
    [todayMatches, now],
  )
  const scheduledTodayMatches = useMemo(
    () => todayMatches.filter(m => getDakarMatchStatus(m.date, m.time, new Date(now)) === 'upcoming'),
    [todayMatches, now],
  )

  // ─── Real stats from loaded data (no fabrication) ──────────────────────
  const stats = useMemo(() => {
    // « Today » = matchs réellement affichés (filtrés par date >= todayStr dans useEffect).
    // On utilise matches.length qui correspond exactement à ce qui est rendu dans la grille.
    const bttsHigh = matches.filter(m => (m.bttsProb ?? 0) >= 0.6).length
    const overHigh = matches.filter(m => (m.over25Prob ?? 0) >= 0.6).length
    const highQuality = matches.filter(m => (m.dataQuality || '').toUpperCase() === 'HIGH').length
    const avgReliability = matches.length > 0
      ? Math.round(matches.reduce((s, m) => s + (m.reliabilityScore ?? 0), 0) / matches.length)
      : null

    // todayCount = number of active/scheduled matches for today (Africa/Dakar).
    // Finished matches remain visible in their own section but are not counted as current selections.
    return {
      todayCount: scheduledTodayMatches.length + liveTodayMatches.length,
      total: matches.length,
      bttsHigh,
      overHigh,
      highQuality,
      avgReliability,
    }
  }, [matches, scheduledTodayMatches, liveTodayMatches])

  // ─── AI COMBO OF THE DAY — deterministic selection from real data only ──
  // Eligibility filter (NO recalculation — uses predictions.json values as-is):
  //   1. dataQuality !== 'LOW' (and must be a known value)
  //   2. reliabilityScore >= 70
  //   3. bttsProb >= 0.65 OR over25Prob >= 0.65
  // For each qualifying match, the market with the higher qualifying probability
  // is selected (deterministic — no randomization).
  // Sort order (deterministic, stable):
  //   1. reliabilityScore DESC
  //   2. selected probability DESC
  //   3. dataQuality HIGH > MEDIUM
  //   4. matchCountTotal (real ESPN matches) DESC
  //   5. alphabetical (home vs away) — stable tiebreak
  const combo = useMemo<ComboPick[]>(() => {
    if (loading || matches.length === 0) return []

    const candidates: ComboPick[] = []

    for (const m of [...liveTodayMatches, ...scheduledTodayMatches]) {
      const dq = (m.dataQuality || '').toUpperCase()
      if (dq === 'LOW' || dq === '') continue

      const sampleSize = (m.matchCountHome ?? 0) + (m.matchCountAway ?? 0)
      if (sampleSize < 2) continue

      const rs = m.reliabilityScore ?? 0
      if (!Number.isFinite(rs) || rs < 70) continue

      const btts = m.bttsProb ?? 0
      const over = m.over25Prob ?? 0

      const bttsQualifies = Number.isFinite(btts) && btts >= 0.65
      const overQualifies = Number.isFinite(over) && over >= 0.65

      if (!bttsQualifies && !overQualifies) continue

      let market: 'BTTS' | 'OVER 2.5'
      let probability: number
      if (bttsQualifies && overQualifies) {
        if (btts >= over) { market = 'BTTS'; probability = btts }
        else { market = 'OVER 2.5'; probability = over }
      } else if (bttsQualifies) {
        market = 'BTTS'; probability = btts
      } else {
        market = 'OVER 2.5'; probability = over
      }

      candidates.push({
        match: m,
        market,
        probability,
        reliabilityScore: rs,
        dataQuality: dq,
        matchCountTotal: (m.matchCountHome ?? 0) + (m.matchCountAway ?? 0),
      })
    }

    const dataQualityRank = (dq: string) => dq === 'HIGH' ? 2 : dq === 'MEDIUM' ? 1 : 0

    candidates.sort((a, b) => {
      if (a.reliabilityScore !== b.reliabilityScore) return b.reliabilityScore - a.reliabilityScore
      if (a.probability !== b.probability) return b.probability - a.probability
      const dqA = dataQualityRank(a.dataQuality)
      const dqB = dataQualityRank(b.dataQuality)
      if (dqA !== dqB) return dqB - dqA
      if (a.matchCountTotal !== b.matchCountTotal) return b.matchCountTotal - a.matchCountTotal
      const keyA = `${a.match.home} vs ${a.match.away}`
      const keyB = `${b.match.home} vs ${b.match.away}`
      return keyA.localeCompare(keyB)
    })

    return candidates.slice(0, 3)
  }, [liveTodayMatches, scheduledTodayMatches, loading])

  // ─── Filtres ──────────────────────────────────────────────────────────
  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: t.predictions.all },
    { id: 'BTTS', label: 'BTTS' },
    { id: 'O2.5', label: 'Over 2.5' },
    { id: 'HIGH', label: lang === 'fr' ? 'Confiance élevée' : lang === 'en' ? 'High confidence' : 'ثقة عالية' },
  ]

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (activeFilter === 'BTTS') return (m.bttsProb ?? 0) >= 0.5
      if (activeFilter === 'O2.5') return (m.over25Prob ?? 0) >= 0.5
      if (activeFilter === 'HIGH') return (m.reliabilityScore ?? 0) >= 80
      return true
    })
  }, [matches, activeFilter])

  const insufficientDataLabel = lang === 'fr'
    ? 'Projection masquée : échantillon de données insuffisant.'
    : lang === 'en'
      ? 'Projection hidden: insufficient data sample.'
      : 'تم إخفاء التوقع: عينة البيانات غير كافية.'
  const labels: DashboardLabels = lang === 'fr'
    ? { exactScore: 'Score exact proposé', projection: 'Projection issue des données disponibles, sans garantie de résultat.', source: 'Source', quality: 'Qualité', matches: 'matchs', dataConfidence: 'Confiance des données', aiAnalysis: 'Notre analyse du match', score: 'Score', xgHome: 'λ domicile', xgAway: 'λ extérieur', xgTotal: 'λ total', xgHint: 'Buteurs attendus modélisés (λ) : moyennes de buts récents (ESPN) converties par notre modèle statistique. Pas des xG de fournisseur.', openMatch: 'Ouvrir la page du match' }
    : lang === 'en'
      ? { exactScore: 'Proposed exact score', projection: 'Projection based on available data, with no result guaranteed.', source: 'Source', quality: 'Quality', matches: 'matches', dataConfidence: 'Data confidence', aiAnalysis: 'Our match analysis', score: 'Score', xgHome: 'Home λ', xgAway: 'Away λ', xgTotal: 'Total λ', xgHint: 'Modeled expected goals (λ): recent real goals averages (ESPN) converted through our statistical model. Not provider xG.', openMatch: 'Open match page' }
      : { exactScore: 'النتيجة الدقيقة المقترحة', projection: 'توقع مبني على البيانات المتاحة دون ضمان للنتيجة.', source: 'المصدر', quality: 'الجودة', matches: 'مباريات', dataConfidence: 'موثوقية البيانات', aiAnalysis: 'تحليلنا للمباراة', score: 'النتيجة', xgHome: 'λ صاحب الأرض', xgAway: 'λ الضيف', xgTotal: 'إجمالي λ', xgHint: 'أهداف متوقعة نمذجة (λ) من متوسطات أهداف حقيقية حديثة (ESPN) عبر نموذجنا الإحصائي.', openMatch: 'فتح صفحة المباراة' }

  // ─── Révélation au scroll (IntersectionObserver, gate .btx3d) ─────────
  // Sans JS : cartes toujours visibles (progressive enhancement).
  // reduced-motion : tout est révélé immédiatement.
  useEffect(() => {
    const section = sectionRef.current
    if (!section || loading) return
    const cards = Array.from(section.querySelectorAll<HTMLElement>('.btx-rev:not(.is-revealed)'))
    if (cards.length === 0) return

    let reduced = false
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      /* no-op */
    }
    if (reduced || typeof IntersectionObserver === 'undefined') {
      cards.forEach(c => c.classList.add('is-revealed'))
      return
    }

    section.classList.add('btx3d')
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.style.transitionDelay = el.style.getPropertyValue('--d') || '0ms'
          el.classList.add('is-revealed')
          io.unobserve(el)
          const done = (e: TransitionEvent) => {
            if (e.propertyName !== 'transform') return
            el.style.transitionDelay = ''
            el.removeEventListener('transitionend', done)
          }
          el.addEventListener('transitionend', done)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    )
    cards.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [loading, activeFilter, filteredMatches, liveTodayMatches, scheduledTodayMatches, finishedTodayMatches, upcomingMatches, now])

  // ─── Compteurs animés du header ────────────────────────────────────────
  const animCount = useCountUp(stats.todayCount, !loading)
  const animBtts = useCountUp(stats.bttsHigh, !loading)
  const animOver = useCountUp(stats.overHigh, !loading)
  const animReliability = useCountUp(stats.avgReliability ?? 0, !loading && stats.avgReliability != null)

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <section id="btts-today-dashboard" ref={sectionRef} className="max-w-[1200px] mx-auto px-3 sm:px-4 py-4 sm:py-6">

      {/* ─── HERO ─── */}
      <div className="btx-hero btx-rev p-4 sm:p-5 mb-4" style={{ ['--d' as string]: '0ms' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <span className="btx-eyebrow">
              <span className="btx-eyebrow-dot" aria-hidden="true" />
              BTTSPredict
              <span style={{ opacity: 0.65, fontWeight: 600 }}>· AI + Statistical Engine</span>
            </span>
            <h2 className="btx-title">
              {lang === 'fr' ? <>Pronostics <em>du jour</em></> : lang === 'en' ? <>Today’s <em>predictions</em></> : <>توقعات <em>اليوم</em></>}
            </h2>
            <p className="btx-sub">
              {lang === 'fr'
                ? 'Prédictions statistiques basées sur des données réelles de matchs'
                : lang === 'en'
                  ? 'Statistical predictions powered by real match data'
                  : 'توقعات إحصائية مبنية على بيانات حقيقية للمباريات'}
            </p>
          </div>
          {generationDate && (
            <span className="btx-datechip">
              {lang === 'fr' ? 'Données générées' : lang === 'en' ? 'Data generated' : 'البيانات المولدة'} · {fmtDate(generationDate)}
            </span>
          )}
        </div>

        {/* ─── Stats réelles ─── */}
        <div className="btx-stats mt-4">
          <div className="btx-stat" style={{ ['--glow' as string]: 'rgba(47, 125, 255, 0.16)' }}>
            <div className="btx-stat__label">{lang === 'fr' ? 'Matchs du jour' : lang === 'en' ? 'Matches today' : 'مباريات اليوم'}</div>
            <div className="btx-stat__value" style={{ ['--accent' as string]: '#F2F6FA' }}>{animCount}</div>
          </div>
          <div className="btx-stat" style={{ ['--glow' as string]: 'rgba(52, 211, 153, 0.16)' }}>
            <div className="btx-stat__label">BTTS ≥ 60%</div>
            <div className="btx-stat__value" style={{ ['--accent' as string]: '#34D399' }}>{animBtts}</div>
          </div>
          <div className="btx-stat" style={{ ['--glow' as string]: 'rgba(251, 191, 36, 0.15)' }}>
            <div className="btx-stat__label">Over 2.5 ≥ 60%</div>
            <div className="btx-stat__value" style={{ ['--accent' as string]: '#FBBF24' }}>{animOver}</div>
          </div>
          <div className="btx-stat" style={{ ['--glow' as string]: 'rgba(47, 125, 255, 0.16)' }}>
            <div className="btx-stat__label">{lang === 'fr' ? 'Confiance moyenne' : lang === 'en' ? 'Avg. confidence' : 'متوسط الثقة'}</div>
            <div className="btx-stat__value" style={{ ['--accent' as string]: '#7DB5FF' }}>
              {stats.avgReliability != null ? `${animReliability}` : '—'}
              {stats.avgReliability != null && <span className="btx-stat__unit">%</span>}
            </div>
          </div>
        </div>

        <div className="btx-reliability">
          <span className="btx-reliability__label">
            {lang === 'fr' ? 'Qualité des données' : lang === 'en' ? 'Data quality' : 'جودة البيانات'}
          </span>
          <span className="btx-reliability__note">
            {lang === 'fr'
              ? 'Indicateur de qualité des données disponibles — ce n’est pas une probabilité de réussite.'
              : lang === 'en'
                ? 'Indicator of available data quality — this is not a probability of success.'
                : 'مؤشر جودة البيانات المتاحة — وليس احتمالاً للنجاح.'}
          </span>
        </div>
      </div>

      {/* ─── AI COMBO OF THE DAY ─── */}
      {/* Deterministic selection — NO Gemini call from client, NO recalculation. */}
      {/* CTA affiliation — lien tracké obligatoire avant le code promo */}
      <div className="btx-rev mb-4 rounded-xl border px-3 py-3 sm:px-4" style={{ ['--d' as string]: '40ms', borderColor: 'rgba(47,125,255,0.28)', background: 'linear-gradient(135deg, rgba(47,125,255,0.10), rgba(11,15,20,0.9))' }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] sm:text-[13px] leading-relaxed" style={{ color: '#C5D0DC' }}>
            {lang === 'fr'
              ? <>Pour parier avec bonus : <strong style={{ color: '#F2F6FA' }}>1)</strong> inscris-toi via notre lien Linebet · <strong style={{ color: '#F2F6FA' }}>2)</strong> entre le code <strong style={{ color: '#7CF5B8' }}>VISION221</strong> avant le 1er dépôt.</>
              : lang === 'en'
                ? <>To claim the bonus: <strong style={{ color: '#F2F6FA' }}>1)</strong> sign up via our Linebet link · <strong style={{ color: '#F2F6FA' }}>2)</strong> enter <strong style={{ color: '#7CF5B8' }}>VISION221</strong> before your first deposit.</>
                : <>للحصول على المكافأة: <strong style={{ color: '#F2F6FA' }}>1)</strong> سجّل عبر رابط Linebet · <strong style={{ color: '#F2F6FA' }}>2)</strong> أدخل <strong style={{ color: '#7CF5B8' }}>VISION221</strong> قبل الإيداع.</>}
          </p>
          <a
            href={AFFILIATE.linebet}
            onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'dashboard-banner')}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-[12px] font-bold text-white"
            style={{ backgroundColor: '#2F7DFF' }}
            data-cta="dashboard-linebet-signup"
          >
            {lang === 'fr' ? "S'inscrire · VISION221" : lang === 'en' ? 'Sign up · VISION221' : 'تسجيل · VISION221'}
          </a>
        </div>
      </div>

      {/* Source: /predictions.json fields only (bttsProb, over25Prob, reliabilityScore, dataQuality, dataSource). */}
      {!loading && (liveTodayMatches.length > 0 || scheduledTodayMatches.length > 0) && (
        <div className="btx-combo btx-rev mb-4" style={{ ['--d' as string]: '60ms' }}>
          <div className="btx-combo__head">
            <span className="btx-combo__icon" aria-hidden="true">✦</span>
            <div className="flex-1 min-w-0">
              <div className="btx-combo__kicker">AI COMBO</div>
              <div className="btx-combo__title">
                {lang === 'fr' ? 'Combo IA du jour' : lang === 'en' ? 'AI Combo of the Day' : 'تركيبة الذكاء الاصطناعي لليوم'}
              </div>
              <div className="btx-combo__note">
                {lang === 'fr'
                  ? 'Sélection déterministe basée sur les données disponibles — ne garantit aucun résultat.'
                  : lang === 'en'
                    ? 'Deterministic selection based on available data — no result is guaranteed.'
                    : 'اختيار محدد يعتمد على البيانات المتاحة — لا توجد ضمانات لأي نتيجة.'}
              </div>
            </div>
          </div>

          {/* Picks — exactly 3 required, otherwise neutral empty state. Legacy copy: No combo available today. */}
          {combo.length < 3 ? (
            <div className="btx-empty" style={{ padding: '1.4rem 1rem' }}>
              <p className="btx-empty__title">{t.predictions.noCombo}</p>
              <p className="btx-empty__sub">
                {lang === 'fr'
                  ? 'Conditions : qualité des données différente de LOW, fiabilité ≥ 70 %, BTTS ou Over 2.5 ≥ 65 %.'
                  : lang === 'en'
                    ? 'Eligibility: data quality is not LOW, reliability ≥ 70%, BTTS or Over 2.5 ≥ 65%.'
                    : 'الشروط: جودة البيانات ليست منخفضة، الموثوقية ≥ 70%، وBTTS أو Over 2.5 ≥ 65%.'}
              </p>
            </div>
          ) : (
            <div>
              {combo.map((pick, i) => (
                <ComboPickRow
                  key={`${pick.match.key}-${pick.market}`}
                  pick={pick}
                  index={i}
                  lang={lang}
                />
              ))}
            </div>
          )}

          <p className="btx-disclaimer" style={{ marginTop: '0.8rem' }}>
            {lang === 'fr'
              ? 'Sélection IA basée sur les sorties du modèle statistique. Aucun pari n’est garanti.'
              : lang === 'en'
                ? 'AI selection based on statistical model outputs. No bet is guaranteed.'
                : 'اختيار الذكاء الاصطناعي مبني على مخرجات النموذج الإحصائي. لا توجد ضمانات لأي رهان.'}
          </p>
        </div>
      )}

      {/* ─── FILTRES ─── */}
      <div className="btx-filters btx-rev mb-4" role="group" aria-label={lang === 'fr' ? 'Filtres de pronostics' : lang === 'ar' ? 'مرشحات التوقعات' : 'Prediction filters'} style={{ ['--d' as string]: '90ms' }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            aria-pressed={activeFilter === f.id}
            className={`btx-filter${activeFilter === f.id ? ' is-active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ─── SECTIONS MATCHS ─── */}
      {loading ? (
        <div className="btx-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="btx-skel" aria-hidden="true" />)}
        </div>
      ) : (
        <>
          {/* ─── Aujourd'hui (live + à venir) ─── */}
          <div className="mb-7">
            <h3 className="btx-section-title">
              {lang === 'fr' ? 'Aujourd’hui' : lang === 'en' ? 'Today' : 'اليوم'}
              <span className={`btx-count-pill${(scheduledTodayMatches.length + liveTodayMatches.length) > 0 ? ' btx-count-pill--green' : ' btx-count-pill--muted'}`}>
                {scheduledTodayMatches.length + liveTodayMatches.length}
              </span>
            </h3>
            {scheduledTodayMatches.length === 0 && liveTodayMatches.length === 0 ? (
              <div className="btx-empty">
                <p className="btx-empty__title">{lang === 'fr' ? 'Aucun match disponible aujourd’hui' : lang === 'en' ? 'No match available today' : 'لا توجد مباريات متاحة اليوم'}</p>
                <p className="btx-empty__sub">{lang === 'fr' ? 'Revenez plus tard ou consultez les matchs à venir ci-dessous.' : lang === 'en' ? 'Come back later or check the upcoming matches below.' : 'عد لاحقاً أو راجع المباريات القادمة أدناه.'}</p>
              </div>
            ) : (
              <div className="btx-grid">
                {[...liveTodayMatches, ...scheduledTodayMatches]
                  .filter(m => passesFilter(m, activeFilter))
                  .map((m, i) => (
                    <MatchCard
                      key={`today-${m.key}`}
                      match={m}
                      index={i}
                      status="scheduled"
                      lang={lang}
                      insufficientDataLabel={insufficientDataLabel}
                      labels={labels}
                      now={now}
                    />
                  ))}
              </div>
            )}
          </div>

          {finishedTodayMatches.length > 0 && (
            <div className="mb-7">
              <h3 className="btx-section-title" style={{ color: C.textSec }}>
                {/* Conservé pour cohérence i18n et tests d'acceptance */}
                {lang === 'fr' ? 'Terminés aujourd’hui' : lang === 'en' ? 'Finished today' : 'انتهت اليوم'}
                <span className="btx-count-pill btx-count-pill--muted">{finishedTodayMatches.length}</span>
              </h3>
              <div className="btx-grid" style={{ opacity: 0.82 }}>
                {finishedTodayMatches.filter(m => passesFilter(m, activeFilter)).map((m, i) => (
                  <MatchCard
                    key={`finished-${m.key}`}
                    match={m}
                    index={i}
                    status="finished"
                    lang={lang}
                    insufficientDataLabel={insufficientDataLabel}
                    labels={labels}
                    now={now}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── À venir (autres jours) ─── */}
          {upcomingMatches.length > 0 && (
            <div className="mb-7">
              <h3 className="btx-section-title">
                {lang === 'fr' ? 'À venir' : lang === 'en' ? 'Upcoming' : 'القادمة'}
                <span className="btx-count-pill">{upcomingMatches.length}</span>
              </h3>
              <div className="btx-grid">
                {upcomingMatches
                  .filter(m => passesFilter(m, activeFilter))
                  .map((m, i) => (
                    <MatchCard
                      key={`upcoming-${m.key}`}
                      match={m}
                      index={i}
                      status="scheduled"
                      lang={lang}
                      insufficientDataLabel={insufficientDataLabel}
                      labels={labels}
                      now={now}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Empty state when both sections are empty under current filter */}
          {scheduledTodayMatches.length === 0 && liveTodayMatches.length === 0 && upcomingMatches.length === 0 && (
            <div className="btx-empty">
              <p className="btx-empty__title">{lang === 'fr' ? 'Aucun match sous ce filtre' : lang === 'en' ? 'No matches under this filter' : 'لا توجد مباريات ضمن هذا الفلتر'}</p>
              <p className="btx-empty__sub">{lang === 'fr' ? 'Essayez un autre filtre ou revenez plus tard.' : lang === 'en' ? 'Try another filter or come back later.' : 'جرّب فلترًا آخر أو عد لاحقاً.'}</p>
            </div>
          )}
        </>
      )}

      {/* ─── Footer disclaimer ─── */}
      <p className="btx-disclaimer">
        {lang === 'fr' ? 'Prédictions statistiques basées sur des buts attendus modélisés (λ) issus des buts récents réels (ESPN) et notre modèle statistique. Aucun résultat futur garanti. 18+' : lang === 'en' ? 'Statistical predictions based on modeled expected goals (λ) from recent real goals (ESPN) and our statistical model. No future result guaranteed. 18+.' : 'توقعات إحصائية مبنية على أهداف متوقعة نمذجة (λ) من أهداف حقيقية حديثة (ESPN) ونموذجنا الإحصائي. لا توجد ضمانات لنتيجة مستقبلية. 18+'}
      </p>
    </section>
  )
}


