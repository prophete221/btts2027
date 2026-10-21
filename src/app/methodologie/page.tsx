import type { Metadata } from 'next'
import { Navbar, Footer, FreePredictions } from '@/components/bttsbet'
import AnimatedTitle from '@/components/bttsbet/HeroWordmark'

export const metadata: Metadata = {
  title: 'Méthodologie',
  description: "Découvrez les données, filtres et limites utilisés pour analyser BTTS et Over 2,5. Méthode transparente, résultats vérifiables et aucune garantie.",
  alternates: { canonical: 'https://bttspredict.com/methodologie' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Méthodologie | BTTSPredict',
    description: "Découvrez les données, filtres et limites utilisés pour analyser BTTS et Over 2,5. Méthode transparente, résultats vérifiables et aucune garantie.",
    url: 'https://bttspredict.com/methodologie',
    type: 'article',
  },
}

export default function MethodologiePage() {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col text-[#F2F6FA]">
      <Navbar />

      <main id="main-content" className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          <header className="mb-10">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
              style={{ backgroundColor: 'rgba(127, 162, 198, 0.16)', color: '#2F7DFF', border: '1px solid rgba(127, 162, 198, 0.30)' }}>
              Méthodologie
            </span>
            <AnimatedTitle
              as="h1"
              text="Notre méthodologie d’analyse"
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
            <p className="text-base text-[#9DABBB] leading-relaxed">
              BTTSPredict publie des pronostics BTTS (Both Teams To Score) et Over 2.5 sur le football, générés par un modèle statistique. Cette page présente l&apos;approche, les marchés couverts, les sources de données et la gestion qualité — dans une approche transparente et crédible.
            </p>
          </header>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Comment lire nos analyses</h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed">BTTSPredict publie des estimations pour deux marchés : BTTS (les deux équipes marquent) et Over 2.5 (au moins trois buts au total). Le modèle s’appuie sur les données de match disponibles. Une estimation, y compris un éventuel score exact affiché, n’est jamais le résultat final du match.</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Données et limites</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <h3 className="text-base font-bold mb-2 text-[#F2F6FA]">ESPN</h3>
                <p className="text-xs text-[#9DABBB] leading-relaxed">Utilisé pour les calendriers, les scores et les logos d’équipes, selon les données disponibles.</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <h3 className="text-base font-bold mb-2 text-[#F2F6FA]">TheSportsDB</h3>
                <p className="text-xs text-[#9DABBB] leading-relaxed">Source complémentaire pour vérifier certains scores.</p>
              </div>
            </div>
            <p className="text-sm text-[#9DABBB] leading-relaxed mt-4">Les données disponibles varient selon les matchs. Les pages match indiquent les informations connues ; une donnée absente n’est pas remplacée par un chiffre inventé. Les valeurs estimées par le modèle ne sont pas des xG fournis par un tiers.</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Vérification</h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed">Les pronostics sont publiés avant le match et ne sont pas modifiés après coup. Lorsqu’un résultat réel est disponible et vérifié, il est affiché séparément du pronostic. La vérification est automatisée ; chaque pronostic n’est pas relu manuellement.</p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>Pas de garantie</h2>
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(47, 125, 255, 0.06)', border: '1px solid rgba(47, 125, 255, 0.2)' }}>
              <p className="text-sm text-[#9DABBB] leading-relaxed">Une probabilité est une estimation du modèle, pas une certitude sur un match particulier. Les paris sportifs comportent un risque de perte. Ne misez jamais plus que ce que vous pouvez vous permettre de perdre. 18+.</p>
            </div>
          </section>

          <section className="pt-8 border-t border-[#6B7A8C]">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="/btts/predictions/today" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all" style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>Voir les pronostics du jour →</a>
              <a href="/jouer-responsable" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all" style={{ backgroundColor: 'transparent', color: '#F87171', border: '1px solid rgba(255, 122, 122, 0.3)' }}>Jouer responsable →</a>
            </div>
          </section>
        </article>
              <section className="max-w-5xl mx-auto px-4 py-8">
          <FreePredictions />
        </section>
      </main>

      <Footer />
    </div>
  )
}
