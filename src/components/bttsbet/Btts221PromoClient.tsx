'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { AFFILIATE } from '@/lib/constants'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import { copyTextToClipboard } from '@/lib/clipboard'

type Lang = 'fr' | 'en' | 'ar'

const CODE = 'btts221'

const COPY: Record<Lang, {
  dir: 'ltr' | 'rtl'
  eyebrow: string
  title: string
  intro: string
  partner: string
  codeLabel: string
  codeHint: string
  offerLabel: string
  offerText: string
  conditions: string
  copy: string
  copied: string
  signup: string
  mobileSignup: string
  guide: string
  stepsTitle: string
  steps: string[]
  faqTitle: string
  faq: Array<{ q: string; a: string }>
  verified: string
  affiliate: string
  responsible: string
  home: string
  predictions: string
  guideLink: string
  termsTag: string
}> = {
  fr: {
    dir: 'ltr',
    eyebrow: 'OFFRE PARTENAIRE · 888STARZ',
    title: 'Ton code 888Starz exclusif',
    intro: 'Copie le code btts221, reçois 300% de bonus + 100 free spins (sans condition de mise, dès 1 € de dépôt), puis ouvre 888Starz depuis le lien sécurisé.',
    partner: 'BTTSPredict × 888Starz',
    codeLabel: 'CODE PROMO',
    codeHint: 'À saisir exactement en minuscules',
    offerLabel: 'CAMPAGNE btts221 ANNONCÉE',
    offerText: '300% de bonus + 100 free spins à l’inscription, sans condition de mise, dès 1 € de dépôt — disponibilité et éligibilité à confirmer directement sur 888Starz.',
    conditions: 'Les bonus varient selon le pays, le compte, la période et les conditions de mise. Ne dépose rien avant d’avoir vérifié l’offre officielle.',
    copy: 'Copier le code',
    copied: 'Code copié',
    signup: 'S’inscrire avec btts221',
    mobileSignup: 'Ouvrir 888Starz',
    guide: 'Activation en 4 étapes',
    stepsTitle: 'Comment utiliser btts221',
    steps: [
      'Ouvre 888Starz depuis le bouton ci-dessus.',
      'Crée ton compte et saisis exactement btts221 en minuscules si le champ est disponible.',
      'Dépose dès 1 € avec un moyen de paiement disponible dans ton pays.',
      'Reçois 300% de bonus + 100 free spins selon l’offre affichée par 888Starz.',
    ],
    faqTitle: 'Questions sur btts221 et 888Starz',
    faq: [
      { q: 'Quel est le code promo 888Starz ?', a: 'Le code présenté sur cette page est btts221, en minuscules. Vérifie son acceptation pendant l’inscription.' },
      { q: 'Le code donne-t-il 300% + 100 free spins ?', a: 'Oui — l’offre annoncée par la campagne est de 300% de bonus + 100 free spins, sans condition de mise. Confirme l’offre affichée sur 888Starz selon ton pays, ton compte et la période.' },
      { q: 'Quel est le dépôt minimum ?', a: 'Le dépôt minimum annoncé est de 1 €. Vérifie le montant réellement affiché avant toute transaction.' },
      { q: 'Le code fonctionne-t-il partout ?', a: 'Non garanti. L’éligibilité peut dépendre du pays, du compte, de l’appareil et des règles locales de l’opérateur.' },
    ],
    verified: 'Page vérifiée le',
    affiliate: 'Lien d’affiliation rémunéré · 18+ · Les conditions de l’opérateur s’appliquent.',
    responsible: 'Jouer responsable',
    home: 'Accueil',
    predictions: 'Voir les prédictions',
    guideLink: 'Guide 888Starz',
    termsTag: 'Conditions à vérifier',
  },
  en: {
    dir: 'ltr',
    eyebrow: 'PARTNER OFFER · 888STARZ',
    title: 'Your exclusive 888Starz code',
    intro: 'Copy btts221, get a 300% bonus + 100 free spins (no wagering requirements, from a €1 deposit), then open 888Starz through the secure link.',
    partner: 'BTTSPredict × 888Starz',
    codeLabel: 'PROMO CODE',
    codeHint: 'Enter exactly in lowercase',
    offerLabel: 'btts221 CAMPAIGN ANNOUNCED',
    offerText: '300% bonus + 100 free spins at sign-up, no wagering requirements, from a €1 deposit — availability and eligibility to be confirmed directly on 888Starz.',
    conditions: 'Bonuses vary by country, account, period and wagering terms. Do not deposit before checking the official offer.',
    copy: 'Copy code',
    copied: 'Code copied',
    signup: 'Sign up with btts221',
    mobileSignup: 'Open 888Starz',
    guide: 'Activation in 4 steps',
    stepsTitle: 'How to use btts221',
    steps: [
      'Open 888Starz from the button above.',
      'Create your account and enter btts221 in lowercase if the field is available.',
      'Deposit from €1 with a payment method available in your country.',
      'Receive a 300% bonus + 100 free spins per the offer shown by 888Starz.',
    ],
    faqTitle: 'Questions about btts221 and 888Starz',
    faq: [
      { q: 'What is the 888Starz promo code?', a: 'The code shown on this page is btts221 in lowercase. Check that it is accepted during registration.' },
      { q: 'Does the code give 300% + 100 free spins?', a: 'Yes — the announced campaign offers a 300% bonus + 100 free spins, no wagering requirements. Confirm the offer displayed on 888Starz for your country, account and period.' },
      { q: 'What is the minimum deposit?', a: 'The announced minimum deposit is €1. Check the amount displayed before making any transaction.' },
      { q: 'Does the code work everywhere?', a: 'Not guaranteed. Eligibility may depend on your country, account, device and the operator’s local rules.' },
    ],
    verified: 'Page checked on',
    affiliate: 'Paid affiliate link · 18+ · Operator terms apply.',
    responsible: 'Play responsibly',
    home: 'Home',
    predictions: 'View predictions',
    guideLink: '888Starz guide',
    termsTag: 'Terms to verify',
  },
  ar: {
    dir: 'rtl',
    eyebrow: 'عرض الشريك · 888STARZ',
    title: 'رمزك الحصري في 888Starz',
    intro: 'انسخ الرمز btts221، واحصل على مكافأة 300% + 100 لفة مجانية (بدون شروط مراهنة، بدءاً من إيداع 1 يورو)، ثم افتح 888Starz عبر الرابط الآمن.',
    partner: 'BTTSPredict × 888Starz',
    codeLabel: 'الرمز الترويجي',
    codeHint: 'أدخله تماماً بأحرف صغيرة',
    offerLabel: 'حملة btts221 المعلنة',
    offerText: 'مكافأة 300% + 100 لفة مجانية عند التسجيل، بدون شروط مراهنة، بدءاً من إيداع 1 يورو — يجب تأكيد التوفر والأهلية مباشرة على 888Starz.',
    conditions: 'قد تختلف المكافآت حسب البلد والحساب والفترة وشروط المراهنة. لا تقم بالإيداع قبل التحقق من العرض الرسمي.',
    copy: 'نسخ الرمز',
    copied: 'تم نسخ الرمز',
    signup: 'التسجيل باستخدام btts221',
    mobileSignup: 'فتح 888Starz',
    guide: 'التفعيل في 4 خطوات',
    stepsTitle: 'كيفية استخدام btts221',
    steps: [
      'افتح 888Starz من الزر أعلاه.',
      'أنشئ حسابك وأدخل btts221 بأحرف صغيرة إذا كان الحقل متاحاً.',
      'أودع من 1 يورو بوسيلة دفع متوفرة في بلدك.',
      'احصل على مكافأة 300% + 100 لفة مجانية وفق العرض المعروض من 888Starz.',
    ],
    faqTitle: 'أسئلة حول btts221 و888Starz',
    faq: [
      { q: 'ما هو الرمز الترويجي لـ 888Starz؟', a: 'الرمز المعروض في هذه الصفحة هو btts221 بأحرف صغيرة. تحقق من قبوله أثناء التسجيل.' },
      { q: 'هل يمنح الرمز 300% + 100 لفة مجانية؟', a: 'نعم — الحملة المعلنة توفر مكافأة 300% + 100 لفة مجانية بدون شروط مراهنة. أكّد العرض الظاهر على 888Starz حسب بلدك وحسابك والفترة.' },
      { q: 'ما هو الحد الأدنى للإيداع؟', a: 'الحد الأدنى المعلن للإيداع هو 1 يورو. تحقق من المبلغ الظاهر قبل إجراء أي معاملة.' },
      { q: 'هل يعمل الرمز في كل البلدان؟', a: 'لا يوجد ضمان عام. قد تعتمد الأهلية على البلد والحساب والجهاز والقواعد المحلية للمشغل.' },
    ],
    verified: 'تم التحقق من الصفحة في',
    affiliate: 'رابط تابع مدفوع · +18 · تطبق شروط المشغل.',
    responsible: 'اللعب المسؤول',
    home: 'الرئيسية',
    predictions: 'عرض التوقعات',
    guideLink: 'دليل 888Starz',
    termsTag: 'تحقق من الشروط',
  },
}

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'ar', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar',
  }).format(new Date(`${value}T12:00:00Z`))
}

export default function Btts221PromoClient({ lang, reviewDate }: { lang: Lang; reviewDate: string }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const copy = useMemo(() => COPY[lang], [lang])

  const handleCopy = async () => {
    // Succès affiché UNIQUEMENT si la copie a réellement réussi
    const ok = await copyTextToClipboard(CODE)
    if (ok) {
      setCopied(true)
      setCopyFailed(false)
      trackAffiliateCodeCopy('888starz', `btts221-${lang}-hero`)
      window.setTimeout(() => setCopied(false), 2200)
    } else {
      setCopyFailed(true)
      setCopied(false)
      window.setTimeout(() => setCopyFailed(false), 4000)
    }
  }

  const handleSignup = () => trackAffiliateAction('888starz', 'signup_cta_click', `btts221-${lang}-hero`)
  const signupLabel = copyFailed ? `${copy.copy} ⚠` : copied ? copy.copied : copy.copy

  return (
    <main dir={copy.dir} className="min-h-screen overflow-hidden bg-[#07090D] text-white">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(circle_at_12%_0%,rgba(248, 113, 113,.18),transparent_32%),radial-gradient(circle_at_88%_6%,rgba(255,215,0,.12),transparent_28%),linear-gradient(180deg,#11141B_0%,#07090D_78%)]" />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pb-16 sm:pt-8">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-[#9CA3AF]">
            <a href={lang === 'fr' ? '/' : `/${lang}`} className="transition-colors hover:text-white">{copy.home}</a>
            <span>/</span>
            <span aria-current="page" className="text-[#E5E7EB]">888Starz btts221</span>
          </nav>

          <section className="relative overflow-hidden rounded-[2rem] border border-[#F87171]/30 bg-[#10161D]/90 shadow-[0_30px_100px_rgba(0,0,0,.45)]">
            <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-[#F87171]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#E8C268]/10 blur-3xl" />
            <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-12 lg:p-12">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Image src="/logos/888starz.svg" alt="888Starz" width={200} height={56} priority className="h-11 w-auto drop-shadow-[0_8px_24px_rgba(248, 113, 113,.22)]" />
                  <span className="rounded-full border border-[#E8C268]/35 bg-[#E8C268]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#E8C268]">{copy.partner}</span>
                </div>
                <p className="mt-7 text-[10px] font-black uppercase tracking-[.25em] text-[#F87171]">{copy.eyebrow}</p>
                <h1 className="mt-3 max-w-2xl text-[2.7rem] font-black leading-[.95] tracking-[-.055em] text-white sm:text-6xl">{copy.title}</h1>
                <p className="mt-5 max-w-xl text-sm leading-7 text-[#B9C0CA] sm:text-base">{copy.intro}</p>
                <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#C9CED7]">
                  <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">18+</span>
                  <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">888Starz</span>
                  <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2">{copy.termsTag}</span>
                </div>
              </div>

              <div className="relative rounded-[1.6rem] border border-[#E8C268]/45 bg-[linear-gradient(145deg,rgba(255,215,0,.12),rgba(248, 113, 113,.08)_46%,rgba(5,7,11,.5))] p-4 shadow-[0_20px_60px_rgba(0,0,0,.3)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#E8C268]">{copy.codeLabel}</p>
                  <span className="h-2 w-2 rounded-full bg-[#63E6BE] shadow-[0_0_14px_#63E6BE]" aria-label="Active campaign" />
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#07090D]/80 px-4 py-6 text-center sm:py-8">
                  <code className="block text-[3.65rem] font-black leading-none tracking-[.12em] text-white sm:text-7xl">{CODE}</code>
                  <p className="mt-3 text-xs text-[#AEB5C0]">{copy.codeHint}</p>
                </div>
                <button type="button" onClick={handleCopy} className="mt-4 w-full rounded-xl border border-[#E8C268] bg-[#E8C268] px-5 py-3.5 text-sm font-black text-[#13100A] shadow-[0_12px_30px_rgba(255,215,0,.2)] transition-all hover:-translate-y-0.5 hover:bg-[#FFE47A] active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-[#E8C268] focus:ring-offset-2 focus:ring-offset-[#10161D]" aria-live="polite">
                  {signupLabel}
                </button>
                <a href={AFFILIATE.star888} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={handleSignup} data-cta={`btts221-${lang}-signup`} className="mt-3 flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#F87171,#D63148)] px-5 py-4 text-center text-sm font-black text-white shadow-[0_14px_34px_rgba(214,49,72,.28)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-[#F87171] focus:ring-offset-2 focus:ring-offset-[#10161D]">
                  {copy.signup}
                </a>
                <p className="mt-3 text-center text-[10px] leading-5 text-[#8E96A3]">{copy.verified} <time dateTime={reviewDate}>{formatDate(reviewDate, lang)}</time></p>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-3xl border border-[#F87171]/25 bg-[linear-gradient(135deg,rgba(248, 113, 113,.11),rgba(17,20,27,.94)_58%)] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#F87171]">{copy.offerLabel}</p>
                  <p className="mt-3 text-xl font-black leading-8 text-white sm:text-2xl">{copy.offerText}</p>
                </div>
                <span className="hidden shrink-0 rounded-full border border-[#E8C268]/30 bg-[#E8C268]/10 px-3 py-1 text-[10px] font-bold uppercase text-[#E8C268] sm:inline-flex">888Starz</span>
              </div>
              <p className="mt-4 max-w-3xl text-xs leading-6 text-[#AEB5C0]">{copy.conditions}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-[#10161D] p-5 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#E8C268]">{copy.guide}</p>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-[#D5DAE2]">
                {copy.steps.slice(0, 3).map((step, index) => <li key={step} className="flex gap-3"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F87171]/15 text-xs font-black text-[#F87171]">{index + 1}</span><span>{step}</span></li>)}
              </ol>
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mt-2 sm:mt-4">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{copy.stepsTitle}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {copy.steps.map((step, index) => <article key={step} className="rounded-2xl border border-white/10 bg-[#10161D] p-5 transition-colors hover:border-[#F87171]/35"><span className="text-xs font-black text-[#E8C268]">0{index + 1}</span><p className="mt-3 text-sm leading-6 text-[#C7CDD6]">{step}</p></article>)}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="btts221-faq">
          <h2 id="btts221-faq" className="text-2xl font-black tracking-tight text-white sm:text-3xl">{copy.faqTitle}</h2>
          <div className="mt-5 space-y-3">
            {copy.faq.map((item) => <details key={item.q} className="rounded-2xl border border-white/10 bg-[#10161D] p-5"><summary className="cursor-pointer font-bold text-white">{item.q}</summary><p className="mt-3 text-sm leading-7 text-[#B9C0CA]">{item.a}</p></details>)}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-[#F87171]/25 bg-[#F87171]/5 p-5 text-center">
          <p className="text-xs leading-6 text-[#C2C8D1]">{copy.affiliate} <a className="font-bold text-[#E8C268] underline underline-offset-2" href={lang === 'fr' ? '/jouer-responsable' : `/${lang}/jouer-responsable`}>{copy.responsible}</a></p>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-bold text-[#F87171]">
          <a href={lang === 'fr' ? '/btts/predictions/today' : `/${lang}/btts/predictions/today`} className="hover:text-white">{copy.predictions}</a>
          <a href={lang === 'fr' ? '/bonus-888starz' : `/${lang}/bonus-888starz`} className="hover:text-white">{copy.guideLink}</a>
        </div>
      </div>

    </main>
  )
}
