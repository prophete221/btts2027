'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from './LanguageSwitcher'
import { AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

/* ──────────────────────────────────────────────────────────────
   Codes promo réels par campagne :
   - Linebet  → VISION221 (majuscules)
   - 888Starz → btts221   (minuscules)
   Offre annoncée par la campagne partenaire : 300 % de bonus +
   100 free spins, sans condition de mise, dès 1 € de dépôt.
   ────────────────────────────────────────────────────────────── */
const CAMPAIGN = {
  bonus: '300%',
  freeSpins: '100',
  minDeposit: '1 €',
} as const

export default function LocalizedPromoClient({ bookmaker, reviewDate }: { bookmaker: 'linebet' | '888starz'; reviewDate?: string }) {
  const effectiveReviewDate = reviewDate || new Date().toISOString().slice(0, 10)
  const { lang } = useLanguage()
  const isLinebet = bookmaker === 'linebet'
  const code = isLinebet ? 'VISION221' : 'btts221'
  const codeCase = {
    fr: isLinebet ? 'en majuscules' : 'en minuscules',
    en: isLinebet ? 'in capitals' : 'in lowercase',
    ar: isLinebet ? 'بأحرف كبيرة' : 'بأحرف صغيرة',
  }
  const codeCaseHint = codeCase[lang]
  const brand = isLinebet ? 'Linebet' : '888Starz'
  const signup = isLinebet ? AFFILIATE.linebet : AFFILIATE.star888
  const download = isLinebet ? AFFILIATE.linebetDownload : AFFILIATE.star888Download
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  /* Mesure : 1 vue de page promo par session (dédupliquée côté tracking) */
  useEffect(() => {
    trackAffiliateAction(bookmaker, 'promo_view', `localized-${bookmaker}-page`)
  }, [bookmaker])

  const copy = lang === 'fr'
    ? {
        title: `Code promo ${brand} ${effectiveReviewDate.slice(0, 4)} : 300% + 100 spins`,
        intro: `Inscris-toi sur ${brand} avec le code ${code} : 300% de bonus et 100 free spins, sans condition de mise, dès ${CAMPAIGN.minDeposit} de dépôt.`,
        offerHeadline: `300% de bonus + 100 free spins`,
        offerSub: `Sans condition de mise · Dès ${CAMPAIGN.minDeposit} de dépôt · Offre annoncée par la campagne ${brand}`,
        codeLabel: 'Code promo',
        codeHint: `À saisir exactement ${codeCaseHint}`,
        signup: `S’inscrire sur ${brand}`,
        download: 'Télécharger l’app',
        steps: 'Comment utiliser le code',
        one: `Copie le code ${code} puis ouvre le lien d’inscription officiel ${brand}.`,
        two: `Colle ${code} dans le champ « Code promo » pendant l’inscription (ou dans ton compte).`,
        three: `Dépose dès ${CAMPAIGN.minDeposit} : le bonus de 300% et les 100 free spins sont crédités selon l’offre affichée par ${brand}.`,
        copied: 'Code copié — colle-le lors de l’inscription',
        copyFailed: 'Copie impossible — sélectionne le code et copie-le manuellement',
        conditions: 'Offre annoncée par la campagne partenaire. Vérifie les conditions affichées par l’opérateur avant tout dépôt.',
        verified: 'Guide vérifié le',
        responsible: 'Jouer responsable',
        faqTitle: `Questions fréquentes sur ${brand}`,
        faqCode: `Quel est le code promo ${brand} ?`,
        faqCodeAnswer: `Le code est ${code} — à saisir exactement ${codeCaseHint} pendant l’inscription ou dans la section « Code promo » de ton compte.`,
        faqBonus: `Qu’est-ce que je reçois avec ${code} ?`,
        faqBonusAnswer: `300% de bonus et 100 free spins, sans condition de mise, dès ${CAMPAIGN.minDeposit} de dépôt — offre annoncée par la campagne. Vérifie l’offre affichée par ${brand} pour ton pays avant de déposer.`,
        faqCountry: 'Le code fonctionne-t-il dans tous les pays ?',
        faqCountryAnswer: 'La disponibilité dépend du pays, du compte et de la période. Vérifie ton éligibilité avant tout dépôt.',
      }
    : lang === 'en'
      ? {
          title: `${brand} promo code ${effectiveReviewDate.slice(0, 4)}: 300% + 100 spins`,
          intro: `Sign up on ${brand} with code ${code}: 300% bonus and 100 free spins, no wagering requirements, from a ${CAMPAIGN.minDeposit} deposit.`,
          offerHeadline: `300% bonus + 100 free spins`,
          offerSub: `No wagering requirements · From ${CAMPAIGN.minDeposit} deposit · Offer announced by the ${brand} campaign`,
          codeLabel: 'Promo code',
          codeHint: `Enter exactly ${codeCaseHint}`,
          signup: `Sign up on ${brand}`,
          download: 'Download the app',
          steps: 'How to use the code',
          one: `Copy code ${code} then open the official ${brand} sign-up link.`,
          two: `Paste ${code} in the “Promo code” field during sign-up (or in your account).`,
          three: `Deposit from ${CAMPAIGN.minDeposit}: the 300% bonus and 100 free spins are credited per the offer shown by ${brand}.`,
          copied: 'Code copied — paste it at sign-up',
          copyFailed: 'Copy failed — select the code and copy it manually',
          conditions: 'Offer announced by the partner campaign. Check the terms shown by the operator before any deposit.',
          verified: 'Guide checked on',
          responsible: 'Play responsibly',
          faqTitle: `Frequently asked questions about ${brand}`,
          faqCode: `What is the ${brand} promo code?`,
          faqCodeAnswer: `The code is ${code} — enter it exactly ${codeCaseHint} during sign-up or in the “Promo code” section of your account.`,
          faqBonus: `What do I get with ${code}?`,
          faqBonusAnswer: `300% bonus and 100 free spins, no wagering requirements, from a ${CAMPAIGN.minDeposit} deposit — offer announced by the campaign. Check the offer shown by ${brand} for your country before depositing.`,
          faqCountry: 'Does the code work in every country?',
          faqCountryAnswer: 'Availability depends on country, account and period. Check your eligibility before making a deposit.',
        }
      : {
          title: `رمز ${brand} الترويجي: 300% + 100 لفة مجانية`,
          intro: `سجّل في ${brand} بالرمز ${code}: مكافأة 300% و100 لفة مجانية، بدون شروط مراهنة، بدءاً من إيداع ${CAMPAIGN.minDeposit}.`,
          offerHeadline: `مكافأة 300% + 100 لفة مجانية`,
          offerSub: `بدون شروط مراهنة · إيداع من ${CAMPAIGN.minDeposit} · عرض معلن من حملة ${brand}`,
          codeLabel: 'الرمز الترويجي',
          codeHint: `أدخله تماماً ${codeCaseHint}`,
          signup: `التسجيل في ${brand}`,
          download: 'تحميل التطبيق',
          steps: 'كيفية استخدام الرمز',
          one: `انسخ الرمز ${code} ثم افتح رابط التسجيل الرسمي لـ ${brand}.`,
          two: `الصق ${code} في خانة «الرمز الترويجي» أثناء التسجيل (أو في حسابك).`,
          three: `أودع من ${CAMPAIGN.minDeposit}: تُضاف مكافأة 300% واللفات المجانية 100 وفق العرض المعروض من ${brand}.`,
          copied: 'تم نسخ الرمز — الصقه أثناء التسجيل',
          copyFailed: 'تعذّر النسخ — حدد الرمز وانسخه يدوياً',
          conditions: 'عرض معلن من الحملة الشريكة. تحقق من الشروط المعروضة من المشغل قبل أي إيداع.',
          verified: 'تم التحقق من الدليل في',
          responsible: 'العب بمسؤولية',
          faqTitle: `الأسئلة الشائعة حول ${brand}`,
          faqCode: `ما هو رمز ${brand} الترويجي؟`,
          faqCodeAnswer: `الرمز هو ${code} — أدخله تماماً ${codeCaseHint} أثناء التسجيل أو في قسم «الرمز الترويجي» في حسابك.`,
          faqBonus: `ماذا أحصل عليه مع ${code}؟`,
          faqBonusAnswer: `مكافأة 300% و100 لفة مجانية، بدون شروط مراهنة، بدءاً من إيداع ${CAMPAIGN.minDeposit} — عرض معلن من الحملة. تحقق من العرض المعروض من ${brand} لبلدك قبل الإيداع.`,
          faqCountry: 'هل يعمل الرمز في جميع البلدان؟',
          faqCountryAnswer: 'تعتمد الإتاحة على البلد والحساب والفترة. تحقق من أهليتك قبل أي إيداع.',
        }

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code)
    if (ok) {
      // Mesure : on ne compte une copie QUE si elle a réellement réussi
      trackAffiliateCodeCopy(bookmaker, `localized-${bookmaker}`)
      setCopied(true)
      setCopyFailed(false)
      window.setTimeout(() => setCopied(false), 2500)
    } else {
      setCopyFailed(true)
      setCopied(false)
      window.setTimeout(() => setCopyFailed(false), 4000)
    }
  }

  const track = (event: 'signup_cta_click' | 'download_click') => trackAffiliateAction(bookmaker, event, `localized-${bookmaker}`)
  const reviewDateLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long', timeZone: 'Africa/Dakar' }).format(new Date(`${effectiveReviewDate}T12:00:00Z`))

  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col text-[#F2F6FA]">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-[#9DABBB] mb-8">
          <a href="/">BTTSPredict</a> <span aria-hidden="true">/</span> <span>{brand}</span>
        </nav>
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#2F7DFF]">{brand}</p>
          <h1 className="text-4xl font-black mt-3" style={{ fontFamily: 'Poppins, sans-serif' }}>{copy.title}</h1>
          <p className="text-sm text-[#9DABBB] mt-4">{copy.intro}</p>
          <p className="text-xs text-[#9DABBB] mt-3">{copy.verified} <time dateTime={effectiveReviewDate}>{reviewDateLabel}</time>
 · 18+</p>
        </div>

        {/* Encart offre — l'avantage est visible avant tout geste */}
        <section className="rounded-2xl p-5 mb-4 text-center" style={{ backgroundColor: '#101a26', border: '1px solid #2F7DFF55' }} aria-label={copy.offerHeadline}>
          <p className="text-lg sm:text-xl font-black" style={{ color: '#2F7DFF' }}>{copy.offerHeadline}</p>
          <p className="text-xs text-[#9DABBB] mt-2">{copy.offerSub}</p>
        </section>

        <section className="rounded-2xl p-6 bg-[#141C25] border border-[#6B7A8C] text-center" aria-labelledby="localized-code-title">
          <p id="localized-code-title" className="text-xs uppercase tracking-widest text-[#9DABBB]">{copy.codeLabel}</p>
          <button onClick={handleCopy} className="mt-3 px-6 py-3 rounded-xl text-xl font-black tracking-widest" style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }} aria-label={`${code} — copy`}>{code}</button>
          {copied && <p className="text-xs text-[#34D399] mt-2" role="status" aria-live="polite">{copy.copied}</p>}
          {copyFailed && <p className="text-xs text-[#F87171] mt-2" role="alert">{copy.copyFailed} ({code})</p>}
          {!copied && !copyFailed && <p className="text-xs text-[#9DABBB] mt-2">{copy.codeHint}</p>}
          <div className="grid gap-3 mt-6">
            <a href={signup} target="_blank" rel="noopener noreferrer nofollow sponsored" onClick={() => track('signup_cta_click')} className="rounded-xl py-3 font-bold" style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>{copy.signup}</a>
            <a href={download} target="_blank" rel="noopener noreferrer nofollow sponsored" onClick={() => track('download_click')} className="rounded-xl py-3 font-bold border border-[#6B7A8C] text-[#F2F6FA]">{copy.download}</a>
          </div>
          <p className="text-xs text-[#9DABBB] mt-4">{copy.conditions}</p>
        </section>

        <section className="mt-8 rounded-2xl p-6 bg-[#141C25] border border-[#6B7A8C]" aria-labelledby="localized-steps-title">
          <h2 id="localized-steps-title" className="text-xl font-bold mb-4">{copy.steps}</h2>
          <ol className="space-y-3 text-sm text-[#9DABBB] list-decimal list-inside">
            <li>{copy.one}</li>
            <li>{copy.two}</li>
            <li>{copy.three}</li>
          </ol>
        </section>

        <section className="mt-8 rounded-2xl p-6 bg-[#141C25] border border-[#6B7A8C]" aria-labelledby="localized-faq-title">
          <h2 id="localized-faq-title" className="text-xl font-bold mb-4">{copy.faqTitle}</h2>
          <details className="border-b border-[#6B7A8C] py-3">
            <summary className="cursor-pointer font-bold">{copy.faqCode}</summary>
            <p className="text-sm text-[#9DABBB] mt-2">{copy.faqCodeAnswer}</p>
          </details>
          <details className="border-b border-[#6B7A8C] py-3">
            <summary className="cursor-pointer font-bold">{copy.faqBonus}</summary>
            <p className="text-sm text-[#9DABBB] mt-2">{copy.faqBonusAnswer}</p>
          </details>
          <details className="py-3">
            <summary className="cursor-pointer font-bold">{copy.faqCountry}</summary>
            <p className="text-sm text-[#9DABBB] mt-2">{copy.faqCountryAnswer}</p>
          </details>
        </section>

        <p className="text-center text-xs text-[#9DABBB] mt-8">18+ · {copy.responsible} · Aucun résultat futur n’est garanti.</p>
      </main>
    </div>
  )
}
