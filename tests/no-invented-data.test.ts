import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { humanMethodLabel } from '@/lib/predictionQuality'
import { statusLabel, confidenceLabel } from '@/lib/predictionPresentation'
import { onlyVipFixtures } from '@/lib/vipPredictions'

/**
 * Gardes anti-régression du chantier audit-conversion-batch.
 * Règle absolue du propriétaire : ne jamais réintroduire de probabilité par
 * défaut 0.62, de lambda inventée 1.3/1.1, de clamp artificiel 40-54 %, ni de
 * contenu gratuit dans l'espace VIP. Ces tests lisent le code source réellement
 * branché : si le pattern interdit revient, le test casse.
 */
function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, '..', relativePath), 'utf8')
}

describe('no invented data — fallbacks interdits', () => {
  it('FreePredictions.tsx n\'invente plus de lambda ni de clamp de probabilité', () => {
    const source = readSource('src/components/bttsbet/FreePredictions.tsx')

    expect(source).not.toMatch(/\?\?\s*1\.3\b/) // lambda domicile inventée
    expect(source).not.toMatch(/\?\?\s*1\.1\b/) // lambda extérieur inventée
    expect(source).not.toMatch(/Math\.max\(40,\s*Math\.min\(54/) // clamp confiance 40-54 %
    expect(source).not.toMatch(/Math\.max\(0\.40,\s*Math\.min\(0\.54/) // clamp probabilité
    expect(source).not.toMatch(/\b0\.62\b/) // probabilité par défaut
  })

  it('FreePredictions.tsx n\'affiche un état insuffisant que sur données réellement insuffisantes', () => {
    const source = readSource('src/components/bttsbet/FreePredictions.tsx')
    // Le calcul d'un marché manquant exige des lambdas réels
    expect(source).toMatch(/homeLambda != null && awayLambda != null \? computeBtts/)
    expect(source).toMatch(/homeLambda != null && awayLambda != null \? computeOver25/)
    // Libellés humains branchés
    expect(source).toContain('humanMethodLabel')
    expect(source).toContain('predictionQuality')
    expect(source).toContain('analysisHeading')
    // Anciens libellés robotiques absents
    expect(source).not.toContain('Pronostic IA')
    expect(source).not.toContain('BTTSPredict AI')
    // URL interne, tracking et CTA affiliés conservés
    expect(source).toContain('generateMatchSlug')
    expect(source).toContain("trackAffiliateAction('linebet', 'signup_cta_click'")
    expect(source).toContain('sponsored')
  })

  it('vip/page.tsx ne consomme que des données explicitement VIP', () => {
    const source = readSource('src/app/vip/page.tsx')

    expect(source).toContain('onlyVipFixtures')
    // L'assemblage gratuit (vipPreview + free + predictions) est interdit
    expect(source).not.toMatch(/vipPreview\s*\|\|\s*\[\]/)
    expect(source).not.toMatch(/\.\.\.\(payload\.free/)
    expect(source).not.toMatch(/\.\.\.\(payload\.predictions/)
    // Message d'absence de sélection VIP exigé par le propriétaire
    expect(source).toContain('Aucune sélection VIP disponible aujourd')
    // Parcours VIP inchangé : code Linebet, dépôt minimum, vérification WhatsApp
    expect(source).toContain("VIP_CODE = 'VISION221'")
    expect(source).toContain("VIP_DEPOSIT = '10 €'")
    expect(source).toContain('whatsapp_click')
  })

  it('match/[slug]/page.tsx n\'affiche plus de date de source codée en dur ni d\'anglicismes', () => {
    const source = readSource('src/app/match/[slug]/page.tsx')

    expect(source).not.toMatch(/depuis le 2026-08-08/)
    expect(source).not.toMatch(/Public tracking since 2026-08-08/)
    expect(source).not.toMatch(/'unavailable'/)
    expect(source).not.toContain('moteur IA')
    expect(source).not.toMatch(/— BTTSPredict AI/)
    // Vraie date de publication branchée depuis les données
    expect(source).toContain('match.lastUpdated')
    expect(source).toContain('verified[0]?.verifiedAt || match.lastUpdated')
    // SEO intact : H1, JSON-LD, canonical présents
    expect(source).toContain('BreadcrumbList')
    expect(source).toContain('SportsEvent')
    expect(source).toContain('bttspredict.com/match/')
  })

  it('matches.ts expose la date de publication réelle du snapshot', () => {
    const source = readSource('src/lib/matches.ts')

    expect(source).toMatch(/lastUpdated\?:/)
    expect(source).toMatch(/snapshotPublishedAt/)
  })

  it('le pipeline marque explicitement la sélection VIP et neutralise les miroirs gratuits', () => {
    const source = readSource('scripts/quick-update-predictions.mjs')

    // Sélection VIP = flag explicite sur copie détachée
    expect(source).toMatch(/\.map\(p => \(\{ \.\.\.p, vip: true \}\)\)/)
    // Miroirs gratuits : jamais VIP
    expect(source).toMatch(/vipMirror: true, vip: false/)
  })

  it('i18n remplace « Fiabilité » par « Qualité des données » dans les 3 langues', () => {
    const source = readSource('src/lib/i18n.ts')

    expect(source).toContain("mcReliability: 'Qualité des données'")
    expect(source).toContain("mcReliability: 'Data quality'")
    expect(source).toContain('mcReliability')
    expect(source).not.toContain("mcReliability: 'Fiabilité'")
    expect(source).not.toContain("mcReliability: 'Reliability'")
  })
})

describe('no invented data — libellés humains (runtime)', () => {
  it('les niveaux de qualité parlent en langage humain, sans pourcentage', () => {
    expect(humanMethodLabel('reliable')).toBe('Basé sur les données récentes')
    expect(humanMethodLabel('limited')).toBe('Données limitées')
    expect(humanMethodLabel('insufficient')).toBe('Données insuffisantes')
  })

  it('les statuts gagné/perdu/en attente restent honnêtes', () => {
    expect(statusLabel('WON')).toBe('Gagné')
    expect(statusLabel('LOST')).toBe('Perdu')
    expect(statusLabel('PENDING')).toBe('En attente')
    expect(statusLabel(undefined)).toBe('En attente')
  })

  it('une confiance absente n\'est jamais présentée comme un pourcentage', () => {
    expect(confidenceLabel(undefined)).toBe('Données insuffisantes')
    expect(confidenceLabel(Number.NaN)).toBe('Données insuffisantes')
  })
})

describe('no invented data — payload réel (public/predictions.json)', () => {
  it('aucune ligne du payload réel n\'entre dans l\'espace VIP sans flag explicite', () => {
    const raw = readFileSync(resolve(__dirname, '..', 'public', 'predictions.json'), 'utf8')
    const payload = JSON.parse(raw) as Record<string, unknown>
    const rows = onlyVipFixtures(payload)

    for (const row of rows) {
      const explicit = row.vip === true || row.isVip === true || row.tier?.toString().toUpperCase() === 'VIP'
      expect(explicit, `ligne VIP sans flag: ${row.home}`).toBe(true)
    }

    // Aucun match gratuit (free / predictions) ne fuite dans l'espace VIP
    const freeLike = [
      ...((payload.free as Array<Record<string, unknown>>) ?? []),
      ...((payload.predictions as Array<Record<string, unknown>>) ?? []),
    ]
    const freeKeys = new Set(freeLike.map((m) => String(m.id ?? `${m.home}-${m.date ?? m.match}`)))
    for (const row of rows as Array<Record<string, unknown>>) {
      const key = String(row.id ?? `${row.home}-${row.date ?? row.match}`)
      expect(freeKeys.has(key), `match gratuit en VIP: ${String(row.home)}`).toBe(false)
    }
  })
})
