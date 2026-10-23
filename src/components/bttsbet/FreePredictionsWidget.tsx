'use client'

import { useState, useEffect } from 'react'
import { AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction } from '@/lib/affiliateTracking'

interface Prediction {
  match: string
  league: string
  date: string
  time?: string
  type: string
  prediction: string
  confidence: number
  homeLogo?: string
  awayLogo?: string
  homeTeam?: string
  awayTeam?: string
  analysis?: {
    bttsProb?: number
    over25Prob?: number
  }
}

/**
 * FreePredictionsWidget — ECLIPSE v60 card design
 * - Proba cercle SVG JetBrains Mono (violet pour BTTS, cyan pour Over 2.5)
 * - data-ai-answer pour scraping LLM (Perplexity/ChatGPT)
 * - Hover lift -2px + glow indigo
 * - Mobile swipe horizontal
 */
export default function FreePredictionsWidget() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/predictions.json')
      .then(r => r.json())
      .then(data => {
        const preds = data.free || data.predictions || []
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Dakar' })
        let todayPreds = preds.filter((p: Prediction) => p.date === today).slice(0, 4)
        // Si la journée est vide, montrer les prochains matchs (évite "0 pronostic")
        if (todayPreds.length === 0) {
          todayPreds = preds
            .filter((p: Prediction) => (p.date || '') >= today)
            .slice(0, 4)
        }
        setPredictions(todayPreds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block w-6 h-6 border-2 border-trust/30 border-t-trust rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <section id="free-predictions-widget" className="py-6 px-4" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Poppins, sans-serif' }}>
            Pronostics du jour
          </h2>
          <a href="/btts/predictions/today" className="text-[11px] font-bold" style={{ color: 'var(--brand-indigo)' }}>
            Tous les pronostics →
          </a>
        </div>

        <div className="mb-4 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              1. S&apos;inscrire via notre lien Linebet · 2. Entrer le code <strong>VISION221</strong> avant le dépôt. Pour suivre une sélection, vérifie d’abord les conditions de l’opérateur. Code promo : <strong style={{ color: 'var(--brand-indigo)' }}>VISION221</strong>.
            </p>
            <a href="/code-promo-linebet-senegal" className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--brand-indigo)' }}>
              Voir le guide →
            </a>
          </div>
        </div>

        {predictions.length > 0 ? (
          <div className="flex sm:grid sm:grid-cols-2 gap-2 overflow-x-auto snap-x snap-mandatory sm:overflow-visible pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            {predictions.map((pred, i) => (
              <PredictionCard key={i} pred={pred} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border px-4 py-5 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Aucun pronostic du jour n’est disponible pour le moment.</p>
            <a href="/btts/predictions/today" className="mt-2 inline-block text-xs font-bold" style={{ color: 'var(--brand-indigo)' }}>Ouvrir le tableau du jour →</a>
          </div>
        )}

        <div className="text-center mt-3">
          <a
            href={AFFILIATE.linebet}
            rel="sponsored nofollow noopener noreferrer"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ backgroundColor: 'var(--brand-indigo)', color: 'var(--cta-text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--cta-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-indigo)')}
            onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'free-predictions-widget')}
            data-cta="free-predictions-linebet"
            aria-label="Ouvrir Linebet avec le code promo VISION221"
          >
            S&apos;inscrire sur Linebet · code VISION221 →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Prediction Card — ECLIPSE v60 design ─────────────────────────────────
function PredictionCard({ pred }: { pred: Prediction }) {
  const teams = pred.match.split(/\s+vs?\s+/i)
  const home = teams[0]?.trim() || ''
  const away = teams[1]?.trim() || ''
  const isBTTS = pred.type === 'BTTS'
  const proba = isBTTS ? pred.analysis?.bttsProb ?? pred.confidence / 100 : pred.analysis?.over25Prob ?? pred.confidence / 100
  const probaPercent = Math.round(proba * 1000) / 10 // 1 décimale
  const probaColor = isBTTS ? '#2F7DFF' : '#2F7DFF' // assombri cyan #2F7DFF → #2F7DFF
  const isLive = false // could be derived from time vs now

  // data-ai-answer: 2 phrases que Perplexity/ChatGPT vont scraper
  const aiAnswer = isBTTS
    ? `Sélection BTTS ${pred.prediction} pour ${home} vs ${away}. Probabilité publiée : ${probaPercent}%. Consultez l'analyse complète et la méthodologie ; cette estimation ne garantit pas le résultat.`
    : `Sélection Over 2.5 ${pred.prediction} pour ${home} vs ${away}. Probabilité publiée : ${probaPercent}%. Consultez l'analyse complète et la méthodologie ; cette estimation ne garantit pas le résultat.`

  // Cercle SVG proba
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (proba * circumference)

  return (
    <div
      data-ai-answer={aiAnswer}
      data-prediction-type={pred.type}
      data-prediction-match={pred.match}
      data-prediction-confidence={pred.confidence}
      className="snap-start flex-shrink-0 w-[280px] sm:w-auto rounded-xl p-3 transition-all duration-200 cursor-default"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--brand-indigo)'
        e.currentTarget.style.boxShadow = '0 0 20px rgba(127, 162, 198, 0.30), 0 8px 32px rgba(7, 17, 26, 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Header: league pill + time + LIVE dot */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] font-mono truncate max-w-[140px]" style={{ color: 'var(--text-tertiary)' }}>
          {pred.league}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--error)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--error)' }} />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Teams + logos */}
      <div className="flex items-center gap-2 mb-2.5">
        <TeamLogoMini src={pred.homeLogo} alt={home} />
        <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
          {home}
        </span>
        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>vs</span>
        <span className="text-xs font-semibold truncate flex-1 text-right" style={{ color: 'var(--text-primary)' }}>
          {away}
        </span>
        <TeamLogoMini src={pred.awayLogo} alt={away} />
      </div>

      {/* Type pill + proba cercle SVG */}
      {/* Type pill — Oui/Non only */}
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: isBTTS ? 'rgba(169, 196, 223, 0.12)' : 'rgba(169, 196, 223, 0.12)',
            color: probaColor,
            border: `1px solid ${isBTTS ? 'rgba(169, 196, 223, 0.25)' : 'rgba(169, 196, 223, 0.25)'}`,
          }}
        >
          {isBTTS ? 'BTTS' : 'O2.5'} {pred.prediction}
        </span>
      </div>
    </div>
  )
}

function TeamLogoMini({ src, alt }: { src?: string; alt: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    // Fallback: initials + name (accessibility: status not only by image)
    const initials = alt?.slice(0, 3).toUpperCase() || '?'
    return (
      <span
        className="w-5 h-5 flex items-center justify-center text-[9px] font-bold rounded flex-shrink-0"
        style={{ backgroundColor: '#141C25', color: '#9DABBB' }}
        aria-label={alt}
        title={alt}
      >
        {initials}
      </span>
    )
  }
  return <img src={src} alt={`Logo ${alt}`} className="w-5 h-5 object-contain flex-shrink-0 rounded" width={20} height={20} onError={() => setErr(true)} loading="lazy" decoding="async" />
}
