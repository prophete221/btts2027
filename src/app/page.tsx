import dynamic from 'next/dynamic'
import type { Metadata } from 'next'
import { checkSeo } from '@/lib/seo'

const Navbar = dynamic(() => import('@/components/bttsbet/Navbar'), { loading: () => null })
const Hero = dynamic(() => import('@/components/bttsbet/Hero'), { loading: () => null })
const ScrollProgressBar = dynamic(() => import('@/components/bttsbet/ScrollProgressBar'), { loading: () => null })
const MatchCenter = dynamic(() => import('@/components/bttsbet/MatchCenter'), { loading: () => null })
const TrustPillars = dynamic(() => import('@/components/bttsbet/TrustPillars'), { loading: () => null })
const PerformanceDashboard = dynamic(() => import('@/components/bttsbet/PerformanceDashboard'), { loading: () => null })
const MethodSection = dynamic(() => import('@/components/bttsbet/HomeEditorial').then(m => ({ default: m.MethodSection })), { loading: () => null })
const LeagueCoverage = dynamic(() => import('@/components/bttsbet/HomeEditorial').then(m => ({ default: m.LeagueCoverage })), { loading: () => null })
const PartnerCard = dynamic(() => import('@/components/bttsbet/HomeEditorial').then(m => ({ default: m.PartnerCard })), { loading: () => null })
const Footer = dynamic(() => import('@/components/bttsbet/Footer'), { loading: () => null })
const ErrorBoundary = dynamic(() => import('@/components/bttsbet/ErrorBoundary'), { loading: () => null })
const StickyCTABar = dynamic(() => import('@/components/bttsbet/StickyCTABar'), { loading: () => null })
const GiftPopup = dynamic(() => import('@/components/bttsbet/GiftPopup'), { loading: () => null })

// Tâche 002 — Title et description SEO alignés sur le Prompt Maître.
// Title : 49 chars (limite soft 60) — description : 139 chars (limite soft 150).
// Anti-récidive: checkSeo() lance une erreur build-time si title > 60 ou desc > 150.
const TITLE = "BTTSPredict — Pronostics BTTS du jour et Over 2,5"
const DESCRIPTION = "Pronostics BTTS du jour sur des matchs internationaux, avec sélections horodatées, historique public et méthode documentée. 18+."
checkSeo('homepage', TITLE, DESCRIPTION)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://bttspredict.com/',
    languages: {
      fr: 'https://bttspredict.com/',
      en: 'https://bttspredict.com/en',
      ar: 'https://bttspredict.com/ar',
      'x-default': 'https://bttspredict.com/',
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://bttspredict.com',
    siteName: 'BTTSPredict',
    type: 'website',
    locale: 'fr_FR',
    alternateLocale: ['en_US', 'ar_SA'],
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
}

// JSON-LD WebSite — SearchAction for Google SERP
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'BTTSPredict',
  url: 'https://bttspredict.com',
  description: "Plateforme de sélections football BTTS, Over 2,5 et score exact pour les parieurs africains. Matchs internationaux, données publiques et historique vérifiable.",
  inLanguage: 'fr',
  publisher: {
    '@type': 'Organization',
    name: 'BTTSPredict',
    url: 'https://bttspredict.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://bttspredict.com/icon-512.png',
    },
  },
}

// JSON-LD FAQPage — Google SERP rich results
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: "Qu'est-ce que le BTTS ?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "BTTS signifie Both Teams To Score (les deux équipes marquent). C'est un type de pari où vous pariez que les deux équipes marqueront au moins un but durant le match, quelle que soit l'issue finale.",
      },
    },
    {
      '@type': 'Question',
      name: "Comment fonctionne l'analyse de BTTSPredict ?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "BTTSPredict publie des pronostics BTTS et Over 2.5 basés sur un modèle statistique. Le nouveau suivi public a été lancé le 2026-08-08 — voir /historique pour les chiffres réels. Aucun résultat futur n'est garanti.",
      },
    },
    {
      '@type': 'Question',
      name: 'Comment utiliser le code promo VISION221 ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Inscrivez-vous sur Linebet via notre lien de parrainage, puis saisissez le code promo VISION221 lors de votre inscription ou dans la section Code Promo de votre compte pour recevoir un bonus exclusif sur votre premier dépôt.",
      },
    },
    {
      '@type': 'Question',
      name: 'Les pronostics gratuits sont-ils fiables ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Nos pronostics gratuits sont produits par le même modèle statistique que nos pronostics premium. Ils couvrent les matchs les plus populaires du jour avec une analyse complète. Aucun résultat n'est garanti.",
      },
    },
  ],
}

// JSON-LD Organization — identité éditoriale vérifiable, sans récompense ni autorité auto-déclarée.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BTTSPredict',
  url: 'https://bttspredict.com',
  logo: 'https://bttspredict.com/icon-512.png',
  description: 'Site informatif consacré aux sélections BTTS, Over 2.5 et score exact sur des matchs internationaux.',
  knowsAbout: ['BTTS', 'Over 2.5', 'football', 'modèle statistique Poisson'],
  sameAs: [
    'https://twitter.com/bttspredict',
    'https://www.facebook.com/bttspredict',
    'https://www.instagram.com/bttspredict',
  ],
}

// JSON-LD WebPage — Trust signals
const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'BTTSPredict — Prédictions BTTS par modèle statistique',
  url: 'https://bttspredict.com',
  description: 'Plateforme de pronostics football BTTS et Over 2.5 par analyse statistique probabiliste. Ligues sélectionnées pour leur fort taux de BTTS. Taux de réussite transparent et vérifié publiquement. Aucun gain garanti. 18+.',
  isPartOf: { '@type': 'WebSite', name: 'BTTSPredict', url: 'https://bttspredict.com' },
  about: [
    { '@type': 'Thing', name: 'BTTS — Both Teams To Score' },
    { '@type': 'Thing', name: 'Over 2.5 Goals' },
    { '@type': 'Thing', name: 'Pronostics football par modèle statistique' },
    { '@type': 'Thing', name: 'Modèles Poisson calibrés' },
  ],
  author: { '@type': 'Organization', name: 'BTTSPredict', url: 'https://bttspredict.com' },
  publisher: { '@type': 'Organization', name: 'BTTSPredict', url: 'https://bttspredict.com' },
  inLanguage: 'fr',
  datePublished: '2026-01-01',
  dateModified: new Date().toISOString().slice(0, 10),
  keywords: 'BTTS, Over 2.5, pronostics btts aujourd\'hui, analyse statistique football, modèles Poisson, code promo VISION221, Linebet, 888starz, pronostics football gratuits, pronostics Sénégal, both teams to score',
}

// JSON-LD Dataset — Transparency & credibility
const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'BTTSPredict — Historique des pronostics BTTS & Over 2.5',
  description: 'Historique complet des pronostics publiés par BTTSPredict, incluant les résultats gagnés ET perdus. Taux de réussite calculé sur les pronostics réellement publiés. Transparence totale.',
  url: 'https://bttspredict.com/win-history.json',
  creator: { '@type': 'Organization', name: 'BTTSPredict', url: 'https://bttspredict.com' },
  license: 'https://creativecommons.org/licenses/by/4.0/',
  isAccessibleForFree: true,
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: 'https://bttspredict.com/win-history.json',
    },
  ],
  keywords: 'pronostics BTTS, historique résultats, taux de réussite, transparence, gagnés perdus',
  variableMeasured: [
    { '@type': 'PropertyValue', name: 'Taux de réussite', value: 'Calculé en temps réel depuis /historique' },
    { '@type': 'PropertyValue', name: 'Ligues couvertes', value: 'Sélection de ligues à fort taux de BTTS' },
    { '@type': 'PropertyValue', name: 'Source de vérification', value: 'ESPN et TheSportsDB' },
    { '@type': 'PropertyValue', name: 'Modèle', value: 'Approche statistique probabiliste' },
    { '@type': 'PropertyValue', name: 'Suivi public', value: 'Lancé le 2026-08-08, voir /historique' },
  ],
}

// JSON-LD Review/Trust — SUPPRIMÉ (avis fictifs supprimés pour conformité Google Structured Data)
// La plateforme n'a pas de système d'avis vérifiable. Inventer des reviews serait une violation.
// Seules les métriques objectives (pronostics publiés, vérifiés, taux calculé depuis l'archive) sont affichées.
const reviewJsonLd = null

// JSON-LD BreadcrumbList — breadcrumbs in SERP
const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://bttspredict.com/' },
    { '@type': 'ListItem', position: 2, name: 'Tableau des pronostics', item: 'https://bttspredict.com/btts/predictions/today' },
    { '@type': 'ListItem', position: 3, name: 'VIP', item: 'https://bttspredict.com/vip' },
  ],
}

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-800 relative">

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* ═══ SEO CONTENT FOR CRAWLERS & AI — minimal v91 ═══ */}
      <div className="sr-only">
        <h2>Plateforme de sélections BTTS, Over 2.5 et score exact</h2>
        <p>
          BTTSPredict aide les parieurs africains à lire des sélections de matchs internationaux :
          BTTS, Over 2.5 et projection de score exact. Les données sont publiées avant le match,
          les résultats gagnés et perdus sont archivés, et aucun gain futur n&apos;est garanti.
        </p>
      </div>

      {/* Skip to content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-gold focus:text-midnight focus:font-bold focus:rounded-lg"
      >
        Aller au contenu principal
      </a>

      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Main Content — Plateforme football intelligence
          Structure : Header produit → Hero + Signal en vedette →
          Matchs du jour (MatchCenter) → Piliers → Performance/Historique →
          Méthode → Compétitions → Partenaire VISION221 → Jeu responsable →
          Footer. Bloc partenaire placé APRÈS la valeur produit. */}
      <main id="main-content" className="relative z-10" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <ErrorBoundary><Navbar /></ErrorBoundary>
        <ErrorBoundary><Hero /></ErrorBoundary>
        <ErrorBoundary><MatchCenter /></ErrorBoundary>
        <ErrorBoundary><TrustPillars /></ErrorBoundary>
        <ErrorBoundary><PerformanceDashboard /></ErrorBoundary>
        <ErrorBoundary><MethodSection /></ErrorBoundary>
        <ErrorBoundary><LeagueCoverage /></ErrorBoundary>
        <ErrorBoundary><PartnerCard /></ErrorBoundary>

        {/* Jeu responsable — compact et moderne */}
        <section className="mx-auto max-w-[980px] px-4 pb-6 sm:px-6">
          <div className="p-4 rounded-[12px] flex items-start gap-3" style={{ backgroundColor: 'rgba(248, 113, 113, 0.05)', border: '1px solid rgba(248, 113, 113, 0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" className="flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm text-[#9DABBB] leading-relaxed mb-1">
                <strong className="text-[#F87171]">18+</strong> · Les paris sportifs comportent un risque de perte. Ne pariez jamais plus que ce que vous pouvez perdre.
              </p>
              <a href="/jouer-responsable" className="text-sm font-semibold text-[#4A90FF] underline">
                En savoir plus →
              </a>
            </div>
          </div>
        </section>

        {/* Liens internes SEO */}
        <section className="mx-auto max-w-[980px] px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="/bonus-888starz" className="text-[#9DABBB] hover:text-[#2F7DFF] transition-colors">Bonus 888Starz</a>
            <span className="text-[#223041]">·</span>
            <a href="/code-promo-linebet-senegal" className="text-[#9DABBB] hover:text-[#2F7DFF] transition-colors">Code Promo Linebet</a>
            <span className="text-[#223041]">·</span>
            <a href="/btts-c-est-quoi" className="text-[#9DABBB] hover:text-[#2F7DFF] transition-colors">BTTS signification</a>
          </div>
        </section>

        <ErrorBoundary><Footer /></ErrorBoundary>
      </main>

      {/* Sticky CTA Bar — mobile only, appears after 60% scroll */}
      <StickyCTABar />

      {/* Paquet cadeau flottant « Bonus 300% » — Linebet parrainage, fermable (accueil) */}
      <GiftPopup />
    </div>
  )
}
