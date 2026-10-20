'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AFFILIATE } from '@/lib/constants'
import { onlyVipFixtures } from '@/lib/vipPredictions'
import { useLanguage } from '@/components/bttsbet/LanguageSwitcher'
import type { Locale } from '@/lib/i18n'
import { trackAffiliateAction, trackAffiliateCodeCopy } from '@/lib/affiliateTracking'
import AnimatedTitle from '@/components/bttsbet/HeroWordmark'
import { copyTextToClipboard } from '@/lib/clipboard'
import './vip.css'

const Navbar = dynamic(() => import('@/components/bttsbet/Navbar'), { loading: () => null })
const Footer = dynamic(() => import('@/components/bttsbet/Footer'), { loading: () => null })
const ErrorBoundary = dynamic(() => import('@/components/bttsbet/ErrorBoundary'), { loading: () => null })

/* ────────────────── Parcours VIP — Linebet uniquement ──────────────────
   Déblocage : création d'un NOUVEAU compte Linebet avec le code promo
   VISION221 + dépôt minimum de 10 €, puis vérification WhatsApp.
   (VISION221 = code Linebet ; btts221 = code 888Starz, voir /bonus-888starz)
   ──────────────────────────────────────────────────────────────────── */
const VIP_BRAND = 'Linebet'
const VIP_CODE = 'VISION221'
const VIP_DEPOSIT = '10 €'
const VIP_DEPOSIT_XOF = '≈ 6 560 XOF'
const VIP_SIGNUP = AFFILIATE.linebet

const WHATSAPP_NUMBER = '15406704172' // inchangé

/* ────────────────────────── Types & helpers ────────────────────────── */

type PredictionFixture = {
  id?: string
  home?: string
  away?: string
  league?: string
  date?: string
  time?: string
  kickoff?: string
}

function dakarDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatKickoff(value: string, lang: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : lang === 'en' ? 'en-GB' : 'fr-FR', {
    timeZone: 'Africa/Dakar',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function fixtureKickoff(fixture: PredictionFixture) {
  const raw = fixture.kickoff || (fixture.date && fixture.time ? `${fixture.date}T${fixture.time}:00Z` : '')
  return { raw, timestamp: Date.parse(raw) }
}

/* Effet 3D : inclinaison douce au survol / au doigt (désactivée si prefers-reduced-motion) */
/* Le ref est créé dans le composant (pattern standard) et passé en paramètre :
   aucune propriété de ref n'est exposée dans l'objet retourné (react-hooks/refs). */
function useTilt(
  ref: React.RefObject<HTMLDivElement | null>,
  max = 8,
) {
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `rotateY(${(px * max).toFixed(2)}deg) rotateX(${(-py * max).toFixed(2)}deg)`
  }, [ref, max])
  const onPointerLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = ''
  }, [ref])
  return { onPointerMove, onPointerLeave }
}

/* ────────────────────────── Icônes inline ────────────────────────── */

const Icon = {
  shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" /></svg>
  ),
  eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  ),
  crown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 18h20M4 18l-1.5-9 5.5 4 4-7 4 7 5.5-4L20 18" /></svg>
  ),
  whatsapp: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01-1.87-1.87-4.36-2.91-7.01-2.91zm0 1.67c2.2 0 4.27.86 5.82 2.42 1.56 1.56 2.42 3.63 2.42 5.82 0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31c-.81-1.29-1.24-2.79-1.24-4.34 0-4.54 3.7-8.24 8.24-8.24z" /><path d="M9.1 7.3c-.2-.45-.42-.46-.6-.47l-.52-.01c-.18 0-.47.07-.72.34-.25.27-.94.92-.94 2.24 0 1.32.96 2.6 1.1 2.78.13.18 1.88 3 4.6 4.09 2.27.9 2.73.72 3.23.68.5-.05 1.6-.65 1.82-1.29.23-.63.23-1.17.16-1.29-.07-.11-.25-.18-.52-.32-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.14-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.72-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.13-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.6-1.47-.83-2.01z" /></svg>
  ),
  spark: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>
  ),
  target: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M7 15l4-6 4 3 5-8" /></svg>
  ),
  users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
}

/* ────────────────────────── Copy FR / EN / AR ────────────────────────── */

const copy = {
  fr: {
    eyebrow: 'Accès VIP privé',
    title: 'Débloque ton accès VIP en 4 étapes claires',
    heroSub: `Copie le code ${VIP_CODE}, crée ton nouveau compte Linebet, dépose au minimum ${VIP_DEPOSIT} — et fais vérifier ton accès sur WhatsApp pour entrer dans l’espace VIP.`,
    ctaUnlock: 'Débloquer mon accès',
    freeLink: 'Pronostics gratuits',
    trustLink: 'Historique public',
    trust1: 'Scores vérifiés ESPN',
    trust2: 'Historique 100 % public',
    trust3: 'Pronos publiés avant le coup d’envoi',
    memberTop: 'BTTSPredict',
    memberKind: 'Carte membre',
    memberPerks: 'BTTS · Over 2.5 · Score exact',
    memberVerified: 'Membre vérifié',
    unlockEyebrow: 'Système de déblocage',
    unlockTitle: 'Comment débloquer ton accès VIP ?',
    unlockSub: 'Aucune ambiguïté : voici exactement les 4 conditions à remplir, dans l’ordre. Chaque étape est vérifiée avant l’activation de ton accès.',
    cardSub: 'Toute la procédure est dans cette carte VIP. Clique sur chaque étape : une fenêtre détaillée s’ouvre avec les instructions exactes et les bons boutons.',
    progressDone: 'étapes validées',
    stepOpen: 'Ouvrir',
    stepDone: 'Fait',
    close: 'Fermer',
    next: 'Étape suivante',
    modalStep: 'Étape {n} sur 4',
    cond1Short: `Copie le code ${VIP_CODE} — 1 clic`,
    cond2Short: 'Colle-le lors de ton inscription Linebet',
    cond3Short: `Dépôt minimum de ${VIP_DEPOSIT} — obligatoire`,
    cond4Short: 'Message pré-rempli + ton ID joueur',
    m2NoBook: 'Copie d’abord ton code à l’étape 1.',
    m2Paste: 'Où coller le code ?',
    m2Where: 'Dans le champ « Code promo » du formulaire d’inscription Linebet (ou dans ton compte, section code promo).',
    m3Confirm: `Je confirme : dépôt de ${VIP_DEPOSIT} effectué`,
    m4Id: 'Ajoute ton ID joueur dans le message WhatsApp avant d’envoyer.',
    m4After: 'Dès que l’équipe confirme ton inscription et ton dépôt, ton accès VIP est activé et les combinés se déverrouillent.',
    matchesTitle: 'Les matchs VIP du jour',
    matchesSub: 'Les affiches analysées par le moteur. La sélection reste verrouillée jusqu’à la vérification de ton accès.',
    conditionsTitle: 'Conditions de déblocage',
    cond1Title: 'Copie ton code promo',
    cond1Desc: `Clique sur la carte Linebet : ton code promo ${VIP_CODE} est copié automatiquement dans ton presse-papiers.`,
    cond2Title: 'Colle le code lors de ton inscription Linebet',
    cond2Desc: `Colle ${VIP_CODE} dans le champ « Code promo » pendant ton inscription sur Linebet. Tu peux aussi le recopier manuellement avec le bouton prévu.`,
    cond3Title: `Crée ton compte et dépose au minimum ${VIP_DEPOSIT}`,
    cond3Desc: `Inscris-toi via le bouton Linebet avec ton code promo, puis effectue un dépôt minimum de ${VIP_DEPOSIT} (${VIP_DEPOSIT_XOF}). Ce dépôt est obligatoire : sans lui, la vérification ne peut pas aboutir.`,
    cond4Title: 'Fais vérifier ton accès sur WhatsApp',
    cond4Desc: 'Clique sur le bouton de vérification : WhatsApp s’ouvre avec un message pré-rempli (bookmaker + code). Ajoute ton ID joueur et envoie — l’équipe active ton accès après contrôle.',
    depositLabel: 'Dépôt minimum requis',
    depositValue: VIP_DEPOSIT,
    depositNote: `${VIP_DEPOSIT_XOF} · Obligatoire — sans ce dépôt minimum, l’accès VIP ne peut pas être activé.`,
    chooseTitle: 'Ton code promo Linebet',
    chooseHint: 'Le clic copie automatiquement ton code promo',
    autoCopied: 'Code copié automatiquement',
    selected: 'Sélectionné',
    tapToCopy: 'Copier le code',
    codeLabel: 'Ton code promo',
    codeIdle: 'Clique pour copier VISION221',
    copyBtn: 'Copier le code',
    copiedBtn: 'Copié',
    signup: 'Créer mon compte Linebet',
    signupWith: 'Inscription avec le code collé',
    needBookmaker: 'Copie d’abord ton code ci-dessus',
    verify: 'Vérifier mon accès sur WhatsApp',
    verifyHint: 'Redirection WhatsApp avec message pré-rempli : ton bookmaker + ton code promo. Ajoute simplement ton ID joueur avant d’envoyer.',
    checklistTitle: 'Ta progression',
    check1: 'Code promo copié',
    check2: 'Compte Linebet créé avec le code',
    check3: `Dépôt de ${VIP_DEPOSIT} effectué (chez Linebet)`,
    check4: 'Demande WhatsApp envoyée',
    done: 'Fait',
    todo: 'À faire',
    combosEyebrow: 'Aperçu VIP',
    combosTitle: 'Les matchs sont visibles. La sélection reste verrouillée.',
    combosIntro: 'Voici les affiches analysées aujourd’hui. Le marché et la sélection VIP se déverrouillent après vérification de ton accès.',
    kickoff: 'Coup d’envoi',
    locked: 'Sélection verrouillée',
    lockedCta: 'Débloquer',
    combosEmpty: 'Aucune sélection VIP disponible aujourd’hui.',
    benefitsEyebrow: 'Ce que tu débloques',
    benefitsTitle: 'Un espace VIP complet, pas juste une liste',
    b1Title: 'Pronos VIP du jour',
    b1Desc: 'BTTS, Over 2.5 et score exact analysés par notre modèle statistique, publiés avant le coup d’envoi.',
    b2Title: 'Combinés exclusifs',
    b2Desc: 'Des combinés construits sur les sélections VIP, réservés aux membres vérifiés.',
    b3Title: 'Indice de confiance',
    b3Desc: 'Chaque pronostic affiche la probabilité calculée par le modèle (xG + forme récente).',
    b4Title: 'Historique transparent',
    b4Desc: 'Tous les pronos, gagnés et perdus, restent consultables publiquement sur la page historique.',
    b5Title: 'Liberté totale',
    b5Desc: 'Utilise tes pronos sur Linebet ou ton bookmaker habituel — tu restes maître de tes mises.',
    b6Title: 'Support WhatsApp',
    b6Desc: 'Une question sur ton accès ou ton code promo ? Une réponse directe sur WhatsApp.',
    trustEyebrow: 'Confiance & transparence',
    trustTitle: 'Vérifiable — pas des promesses',
    trustDesc: 'Chaque prono est archivé avec son résultat réel, scores vérifiés via ESPN. Rien n’est filtré : les pronos perdus restent visibles au même titre que les gagnants. Aucun gain n’est garanti — le pari sportif comporte toujours un risque.',
    faqTitle: 'Questions fréquentes',
    faq1Q: `Pourquoi un dépôt minimum de ${VIP_DEPOSIT} ?`,
    faq1A: `L’accès VIP est financé par notre partenaire bookmaker. Le dépôt minimum de ${VIP_DEPOSIT} (${VIP_DEPOSIT_XOF}), effectué avec ton code promo ${VIP_CODE} lors de la création de ton compte Linebet, conditionne l’activation de ton accès : c’est ce qui confirme que ton compte partenaire est réellement actif. Sans ce dépôt, la vérification ne peut pas aboutir — c’est la règle, appliquée à tout le monde.`,
    faq2Q: 'Le code promo n’a pas été copié, que faire ?',
    faq2A: `Clique à nouveau sur la carte Linebet : le code ${VIP_CODE} est recopié automatiquement. Tu peux aussi utiliser le bouton « Copier le code ». En dernier recours, saisis-le manuellement : ${VIP_CODE}, en majuscules.`,
    faq3Q: 'Combien de temps prend la vérification ?',
    faq3A: 'Envoie ta demande sur WhatsApp avec ton ID joueur après ton dépôt. La vérification est traitée dans la journée, aux heures de publication des pronos. Tu reçois une confirmation dès que ton accès est activé.',
    faq4Q: 'Mes données sont-elles en sécurité ?',
    faq4A: 'Ton ID joueur reste dans le message WhatsApp que tu choisis d’envoyer : BTTSPredict ne le reçoit pas via le site. Aucune donnée bancaire ne transite par nos pages — le dépôt se fait directement chez le bookmaker.',
    faq5Q: 'Des gains sont-ils garantis ?',
    faq5A: 'Non. Aucun résultat n’est garanti dans les paris sportifs. L’historique public affiche gagnés ET perdus, sans filtrage. Ne mise jamais plus que ce que tu peux te permettre de perdre (18+).',
    finalTitle: 'Prêt à entrer dans l’espace VIP ?',
    finalDesc: `Copie le code ${VIP_CODE}, crée ton compte Linebet, dépose au minimum ${VIP_DEPOSIT} et fais vérifier ton accès sur WhatsApp. 4 étapes, zéro ambiguïté.`,
    finalCta: 'Débloquer mon accès',
    responsible: '18+ · Les paris sportifs comportent des risques : endettement, isolement, dépendance. Pour être aidé : 09 74 75 13 13 (gratuit, France) ou begambleaware.org. Aucun gain n’est garanti.',
    footerNote: 'BTTSPredict est un site informatif et d’affiliation : nous ne prenons pas de paris et ne collectons aucun fonds.',
  },
  en: {
    eyebrow: 'Private VIP access',
    title: 'Unlock your VIP access in 4 clear steps',
    heroSub: `Copy the ${VIP_CODE} code, create your new Linebet account, deposit at least ${VIP_DEPOSIT} — and get your access verified on WhatsApp to step into the VIP space.`,
    ctaUnlock: 'Unlock my access',
    freeLink: 'Free predictions',
    trustLink: 'Public history',
    trust1: 'ESPN-verified scores',
    trust2: '100% public history',
    trust3: 'Picks published before kick-off',
    memberTop: 'BTTSPredict',
    memberKind: 'Member card',
    memberPerks: 'BTTS · Over 2.5 · Exact score',
    memberVerified: 'Verified member',
    unlockEyebrow: 'Unlock system',
    unlockTitle: 'How to unlock your VIP access?',
    unlockSub: 'Zero guesswork: these are the exact 4 conditions to meet, in order. Each step is checked before your access is activated.',
    cardSub: 'The whole process lives in this VIP card. Tap any step: a detailed popup opens with the exact instructions and the right buttons.',
    progressDone: 'steps completed',
    stepOpen: 'Open',
    stepDone: 'Done',
    close: 'Close',
    next: 'Next step',
    modalStep: 'Step {n} of 4',
    cond1Short: `Copy the ${VIP_CODE} code — 1 tap`,
    cond2Short: 'Paste it during your Linebet sign-up',
    cond3Short: `Minimum ${VIP_DEPOSIT} deposit — mandatory`,
    cond4Short: 'Pre-filled message + your player ID',
    m2NoBook: 'Copy your code in step 1 first.',
    m2Paste: 'Where to paste the code?',
    m2Where: 'In the “Promo code” field of the Linebet sign-up form (or in your account, promo code section).',
    m3Confirm: `I confirm: ${VIP_DEPOSIT} deposit made`,
    m4Id: 'Add your player ID to the WhatsApp message before sending.',
    m4After: 'As soon as the team confirms your sign-up and deposit, your VIP access is activated and the combos unlock.',
    matchesTitle: 'Today’s VIP matches',
    matchesSub: 'The fixtures analysed by the engine. The selection stays locked until your access is verified.',
    conditionsTitle: 'Unlock conditions',
    cond1Title: 'Copy your promo code',
    cond1Desc: `Tap the Linebet card: your promo code ${VIP_CODE} is automatically copied to your clipboard.`,
    cond2Title: 'Paste the code during your Linebet sign-up',
    cond2Desc: `Paste ${VIP_CODE} in the “Promo code” field while registering on Linebet. You can also copy it manually with the dedicated button.`,
    cond3Title: `Create your account and deposit at least ${VIP_DEPOSIT}`,
    cond3Desc: `Sign up through the Linebet button with your promo code, then make a minimum deposit of ${VIP_DEPOSIT} (${VIP_DEPOSIT_XOF}). This deposit is mandatory: without it, verification cannot go through.`,
    cond4Title: 'Get your access verified on WhatsApp',
    cond4Desc: 'Tap the verification button: WhatsApp opens with a pre-filled message (bookmaker + code). Add your player ID and send — the team activates your access after review.',
    depositLabel: 'Minimum deposit required',
    depositValue: VIP_DEPOSIT,
    depositNote: `${VIP_DEPOSIT_XOF} · Mandatory — without this minimum deposit, VIP access cannot be activated.`,
    chooseTitle: 'Your Linebet promo code',
    chooseHint: 'Tapping copies your promo code automatically',
    autoCopied: 'Code copied automatically',
    selected: 'Selected',
    tapToCopy: 'Tap to copy',
    codeLabel: 'Your promo code',
    codeIdle: 'Tap to copy VISION221',
    copyBtn: 'Copy code',
    copiedBtn: 'Copied',
    signup: 'Create my Linebet account',
    signupWith: 'Sign-up with the pasted code',
    needBookmaker: 'Copy your code above first',
    verify: 'Verify my access on WhatsApp',
    verifyHint: 'Redirects to WhatsApp with a pre-filled message: your bookmaker + your promo code. Just add your player ID before sending.',
    checklistTitle: 'Your progress',
    check1: 'Promo code copied',
    check2: 'Linebet account created with the code',
    check3: `${VIP_DEPOSIT} deposit made (with Linebet)`,
    check4: 'WhatsApp request sent',
    done: 'Done',
    todo: 'To do',
    combosEyebrow: 'VIP preview',
    combosTitle: 'Matches are visible. The selection stays locked.',
    combosIntro: 'Here are today’s analysed fixtures. The VIP market and selection unlock once your access is verified.',
    kickoff: 'Kick-off',
    locked: 'Selection locked',
    lockedCta: 'Unlock',
    combosEmpty: 'No VIP selection available today.',
    benefitsEyebrow: 'What you unlock',
    benefitsTitle: 'A complete VIP space, not just a list',
    b1Title: 'Daily VIP picks',
    b1Desc: 'BTTS, Over 2.5 and exact score analysed by our statistical model, published before kick-off.',
    b2Title: 'Exclusive combos',
    b2Desc: 'Combos built from VIP selections, reserved for verified members.',
    b3Title: 'Confidence index',
    b3Desc: 'Every pick shows the probability computed by the model (xG + recent form).',
    b4Title: 'Transparent history',
    b4Desc: 'All picks, wins and losses, stay publicly visible on the history page.',
    b5Title: 'Full freedom',
    b5Desc: 'Use your picks on Linebet or your usual bookmaker — you stay in control of your stakes.',
    b6Title: 'WhatsApp support',
    b6Desc: 'A question about your access or promo code? A direct answer on WhatsApp.',
    trustEyebrow: 'Trust & transparency',
    trustTitle: 'Verifiable — not promises',
    trustDesc: 'Every pick is archived with its real result, scores verified via ESPN. Nothing is filtered: losing picks stay visible just like winners. No profit is guaranteed — sports betting always carries risk.',
    faqTitle: 'Frequently asked questions',
    faq1Q: `Why a ${VIP_DEPOSIT} minimum deposit?`,
    faq1A: `VIP access is funded by our bookmaker partner. The ${VIP_DEPOSIT} minimum deposit (${VIP_DEPOSIT_XOF}), made with your promo code ${VIP_CODE} when creating your Linebet account, conditions the activation of your access: it confirms your partner account is actually active. Without this deposit, verification cannot go through — that rule applies to everyone.`,
    faq2Q: 'The promo code wasn’t copied, what now?',
    faq2A: `Tap the Linebet card again: the ${VIP_CODE} code is copied again automatically. You can also use the “Copy code” button. As a last resort, type it manually: ${VIP_CODE}, in capitals.`,
    faq3Q: 'How long does verification take?',
    faq3A: 'Send your request on WhatsApp with your player ID after your deposit. Verification is handled within the day, during pick publishing hours. You receive a confirmation once your access is activated.',
    faq4Q: 'Is my data safe?',
    faq4A: 'Your player ID stays inside the WhatsApp message you choose to send: BTTSPredict does not receive it through the site. No banking data goes through our pages — the deposit happens directly with the bookmaker.',
    faq5Q: 'Are winnings guaranteed?',
    faq5A: 'No. No result is guaranteed in sports betting. The public history shows wins AND losses, unfiltered. Never bet more than you can afford to lose (18+).',
    finalTitle: 'Ready to step into the VIP space?',
    finalDesc: `Copy the ${VIP_CODE} code, create your Linebet account, deposit at least ${VIP_DEPOSIT} and get your access verified on WhatsApp. 4 steps, zero guesswork.`,
    finalCta: 'Unlock my access',
    responsible: '18+ · Sports betting carries risks: debt, isolation, addiction. For help: begambleaware.org. No profit is guaranteed.',
    footerNote: 'BTTSPredict is an informational and affiliate website: we do not take bets and we do not collect funds.',
  },
  ar: {
    eyebrow: 'وصول VIP خاص',
    title: 'افتح وصولك إلى VIP في 4 خطوات واضحة',
    heroSub: `انسخ الرمز ${VIP_CODE}، أنشئ حساب Linebet جديداً، أودع ${VIP_DEPOSIT} على الأقل — ثم اطلب التحقق من وصولك عبر واتساب لدخول فضاء VIP.`,
    ctaUnlock: 'افتح وصولي',
    freeLink: 'توقعات مجانية',
    trustLink: 'السجل العام',
    trust1: 'نتائج موثقة من ESPN',
    trust2: 'سجل عام 100%',
    trust3: 'توقعات منشورة قبل انطلاق المباراة',
    memberTop: 'BTTSPredict',
    memberKind: 'بطاقة عضوية',
    memberPerks: 'BTTS · أكثر من 2.5 · النتيجة الدقيقة',
    memberVerified: 'عضو موثق',
    unlockEyebrow: 'نظام الفتح',
    unlockTitle: 'كيف تفتح وصولك إلى VIP؟',
    unlockSub: 'بلا أي غموض: هذه هي الشروط الأربعة المطلوبة بالترتيب. يتم التحقق من كل خطوة قبل تفعيل وصولك.',
    cardSub: 'الإجراء كامل داخل بطاقة VIP هذه. اضغط على كل خطوة: تُفتح نافذة مفصلة بالتعليمات الدقيقة والأزرار المناسبة.',
    progressDone: 'خطوات مكتملة',
    stepOpen: 'فتح',
    stepDone: 'منجز',
    close: 'إغلاق',
    next: 'الخطوة التالية',
    modalStep: 'الخطوة {n} من 4',
    cond1Short: `انسخ الرمز ${VIP_CODE} — بضغطة واحدة`,
    cond2Short: 'الصقه عند التسجيل في Linebet',
    cond3Short: `إيداع أدنى ${VIP_DEPOSIT} — إلزامي`,
    cond4Short: 'رسالة جاهزة + معرّف لاعبك',
    m2NoBook: 'انسخ رمزك أولاً في الخطوة 1.',
    m2Paste: 'أين تلصق الرمز؟',
    m2Where: 'في حقل «الرمز الترويجي» في استمارة التسجيل لدى Linebet (أو في حسابك، قسم الرمز الترويجي).',
    m3Confirm: `أؤكد: تم إيداع ${VIP_DEPOSIT}`,
    m4Id: 'أضف معرّف لاعبك في رسالة واتساب قبل الإرسال.',
    m4After: 'بمجرد أن يؤكد الفريق التسجيل والإيداع، يُفعَّل وصولك إلى VIP وتُفتح التركيبات.',
    matchesTitle: 'مباريات VIP اليوم',
    matchesSub: 'المواجهات التي حللها المحرك. يبقى الاختيار مقفلاً حتى يتم التحقق من وصولك.',
    conditionsTitle: 'شروط الفتح',
    cond1Title: 'انسخ رمزك الترويجي',
    cond1Desc: `اضغط على بطاقة Linebet: يُنسخ رمزك الترويجي ${VIP_CODE} تلقائياً إلى الحافظة.`,
    cond2Title: 'الصق الرمز عند التسجيل في Linebet',
    cond2Desc: `الصق ${VIP_CODE} في حقل «الرمز الترويجي» أثناء تسجيلك في Linebet. يمكنك أيضاً نسخه يدوياً عبر الزر المخصص.`,
    cond3Title: `أنشئ حسابك وأودع ${VIP_DEPOSIT} على الأقل`,
    cond3Desc: `سجّل عبر زر Linebet باستخدام رمزك الترويجي، ثم أجرِ إيداعاً بحد أدنى ${VIP_DEPOSIT} (${VIP_DEPOSIT_XOF}). هذا الإيداع إلزامي: بدونه لا يمكن إتمام التحقق.`,
    cond4Title: 'اطلب التحقق من وصولك عبر واتساب',
    cond4Desc: 'اضغط زر التحقق: يفتح واتساب برسالة جاهزة (الشركة + الرمز). أضف معرّف لاعبك وأرسل — يقوم الفريق بتفعيل وصولك بعد المراجعة.',
    depositLabel: 'الحد الأدنى للإيداع مطلوب',
    depositValue: VIP_DEPOSIT,
    depositNote: `${VIP_DEPOSIT_XOF} · إلزامي — بدون هذا الإيداع لا يمكن تفعيل وصول VIP.`,
    chooseTitle: 'رمزك الترويجي لـ Linebet',
    chooseHint: 'الضغط ينسخ رمزك الترويجي تلقائياً',
    autoCopied: 'تم نسخ الرمز تلقائياً',
    selected: 'محدد',
    tapToCopy: 'اضغط لنسخ الرمز',
    codeLabel: 'رمزك الترويجي',
    codeIdle: 'اضغط لنسخ VISION221',
    copyBtn: 'نسخ الرمز',
    copiedBtn: 'تم النسخ',
    signup: 'أنشئ حساب Linebet',
    signupWith: 'التسجيل بالرمز المنسوخ',
    needBookmaker: 'انسخ رمزك أولاً بالأعلى',
    verify: 'تحقق من وصولي عبر واتساب',
    verifyHint: 'تحويل إلى واتساب برسالة جاهزة: شركتك + رمزك الترويجي. أضف فقط معرّف لاعبك قبل الإرسال.',
    checklistTitle: 'تقدمك',
    check1: 'تم نسخ الرمز الترويجي',
    check2: 'تم إنشاء حساب Linebet بالرمز',
    check3: `تم إيداع ${VIP_DEPOSIT} (لدى Linebet)`,
    check4: 'تم إرسال طلب واتساب',
    done: 'منجز',
    todo: 'للإنجاز',
    combosEyebrow: 'معاينة VIP',
    combosTitle: 'المباريات ظاهرة. الاختيار يبقى مقفلاً.',
    combosIntro: 'هذه مواجهات اليوم التي تم تحليلها. يُفتح سوق واختيار VIP بعد التحقق من وصولك.',
    kickoff: 'انطلاق المباراة',
    locked: 'الاختيار مقفل',
    lockedCta: 'فتح',
    combosEmpty: 'لا توجد اختيارات VIP متاحة اليوم.',
    benefitsEyebrow: 'ماذا تفتح',
    benefitsTitle: 'فضاء VIP كامل، وليس مجرد قائمة',
    b1Title: 'توقعات VIP اليومية',
    b1Desc: 'BTTS وأكثر من 2.5 والنتيجة الدقيقة يحللها نموذجنا الإحصائي وتُنشر قبل انطلاق المباريات.',
    b2Title: 'تركيبات حصرية',
    b2Desc: 'تركيبات مبنية على اختيارات VIP، محجوزة للأعضاء الموثقين.',
    b3Title: 'مؤشر الثقة',
    b3Desc: 'كل توقع يعرض الاحتمالية المحسوبة من النموذج (xG + الفورمة الحديثة).',
    b4Title: 'سجل شفاف',
    b4Desc: 'كل التوقعات، الرابحة والخاسرة، تبقى متاحة للعموم في صفحة السجل.',
    b5Title: 'حرية كاملة',
    b5Desc: 'استخدم توقعاتك على Linebet أو شركتك المعتادة — أنت من يتحكم في رهاناتك.',
    b6Title: 'دعم واتساب',
    b6Desc: 'سؤال حول وصولك أو رمزك الترويجي؟ إجابة مباشرة عبر واتساب.',
    trustEyebrow: 'الثقة والشفافية',
    trustTitle: 'قابل للتحقق — لا وعود',
    trustDesc: 'كل توقعة تُؤرشف بنتيجتها الحقيقية، مع نتائج موثقة من ESPN. لا يوجد أي ترشيح: التوقعات الخاسرة تبقى ظاهرة كالرابحة. لا يوجد ربح مضمون — المراهنات الرياضية تنطوي دائماً على مخاطر.',
    faqTitle: 'الأسئلة الشائعة',
    faq1Q: `لماذا إيداع أدنى ${VIP_DEPOSIT}؟`,
    faq1A: `يتم تمويل وصول VIP من قبل شريكنا شركة المراهنات. الإيداع الأدنى ${VIP_DEPOSIT} (${VIP_DEPOSIT_XOF}) باستخدام رمزك الترويجي ${VIP_CODE} عند إنشاء حسابك في Linebet هو شرط تفعيل وصولك: فهو يؤكد أن حسابك لدى الشريك نشط فعلاً. بدون هذا الإيداع لا يمكن إتمام التحقق — قاعدة مطبقة على الجميع.`,
    faq2Q: 'لم يُنسخ الرمز الترويجي، ماذا أفعل؟',
    faq2A: `اضغط مرة أخرى على بطاقة Linebet: يُنسخ الرمز ${VIP_CODE} تلقائياً من جديد. يمكنك أيضاً استخدام زر «نسخ الرمز». وكحل أخير، أدخله يدوياً: ${VIP_CODE} بأحرف كبيرة.`,
    faq3Q: 'كم يستغرق التحقق؟',
    faq3A: 'أرسل طلبك عبر واتساب مع معرّف لاعبك بعد الإيداع. تُعالج عملية التحقق خلال اليوم، في أوقات نشر التوقعات. تتلقى تأكيداً بمجرد تفعيل وصولك.',
    faq4Q: 'هل بياناتي آمنة؟',
    faq4A: 'يبقى معرّف لاعبك داخل رسالة واتساب التي تختار إرسالها: لا يستلمه BTTSPredict عبر الموقع. ولا تمر أي بيانات بنكية عبر صفحاتنا — الإيداع يتم مباشرة لدى شركة المراهنات.',
    faq5Q: 'هل الأرباح مضمونة؟',
    faq5A: 'لا. لا نتيجة مضمونة في المراهنات الرياضية. السجل العام يعرض الرابح والخاسر بلا ترشيح. لا تراهن أبداً بأكثر مما يمكنك تحمل خسارته (18+).',
    finalTitle: 'جاهز للدخول إلى فضاء VIP؟',
    finalDesc: `انسخ الرمز ${VIP_CODE}، أنشئ حسابك في Linebet، أودع ${VIP_DEPOSIT} على الأقل واطلب التحقق عبر واتساب. 4 خطوات، بلا غموض.`,
    finalCta: 'افتح وصولي',
    responsible: '18+ · تنطوي المراهنات الرياضية على مخاطر: المديونية، العزلة، الإدمان. للمساعدة: begambleaware.org. لا يوجد ربح مضمون.',
    footerNote: 'BTTSPredict موقع معلوماتي وتسويق بالعمولة: نحن لا نقبل الرهانات ولا نجمع أموالاً.',
  },
} as const

/* ────────────────────────── Page ────────────────────────── */

export default function VipPage() {
  const { lang: detectedLang } = useLanguage()
  const lang: Locale = detectedLang
  const text = copy[lang]

  const [codeSelected, setCodeSelected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [signupOpened, setSignupOpened] = useState(false)
  const [depositConfirmed, setDepositConfirmed] = useState(false)
  const [verifyOpened, setVerifyOpened] = useState(false)
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | 4 | null>(null)
  const [toast, setToast] = useState('')
  const [fixtures, setFixtures] = useState<PredictionFixture[]>([])

  const memberCardRef = useRef<HTMLDivElement | null>(null)
  const memberTilt = useTilt(memberCardRef, 9)

  const today = dakarDate()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  /* Mesure : 1 visite de la page VIP par session (visite ≠ clic ≠ inscription) */
  useEffect(() => {
    trackAffiliateAction('linebet', 'promo_view', 'vip-page-visit')
  }, [])

  /* Fenêtres pop : Escape ferme + scroll bloqué tant qu'une étape est ouverte */
  useEffect(() => {
    if (openStep === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenStep(null)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [openStep])

  /* Aperçu VIP : uniquement les fixtures explicitement marquées VIP par la source de données.
     Jamais de contenu gratuit (free / predictions / vipPreview non flagué) dans cet espace —
     seule une donnée explicitement VIP (payload.vip / payload.vipPredictions, flag vip) est retenue. */
  useEffect(() => {
    let cancelled = false
    fetch('/predictions.json', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<{ date?: string; vip?: PredictionFixture[]; vipPredictions?: PredictionFixture[] }>) : null))
      .then((payload) => {
        if (cancelled || !payload || payload.date !== dakarDate()) return
        const rows = onlyVipFixtures(payload)
        const seen = new Set<string>()
        const upcoming: PredictionFixture[] = []
        for (const fixture of rows) {
          const home = fixture.home?.trim()
          const away = fixture.away?.trim()
          const { raw, timestamp } = fixtureKickoff(fixture)
          if (!home || !away || !Number.isFinite(timestamp) || timestamp <= Date.now()) continue
          // Sélections du jour uniquement (Africa/Dakar) : un match programmé
          // à J+N (ex. dans 4 jours) n'est jamais présenté comme sélection du jour.
          if (dakarDate(new Date(timestamp)) !== today) continue
          const key = `${home.toLowerCase()}|${away.toLowerCase()}|${timestamp}`
          if (seen.has(key)) continue
          seen.add(key)
          upcoming.push({ ...fixture, kickoff: raw })
          if (upcoming.length >= 4) break
        }
        if (!cancelled) setFixtures(upcoming)
      })
      .catch(() => {
        if (!cancelled) setFixtures([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* Clic carte Linebet = sélection + COPIE AUTOMATIQUE du code promo
     (le toast ne confirme que si la copie a réellement réussi) */
  const activateCode = async () => {
    setCodeSelected(true)
    trackAffiliateAction('linebet', 'promo_view', 'vip-page')
    const ok = await copyTextToClipboard(VIP_CODE)
    if (ok) {
      setCopied(true)
      trackAffiliateCodeCopy('linebet', 'vip-linebet-card')
      setToast(`${VIP_CODE} — ${text.autoCopied}`)
    } else {
      setCopied(false)
      setToast(`${VIP_CODE} — ${text.copyBtn}`)
    }
  }

  const manualCopy = async () => {
    const ok = await copyTextToClipboard(VIP_CODE)
    if (ok) {
      setCopied(true)
      setCodeSelected(true)
      trackAffiliateCodeCopy('linebet', 'vip-code-chip')
      setToast(`${VIP_CODE} — ${text.copiedBtn}`)
    }
  }

  /* Bouton de vérification → redirection WhatsApp (message pré-rempli) */
  const openVerification = () => {
    trackAffiliateAction('linebet', 'whatsapp_click', 'vip-verify')
    setVerifyOpened(true)
    const message =
      lang === 'en'
        ? `Hello BTTSPredict, I would like to verify my VIP access. Bookmaker: ${VIP_BRAND}. Promo code used: ${VIP_CODE}. Minimum deposit of ${VIP_DEPOSIT} made. My player ID: `
        : lang === 'ar'
          ? `مرحباً BTTSPredict، أرغب في التحقق من وصولي إلى VIP. شركة المراهنات: ${VIP_BRAND}. الرمز الترويجي المستخدم: ${VIP_CODE}. تم الإيداع الأدنى ${VIP_DEPOSIT}. معرّف لاعبي: `
          : `Bonjour BTTSPredict, je souhaite faire vérifier mon accès VIP. Bookmaker : ${VIP_BRAND}. Code promo utilisé : ${VIP_CODE}. Dépôt minimum de ${VIP_DEPOSIT} effectué. Mon ID joueur : `
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpenStep(null)
  }

  const steps = [
    { n: 1 as const, title: text.cond1Title, short: text.cond1Short, done: codeSelected },
    { n: 2 as const, title: text.cond2Title, short: text.cond2Short, done: signupOpened },
    { n: 3 as const, title: text.cond3Title, short: text.cond3Short, done: depositConfirmed },
    { n: 4 as const, title: text.cond4Title, short: text.cond4Short, done: verifyOpened },
  ]
  const doneCount = steps.filter((step) => step.done).length

  const openStepModal = (n: 1 | 2 | 3 | 4) => {
    trackAffiliateAction('linebet', 'vip_unlock_open', `vip-step-${n}`)
    setOpenStep(n)
  }

  return (
    <div className="vipx" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <ErrorBoundary><Navbar /></ErrorBoundary>

      {toast && <div className="vipx-toast" role="status"><Icon.check /> {toast}</div>}

      <main id="main-content">
        {/* ═══════════ HERO ═══════════ */}
        <section className="vipx-hero">
          <div className="vipx-hero__aura" aria-hidden="true" />
          <div className="vipx-hero__grid vipx-shell">
            <div className="vipx-hero__copy">
              <span className="vipx-eyebrow"><i aria-hidden="true" />{text.eyebrow}</span>
              <AnimatedTitle as="h1" text={text.title} accentColor="#E8C268" />
              <p className="vipx-hero__sub">{text.heroSub}</p>
              <div className="vipx-hero__cta">
                <a className="vipx-btn vipx-btn--gold" href="#deblocage" onClick={() => setOpenStep(1)}>{text.ctaUnlock}<span aria-hidden="true">→</span></a>
                <a className="vipx-btn vipx-btn--ghost" href="/btts/predictions/today">{text.freeLink}</a>
              </div>
              <ul className="vipx-hero__trust">
                <li><Icon.shield />{text.trust1}</li>
                <li><Icon.eye />{text.trust2}</li>
                <li><Icon.clock />{text.trust3}</li>
              </ul>
            </div>

            {/* Carte membre 3D */}
            <div className="vipx-hero__card">
              <div className="vipx-scene">
                <div className="vipx-member vipx-tilt" ref={memberCardRef} onPointerMove={memberTilt.onPointerMove} onPointerLeave={memberTilt.onPointerLeave}>
                  <div className="vipx-member__row">
                    <strong>{text.memberTop}</strong>
                    <span className="vipx-member__crown"><Icon.crown />VIP</span>
                  </div>
                  <div className="vipx-member__chip" aria-hidden="true" />
                  <div className="vipx-member__middle">
                    <span>{text.memberKind}</span>
                    <small>{text.memberPerks}</small>
                  </div>
                  <div className="vipx-member__row vipx-member__row--bottom">
                    <span className="vipx-member__verified"><Icon.check />{text.memberVerified}</span>
                    <span className="vipx-member__stars" aria-hidden="true">★★★★★</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ CARTE VIP — PROCÉDURE COMPLÈTE ═══════════ */}
        <section id="deblocage" className="vipx-unlock vipx-shell">
          <header className="vipx-section-head">
            <span className="vipx-eyebrow"><i aria-hidden="true" />{text.unlockEyebrow}</span>
            <h2>{text.unlockTitle}</h2>
            <p>{text.cardSub}</p>
          </header>

          <article className="vipx-card">
            <div className="vipx-card__head">
              <span className="vipx-card__badge"><Icon.crown />VIP</span>
              <div className="vipx-card__progress">
                <strong>{doneCount} / 4</strong>
                <span>{text.progressDone}</span>
                <div className="vipx-card__bar" aria-hidden="true"><i style={{ width: `${Math.round((doneCount / 4) * 100)}%` }} /></div>
              </div>
            </div>

            {/* Étapes cliquables — chaque clic ouvre une fenêtre pop détaillée */}
            <ol className="vipx-steps">
              {steps.map((step) => (
                <li key={step.n}>
                  <button type="button" className={`vipx-step${step.done ? ' is-done' : ''}`} onClick={() => openStepModal(step.n)} aria-haspopup="dialog">
                    <span className="vipx-step__num" aria-hidden="true">{step.done ? <Icon.check /> : step.n}</span>
                    <span className="vipx-step__body">
                      <strong>{step.title}</strong>
                      <small>{step.short}</small>
                    </span>
                    <span className="vipx-step__cta">{step.done ? text.stepDone : text.stepOpen}<span aria-hidden="true">→</span></span>
                  </button>
                </li>
              ))}
            </ol>

            {/* Matchs VIP affichés dans la carte */}
            <div className="vipx-card__matches">
              <div className="vipx-card__matches-head">
                <h4><Icon.target />{text.matchesTitle}</h4>
                <time dateTime={today}>{today}</time>
              </div>
              <p className="vipx-card__matches-sub">{text.matchesSub}</p>
              {fixtures.length > 0 ? (
                <ul className="vipx-matches">
                  {fixtures.map((fixture, index) => {
                    const { raw } = fixtureKickoff(fixture)
                    return (
                      <li key={`${fixture.home}-${fixture.away}-${raw}-${index}`}>
                        <div className="vipx-matches__teams">
                          <small>{fixture.league?.trim() || 'Football'}</small>
                          <strong>{fixture.home} <span aria-hidden="true">vs</span> {fixture.away}</strong>
                        </div>
                        <div className="vipx-matches__right">
                          <time dateTime={raw}>{formatKickoff(raw, lang)}</time>
                          <span className="vipx-matches__hidden"><Icon.lock />VIP</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="vipx-matches__empty" role="status">{text.combosEmpty}</p>
              )}
              <div className="vipx-matches__locked">
                <Icon.lock />
                <span>{text.locked}</span>
                <button type="button" className="vipx-btn vipx-btn--gold vipx-btn--sm" onClick={() => openStepModal(1)}>{text.lockedCta}</button>
              </div>
            </div>

            {/* Vérification WhatsApp — toujours visible en bas de carte */}
            <div className="vipx-card__footer">
              <button type="button" className="vipx-btn vipx-btn--wa vipx-btn--block" onClick={openVerification} disabled={!codeSelected} data-cta="vip-verify-whatsapp">
                <Icon.whatsapp />{text.verify}
              </button>
              <p className="vipx-card__hint">{text.verifyHint}</p>
            </div>
          </article>

          {/* Fenêtres pop détaillées — une par étape */}
          {openStep !== null && (
            <div className="vipx-modal" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setOpenStep(null) }}>
              <div className="vipx-modal__panel">
                <button type="button" className="vipx-modal__close" onClick={() => setOpenStep(null)} aria-label={text.close}>&times;</button>
                <span className="vipx-modal__step">{text.modalStep.replace('{n}', String(openStep))}</span>

                {openStep === 1 && (
                  <>
                    <h3 className="vipx-modal__title">{text.cond1Title}</h3>
                    <div className="vipx-modal__body">
                      <p>{text.cond1Desc}</p>
                      <div className="vipx-bookmakers" role="group" aria-label={text.chooseTitle}>
                        <button
                          type="button"
                          onClick={activateCode}
                          className={`vipx-bookmaker${codeSelected ? ' is-selected' : ''}`}
                          aria-pressed={codeSelected}
                        >
                          <span className="vipx-bookmaker__logo" aria-hidden="true">
                            <img src="/logos/linebet-provided.jpg" alt="" />
                          </span>
                          <span className="vipx-bookmaker__body">
                            <strong>{VIP_BRAND}</strong>
                            <small className="vipx-bookmaker__code">{VIP_CODE}</small>
                          </span>
                          <span className={`vipx-bookmaker__state${codeSelected ? ' is-on' : ''}`}>
                            {copied ? <><Icon.check />{text.autoCopied}</> : <><Icon.copy />{text.tapToCopy}</>}
                          </span>
                        </button>
                      </div>
                      {codeSelected && copied && (
                        <p className="vipx-modal__ok"><Icon.check />{VIP_CODE} — {text.autoCopied}</p>
                      )}
                    </div>
                  </>
                )}

                {openStep === 2 && (
                  <>
                    <h3 className="vipx-modal__title">{text.cond2Title}</h3>
                    <div className="vipx-modal__body">
                      {codeSelected ? (
                        <>
                          <p>{text.cond2Desc}</p>
                          <div className="vipx-code">
                            <div className="vipx-code__body">
                              <span>{text.codeLabel}</span>
                              <strong>{VIP_CODE}</strong>
                            </div>
                            <button type="button" className="vipx-code__copy" onClick={manualCopy}>
                              {copied ? <Icon.check /> : <Icon.copy />}{copied ? text.copiedBtn : text.copyBtn}
                            </button>
                          </div>
                          <p><strong>{text.m2Paste}</strong> {text.m2Where}</p>
                          <a
                            href={VIP_SIGNUP}
                            target="_blank"
                            rel="sponsored nofollow noopener noreferrer"
                            className="vipx-btn vipx-btn--gold vipx-btn--block"
                            onClick={() => { setSignupOpened(true); trackAffiliateAction('linebet', 'signup_cta_click', 'vip-modal-step2') }}
                            data-cta="vip-modal-signup"
                          >
                            {text.signup}<span aria-hidden="true">↗</span>
                          </a>
                        </>
                      ) : (
                        <p className="vipx-modal__warn"><Icon.lock />{text.m2NoBook}</p>
                      )}
                    </div>
                  </>
                )}

                {openStep === 3 && (
                  <>
                    <h3 className="vipx-modal__title">{text.cond3Title}</h3>
                    <div className="vipx-modal__body">
                      <p>{text.cond3Desc}</p>
                      <div className="vipx-deposit">
                        <span className="vipx-deposit__label">{text.depositLabel}</span>
                        <strong className="vipx-deposit__value">{text.depositValue}</strong>
                        <span className="vipx-deposit__note">{text.depositNote}</span>
                      </div>
                      <button
                        type="button"
                        className={`vipx-btn vipx-btn--block ${depositConfirmed ? 'vipx-btn--ghost' : 'vipx-btn--gold'}`}
                        onClick={() => setDepositConfirmed(true)}
                        disabled={depositConfirmed}
                      >
                        {depositConfirmed ? <><Icon.check />{text.stepDone}</> : text.m3Confirm}
                      </button>
                    </div>
                  </>
                )}

                {openStep === 4 && (
                  <>
                    <h3 className="vipx-modal__title">{text.cond4Title}</h3>
                    <div className="vipx-modal__body">
                      <p>{text.cond4Desc}</p>
                      <p><strong>{text.m4Id}</strong></p>
                      <button type="button" className="vipx-btn vipx-btn--wa vipx-btn--block" onClick={openVerification} disabled={!codeSelected}>
                        <Icon.whatsapp />{text.verify}
                      </button>
                      <p>{text.m4After}</p>
                    </div>
                  </>
                )}

                <div className="vipx-modal__foot">
                  {openStep < 4 ? (
                    <button type="button" className="vipx-btn vipx-btn--gold" onClick={() => setOpenStep((openStep + 1) as 1 | 2 | 3 | 4)}>
                      {text.next}<span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button type="button" className="vipx-btn vipx-btn--ghost" onClick={() => setOpenStep(null)}>{text.close}</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════ BÉNÉFICES ═══════════ */}
        <section className="vipx-benefits vipx-shell">
          <header className="vipx-section-head">
            <span className="vipx-eyebrow"><i aria-hidden="true" />{text.benefitsEyebrow}</span>
            <h2>{text.benefitsTitle}</h2>
          </header>
          <div className="vipx-benefits__grid">
            <article><span className="vipx-benefits__icon"><Icon.spark /></span><h3>{text.b1Title}</h3><p>{text.b1Desc}</p></article>
            <article><span className="vipx-benefits__icon"><Icon.lock /></span><h3>{text.b2Title}</h3><p>{text.b2Desc}</p></article>
            <article><span className="vipx-benefits__icon"><Icon.target /></span><h3>{text.b3Title}</h3><p>{text.b3Desc}</p></article>
            <article><span className="vipx-benefits__icon"><Icon.eye /></span><h3>{text.b4Title}</h3><p>{text.b4Desc}</p></article>
            <article><span className="vipx-benefits__icon"><Icon.chart /></span><h3>{text.b5Title}</h3><p>{text.b5Desc}</p></article>
            <article><span className="vipx-benefits__icon"><Icon.users /></span><h3>{text.b6Title}</h3><p>{text.b6Desc}</p></article>
          </div>
        </section>

        {/* ═══════════ CONFIANCE ═══════════ */}
        <section className="vipx-trust vipx-shell">
          <div className="vipx-trust__card">
            <span className="vipx-eyebrow"><i aria-hidden="true" />{text.trustEyebrow}</span>
            <h2>{text.trustTitle}</h2>
            <p>{text.trustDesc}</p>
            <a className="vipx-btn vipx-btn--ghost" href="/historique">{text.trustLink}<span aria-hidden="true">→</span></a>
          </div>
        </section>

        {/* ═══════════ FAQ ═══════════ */}
        <section className="vipx-faq vipx-shell">
          <header className="vipx-section-head">
            <h2>{text.faqTitle}</h2>
          </header>
          <div className="vipx-faq__list">
            <details>
              <summary>{text.faq1Q}</summary>
              <p>{text.faq1A}</p>
            </details>
            <details>
              <summary>{text.faq2Q}</summary>
              <p>{text.faq2A}</p>
            </details>
            <details>
              <summary>{text.faq3Q}</summary>
              <p>{text.faq3A}</p>
            </details>
            <details>
              <summary>{text.faq4Q}</summary>
              <p>{text.faq4A}</p>
            </details>
            <details>
              <summary>{text.faq5Q}</summary>
              <p>{text.faq5A}</p>
            </details>
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="vipx-final">
          <div className="vipx-final__card vipx-shell">
            <h2>{text.finalTitle}</h2>
            <p>{text.finalDesc}</p>
            <a className="vipx-btn vipx-btn--gold" href="#deblocage">{text.finalCta}<span aria-hidden="true">→</span></a>
            <p className="vipx-final__responsible">{text.responsible}</p>
            <p className="vipx-final__note">{text.footerNote}</p>
          </div>
        </section>
      </main>

      <ErrorBoundary><Footer /></ErrorBoundary>
    </div>
  )
}
