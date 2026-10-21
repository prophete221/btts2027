'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { isLocale, localizedPath, LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'

const STORAGE_KEY = 'bttsbet-lang'

export function useLanguage() {
  const pathname = usePathname() || '/'
  const pathLocale = pathname.split('/').filter(Boolean)[0]
  // L'URL est autoritaire : /en/… s'affiche toujours en anglais, /ar/… en
  // arabe, la racine en français. (Avant, un ancien localStorage
  // « bttsbet-lang » pouvait re-franciser les pages /en — corrigé.)
  // Le sélecteur de langue navigue de toute façon vers l'URL localisée,
  // donc la préférence sauvegardée n'a jamais à passer outre le chemin.
  const [lang] = useState<Locale>(isLocale(pathLocale) ? pathLocale : 'fr')

  const change = (newLang: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      /* localStorage indisponible — la navigation suffit */
    }
    window.dispatchEvent(new CustomEvent('lang-change', { detail: newLang }))
    // Navigation immédiate vers l'URL localisée : l'URL reste la source
    // unique de vérité pour la langue affichée.
    window.location.assign(localizedPath(pathname, newLang))
  }

  return { lang, change }
}

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() || '/'
  const { lang, change } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative" dir="ltr">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-cendre hover:text-papier hover:bg-dark-800 transition-all border border-edge"
        aria-label={LOCALE_META[lang].nativeLabel}
        aria-expanded={open}
      >
        <span className="text-sm" aria-hidden="true">{LOCALE_META[lang].flag}</span>
        <span>{LOCALE_META[lang].nativeLabel}</span>
        {!compact && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close language menu" />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-1 z-50 glass-card rounded-lg overflow-hidden min-w-[160px]"
              role="menu"
            >
              {SUPPORTED_LOCALES.map(code => (
                <button
                  type="button"
                  key={code}
                  role="menuitem"
                  onClick={() => { setOpen(false); change(code) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-800 transition-colors ${lang === code ? 'text-success bg-success/5' : 'text-cendre'}`}
                  aria-current={lang === code ? 'true' : undefined}
                  title={localizedPath(pathname, code)}
                >
                  <span className="text-sm" aria-hidden="true">{LOCALE_META[code].flag}</span>
                  <span className="flex-1 text-left">{LOCALE_META[code].nativeLabel}</span>
                  {lang === code && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
