import type { Prediction } from './predictions'

type PredictionPayload = Prediction & Record<string, unknown> & {
  analysisData?: Record<string, unknown>
  xgHome?: number
  xgAway?: number
  dataQuality?: string
  dataSource?: string
  matchCountHome?: number
  matchCountAway?: number
}

/** Public-facing quality rules. Missing evidence is never converted into a made-up percentage. */
export type PredictionQuality = 'reliable' | 'limited' | 'insufficient'

export function predictionQuality(input: PredictionPayload): PredictionQuality {
  const analysis = input.analysis && typeof input.analysis === 'object' ? input.analysis : undefined
  const nested = input.analysisData && typeof input.analysisData === 'object' ? input.analysisData : undefined
  const homeLambda = analysis?.homeLambda ?? nested?.homeLambda ?? input.xgHome
  const awayLambda = analysis?.awayLambda ?? nested?.awayLambda ?? input.xgAway
  const hasLambdas = Number.isFinite(homeLambda) && Number.isFinite(awayLambda)
  const hasForm = Boolean(analysis?.homeForm && analysis?.awayForm)
  const hasSource = analysis?.hasRealData === true
    || Boolean(input.source || input.verifiedSource || input.dataSource)
  const sampleSize = Math.min(input.matchCountHome ?? 0, input.matchCountAway ?? 0)
  const hasEnoughMatches = sampleSize >= 6
  const quality = String(input.dataQuality || '').toUpperCase()

  if (hasLambdas && hasSource && (hasForm || hasEnoughMatches || quality === 'HIGH')) return 'reliable'
  // Mission couverture : un match réel issu d'une vraie source mais aux données
  // trop minces pour un λ est affiché « Données limitées » (jamais « insuffisant »,
  // jamais une probabilité inventée pour lui).
  if (quality === 'LOW' && hasSource && !hasLambdas) return 'limited'
  if (hasLambdas || (input.proba && input.proba > 0) || (input.probability && input.probability > 0)) return 'limited'
  return 'insufficient'
}

export function shouldPublishPrediction(input: PredictionPayload): boolean {
  return predictionQuality(input) !== 'insufficient'
}

export function humanMethodLabel(quality: PredictionQuality, locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return quality === 'reliable' ? 'Based on recent data' : quality === 'limited' ? 'Limited data' : 'Not enough data'
  if (locale === 'ar') return quality === 'reliable' ? 'مبني على بيانات حديثة' : quality === 'limited' ? 'بيانات محدودة' : 'بيانات غير كافية'
  return quality === 'reliable' ? 'Basé sur les données récentes' : quality === 'limited' ? 'Données limitées' : 'Données insuffisantes'
}

export function humanAnalysisLabel(locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return 'Our match reading'
  if (locale === 'ar') return 'قراءتنا للمباراة'
  return 'Notre lecture du match'
}
