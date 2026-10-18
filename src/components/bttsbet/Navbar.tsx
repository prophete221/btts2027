'use client'

import { useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { SITE } from '@/lib/constants'
import LanguageSwitcher, { useLanguage } from './LanguageSwitcher'
import { localizedPath, translationsFor } from '@/lib/i18n'
import { trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

/**
 * Navbar BTTSPredict — Design V2 (plateforme d'analyse)
 *
 * Navigation produit claire : Tableau du jour, Résultats vérifiés,
 * Statistiques, Méthode, VIP. Le CTA VISION221 reste discret (copie).
 * Les liens bookmakers (Linebet / 888Starz) vivent dans le drawer mobile
 * (section partenaires) et le footer — la barre principale reste produit.
 */
export default function Navbar() {
  const { lang } = useLanguage()
  const t = translationsFor(lang)
  const pathname = usePathname()
  const pageLinks = [
    { label: t.nav.today, href: localizedPath('/btts/predictions/today', lang) },
    { label: t.nav.history, href: localizedPath('/resultats-verifies', lang) },
    { label: t.nav.statistics, href: lang === 'fr' ? '/btts/statistics' : localizedPath('/statistiques', lang) },
    { label: t.nav.methodology, href: localizedPath('/methodologie', lang) },
    { label: 'VIP', href: localizedPath('/vip', lang) },
  ]
  const partnerLinks = [
    { label: 'Linebet', href: localizedPath('/code-promo-linebet-senegal', lang) },
    { label: '888Starz', href: localizedPath('/bonus-888starz', lang) },
  ]
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  /* Code promo contextuel : btts221 sur les pages 888Starz, VISION221 (Linebet) ailleurs */
  const is888Page = pathname?.includes('bonus-888starz') ?? false
  const navPromoCode = is888Page ? 'btts221' : SITE.promoCode
  const navPartner: 'linebet' | '888starz' = is888Page ? '888starz' : 'linebet'

  const copyCode = useCallback(async () => {
    // « Copié » n'est affiché que si la copie a réellement réussi
    const ok = await copyTextToClipboard(navPromoCode)
    if (!ok) return
    trackAffiliateCodeCopy(navPartner, 'navbar-promo-code')
    setCopied(true)
    navigator.vibrate?.(15)
    setTimeout(() => setCopied(false), 2000)
  }, [navPromoCode, navPartner])

  const isActive = (href: string) => {
    if (href === '/' || href === localizedPath('/', lang)) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <nav
        className="sticky top-0 z-50 navbar-blur"
        style={{
          backgroundColor: 'rgba(11, 15, 20, 0.88)',
          borderBottom: '1px solid #223041',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
          {/* Ligne unique : Logo + nav produit + VISION221 + langues */}
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Logo BTTSPredict */}
            <a
              href={localizedPath('/', lang)}
              className="flex items-center gap-2 flex-shrink-0"
              aria-label={`BTTSPredict — ${t.nav.home}`}
            >
              <img src="/favicon.svg" alt="" width={26} height={26} className="flex-shrink-0 rounded" />
              <span>
                <span className="block text-sm font-bold leading-tight text-papier tracking-tight">BTTSPredict</span>
                <span className="block max-[379px]:hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-primary leading-none">Match intelligence</span>
              </span>
            </a>

            {/* Nav produit — desktop */}
            <div className="hidden lg:flex items-center gap-1">
              {pageLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive(link.href)
                      ? 'text-papier bg-white/[0.06]'
                      : 'text-cendre hover:text-papier hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Actions droite */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher compact />
              <button
                onClick={copyCode}
                className="hidden sm:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
                style={{
                  border: '1px solid rgba(47, 125, 255, 0.45)',
                  backgroundColor: 'rgba(47, 125, 255, 0.10)',
                  color: copied ? '#34D399' : '#4A90FF',
                }}
                aria-label={`Copier le code promo ${navPromoCode}`}
              >
                {copied ? '✓ Copié' : navPromoCode}
              </button>

              {/* Hamburger — mobile/tablette */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-papier hover:bg-white/[0.06] transition-colors"
                aria-label={t.nav.openMenu}
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* === DRAWER MOBILE — navigation produit + partenaires === */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] lg:hidden"
            style={{ backgroundColor: 'rgba(5, 8, 12, 0.65)' }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <div
            className="fixed top-0 left-0 right-0 z-[70] lg:hidden"
            style={{
              backgroundColor: '#10161D',
              borderBottom: '1px solid #223041',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header du drawer */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#223041' }}>
              <span className="text-sm font-bold text-papier">{t.nav.menu}</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-cendre hover:text-papier"
                aria-label={t.nav.closeMenu}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Liens produit — liste verticale lisible */}
            <nav className="px-3 py-3 grid gap-1" aria-label={t.nav.menu}>
              {pageLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-3 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(link.href) ? 'text-papier bg-white/[0.06]' : 'text-cendre hover:text-papier hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Partenaires — séparés, secondaires */}
            <div className="px-3 pb-1 pt-2 border-t" style={{ borderColor: '#223041' }}>
              <span className="block px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-cendre opacity-60">
                {lang === 'en' ? 'Partners' : lang === 'ar' ? 'شركاء' : 'Partenaires'}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {partnerLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm font-medium text-center text-cendre hover:text-papier transition-colors"
                    style={{ backgroundColor: 'rgba(157, 171, 187, 0.06)', border: '1px solid #223041' }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* CTA copier code — bas du drawer */}
            <div className="px-4 py-3 border-t" style={{ borderColor: '#223041' }}>
              <button
                onClick={() => { copyCode(); setMenuOpen(false) }}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono font-semibold text-center transition-colors"
                style={{
                  border: '1px solid rgba(47, 125, 255, 0.45)',
                  backgroundColor: 'rgba(47, 125, 255, 0.10)',
                  color: copied ? '#34D399' : '#4A90FF',
                }}
              >
                {copied ? '✓ Copié' : navPromoCode}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
