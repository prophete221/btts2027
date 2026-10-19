import type { Metadata } from 'next'
import { Navbar, Footer, FreePredictionsWidget, VipCardWidget, LinebetApkButton } from '@/components/bttsbet'
import LinebetClient from './LinebetClient'
import { checkSeo } from '@/lib/seo'

/* ──────────────────────────────────────────────────────────────
   Metadata — SEO Afrique de l'Ouest & Maroc
   Offre annoncée par la campagne : 300% de bonus + 100 free
   spins, sans condition de mise, dès 1 € de dépôt.
   ────────────────────────────────────────────────────────────── */
const SITE_URL = 'https://bttspredict.com'
const SLUG = 'code-promo-linebet-senegal'
const PAGE_URL = `${SITE_URL}/${SLUG}`
const CURRENT_YEAR = new Date().getUTCFullYear()
const REVIEW_DATE = new Date().toISOString().slice(0, 10)

// SEO — title court (47 chars) + description courte (<150).
// Avec le template "%s | BTTSPredict" (14 chars), le title rendu final
// fait 47 + 14 = 61 chars, sous la limite hard 70.
// Anti-récidive: checkSeo() lance une erreur build-time si title > 60 ou desc > 150.
const TITLE = 'Code promo Linebet VISION221 : 300% + 100 spins'
const DESCRIPTION = `Code promo Linebet VISION221 : 300% de bonus + 100 free spins, sans condition de mise, dès 1 € de dépôt. Guide ${CURRENT_YEAR}, 18+.`
checkSeo('code-promo-linebet-senegal', TITLE, DESCRIPTION)

export const metadata: Metadata = {
  // `title: TITLE` (pas `{ absolute: ... }`) — laisse le template du layout
  // ajouter " | BTTSPredict" automatiquement.
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'code promo linebet', 'linebet senegal', 'bonus linebet', 'vision221', 'linebet wave',
    'linebet orange money', 'code promo linebet senegal', 'linebet inscription',
    'depot linebet senegal', 'linebet free money', 'paris sportifs senegal',
    'linebet 300 bonus', 'linebet free spins', 'linebet bonus sans condition de mise',
    // SEO v60 — cible Afrique de l'Ouest & Maroc
    'code promo linebet afrique ouest', 'linebet maroc', 'linebet mali', 'linebet cote d\'ivoire',
    'linebet guinee', 'linebet congo', 'guide linebet vision221',
  ],
  alternates: {
    canonical: PAGE_URL,
    languages: {
      fr: PAGE_URL,
      en: `${SITE_URL}/en/${SLUG}`,
      ar: `${SITE_URL}/ar/${SLUG}`,
      'x-default': PAGE_URL,
    },
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: 'BTTSPredict',
    type: 'article',
    locale: 'fr_SN',
    publishedTime: '2026-07-06',
    modifiedTime: REVIEW_DATE,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
}

/* ──────────────────────────────────────────────────────────────
   JSON-LD — Article + Breadcrumb + HowTo + FAQPage
   ────────────────────────────────────────────────────────────── */
function buildArticleJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    datePublished: '2026-07-06',
    dateModified: REVIEW_DATE,
    author: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'BTTSPredict',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': PAGE_URL },
  }
}

function buildBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Code Promo Linebet International', item: PAGE_URL },
    ],
  }
}

function buildHowToJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment utiliser le code promo Linebet VISION221',
    description: "Guide pour activer l'offre Linebet avec le code VISION221 : 300% de bonus + 100 free spins, sans condition de mise, dès 1 € de dépôt. Vérifie les conditions affichées par l'opérateur.",
    totalTime: 'PT5M',
    supply: [{ '@type': 'HowToSupply', name: 'Code promo VISION221' }],
    tool: [
      { '@type': 'HowToTool', name: 'Application Linebet ou site web' },
      { '@type': 'HowToTool', name: 'Wave, Orange Money ou autre moyen disponible selon le pays' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: "S'inscrire sur Linebet via le lien de parrainage",
        text: "Clique sur le lien d'inscription Linebet, crée ton compte gratuit en 2 minutes avec ton email ou ton numéro.",
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Saisir le code promo VISION221',
        text: "Pendant l'inscription ou dans la section « Code Promo » de ton compte, colle exactement VISION221 en majuscules.",
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Déposer dès 1 €',
        text: "Effectue un premier dépôt à partir de 1 € avec Wave, Orange Money ou un autre moyen disponible dans ton pays.",
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Recevoir 300% de bonus + 100 free spins',
        text: "Le bonus de 300% et les 100 free spins, sans condition de mise, sont crédités selon l'offre affichée par Linebet. Vérifie les conditions actuelles pour ton pays.",
      },
    ],
  }
}

function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Quel est le code promo Linebet ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Le code promo Linebet est VISION221 — à saisir en majuscules lors de l'inscription ou dans la section « Code Promo » de ton compte. Valable dans le monde entier — tous les pays du monde, sans exception.",
        },
      },
      {
        '@type': 'Question',
        name: `Que donne le code VISION221 en ${CURRENT_YEAR} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Le code VISION221 donne 300% de bonus et 100 free spins, sans condition de mise, dès 1 € de dépôt — offre annoncée par la campagne partenaire. Vérifie l'offre affichée par Linebet pour ton pays avant tout dépôt.",
        },
      },
      {
        '@type': 'Question',
        name: 'Comment déposer avec Wave ou Orange Money sur Linebet ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "Si Wave ou Orange Money est disponible pour ton pays, sélectionne-le dans la section Dépôt de Linebet, dépose à partir de 1 € puis vérifie les conditions affichées avant de confirmer.",
        },
      },
      {
        '@type': 'Question',
        name: 'Le bonus est-il valable dans tous les pays ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "La disponibilité du code et de l'offre dépend du pays, du compte et de la période. Vérifiez votre éligibilité et les conditions actuellement affichées par Linebet avant toute inscription ou dépôt.",
        },
      },
    ],
  }
}

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */
export default function CodePromoLinebetSenegalPage() {
  return (
    <div className="min-h-screen bg-dark-800 flex flex-col text-papier">
      {/* Structured Data — Article + Breadcrumb + HowTo + FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHowToJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />

      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-emerald focus:text-dark-900 focus:font-bold focus:rounded-lg"
      >
        Aller au contenu principal
      </a>

      <Navbar />

      <main id="main-content" className="flex-1 relative z-10" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <LinebetClient />

        {/* Pronostics gratuits + VIP + APK — visibles sur toutes les pages */}
        <FreePredictionsWidget />
        <VipCardWidget />
        <div className="text-center pb-6">
          <LinebetApkButton />
        </div>
      </main>

      <Footer />
    </div>
  )
}
