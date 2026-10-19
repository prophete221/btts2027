import { describe, expect, it } from 'vitest'
import { AFFILIATE, BOOKMAKERS, VIP_POLICY } from '@/lib/constants'

describe('affiliate and VIP consistency', () => {
  it('keeps each bookmaker code distinct and explicit', () => {
    const linebet = BOOKMAKERS.find((bookmaker) => bookmaker.id === 'linebet')
    const star888 = BOOKMAKERS.find((bookmaker) => bookmaker.id === '888starz')

    expect(linebet?.promoCode).toBe('VISION221')
    expect(star888?.promoCode).toBe('btts221')
    expect(VIP_POLICY.partner).toBe('Linebet')
    expect(VIP_POLICY.promoCode).toBe(linebet?.promoCode)
  })

  it('keeps affiliate destinations present for both partners', () => {
    expect(AFFILIATE.linebet).toMatch(/^https:\/\//)
    expect(AFFILIATE.star888).toMatch(/^https:\/\//)
    expect(AFFILIATE.linebetDownload).toMatch(/^https:\/\//)
    expect(AFFILIATE.star888Download).toMatch(/^https:\/\//)
  })
})
