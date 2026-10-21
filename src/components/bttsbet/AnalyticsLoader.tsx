'use client'

import { useEffect } from 'react'

const CONSENT_KEY = 'bttsbet_cookie_consent'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID
// Ne charge GA qu'en build de production (next dev / preview exclus).
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production'

function analyticsAllowed(): boolean {
  if (!GA_ID || !IS_PRODUCTION_BUILD) return false
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored) as { preferences?: { analytics?: boolean } }
    return parsed.preferences?.analytics === true
  } catch {
    return false
  }
}

function disableAnalytics(): void {
  if (!GA_ID || typeof window === 'undefined') return
  const analyticsGlobal = window as unknown as Record<string, unknown>
  analyticsGlobal[`ga-disable-${GA_ID}`] = true
}

function loadAnalytics(): void {
  if (!GA_ID || !IS_PRODUCTION_BUILD || typeof window === 'undefined') return
  const analyticsGlobal = window as unknown as Record<string, unknown>
  analyticsGlobal[`ga-disable-${GA_ID}`] = false
  if (document.querySelector(`script[data-bttspredict-ga="${GA_ID}"]`)) return

  const analyticsWindow = window as Window & {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || []
  analyticsWindow.gtag = (...args: unknown[]) => analyticsWindow.dataLayer?.push(args)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  script.dataset.bttspredictGa = GA_ID
  document.head.appendChild(script)

  analyticsWindow.gtag('js', new Date())
  analyticsWindow.gtag('config', GA_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false })
}

export default function AnalyticsLoader() {
  useEffect(() => {
    if (analyticsAllowed()) loadAnalytics()
    else disableAnalytics()

    const handleConsent = () => {
      // La préférence persistée fait foi, pas un simple événement DOM.
      if (analyticsAllowed()) loadAnalytics()
      else disableAnalytics()
    }
    window.addEventListener('cookie-consent-changed', handleConsent)
    return () => window.removeEventListener('cookie-consent-changed', handleConsent)
  }, [])

  return null
}
