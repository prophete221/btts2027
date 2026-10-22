import type { Locale } from './i18n'

/**
 * Traductions complémentaires (AI Combo Builder + indicateur temps réel du
 * coup d'envoi + filtre horaire).
 *
 * ⚠ src/lib/i18n.ts est GELÉ byte-for-byte par tests/seo-preservation.test.ts :
 * ces clés vivent donc dans un module séparé, importé par ComboBuilder.tsx et
 * MatchCenter.tsx. Même contrat trilingue (fr / en / ar) que TRANSLATIONS.
 */

export interface ComboCopy {
  eyebrow: string
  title: string
  subtitle: string
  targetOdds: string
  matchCount: string
  minProbLabel: string
  none: string
  combinedOdds: string
  combinedProb: string
  potentialReturn: string
  selections: string
  copy: string
  copied: string
  disclaimer: string
  openAnalysis: string
}

export interface KickoffCopy {
  live: string
  startsSoon: string
  hourAll: string
}

export const COMBO_I18N: Record<Locale, ComboCopy> = {
  fr: {
    eyebrow: 'Générateur de combiné IA',
    title: 'AI Combo Builder',
    subtitle: 'Choisissez votre cote cible et le nombre de matchs : le moteur assemble automatiquement les meilleures probabilités du jour (≥ 65 %).',
    targetOdds: 'Cote cible',
    matchCount: 'Nombre de matchs',
    minProbLabel: 'Seuil appliqué',
    none: 'Pas assez de sélections ≥ 65 % aujourd’hui pour cette cote cible. Essayez une cote plus haute, moins de matchs, ou élargissez aux jours à venir.',
    combinedOdds: 'Cote combinée',
    combinedProb: 'Probabilité combinée',
    potentialReturn: 'Retour potentiel (pour 10)',
    selections: 'Sélections du combiné',
    copy: 'Copier le combiné',
    copied: 'Copié !',
    disclaimer: 'Combiné statistique informatif — aucune garantie de résultat. 18+.',
    openAnalysis: 'Analyse',
  },
  en: {
    eyebrow: 'AI combo generator',
    title: 'AI Combo Builder',
    subtitle: 'Pick your target odds and number of matches: the engine automatically assembles the day’s best probabilities (≥ 65 %).',
    targetOdds: 'Target odds',
    matchCount: 'Number of matches',
    minProbLabel: 'Applied threshold',
    none: 'Not enough ≥ 65 % selections today for this target odds. Try higher odds, fewer matches, or extend to upcoming days.',
    combinedOdds: 'Combined odds',
    combinedProb: 'Combined probability',
    potentialReturn: 'Potential return (for 10)',
    selections: 'Combo selections',
    copy: 'Copy combo',
    copied: 'Copied!',
    disclaimer: 'Informational statistical combo — no guaranteed result. 18+.',
    openAnalysis: 'Analysis',
  },
  ar: {
    eyebrow: 'مولّد التركيبات الذكي',
    title: 'AI Combo Builder',
    subtitle: 'اختر السهم المستهدف وعدد المباريات: يجمع المحرك تلقائياً أفضل احتمالات اليوم (≥ 65 %).',
    targetOdds: 'السهم المستهدف',
    matchCount: 'عدد المباريات',
    minProbLabel: 'الحد المطبق',
    none: 'لا توجد إشارات كافية ≥ 65 % اليوم لهذا السهم. جرّب سهمًا أعلى، مباريات أقل، أو وسّع إلى الأيام القادمة.',
    combinedOdds: 'السهم المركّب',
    combinedProb: 'الاحتمال المركّب',
    potentialReturn: 'العائد المحتمل (عن 10)',
    selections: 'اختيارات التركيبة',
    copy: 'نسخ التركيبة',
    copied: 'تم النسخ!',
    disclaimer: 'تركيبة إحصائية إعلامية — لا ضمان لأي نتيجة. 18+.',
    openAnalysis: 'تحليل',
  },
}

export const KICKOFF_I18N: Record<Locale, KickoffCopy> = {
  fr: { live: 'En cours', startsSoon: 'Commence dans', hourAll: 'Toutes heures' },
  en: { live: 'Live', startsSoon: 'Starts in', hourAll: 'All times' },
  ar: { live: 'جارية', startsSoon: 'تبدأ بعد', hourAll: 'كل الأوقات' },
}
