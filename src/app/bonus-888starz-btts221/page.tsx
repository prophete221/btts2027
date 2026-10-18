import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getDakarDateString } from '@/lib/dakar-date'
import { checkSeo } from '@/lib/seo'

const Footer = dynamic(() => import('@/components/bttsbet/Footer'), { loading: () => null })
const Btts221PromoClient = dynamic(() => import('@/components/bttsbet/Btts221PromoClient'), { loading: () => null })

const SITE_URL = 'https://bttspredict.com'
const SLUG = 'bonus-888starz-btts221'
const PAGE_URL = `${SITE_URL}/${SLUG}`
const REVIEW_DATE = getDakarDateString()
const YEAR = Number(REVIEW_DATE.slice(0, 4))
// Titre différencié de /bonus-888starz (angle « code btts221 ») — 46 chars
const TITLE = `Code 888Starz btts221 : bonus 300% + 100 spins`
const DESCRIPTION = `Le code btts221 débloque 300% de bonus + 100 free spins sur 888Starz, sans condition de mise, dès 1 € de dépôt. Guide ${YEAR}, 18+.`

checkSeo('bonus-888starz-btts221', TITLE, DESCRIPTION)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'code promo 888starz btts221', '888starz btts221', 'bonus 888starz btts221',
    '888starz 100 free spins', '888starz 300 bonus', '888starz bonus free spins', '888starz promo code',
    'code promo 888starz', 'bonus 888starz', '888starz minimum deposit', 'btts221 code',
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
    locale: 'fr_FR',
    modifiedTime: REVIEW_DATE,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: TITLE }],
  },
}

function articleJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    datePublished: REVIEW_DATE,
    dateModified: REVIEW_DATE,
    author: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'BTTSPredict', url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': PAGE_URL },
  }
}

function breadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Code promo 888Starz btts221', item: PAGE_URL },
    ],
  }
}

function howToJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment utiliser le code promo 888Starz btts221',
    description: 'Étapes pour activer l\'offre annoncée avec le code btts221 : 300% de bonus + 100 free spins, sans condition de mise, dès 1 € de dépôt.',
    totalTime: 'PT5M',
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Ouvrir 888Starz', text: 'Ouvre le lien officiel 888Starz depuis cette page.' },
      { '@type': 'HowToStep', position: 2, name: 'Saisir btts221', text: 'Crée ton compte et saisis exactement btts221 en minuscules si le champ est disponible.' },
      { '@type': 'HowToStep', position: 3, name: 'Déposer dès 1 €', text: 'Effectue un premier dépôt à partir de 1 € avec un moyen de paiement disponible dans ton pays.' },
      { '@type': 'HowToStep', position: 4, name: 'Recevoir le bonus et les free spins', text: '300% de bonus + 100 free spins, sans condition de mise, selon l\'offre affichée par 888Starz. Vérifie les conditions actuelles avant de confirmer.' },
    ],
  }
}

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Quel est le code promo 888Starz btts221 ?', acceptedAnswer: { '@type': 'Answer', text: 'Le code présenté sur cette page est btts221, en minuscules. Vérifiez son acceptation pendant l’inscription.' } },
      { '@type': 'Question', name: 'Le code btts221 donne-t-il 300% + 100 free spins ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui — l’offre annoncée par la campagne est de 300% de bonus + 100 free spins, sans condition de mise. Vérifiez l’offre affichée sur 888Starz selon votre pays, votre compte et la période.' } },
      { '@type': 'Question', name: 'Quel est le dépôt minimum annoncé ?', acceptedAnswer: { '@type': 'Answer', text: 'Le dépôt minimum annoncé est de 1 €. Vérifiez le montant affiché par 888Starz avant toute transaction.' } },
      { '@type': 'Question', name: 'Le code btts221 fonctionne-t-il dans tous les pays ?', acceptedAnswer: { '@type': 'Answer', text: 'L’éligibilité n’est pas garantie dans tous les pays. Vérifiez les règles locales, le compte et les conditions de 888Starz.' } },
    ],
  }
}

export default function Bonus888StarzBtts221Page() {
  return (
    <div className="min-h-screen bg-dark-800 text-papier">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }} />
      <Btts221PromoClient lang="fr" reviewDate={REVIEW_DATE} />
      <Footer />
    </div>
  )
}
