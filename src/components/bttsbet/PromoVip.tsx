'use client'
import { useState } from 'react'
import { useScrollAnimation } from '@/hooks/useAnimations'
import VipUnlockModal from './VipUnlockModal'

const C = {
  bg:'#0B0F14', card:'#141C25', border:'#6B7A8C',
  neon:'#2F7DFF', gold:'#2F7DFF', data:'#2F7DFF',
  text:'#F2F6FA', textSec:'#9DABBB', textMute:'#9DABBB',
  success:'#2F7DFF',
}

export default function PromoVip() {
  const [ref, isVisible] = useScrollAnimation()
  const [showModal, setShowModal] = useState(false)
  return (
    <>
      <section ref={ref} id="coupon-vip" className="py-4 relative">
        <div className="max-w-md mx-auto relative px-4">

          {/* ═══ CARTE VERROUILLÉE PREMIUM ═══ */}
          <div
            className="relative rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.01]"
            style={{
              background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg} 60%, #0A1822 100%)`,
              border: `1px solid ${C.gold}30`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px ${C.gold}10, inset 0 1px 0 ${C.gold}15`,
            }}
          >
            {/* Top accent gradient bar */}
            <div className="h-[3px] w-full" style={{
              background: `linear-gradient(90deg, transparent 0%, ${C.gold} 30%, ${C.neon} 50%, ${C.gold} 70%, transparent 100%)`,
            }} />

            {/* Decorative glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${C.gold}12, transparent 70%)`,
            }} />

            <div className="relative p-5 text-center">

              {/* Lock icon — premium */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 relative" style={{
                background: `linear-gradient(135deg, ${C.gold}20, ${C.gold}08)`,
                border: `1px solid ${C.gold}40`,
                boxShadow: `0 0 24px ${C.gold}25, inset 0 1px 0 ${C.gold}30`,
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1" fill={C.gold} />
                </svg>
              </div>

              {/* Badge */}
              <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-2"
                style={{
                  background: `linear-gradient(135deg, ${C.gold}25, ${C.gold}10)`,
                  color: C.gold,
                  border: `1px solid ${C.gold}40`,
                }}>
                ✦ Accès Premium ✦
              </span>

              {/* Title */}
              <h2 className="text-xl font-black mb-1" style={{
                fontFamily: 'Poppins, sans-serif',
                background: `linear-gradient(135deg, ${C.gold} 0%, ${C.text} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Pronostics Premium
              </h2>

              <p className="text-[11px] mb-4" style={{ color: C.textSec }}>
                Les sélections privées ne sont pas publiées dans les fichiers du site.
              </p>

              {/* Premium features row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(255,215,0,0.06)', border: `1px solid ${C.gold}20` }}>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: C.textMute }}>BTTS</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: C.gold }}>Oui/Non</div>
                </div>
                <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(99,214,255,0.06)', border: `1px solid ${C.data}20` }}>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: C.textMute }}>Over 2.5</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: C.data }}>Oui/Non</div>
                </div>
                <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(52, 211, 153,0.06)', border: `1px solid ${C.success}20` }}>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: C.textMute }}>Cote</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: C.success }}>Non publiée</div>
                </div>
              </div>

              {/* CTA — premium */}
              <button
                onClick={() => setShowModal(true)}
                className="group block w-full h-[44px] rounded-xl font-black text-[13px] uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${C.gold} 0%, ${C.neon} 100%)`,
                  color: C.bg,
                  boxShadow: `0 8px 24px ${C.gold}30, 0 4px 12px ${C.neon}20`,
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Débloquer les pronostics
                </span>
              </button>

              <p className="text-[9px] mt-3" style={{ color: C.textMute }}>
                Conditions d’accès à vérifier auprès de l’équipe · 18+
              </p>
            </div>

            {/* Bottom subtle accent */}
            <div className="h-px w-full" style={{
              background: `linear-gradient(90deg, transparent, ${C.gold}30, transparent)`,
            }} />
          </div>
        </div>
      </section>

      <VipUnlockModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
