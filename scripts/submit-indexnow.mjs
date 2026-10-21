#!/usr/bin/env node
/**
 * IndexNow — Soumet toutes les URLs importantes de bttspredict.com à Bing
 * pour forcer l'indexation immédiate.
 * 
 * IndexNow est un protocole supporté par Bing, Yandex et Seznam.
 * ChatGPT utilise l'API Bing pour ses recherches en temps réel.
 */

const INDEXNOW_KEY = 'ba48253f4d8544b3a93cc49a1498381a'
const HOST = 'bttspredict.com'
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`

// URLs à soumettre (25 URLs du sitemap)
const URLS = [
  'https://bttspredict.com/',
  'https://bttspredict.com/pronostics',
  'https://bttspredict.com/vip',
  'https://bttspredict.com/statistiques',
  'https://bttspredict.com/bookmakers',
  'https://bttspredict.com/methodologie',
  'https://bttspredict.com/historique',
  'https://bttspredict.com/btts-c-est-quoi',
  'https://bttspredict.com/code-promo-linebet-senegal',
  'https://bttspredict.com/bonus-888starz',
  'https://bttspredict.com/prediction-aviator',
  'https://bttspredict.com/faille-fifa',
  'https://bttspredict.com/equipe',
  'https://bttspredict.com/presse',
  'https://bttspredict.com/blog',
  'https://bttspredict.com/blog/comment-analyser-match-btts',
  'https://bttspredict.com/blog/strategie-mise-over-2-5',
  'https://bttspredict.com/blog/gestion-bankroll-paris-sportifs',
  'https://bttspredict.com/blog/meilleurs-championnats-btts',
  'https://bttspredict.com/blog/faille-fifa-linebet',
  'https://bttspredict.com/blog/guide-linebet-inscription',
  'https://bttspredict.com/over-2-5-predictions',
  'https://bttspredict.com/correct-score-predictions',
  'https://bttspredict.com/football-predictions-today',
  'https://bttspredict.com/betting-tips',
  'https://bttspredict.com/league-predictions',
  'https://bttspredict.com/team-predictions',
  'https://bttspredict.com/match-predictions',
  'https://bttspredict.com/linebet-promo-code',
]

async function submitToIndexNow() {
  console.log(`[IndexNow] Soumission de ${URLS.length} URLs à Bing...`)
  console.log(`[IndexNow] Clé: ${INDEXNOW_KEY}`)
  console.log(`[IndexNow] Key location: ${KEY_LOCATION}`)
  console.log('')

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: URLS,
  }

  try {
    const response = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    console.log(`[IndexNow] Status: ${response.status} ${response.statusText}`)
    if (response.status === 200) {
      console.log('[IndexNow] ✓ URLs soumises avec succès — Bing va analyser sous 24-48h')
    } else if (response.status === 202) {
      console.log('[IndexNow] ✓ Requête acceptée — Bing analysera les URLs prochainement')
    } else if (response.status === 422) {
      console.log('[IndexNow] ⚠ Erreur 422 — format invalide ou clé non vérifiée')
    } else {
      console.log(`[IndexNow] Status inattendu: ${response.status}`)
    }

    if (response.body) {
      const text = await response.text()
      if (text) console.log(`[IndexNow] Réponse: ${text}`)
    }
  } catch (err) {
    console.error('[IndexNow] Erreur réseau:', err.message)
  }

  // Soumettre aussi directement à Bing
  console.log('')
  console.log('[IndexNow-Bing] Soumission directe à Bing...')
  try {
    const bingResponse = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    console.log(`[IndexNow-Bing] Status: ${bingResponse.status} ${bingResponse.statusText}`)
    if (bingResponse.status === 200 || bingResponse.status === 202) {
      console.log('[IndexNow-Bing] ✓ URLs soumises à Bing avec succès')
    }
  } catch (err) {
    console.error('[IndexNow-Bing] Erreur:', err.message)
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('URLs soumises:')
  URLS.forEach((url, i) => console.log(`  ${i + 1}. ${url}`))
  console.log('═══════════════════════════════════════════════════')
}

submitToIndexNow().catch((err) => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
