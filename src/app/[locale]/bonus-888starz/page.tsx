import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LocalizedPromoClient from '@/components/bttsbet/LocalizedPromoClient'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'

export function generateStaticParams() { return SUPPORTED_LOCALES.filter(locale => locale !== 'fr').map(locale => ({ locale })) }
const SITE_URL = 'https://bttspredict.com'
const SLUG = 'bonus-888starz'
const REVIEW_DATE = new Date().toISOString().slice(0, 10)
const YEAR = new Date().getUTCFullYear()

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (locale === 'en') return {
    title: `888Starz Promo Code btts221: 300% + 100 Spins`,
    description: `888Starz promo code btts221: 300% bonus + 100 free spins, no wagering requirements, from a €1 deposit. ${YEAR} sign-up guide, 18+.`,
    keywords: ['888starz promo code', '888starz bonus', '888starz code', '888starz btts221', '888starz Senegal', 'btts221', '888starz 300 bonus', '888starz free spins'],
    alternates: {
      canonical: `${SITE_URL}/en/${SLUG}`,
      languages: { fr: `${SITE_URL}/${SLUG}`, en: `${SITE_URL}/en/${SLUG}`, ar: `${SITE_URL}/ar/${SLUG}`, 'x-default': `${SITE_URL}/${SLUG}` },
    },
    robots: { index: true, follow: true },
  }
  if (locale === 'ar') return {
    title: `رمز 888Starz الترويجي btts221: 300% + 100 لفة مجانية`,
    description: `رمز 888Starz الترويجي btts221: مكافأة 300% + 100 لفة مجانية، بدون شروط مراهنة، بدءاً من إيداع 1 يورو. دليل ${YEAR}، 18+.`,
    keywords: ['رمز 888Starz الترويجي', 'مكافأة 888Starz', 'كود 888Starz', 'btts221', '888Starz btts221'],
    alternates: {
      canonical: `${SITE_URL}/ar/${SLUG}`,
      languages: { fr: `${SITE_URL}/${SLUG}`, en: `${SITE_URL}/en/${SLUG}`, ar: `${SITE_URL}/ar/${SLUG}`, 'x-default': `${SITE_URL}/${SLUG}` },
    },
    robots: { index: true, follow: true },
  }
  return {}
}
export default async function Localized888StarzPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!SUPPORTED_LOCALES.includes(locale as Locale) || locale === 'fr') notFound();   return <LocalizedPromoClient bookmaker="888starz" reviewDate={REVIEW_DATE} />
 }
