import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { publicPredictionPayload } from '../../../scripts/public-predictions.mjs'

export const dynamic = 'force-static'
export function GET() {
  try {
    const predictionsPath = path.join(process.cwd(), 'public', 'predictions.json')
    const data = publicPredictionPayload(JSON.parse(fs.readFileSync(predictionsPath, 'utf8')), { retireLegacyAiNumbers: true })
    const free = data.free || data.predictions || []
    return NextResponse.json({
      date: data.date || null,
      lastUpdated: data.lastUpdated || null,
      source: data.source || '',
      disclaimer: 'Prédictions informatives, pas de gain garanti, 18+',
      free,
      // Uniquement calendrier des rencontres, jamais les choix/probabilités VIP.
      vipPreview: data.vipPreview || [],
      stats: data.stats || {},
      predictions: free,
    }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' } })
  } catch {
    return NextResponse.json({
      date: null, lastUpdated: null, free: [], vipPreview: [], predictions: [],
      stats: {}, status: 'no data yet',
    })
  }
}
