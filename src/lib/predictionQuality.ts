import type { Prediction } from './predictions'

/**
 * Public-facing quality rules for model output.
 * Missing evidence is not converted into a made-up percentage.
 */
export type PredictionQuality = 'reliable' | 'limited' | 'insufficient'

export function predictionQuality(prediction: Prediction): PredictionQuality {
  const analysis = prediction.analysis
  const hasLambdas = Number.isFinite(analysis?.homeLambda) && Number.isFinite(analysis?.awayLambda)
  const hasForm = Boolean(analysis?.homeForm && analysis?.awayForm)
  const hasSource = analysis?.hasRealData === true || Boolean(prediction.source || prediction.verifiedSource)

  if (hasLambdas && hasForm && hasSource) return 'reliable'
  if (hasLambdas || (prediction.proba && prediction.proba > 0) || (prediction.probability && prediction.probability > 0)) return 'limited'
  return 'insufficient'
}

export function shouldPublishPrediction(prediction: Prediction): boolean {
  return predictionQuality(prediction) !== 'insufficient'
}

export function humanMethodLabel(quality: PredictionQuality, locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') {
    return quality === 'reliable' ? 'Based on recent data' : quality === 'limited' ? 'Limited data' : 'Not enough data'
  }
  if (locale === 'ar') {
    return quality === 'reliable' ? 'مبني على بيانات حديثة' : quality === 'limited' ? 'بيانات محدودة' : 'بيانات غير كافية'
  }
  return quality === 'reliable' ? 'Basé sur les données récentes' : quality === 'limited' ? 'Données limitées' : 'Données insuffisantes'
}

export function humanAnalysisLabel(locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return 'Our match reading'
  if (locale === 'ar') return 'قراءتنا للمباراة'
  return 'Notre lecture du match'
}
