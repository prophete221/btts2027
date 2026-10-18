export const SUPPORTED_LOCALES = ['fr', 'en', 'ar'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_META: Record<Locale, {
  label: string
  nativeLabel: string
  flag: string
  htmlLang: string
  direction: 'ltr' | 'rtl'
}> = {
  fr: { label: 'French', nativeLabel: 'Français', flag: '🇫🇷', htmlLang: 'fr-SN', direction: 'ltr' },
  en: { label: 'English', nativeLabel: 'English', flag: '🇬🇧', htmlLang: 'en', direction: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦', htmlLang: 'ar', direction: 'rtl' },
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'fr' || value === 'en' || value === 'ar'
}

export function localeFromPathname(pathname: string | null | undefined): Locale {
  const segment = pathname?.split('/').filter(Boolean)[0]
  return isLocale(segment) ? segment : DEFAULT_LOCALE
}

/** Keep existing French URLs canonical; only non-default locales receive a prefix. */
export function localizedPath(pathname: string, locale: Locale): string {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const withoutLocale = cleanPath.replace(/^\/(?:en|ar)(?=\/|$)/, '') || '/'
  return locale === DEFAULT_LOCALE ? withoutLocale : `/${locale}${withoutLocale === '/' ? '' : withoutLocale}`
}

export const TRANSLATIONS = {
  fr: {
    nav: {
      today: 'Tableau du jour', history: 'Historique', statistics: 'Statistiques', methodology: 'Méthode',
      menu: 'Menu', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', home: 'Accueil', predictions: 'Pronos', vip: 'VIP',
      changeLanguage: 'Changer de langue', moreLanguages: 'Langues disponibles',
    },
    hero: {
      // Clé composée utilisée par le H1 de Hero.tsx (identique à title1 + title2)
      title: 'Les matchs. Décryptés par les données.',
      title1: 'Les matchs.', title2: 'Décryptés par les données.',
      subtitle: 'BTTS, Over 2.5, scores exacts et signaux de marché analysés à partir de données actualisées.',
      liveData: 'Analyse en direct', timezone: 'Africa/Dakar',
      cta: 'Voir les analyses du jour', ctaSecondary: 'Découvrir la plateforme',
      note18: '18+ · Données publiées avant le match',
      statsRate: 'Taux de réussite vérifié', statsTotal: 'Matchs analysés', statsRecord: 'Résultats publiés',
      partnerEyebrow: 'Partenaire', partnerQuestion: 'Vous souhaitez miser sur vos analyses ?', partnerJoin: 'Rejoignez LINEBET',
      promoLabel: 'Code promo', bonus: 'Bonus de bienvenue sur le 1er dépôt*',
      partnerCta: 'Créer mon compte LINEBET', copied: 'Code copié !', copy: 'Copier',
      partnerDisclaimer: '*Selon les conditions de l’offre.',
      trendLabel: 'Tendance vérifiée',
      funnelData: 'Données', funnelAnalysis: 'Analyse', funnelPick: 'Pronostic', funnelAction: 'Action',
    },
    predictions: {
      all: 'Tous', today: 'Auj.', tomorrow: 'Dem.', leagues: 'Toutes', noMatches: 'Aucun match sous ce filtre', seeAll: 'Voir tous les pronostics du jour', matchPage: 'Analyse',
      aiPick: 'Pronostic IA', predictedScore: 'Score prédit', betMatch: 'Parier sur ce match', analysis: "Voir l’analyse", bttsYes: 'Oui', bttsNo: 'Non',
      updated: 'Mis à jour quotidiennement', noCombo: 'Aucun combo disponible aujourd’hui.',
    },
    legal: {
      eighteen: '18+', risk: 'Les paris sportifs comportent un risque de perte. Ne pariez jamais plus que vous ne pouvez perdre.',
      responsible: 'Jouer de manière responsable', learnMore: 'En savoir plus', noGuarantee: 'Aucun résultat futur n’est garanti.',
      affiliation: 'Site informatif et d’affiliation. Nous ne prenons pas de paris et ne collectons pas de fonds.',
    },
    common: { home: 'Accueil', quickLinks: 'Liens rapides', methodology: 'Méthodologie', statistics: 'Statistiques', verifiedHistory: 'Historique vérifié', publicData: 'Données publiques', transparency: 'Transparence', faq: 'Questions fréquentes', warning: 'Avertissement', responsible: 'Jeu responsable', affiliate: "Liens d’affiliation — BTTSPredict est un site informatif indépendant et ne prend pas de paris.", publisher: 'Éditeur : BTTSPredict · Dakar, Sénégal' },
    faqItems: [
      { q: 'Qu’est-ce que le BTTS ?', a: 'BTTS signifie que les deux équipes marquent au moins un but. Il s’agit d’une estimation statistique, jamais d’une garantie.' },
      { q: 'Les pronostics sont-ils garantis ?', a: 'Non. Les paris sportifs comportent un risque de perte et aucun résultat futur n’est garanti.' },
      { q: 'Comment les données sont-elles suivies ?', a: 'Les pronostics sont horodatés puis comparés au résultat officiel après le match.' },
      { q: 'BTTSPredict prend-il des paris ?', a: 'Non. BTTSPredict est un site informatif et d’affiliation et ne collecte pas de fonds.' },
    ],
  },
  en: {
    nav: {
      today: 'Today’s board', history: 'History', statistics: 'Statistics', methodology: 'Methodology',
      menu: 'Menu', openMenu: 'Open menu', closeMenu: 'Close menu', home: 'Home', predictions: 'Predictions', vip: 'VIP',
      changeLanguage: 'Change language', moreLanguages: 'Available languages',
    },
    hero: {
      badge: 'Global BTTS prediction platform', title: 'The global reference for BTTS predictions.',
      subtitle: 'BTTS, Over 2.5 and exact-score selections for international matches. Time-stamped data and a documented method.', commandCenter: 'Markets monitored', liveData: 'Live data', btts: 'Both teams to score', goals: 'Total goals', exact: 'Exact-score projection', active: 'Analysis active',
      cta: 'Today’s predictions', timezone: 'Official Africa/Dakar time',
    },
    predictions: {
      all: 'All', today: 'Today', tomorrow: 'Tomorrow', leagues: 'All leagues', noMatches: 'No match under this filter', seeAll: 'See all today’s predictions', matchPage: 'Analysis',
      aiPick: 'AI pick', predictedScore: 'Predicted score', betMatch: 'Bet on this match', analysis: 'View analysis', bttsYes: 'Yes', bttsNo: 'No',
      updated: 'Updated daily', noCombo: 'No combo is available today.',
    },
    legal: {
      eighteen: '18+', risk: 'Sports betting carries a risk of loss. Never bet more than you can afford to lose.',
      responsible: 'Play responsibly', learnMore: 'Learn more', noGuarantee: 'No future result is guaranteed.',
      affiliation: 'Informational and affiliate website. We do not take bets or hold funds.',
    },
    common: { home: 'Home', quickLinks: 'Quick links', methodology: 'Methodology', statistics: 'Statistics', verifiedHistory: 'Verified history', publicData: 'Public data', transparency: 'Transparency', faq: 'Frequently asked questions', warning: 'Warning', responsible: 'Play responsibly', affiliate: 'Affiliate links — BTTSPredict is an independent informational website and does not take bets.', publisher: 'Publisher: BTTSPredict · Dakar, Senegal' },
    faqItems: [
      { q: 'What does BTTS mean?', a: 'BTTS means that both teams score at least one goal. It is a statistical estimate, never a guarantee.' },
      { q: 'Are predictions guaranteed?', a: 'No. Sports betting carries a risk of loss and no future result is guaranteed.' },
      { q: 'How are results tracked?', a: 'Predictions are time-stamped and compared with the official result after the match.' },
      { q: 'Does BTTSPredict take bets?', a: 'No. BTTSPredict is an informational and affiliate website and does not hold funds.' },
    ],
  },
  ar: {
    nav: {
      today: 'لوحة اليوم', history: 'السجل', statistics: 'الإحصائيات', methodology: 'المنهجية',
      menu: 'القائمة', openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', home: 'الرئيسية', predictions: 'التوقعات', vip: 'VIP',
      changeLanguage: 'تغيير اللغة', moreLanguages: 'اللغات المتاحة',
    },
    hero: {
      badge: 'منصة عالمية لتوقعات BTTS', title: 'المرجع العالمي لتوقعات BTTS.',
      subtitle: 'توقعات BTTS وOver 2.5 والنتيجة الدقيقة للمباريات الدولية، مع بيانات مؤرخة ومنهجية موثقة.', commandCenter: 'الأسواق المتابعة', liveData: 'بيانات مباشرة', btts: 'كلا الفريقين يسجلان', goals: 'إجمالي الأهداف', exact: 'توقع النتيجة الدقيقة', active: 'التحليل نشط',
      cta: 'توقعات اليوم', timezone: 'التوقيت الرسمي: إفريقيا/داكار',
    },
    predictions: {
      all: 'الكل', today: 'اليوم', tomorrow: 'غداً', leagues: 'كل البطولات', noMatches: 'لا توجد مباراة ضمن هذا الفلتر', seeAll: 'عرض كل توقعات اليوم', matchPage: 'تحليل',
      aiPick: 'توقع الذكاء الاصطناعي', predictedScore: 'النتيجة المتوقعة', betMatch: 'المراهنة على المباراة', analysis: 'عرض التحليل', bttsYes: 'نعم', bttsNo: 'لا',
      updated: 'يتم التحديث يومياً', noCombo: 'لا توجد تركيبة متاحة اليوم.',
    },
    legal: {
      eighteen: '18+', risk: 'المراهنات الرياضية تنطوي على خطر الخسارة. لا تراهن أبداً بأكثر مما يمكنك تحمل خسارته.',
      responsible: 'العب بمسؤولية', learnMore: 'معرفة المزيد', noGuarantee: 'لا توجد ضمانات لأي نتيجة مستقبلية.',
      affiliation: 'موقع معلومات وتسويق بالعمولة. لا نقبل الرهانات ولا نحتفظ بالأموال.',
    },
    common: { home: 'الرئيسية', quickLinks: 'روابط سريعة', methodology: 'المنهجية', statistics: 'الإحصائيات', verifiedHistory: 'سجل موثق', publicData: 'بيانات عامة', transparency: 'الشفافية', faq: 'الأسئلة الشائعة', warning: 'تحذير', responsible: 'العب بمسؤولية', affiliate: 'روابط تسويق بالعمولة — BTTSPredict موقع معلومات مستقل ولا يقبل الرهانات.', publisher: 'الناشر: BTTSPredict · داكار، السنغال' },
    faqItems: [
      { q: 'ما معنى BTTS؟', a: 'يعني BTTS أن يسجل كلا الفريقين هدفاً واحداً على الأقل. إنه تقدير إحصائي وليس ضماناً.' },
      { q: 'هل التوقعات مضمونة؟', a: 'لا. المراهنات الرياضية تنطوي على خطر الخسارة ولا توجد ضمانات لأي نتيجة مستقبلية.' },
      { q: 'كيف يتم تتبع النتائج؟', a: 'يتم تأريخ التوقعات ومقارنتها بالنتيجة الرسمية بعد انتهاء المباراة.' },
      { q: 'هل تقبل BTTSPredict الرهانات؟', a: 'لا. BTTSPredict موقع معلومات وتسويق بالعمولة ولا يحتفظ بالأموال.' },
    ],
  },
} as const

export type TranslationSet = (typeof TRANSLATIONS)[Locale]
export function translationsFor(locale: Locale): TranslationSet {
  return TRANSLATIONS[locale]
}
