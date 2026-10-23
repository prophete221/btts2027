'use client'

/**
 * GiftPopup — paquet cadeau flottant « Bonus 300% » (monté GLOBALEMENT dans
 * le layout racine : visible sur toutes les pages du site).
 *
 * Comportement :
 *  - PAGE PRIORITAIRE — /over-2-5/predictions/today (fr, /en et /ar) : la page
 *    la plus visitée du site. Le cadeau s'affiche IMMÉDIATEMENT (après un court
 *    délai d'entrée), sans exiger de scroll, avec une clé de fermeture dédiée
 *    (fermer ici ne masque pas le cadeau sur les autres pages, et réciproquement).
 *  - AUTRES PAGES : apparaît en bas d'écran une fois l'utilisateur scrollé
 *    (~30 % de la page) ou après un filet de sécurité de 7 s — les pages
 *    courtes (mentions légales, CGU…) ne peuvent pas atteindre 30 % de scroll,
 *    le cadeau doit malgré tout s'afficher sur toutes les pages.
 *  - Redirige vers Linebet via le lien de parrainage AFFILIATE.linebet.
 *  - Fermable (croix) : la fermeture est mémorisée en sessionStorage pour ne
 *    plus déranger l'utilisateur pendant la session (par contexte).
 *  - Mobile : positionné au-dessus de MobileTabBar (64px) + StickyCTABar (~68px).
 *  - Desktop : ancré en bas à droite.
 *  - Tracking affiliation : signup_cta_click / gift-popup-300 (consent-gated).
 *  - Motion design framer-motion : entrée ressort, flottement du cadeau,
 *    halo pulsant, étincelles. prefers-reduced-motion → rendu statique.
 *  - SSR : rend null côté serveur (aucun impact SEO / CLS).
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AFFILIATE, SITE } from '@/lib/constants'
import { trackAffiliateAction } from '@/lib/affiliateTracking'
import MovingGradientButton from './MovingGradientButton'

const GIFT_DISMISS_KEY = 'bttsbet_gift_popup_dismissed'
const GIFT_DISMISS_KEY_TODAY = 'bttsbet_gift_popup_dismissed_today'

/** Pages prioritaires : /over-2-5/predictions/today (+ variantes /en et /ar). */
const PRIORITY_PATH_RE = /^\/(?:en|ar)?\/?over-2-5\/predictions\/today\/?$/

export default function GiftPopup() {
  const reduceMotion = useReducedMotion()
  const pathname = usePathname() ?? ''
  const isPriorityPage = PRIORITY_PATH_RE.test(pathname)
  // SSR-safe : caché par défaut, révélé uniquement côté client si non fermé.
  const [dismissed, setDismissed] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissKey = isPriorityPage ? GIFT_DISMISS_KEY_TODAY : GIFT_DISMISS_KEY
    try {
      if (sessionStorage.getItem(dismissKey) === '1') return
    } catch {
      /* sessionStorage indisponible — on affiche normalement */
    }

    const reveal = () => {
      setDismissed(false)
      setVisible(true)
    }

    // Page prioritaire (la plus visitée) : affichage immédiat, sans scroll.
    if (isPriorityPage) {
      /* Léger délai : laisse l'entrée de page se terminer avant le spring. */
      const timer = setTimeout(reveal, 900)
      return () => clearTimeout(timer)
    }

    // Toutes les autres pages : seuil de scroll 30 % + filet de sécurité 7 s
    // (une page plus courte que l'écran ne peut pas atteindre 30 %).
    let armed = false
    const revealOnce = () => {
      if (armed) return
      armed = true
      reveal()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    const onScroll = () => {
      const denom = document.documentElement.scrollHeight - window.innerHeight
      if (denom <= 0 || window.scrollY / denom >= 0.3) revealOnce()
    }
    /* Armer au frame suivant : évite un setState synchrone dans l'effet
       (cascade de rendus). Le seuil de scroll est évalué dès le montage,
       puis à chaque scroll/resize — le filet 7 s couvre les pages courtes. */
    const arm = requestAnimationFrame(() => {
      setDismissed(false)
      onScroll()
    })
    const fallback = setTimeout(revealOnce, 7000)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(arm)
      clearTimeout(fallback)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isPriorityPage])

  const close = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(isPriorityPage ? GIFT_DISMISS_KEY_TODAY : GIFT_DISMISS_KEY, '1')
    } catch {
      /* no-op */
    }
  }

  if (dismissed) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ y: 110, opacity: 0, scale: 0.85, rotate: -6 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ y: 90, opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 19 }}
          className="hp-gift"
          role="complementary"
          aria-label="Exclusive Linebet offer — 300% bonus"
        >
          <div className="hp-gift-card">
            {/* Fermeture — l'utilisateur garde le contrôle */}
            <button onClick={close} className="hp-gift-close" aria-label="Close bonus offer" data-cta="gift-popup-close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Paquet cadeau animé */}
            <motion.div
              className="hp-gift-box"
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -5, 0], rotate: [0, -4, 3, 0] }
              }
              transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              <svg width="42" height="42" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="hpGiftBox" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#00E27A" />
                    <stop offset="1" stopColor="#009E4F" />
                  </linearGradient>
                  <linearGradient id="hpGiftLid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#2BEE92" />
                    <stop offset="1" stopColor="#00B85E" />
                  </linearGradient>
                  <linearGradient id="hpGiftRibbon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFE082" />
                    <stop offset="1" stopColor="#E8B33C" />
                  </linearGradient>
                </defs>
                {/* Ombre au sol */}
                <ellipse cx="32" cy="59" rx="17" ry="3" fill="rgba(0,0,0,0.35)" />
                {/* Nœud — deux boucles */}
                <path d="M32 17 C 25 8, 13 9, 16.5 16.5 C 19 21.5, 27 20.5, 32 17 Z" fill="url(#hpGiftRibbon)" />
                <path d="M32 17 C 39 8, 51 9, 47.5 16.5 C 45 21.5, 37 20.5, 32 17 Z" fill="url(#hpGiftRibbon)" />
                {/* Boîte */}
                <rect x="12" y="27" width="40" height="29" rx="5" fill="url(#hpGiftBox)" />
                {/* Ruban vertical */}
                <rect x="28" y="27" width="8" height="29" fill="url(#hpGiftRibbon)" />
                {/* Couvercle */}
                <rect x="9" y="19" width="46" height="11" rx="4" fill="url(#hpGiftLid)" />
                <rect x="28" y="19" width="8" height="11" fill="url(#hpGiftRibbon)" />
                {/* Reflet */}
                <rect x="15" y="30" width="6" height="22" rx="3" fill="rgba(255,255,255,0.22)" />
              </svg>
            </motion.div>

            {/* Offre */}
            <div className="hp-gift-body">
              <p className="hp-gift-bonus">
                <span>300%</span> Bonus
              </p>
              <p className="hp-gift-sub">
                1. Click below · 2. Enter code <b>{SITE.promoCode}</b>
              </p>
              <MovingGradientButton
                href={AFFILIATE.linebet}
                external
                rel="sponsored nofollow noopener noreferrer"
                dataCta="gift-popup-300"
                onClick={() => trackAffiliateAction('linebet', 'signup_cta_click', 'gift-popup-300')}
                padding="0 0.7rem"
                rounded={10}
                style={{ height: 32, width: '100%' }}
                font={{ fontWeight: 800, fontSize: '12px' }}
                colors={{ fill: '#07271A', hoverFill: '#0B3A26', textColor: '#E9FFF3', hoverTextColor: '#FFFFFF' }}
                border={{ borderWidth: 1.5, borderStyle: 'solid', borderColor: 'rgba(0, 210, 122, 0.45)' }}
                stroke={{ headColor: '#8CFFC1', color: '#00C26E', direction: 'cw', movement: 'step', count: 2, trail: 72, speed: 14 }}
              >
                Sign up · {SITE.promoCode}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </MovingGradientButton>
            </div>

            {/* Étincelles festives (CSS) */}
            <span className="hp-gift-spark hp-gift-spark--1" aria-hidden="true" />
            <span className="hp-gift-spark hp-gift-spark--2" aria-hidden="true" />
            <span className="hp-gift-spark hp-gift-spark--3" aria-hidden="true" />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
