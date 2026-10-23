'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SITE, AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import MovingGradientButton from './MovingGradientButton'

/**
 * StickyCTABar — Mobile-only sticky CTA bar (appears after 40% scroll)
 * Height: 64px, safe-area iOS respected, dismissible
 * Two actions: Copy code + Register
 * Fix: guard division par zéro (denom <= 0), seuil 40 %, listener resize,
 * état calculé au mount.
 */
export default function StickyCTABar() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const onScroll = () => {
      // FIX division par zéro : page plus courte que le viewport (scrollHeight ≈ innerHeight)
      const denom = document.documentElement.scrollHeight - window.innerHeight
      if (denom <= 0) { setVisible(false); return }
      const scrollPercent = window.scrollY / denom
      setVisible(scrollPercent > 0.2) // 20 % — inscription visible plus tôt
    }
    onScroll() // état correct dès le mount (pas d'attente du 1er scroll)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [dismissed])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(SITE.promoCode)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = SITE.promoCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    trackAffiliateCodeCopy('linebet', 'sticky-vision221')
    setCopied(true)
    // Vibration feedback (mobile)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15)
    }
    setTimeout(() => setCopied(false), 2000)
  }

  if (dismissed) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed left-0 right-0 z-40 md:hidden"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: '0px',
          }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 backdrop-blur-xl"
            style={{
              backgroundColor: 'rgba(7, 17, 26, 0.95)',
              borderTop: '1px solid rgba(47, 125, 255, 0.2)',
              boxShadow: '0 -4px 20px rgba(7, 17, 26, 0.4)',
            }}
          >
            {/* Copy code button */}
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-3 h-[48px] rounded-[12px] flex-shrink-0 transition-all"
              style={{
                backgroundColor: copied ? 'rgba(127, 162, 198, 0.16)' : '#141C25',
                border: '1px solid ' + (copied ? 'rgba(127, 162, 198, 0.30)' : 'rgba(244, 247, 251, 0.12)'),
              }}
              aria-label="Copier le code promo VISION221"
              data-cta="sticky-copy"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F7DFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(244, 247, 251,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
              <span className="font-mono text-[13px] font-bold" style={{ color: copied ? '#2F7DFF' : '#F2F6FA' }}>
                {copied ? 'Copié!' : SITE.promoCode}
              </span>
            </button>

            {/* Register CTA — bouton gradient animé (designer brief) */}
            <MovingGradientButton
              href={AFFILIATE.linebet}
              external
              rel="sponsored nofollow noopener noreferrer"
              dataCta="sticky-register"
              onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'sticky-register')}
              padding="0 1rem"
              style={{ flex: 1, height: 48, borderRadius: 12 }}
              font={{ fontWeight: 700, fontSize: '14px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
              S'inscrire · VISION221
            </MovingGradientButton>

            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="flex items-center justify-center w-[32px] h-[32px] rounded-[8px] flex-shrink-0"
              style={{ backgroundColor: '#141C25' }}
              aria-label="Fermer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(244, 247, 251,0.4)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
