/**
 * Schémas JSON-LD centralisés pour BTTSPredict
 * Réutilisables sur toutes les pages pour renforcer l'E-E-A-T
 */

export const SITE_URL = 'https://bttspredict.com'

// ─── Organization (à inclure sur toutes les pages) ──────────────────────
export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BTTSPredict',
    legalName: 'BTTSPredict',
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    image: `${SITE_URL}/og-image.png`,
    foundingDate: '2026-01-01',
    slogan: 'Plateforme de référence — Pronostics BTTS et Over 2.5',
    description: "BTTSPredict est la plateforme de pronostics BTTS (Both Teams To Score) et Over 2.5 buts. Modèle Poisson calibré sur la forme récente des équipes, sources ESPN et TheSportsDB. Transparence totale : gagnés ET perdus affichés publiquement.",
    email: 'support@bttspredict.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dakar',
      addressCountry: 'SN',
    },
    areaServed: ['Worldwide', 'SN', 'CI', 'CM', 'ML', 'BF', 'FR', 'NG'],
    knowsAbout: [
      'BTTS',
      'Both Teams To Score',
      'Over 2.5',
      'pronostics football',
      'pronostics btts aujourd\'hui',
      'paris sportifs',
      'modèle Poisson football',
      'analyses de valeur statistique FIFA',
      'statistiques Aviator',
      'prédictions football',
      'analyse statistique football',
    ],
    // Signaux d'autorité
    brand: {
      '@type': 'Brand',
      name: 'BTTSPredict',
      slogan: 'Plateforme de référence Pronostics BTTS',
      logo: `${SITE_URL}/favicon.svg`,
    },
    award: 'Standard de transparence dans les pronostics BTTS et Over 2.5',
    // NOTE: pas de propriété founder tant que le vrai nom du fondateur n'est pas fourni.
    // Google vérifie la cohérence des entités Person — ne JAMAIS inventer de nom.
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Support client',
      email: 'support@bttspredict.com',
      telephone: '+15406704172',
      availableLanguage: ['French', 'English'],
      url: `${SITE_URL}/#support`,
    },
    // NOTE : pas d'AggregateRating — la plateforme n'a pas de système d'avis vérifiable.
    // Inventer une note serait une violation des guidelines Google Structured Data.
    sameAs: [
      'https://wa.me/15406704172',
      'https://twitter.com/bttspredict',
      'https://www.facebook.com/bttspredict',
      'https://www.instagram.com/bttspredict',
      'https://www.linkedin.com/company/bttspredict',
      'https://www.reddit.com/user/bttspredict',
    ],
  }
}

// ─── LocalBusiness (schéma entreprise locale) ──────────────────────────
export function buildLocalBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'BTTSPredict',
    image: `${SITE_URL}/og-image.png`,
    '@id': SITE_URL,
    url: SITE_URL,
    telephone: '+15406704172',
    email: 'support@bttspredict.com',
    priceRange: '€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Dakar',
      addressLocality: 'Dakar',
      addressRegion: 'Dakar',
      postalCode: '00000',
      addressCountry: 'SN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 14.6928,
      longitude: -17.4467,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '00:00',
      closes: '23:59',
    },
    sameAs: [
      'https://wa.me/15406704172',
      'https://twitter.com/bttspredict',
      'https://www.facebook.com/bttspredict',
      'https://www.instagram.com/bttspredict',
      'https://www.linkedin.com/company/bttspredict',
    ],
  }
}

// ─── Claim (autorité mondiale — pour Google et IA) ──────────────────────
export function buildClaimJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Claim',
    claimText: 'BTTSPredict est la base open-source de pronostics BTTS (Both Teams To Score) et Over 2.5 buts.',
    appearance: {
      '@type': 'OpinionNewsArticle',
      headline: 'BTTSPredict — Plateforme de référence Pronostics BTTS et Over 2.5',
      url: SITE_URL,
      datePublished: '2026-01-01',
      author: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
    },
    author: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
    },
  }
}

// ─── Person (expert E-E-A-T) ────────────────────────────────────────────
// ⚠️ ATTENTION : ne pas injecter ce schema tant que le vrai nom du fondateur
// n'est pas fourni. Google pénalise les entités Person fictives.
// La fonction est conservée pour usage futur — mais buildPersonJsonLd()
// ne doit être appelée QUE quand EXPERT_NAME contient un vrai nom.
export const EXPERT_NAME: string | null = null  // ← Remplacer par le vrai nom quand disponible
export const EXPERT_ROLE = 'Analyste Football Senior & Fondateur — BTTSPredict'

export function buildPersonJsonLd() {
  // Si EXPERT_NAME est null, on ne retourne pas de schema Person
  // (évite d'injecter une entité Person fictive dans le DOM)
  if (!EXPERT_NAME) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: EXPERT_NAME,
    jobTitle: EXPERT_ROLE,
    description: "Analyste football principal de BTTSPredict. Spécialiste en modélisation statistique (Poisson, xG) avec plus de 10 ans d'expérience en analyse prédictive des matchs de football.",
    url: SITE_URL,
    image: `${SITE_URL}/og-image.png`,
    worksFor: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
    },
    affiliation: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
    },
    knowsAbout: [
      'BTTS — Both Teams To Score',
      'Over 2.5 Goals',
      'Modèle de distribution de Poisson',
      'Expected Goals (xG)',
      'Value bets FIFA',
      'Analyse statistique football',
      'pronostics btts aujourd\'hui',
      'prédiction football',
    ],
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: 'École de statistiques appliquées',
    },
    sameAs: ['https://wa.me/15406704172'],
  }
}

// ─── WebPage (générique) ────────────────────────────────────────────────
export function buildWebPageJsonLd({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  const url = `${SITE_URL}${path}`
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'BTTSPredict', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
    },
    author: {
      '@type': 'Person',
      name: 'Expert BTTSPredict',
      url: SITE_URL,
    },
    inLanguage: 'fr',
  }
}

// ─── BreadcrumbList (fil d'Ariane dynamique) ────────────────────────────
export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  }
}

// ─── Dataset (page /historique — transparence des résultats) ────────────
// Lit les stats réelles depuis public/win-history.json (généré par scripts/update-win-history.mjs).
// Aucune stat figée — les chiffres reflètent l'état réel de l'archive publique.
// ATTENTION: cette fonction doit être appelée dans un Server Component (async).
export async function buildDatasetJsonLd() {
  let stats: {
    total?: number
    verified?: number
    won?: number
    lost?: number
    pending?: number
    rate?: string
    byType?: {
      BTTS?: { total?: number; won?: number; lost?: number; rate?: number }
      'O2.5'?: { total?: number; won?: number; lost?: number; rate?: number }
    }
  } = {}

  try {
    // Lecture directe du fichier statique au build (mode export statique)
    // Permet d'éviter un fetch réseau pendant le SSR
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'public', 'win-history.json')
    const raw = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    stats = data?.stats ?? {}
  } catch (err) {
    // Fallback silencieux en cas d'erreur lecture
    console.warn('[seoSchemas] buildDatasetJsonLd: could not read win-history.json:', err instanceof Error ? err.message : String(err))
  }

  const total = stats.total ?? 0
  const verified = stats.verified ?? 0
  const won = stats.won ?? 0
  const lost = stats.lost ?? 0
  const rate = stats.rate ?? 'N/A'
  const bttsRate = stats.byType?.BTTS?.rate ?? 'N/A'
  const o25Rate = stats.byType?.['O2.5']?.rate ?? 'N/A'

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'BTTSPredict — Historique vérifiable des pronostics BTTS & Over 2.5',
    description: `Dataset public des pronostics BTTS et Over 2.5 publiés par BTTSPredict. Sur ${verified} pronostics vérifiés (score final connu), ${won} ont été gagnants (${rate} de réussite réelle vérifiable). Répartition par type: BTTS ${bttsRate}%, Over 2.5 ${o25Rate}%. Toutes les entrées sont archivées quotidiennement dans predictions-archive/ et vérifiées via API-Football / ESPN. Aucun filtrage — gagnés ET perdus affichés. Licence CC-BY.`,
    url: `${SITE_URL}/historique`,
    creator: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
      founder: { '@type': 'Person', name: 'prophete221', nationality: 'SN' },
    },
    publisher: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${SITE_URL}/win-history.json`,
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${SITE_URL}/api/public/predictions.json`,
        description: 'Open data: derniers 7 jours de pronostics (planned)',
      },
    ],
    keywords: 'pronostics BTTS, both teams to score, over 2.5 predictions, historique résultats, dataset ouvert, transparence, gagnés perdus, modèle Poisson, xG, API-Football',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Total pronostics archivés', value: String(total) },
      { '@type': 'PropertyValue', name: 'Pronostics vérifiés (W+L)', value: String(verified) },
      { '@type': 'PropertyValue', name: 'Pronostics gagnés', value: String(won) },
      { '@type': 'PropertyValue', name: 'Pronostics perdus', value: String(lost) },
      { '@type': 'PropertyValue', name: 'Taux de réussite global', value: rate },
      { '@type': 'PropertyValue', name: 'Taux BTTS', value: `${bttsRate}%` },
      { '@type': 'PropertyValue', name: 'Taux Over 2.5', value: `${o25Rate}%` },
    ],
    temporalCoverage: 'P90D',
    inLanguage: 'fr',
    citation: [
      'ESPN Soccer API (https://site.api.espn.com/apis/site/v2/sports/soccer)',
      'API-Football v3 (https://www.api-football.com/)',
    ],
    isBasedOn: 'Modèle statistique Poisson (xG domicile/extérieur basé sur les 5 derniers matchs)',
  }
}

// ─── SportsEvent (pour CHAQUE prono du jour) ──────────────────────────────
// Permet à Google/Perplexity de comprendre chaque match comme un événement.
export function buildSportsEventJsonLd({
  homeTeam,
  awayTeam,
  league,
  startDate, // ISO 8601
  predictionType, // 'BTTS' ou 'Over 2.5'
  prediction, // 'Oui' ou 'Non'
  confidence,
  homeLogo,
  awayLogo,
}: {
  homeTeam: string
  awayTeam: string
  league: string
  startDate: string
  predictionType: string
  prediction: string
  confidence: number
  homeLogo?: string
  awayLogo?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${homeTeam} vs ${awayTeam}`,
    sport: 'Soccer',
    startDate,
    homeTeam: {
      '@type': 'SportsTeam',
      name: homeTeam,
      ...(homeLogo ? { logo: homeLogo } : {}),
    },
    awayTeam: {
      '@type': 'SportsTeam',
      name: awayTeam,
      ...(awayLogo ? { logo: awayLogo } : {}),
    },
    location: {
      '@type': 'Place',
      name: league,
    },
    superEvent: {
      '@type': 'SportsEvent',
      name: league,
    },
    about: {
      '@type': 'Thing',
      name: `${predictionType} prediction: ${prediction}`,
      description: `BTTSPredict Poisson model — confidence ${confidence}%`,
    },
    organizer: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
    },
  }
}

// ─── ItemList (liste des pronos du jour) ──────────────────────────────────
export function buildItemListJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Pronostics BTTS et Over 2.5 du jour',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url.startsWith('http') ? it.url : `${SITE_URL}${it.url}`,
    })),
  }
}

// ─── Article (pages de blog) ────────────────────────────────────────────
export function buildArticleJsonLd({
  title,
  description,
  path,
  datePublished,
  dateModified,
}: {
  title: string
  description: string
  path: string
  datePublished: string
  dateModified?: string
}) {
  const url = `${SITE_URL}${path}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    image: `${SITE_URL}/og-image.png`,
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Person',
      name: 'Expert BTTSPredict',
      url: SITE_URL,
      jobTitle: 'Analyste football senior',
    },
    publisher: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    inLanguage: 'fr',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
}
