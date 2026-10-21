import { describe, expect, test } from 'vitest'
import { getConfidence, getProba } from '@/lib/predictions'

describe('probabilités et confiance sans valeurs inventées', () => {
  test('préserve les valeurs valides même sous le seuil de publication', () => {
    expect(getProba({ proba: 0.41 })).toBe(0.41)
    expect(getProba({ probability: 0.53 })).toBe(0.53)
    expect(getProba({ confidence: 41 })).toBe(0.41)
    expect(getConfidence({ confidence: 41 })).toBe(41)
  })

  test('utilise le champ d’analyse correspondant au marché sans plancher artificiel', () => {
    expect(getProba({ type: 'BTTS', analysis: { bttsProb: 0.32 } })).toBe(0.32)
    expect(getProba({ type: 'Over 2.5', analysis: { over25Prob: 0.57 } })).toBe(0.57)
  })

  test('signale une probabilité manquante comme inconnue avec zéro pour les API numériques', () => {
    expect(getProba({})).toBe(0)
    expect(getConfidence({})).toBe(0)
  })

  test('ignore les valeurs hors plage et continue la chaîne de repli', () => {
    expect(getProba({ proba: 1.2, probability: 0.48 })).toBe(0.48)
    expect(getConfidence({ confidence: 150, proba: 0.48 })).toBe(48)
  })
})
