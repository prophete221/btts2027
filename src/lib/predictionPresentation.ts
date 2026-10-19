/**
 * Human-facing labels for prediction cards.
 * Keep the model technical details available on demand, but lead with plain language.
 * This module does not change URLs, metadata, SEO titles, or prediction calculations.
 */

export type PredictionMarket = 'BTTS' | 'Over 2.5' | 'Exact score' | string

export function marketLabel(market: PredictionMarket, locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') {
    if (market === 'BTTS') return 'Both teams to score'
    if (market === 'Over 2.5') return 'More than 2.5 goals'
    if (market === 'Exact score') return 'Exact score'
  }
  if (locale === 'ar') {
    if (market === 'BTTS') return 'كلا الفريقين يسجلان'
    if (market === 'Over 2.5') return 'أكثر من 2.5 هدف'
    if (market === 'Exact score') return 'النتيجة الدقيقة'
  }
  if (market === 'BTTS') return 'Les deux équipes marquent'
  if (market === 'Over 2.5') return 'Plus de 2,5 buts'
  if (market === 'Exact score') return 'Score exact'
  return market
}

export function analysisHeading(locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return "Our read of the match"
  if (locale === 'ar') return 'قراءة المباراة'
  return 'Notre lecture du match'
}

export function reasonsHeading(locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return 'Why this pick stands out'
  if (locale === 'ar') return 'لماذا يبرز هذا الاختيار'
  return 'Pourquoi ce choix ressort'
}

export function statusLabel(status: 'WON' | 'LOST' | 'PENDING' | string | undefined, locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return status === 'WON' ? 'Won' : status === 'LOST' ? 'Lost' : 'Awaiting result'
  if (locale === 'ar') return status === 'WON' ? 'فوز' : status === 'LOST' ? 'خسارة' : 'بانتظار النتيجة'
  return status === 'WON' ? 'Gagné' : status === 'LOST' ? 'Perdu' : 'En attente'
}

export function confidenceLabel(value: number | undefined, locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (value === undefined || !Number.isFinite(value)) {
    if (locale === 'en') return 'Not enough data'
    if (locale === 'ar') return 'بيانات غير كافية'
    return 'Données insuffisantes'
  }
  if (locale === 'en') return value >= 70 ? 'Stronger signal' : value >= 58 ? 'Interesting signal' : 'More cautious pick'
  if (locale === 'ar') return value >= 70 ? 'إشارة قوية' : value >= 58 ? 'إشارة مثيرة للاهتمام' : 'اختيار أكثر حذراً'
  return value >= 70 ? 'Signal fort' : value >= 58 ? 'Signal intéressant' : 'Choix plus prudent'
}

export function publicationNote(locale: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (locale === 'en') return 'Published before kick-off. Past results do not predict the next one.'
  if (locale === 'ar') return 'نُشر قبل انطلاق المباراة. النتائج السابقة لا تتنبأ بالنتيجة القادمة.'
  return 'Publié avant le coup d’envoi. Les résultats passés ne prédisent pas le prochain match.'
}
