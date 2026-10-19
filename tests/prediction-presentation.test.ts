import { describe, expect, it } from 'vitest'
import { analysisHeading, confidenceLabel, marketLabel, publicationNote, statusLabel } from '@/lib/predictionPresentation'

describe('human prediction presentation', () => {
  it('uses plain-language market names', () => {
    expect(marketLabel('BTTS')).toBe('Les deux équipes marquent')
    expect(marketLabel('Over 2.5')).toBe('Plus de 2,5 buts')
  })

  it('does not present missing confidence as a percentage', () => {
    expect(confidenceLabel(undefined)).toBe('Données insuffisantes')
  })

  it('keeps honest result labels', () => {
    expect(statusLabel('WON')).toBe('Gagné')
    expect(statusLabel('LOST')).toBe('Perdu')
    expect(statusLabel('PENDING')).toBe('En attente')
  })

  it('uses human headings and publication context', () => {
    expect(analysisHeading()).toBe('Notre lecture du match')
    expect(publicationNote()).toContain('coup d’envoi')
  })
})
