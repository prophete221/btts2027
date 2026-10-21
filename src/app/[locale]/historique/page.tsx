import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HistoriquePage from '@/app/historique/page'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'

export function generateStaticParams() {
  return SUPPORTED_LOCALES.filter(locale => locale !== 'fr').map(locale => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (locale === 'en') return { title: 'Verified history — New public tracking', description: 'BTTSPredict verified history: every prediction recorded, time-stamped and assessed after the official result. 18+.', alternates: { canonical: 'https://bttspredict.com/en/historique' } }
  if (locale === 'ar') return { title: 'السجل الموثق — فترة تتبع عامة جديدة', description: 'السجل الموثق من BTTSPredict: كل توقع مسجّل ومؤرّخ ومقيّم بعد النتيجة الرسمية. 18+.', alternates: { canonical: 'https://bttspredict.com/ar/historique' } }
  return {}
}

export default async function LocalizedHistoriquePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!SUPPORTED_LOCALES.includes(locale as Locale) || locale === 'fr') notFound()
  return <HistoriquePage srH1={locale === 'ar' ? 'السجل الموثق — BTTSPredict' : 'Verified history — BTTSPredict'} />
}
