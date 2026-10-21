import { createElement } from 'react'
import { render, cleanup, act } from './react-dom-test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

const CONSENT = 'bttsbet_cookie_consent'
const ID = 'G-TEST123'
const globalWindow = () => window as unknown as Record<string, unknown>

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_GA_ID', ID)
  vi.stubEnv('NODE_ENV', 'production')
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  document.querySelectorAll('script[data-bttspredict-ga]').forEach(node => node.remove())
  for (const key of ['dataLayer', 'gtag', `ga-disable-${ID}`]) delete globalWindow()[key]
  localStorage.clear()
  vi.unstubAllEnvs()
})
async function mountAnalytics() {
  const { default: AnalyticsLoader } = await import('../src/components/bttsbet/AnalyticsLoader')
  return render(createElement(AnalyticsLoader))
}
function consent(analytics: boolean) {
  localStorage.setItem(CONSENT, JSON.stringify({ preferences: { analytics } }))
  act(() => window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { analytics } })))
}

describe('GA4 consent and CSP', () => {
  it('does not load GA without persisted consent, including a spoofed consent event', async () => {
    await mountAnalytics()
    act(() => window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { analytics: true } })))
    expect(document.querySelector('script[data-bttspredict-ga]')).toBeNull()
    expect(globalWindow()[`ga-disable-${ID}`]).toBe(true)
  })
  it('enables after acceptance, disables on refusal, and re-enables without duplicate script', async () => {
    await mountAnalytics()
    consent(true)
    expect(globalWindow()[`ga-disable-${ID}`]).toBe(false)
    expect(document.querySelectorAll('script[data-bttspredict-ga]')).toHaveLength(1)
    expect((document.querySelector('script[data-bttspredict-ga]') as HTMLScriptElement).src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    consent(false)
    expect(globalWindow()[`ga-disable-${ID}`]).toBe(true)
    consent(true)
    expect(globalWindow()[`ga-disable-${ID}`]).toBe(false)
    expect(document.querySelectorAll('script[data-bttspredict-ga]')).toHaveLength(1)
    expect(globalWindow().dataLayer).toContainEqual(['config', ID, {
      anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false,
    }])
  })
  it('does not load GA when the measurement ID is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    localStorage.setItem(CONSENT, JSON.stringify({ preferences: { analytics: true } }))
    await mountAnalytics()
    expect(document.querySelector('script[data-bttspredict-ga]')).toBeNull()
  })
  it('permits the GA4 script and collection endpoints without unsafe-eval or advertising domains', () => {
    const contents = fs.readFileSync('public/.htaccess', 'utf8')
    const policy = contents.match(/Header always set Content-Security-Policy "([^"]+)"/)?.[1]
    expect(policy).toBeTruthy()
    const directives = Object.fromEntries(policy!.split(';').map(part => part.trim().split(/\s+/)).filter(parts => parts[0]).map(([key, ...values]) => [key, values]))
    expect(directives['script-src']).toContain('https://www.googletagmanager.com')
    expect(directives['connect-src']).toContain('https://*.google-analytics.com')
    expect(directives['connect-src']).toContain('https://*.google.com')
    expect(directives['img-src']).toContain('https://*.google-analytics.com')
    expect(policy).not.toContain('unsafe-eval')
    expect(policy).not.toMatch(/doubleclick|googlesyndication/)
    expect(directives['default-src']).toEqual(["'self'"])
    expect(directives['frame-ancestors']).toEqual(["'none'"])
  })
})
