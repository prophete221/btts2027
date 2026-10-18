'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SITE } from '@/lib/constants'
import LanguageSwitcher, { useLanguage } from './LanguageSwitcher'
import { localizedPath, translationsFor } from '@/lib/i18n'
import { trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

/**
 * Navbar BTTSPredict — header plateforme « football intelligence ».
 *
 * - Navigation produit : Matchs du jour (#matchs), Résultats, Historique,
 *   Méthode, Statistiques — uniquement des pages/ancres réelles.
 * - Statut données : point vert « Données mises à jour aujourd’hui »
 *   AFFICHÉ UNIQUEMENT SI VRAI (date de predictions.json == aujourd’hui, UTC — Dakar = UTC+0).
 * - Droite : code VISION221 (copie trackée), langues, CTA principal pronostics.
 * - Mobile : logo + menu (drawer) + CTA compact.
 */
export default function Navbar() {
  const { lang } = useLanguage()
  const t = translationsFor(lang)
  const pathname = usePathname()
  const home = localizedPath('/', lang)
  const pageLinks = [
    { label: t.nav.matchs, href: `${home}#matchs` },
    { label: t.nav.results, href: localizedPath('/resultats-verifies', lang) },
    { label: t.nav.history, href: localizedPath('/historique', lang) },
    { label: t.nav.methodology, href: localizedPath('/methodologie', lang) },
    { label: t.nav.stats2, href: localizedPath('/statistiques', lang) },
  ]
  const partnerLinks = [
    { label: 'Linebet', href: localizedPath('/code-promo-linebet-senegal', lang) },
    { label: '888Starz', href: localizedPath('/bonus-888starz', lang) },
  ]
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dataToday, setDataToday] = useState(false)

  // Statut données — strictement factuel : date(lastUpdated) == aujourd’hui (UTC)
  useEffect(() => {
    let cancelled = false
    fetch('/predictions.json')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d?.lastUpdated) return
        const updatedDay = String(d.lastUpdated).slice(0, 10)
        setDataToday(updatedDay === new Date().toISOString().slice(0, 10))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
    const clean = href.split('#')[0]
    if (clean === '/' || clean === localizedPath('/', lang)) return pathname === clean || pathname === ''
    return pathname === clean || pathname.startsWith(clean + '/')
  }

  return (
    <>
      <nav
        className="sticky top-0 z-50 navbar-blur"
        style={{
          backgroundColor: 'rgba(4, 6, 10, 0.72)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Logo */}
            <a
              href={home}
              className="flex items-center gap-2 flex-shrink-0"
              aria-label={`BTTSPredict — ${t.nav.home}`}
            >
              <img src="/favicon.svg" alt="" width={26} height={26} className="flex-shrink-0 rounded" />
              <span>
                <span className="block text-sm font-bold leading-tight text-papier tracking-tight">BTTSPredict</span>
                <span className="block max-[379px]:hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-primary leading-none">Football data</span>
              </span>
            </a>

            {/* Nav produit — desktop */}
            <div className="hidden lg:flex items-center gap-0.5">
              {pageLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`px-2.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
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
              {/* Statut données — seulement si techniquement vrai */}
              {dataToday && (
                <span
                  className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: '#86E9BC', backgroundColor: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.22)' }}
                  title={t.home2.statusUpdated}
                >
                  <span className="hp-status-dot" aria-hidden="true" />
                  {t.home2.statusUpdated}
                </span>
              )}
              <LanguageSwitcher compact />
              <button
                onClick={copyCode}
                className="hidden md:inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
                style={{
                  border: '1px solid rgba(47, 125, 255, 0.45)',
                  backgroundColor: 'rgba(47, 125, 255, 0.10)',
                  color: copied ? '#34D399' : '#4A90FF',
                }}
                aria-label={`Copier le code promo ${navPromoCode}`}
              >
                {copied ? '✓ Copié' : navPromoCode}
              </button>

              {/* CTA principal — desktop */}
              <a
                href={`${home}#matchs`}
                data-cta="navbar-open-picks"
                className="hidden sm:inline-flex items-center px-3.5 h-9 rounded-lg text-[13px] font-bold whitespace-nowrap transition-all hp-cta-primary"
              >
                {t.nav.ctaPronostics}
              </a>

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

      {/* === DRAWER MOBILE === */}
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

            {dataToday && (
              <div className="px-4 pb-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#86E9BC' }}>
                  <span className="hp-status-dot" aria-hidden="true" />
                  {t.home2.statusUpdated}
                </span>
              </div>
            )}

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

            <div className="px-4 py-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: '#223041' }}>
              <a
                href={`${home}#matchs`}
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-bold hp-cta-primary"
              >
                {t.nav.ctaPronostics}
              </a>
              <button
                onClick={() => { copyCode(); setMenuOpen(false) }}
                className="px-3 py-2.5 rounded-lg text-sm font-mono font-semibold text-center transition-colors"
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
