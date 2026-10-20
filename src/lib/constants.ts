// ═══════════════════════════════════════════════════════════════
// BTTSPredict – Centralized Data & Constants
// ═══════════════════════════════════════════════════════════════

export const SITE = {
  name: 'BTTSPredict',
  url: 'https://bttspredict.com',
  tagline: "Pronostics football BTTS & Over 2,5 calculés par un modèle statistique transparent pour parieurs sérieux",
  promoCode: 'VISION221',
  accuracy: 'Calculé en temps réel depuis l\'archive publique',
  vipAccuracy: 'Calculé en temps réel depuis l\'archive publique',
  vipMinDeposit: '10 € (≈ 6 560 XOF)',
  historyRate: 'Voir /historique',
  last30Rate: 'Voir /historique',
}

export const AFFILIATE = {
  linebet: 'https://lb-aff.com/L?tag=d_5589568m_22611c_site&site=5589568&ad=22611&r=registration',
  linebetDownload: 'https://lb-aff.com/L?tag=d_5589568m_66803c_apk1&site=5589568&ad=66803',
  linebetSocial: [
    'https://vision221.lineorgs.com/',
    'https://linebet.press/vision221',
    'https://linebetop.com/en?promocode=VISION221',
  ],
  // 888starz utilise btts221. VISION221 est réservé à Linebet.
  star888: 'https://888ghta.com/8hwF6V',
  star888Download: 'https://888ghta.com/5o6glw',
  rel: 'sponsored nofollow',
}

// Politique VIP centrale : les écrans doivent reprendre ces faits, pas des valeurs héritées.
// Le dépôt est une condition déclarée du parcours, pas une preuve automatique de paiement.
export const VIP_POLICY = {
  partner: 'Linebet',
  promoCode: 'VISION221',
  minimumDeposit: '10 €',
  minimumDepositXof: '≈ 6 560 XOF',
  activation: 'Après vérification manuelle sur WhatsApp',
  verificationTime: 'Dans la journée, selon les horaires de publication',
} as const

export const BOOKMAKERS = [
  {
    id: 'linebet', name: 'Linebet', signupLink: AFFILIATE.linebet, downloadLink: AFFILIATE.linebetDownload,
    promoCode: 'VISION221', color: 'emerald', bonus: '300% + 100 free spins (offre annoncée, dès 1 € de dépôt)',
    description: 'Partenaire d’affiliation — offre annoncée : 300% + 100 free spins, sans condition de mise, dès 1 € de dépôt',
    logoFull: '/logos/linebet.svg', logoIcon: '/logos/linebet-icon.svg',
  },
  {
    id: '888starz', name: '888starz', signupLink: AFFILIATE.star888, downloadLink: AFFILIATE.star888Download,
    promoCode: 'btts221', color: 'gold', bonus: '300% + 100 free spins (offre annoncée, dès 1 € de dépôt)',
    description: 'Bookmaker partenaire — offre annoncée : 300% + 100 free spins, sans condition de mise, dès 1 € de dépôt',
    logoFull: '/logos/888starz.svg', logoIcon: '/logos/888starz-icon.svg',
  },
] as const

export const ANDROID_LOGO = '/logos/android.svg'

export const NAV_LINKS = [
  { label: 'Accueil', href: '/' }, { label: 'Pronos', scrollTarget: 'free-predictions' },
  { label: 'Historique', href: '/historique' }, { label: 'Méthodologie', href: '/methodologie' },
  { label: 'VIP', scrollTarget: 'vip', highlight: true },
]

export const HOW_IT_WORKS = [
  { step: '01', title: "Notre analyse passe chaque match au crible", desc: "Notre modèle statistique estime des buts attendus modélisés (lambda) à partir des buts réels des 8 derniers matchs de chaque équipe. Sources : ESPN et TheSportsDB." },
  { step: '02', title: 'On sélectionne les meilleurs', desc: "Seuls les pronostics BTTS et Over 2,5 avec le plus haut indice de confiance sont retenus et publiés sur la plateforme." },
  { step: '03', title: 'Tu paries en confiance', desc: "Utilise nos pronostics sur Linebet ou ton bookmaker habituel. Code promo VISION221 pour un bonus exclusif sur le premier dépôt." },
]

export const HERO_STATS = [
  { value: 'Voir /historique', label: 'Taux de réussite réel', icon: 'target' },
  { value: '—', label: 'Pronostics archivés (voir /historique)', icon: 'chart' },
  { value: '50+', label: 'Championnats couverts', icon: 'globe' },
]

export const FAQ_ITEMS = [
  { q: "Qu'est-ce que le BTTS ?", a: "BTTS signifie \"Both Teams To Score\" (les deux équipes marquent). C'est un type de pari où vous pariez que les deux équipes marqueront au moins un but durant le match, quelle que soit l'issue finale. Ce marché est très populaire car il ne dépend pas du résultat final du match, mais uniquement de la capacité des deux équipes à trouver le chemin des filets. Notre équipe analyse les statistiques offensives et défensives pour identifier les matchs où les deux équipes ont une forte probabilité de marquer." },
  { q: "Comment fonctionne l'analyse de BTTSPredict ?", a: "Notre modèle statistique est calibré sur la forme récente des équipes (8 derniers matchs réels) et des buts attendus modélisés (lambda). Sources : ESPN et TheSportsDB (données publiques). Le taux de réussite réel est calculé dynamiquement depuis l'archive publique des pronostics (predictions-archive/) et affiché sans filtrage sur /historique. Chaque pronostic est accompagné d'un indice de confiance calculé par le modèle. Les performances passées ne garantissent pas les résultats futurs." },
  { q: 'Comment utiliser les codes promo VISION221 et btts221 ?', a: "VISION221 est le code promo Linebet, btts221 est le code promo 888Starz. Inscrivez-vous via notre lien, saisissez le code correspondant dans le champ « Code Promo » puis effectuez un premier dépôt dès 1 € : 300% de bonus + 100 free spins, sans condition de mise (offre annoncée par la campagne partenaire). Vérifiez l'offre affichée par l'opérateur avant tout dépôt. Les conditions commerciales peuvent changer." },
  { q: 'Les pronostics gratuits sont-ils fiables ?', a: "Nos pronostics gratuits sont calculés par le même modèle statistique que nos pronostics premium. Ils couvrent les matchs les plus populaires du jour avec une analyse complète. La différence avec les pronostics premium réside dans le nombre de matchs analysés et l'accès à des marchés supplémentaires. Comme pour tout pronostic, aucun résultat n'est garanti — les performances historiques ne préjugent pas les résultats futurs." },
  { q: 'Quels championnats sont couverts ?', a: "Moteur entraîné sur 50+ championnats internationaux, prédictions appliquées en priorité Afrique de l'Ouest (Sénégal, Mali, CIV, Guinée, Congo) & Maroc + top ligues Europe pour volume. Ligues prioritaires : Ligue 1 Sénégal, Botola Pro (Maroc), Bundesliga, Eredivisie, Jupiler Pro League, Championship, Liga Portugal." },
  { q: 'Comment utiliser les pronostics BTTSPredict ?', a: "Nos pronostics sont des outils d'aide à la décision, pas des garanties de gain. Pour les utiliser au mieux, consultez nos pronostics gratuits chaque jour, vérifiez l'indice de confiance associé, et croisez avec votre propre analyse. Nous vous recommandons de toujours respecter votre gestion de bankroll et de ne jamais miser plus que ce que vous pouvez vous permettre de perdre. Les résultats passés ne garantissent pas les résultats futurs." },
  { q: 'Peut-on prédire Aviator ou une faille de cotes FIFA ?', a: "Non. Aviator est un jeu 100% aléatoire basé sur un générateur certifié 'provably fair' — aucun outil au monde ne peut prédire le multiplicateur d'un round futur. Nos statistiques Aviator permettent d'observer l'historique des rounds et les tendances passées, mais ne constituent en aucun cas des prédictions. Concernant les 'Analyses de valeur FIFA (expérimental)', il s'agit d'estimations statistiques comparant les cotes des bookmakers à nos probabilités calculées — ce sont des outils d'analyse, pas des garanties de gain. Tout pari comporte un risque de perte." },
]

export const VIP_DESCRIPTION = 'VIP : historique complet + sélections du jour — Débloque avec un nouveau compte Linebet via VISION221 et un dépôt minimum de 10 €'
export const LONASE = { name: 'LONASE', description: 'Loterie Nationale du Sénégal' }

export const LEGAL = {
  disclaimer: "Les paris sportifs comportent des risques financiers. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre. Nos résultats sont vérifiés 6 fois par jour depuis l'archive publique des pronostics (predictions-archive/), avec scores finaux vérifiés via ESPN et TheSportsDB. Aucun filtrage — gagnés ET perdus affichés sur /historique. Aucun résultat futur n'est garanti. BTTSPredict est un site informatif et d'affiliation : nous ne prenons pas de paris et ne collectons pas de fonds. Ce site ne publie pas de témoignages de clients ni de statistiques non sourcées. Jouez de manière responsable (18+).",
  responsible: "Si vous ou un proche avez un problème lié aux jeux d'argent, contactez la ligne d'écoute nationale de votre pays. En France : 09-74-75-13-13 (Joueurs Info Service). Au Cameroun : contactez le MINSANT. Au Sénégal : 33 867 22 22. Ressource internationale : https://www.begambleaware.org/",
  copyright: `© ${new Date().getFullYear()} BTTSPredict. Tous droits réservés.`,
  links: [
    { label: 'Mentions Légales', href: '/mentions-legales' }, { label: 'Politique de Confidentialité', href: '/politique-confidentialite' },
    { label: 'Jouer Responsable', href: 'https://www.begambleaware.org/' }, { label: 'CGU', href: '/cgu' },
  ],
}
