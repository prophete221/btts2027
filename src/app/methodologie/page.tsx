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

          {/* Section 1 — Approche générale */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              1. Approche statistique
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
              BTTSPredict utilise un modèle statistique pour analyser les matchs de football à partir des données disponibles dans son système de prédiction. Les prédictions BTTS et Over 2.5 reposent sur les buts marqués et encaissés lors des matchs récents disponibles, les paramètres lambda et le modèle de Poisson. Ces estimations ne sont pas des xG fournis par un tiers.
            </p>
            <p className="text-sm text-[#9DABBB] leading-relaxed">
              Pour chaque match, le modèle estime les intensités offensives attendues (lambdas) de chaque équipe à partir de ces variables, puis calcule la probabilité de chaque marché (BTTS, Over 2.5) via la distribution de Poisson. Cette approche est largement documentée dans la littérature scientifique sur la modélisation sportive.
            </p>
          </section>

          {/* Section 2 — Sources de données */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              2. Sources de données
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-4">
              BTTSPredict utilise deux sources de données publiques :
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <h3 className="text-base font-bold mb-2 text-[#F2F6FA]">ESPN</h3>
                <p className="text-xs text-[#9DABBB] leading-relaxed">
                  Source publique gratuite. Utilisée pour récupérer le calendrier des matchs, les scores finaux et les logos d'équipes. Couvre les principales ligues européennes et nord-américaines.
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <h3 className="text-base font-bold mb-2 text-[#F2F6FA]">TheSportsDB</h3>
                <p className="text-xs text-[#9DABBB] leading-relaxed">
                  Source publique gratuite, utilisée en complément d'ESPN pour la vérification des scores finaux sur les matchs non couverts par la source principale.
                </p>
              </div>
            </div>
            <p className="text-xs text-[#9DABBB] mt-4 leading-relaxed">
              Les chiffres des pronostics reposent sur les données sportives mentionnées ci-dessus. Les actualités et photos de contexte utilisent des sources distinctes, avec leurs dates et attributions ; elles ne modifient pas les probabilités du modèle.
            </p>
          </section>

          {/* Section 3 — Marchés couverts */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              3. Marchés couverts
            </h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(169, 196, 223, 0.15)' }}>
                  <span className="text-xs font-bold text-[#2F7DFF]">BT</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F2F6FA] mb-1">BTTS (Both Teams To Score)</h3>
                  <p className="text-xs text-[#9DABBB] leading-relaxed">
                    Pronostic : les deux équipes marquent au moins un but pendant le match.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: '#141C25', border: '1px solid #6B7A8C' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(169, 196, 223, 0.15)' }}>
                  <span className="text-xs font-bold text-[#2F7DFF]">O2</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F2F6FA] mb-1">Over 2.5 goals</h3>
                  <p className="text-xs text-[#9DABBB] leading-relaxed">
                    Pronostic : le total des buts du match est supérieur ou égal à 3.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#9DABBB] mt-3 leading-relaxed">
              Un score estimé peut être affiché à titre indicatif lorsqu’il est calculé par le modèle : ce n’est ni un score réel ni une garantie. Les sélections suivies concernent le BTTS et l’Over 2.5 ; les marchés double chance, handicap asiatique, mi-temps/fin de match et buteurs ne sont pas couverts.
            </p>
          </section>

          {/* Section 4 — Ligues couvertes */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              4. Ligues couvertes
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
              Les variables réellement disponibles dans les données de prédiction peuvent notamment inclure : buts marqués et encaissés ; paramètres lambda (buts attendus modélisés) ; probabilités BTTS ; probabilités Over 2.5 ; score de fiabilité ; qualité des données ; nombre de matchs disponibles pour l&apos;analyse. Les données non disponibles ne sont pas remplacées par des statistiques fictives.
            </p>
            <p className="text-sm text-[#9DABBB] leading-relaxed">
              Ligues prioritaires Afrique : Ligue 1 Sénégal, Botola Pro (Maroc). Ligues européennes de volume : Bundesliga, Eredivisie, Jupiler Pro League, Championship, Liga Portugal. La liste exacte peut évoluer sans préavis.
            </p>
          </section>

          {/* Section 5 — Calibration et contrôle qualité */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              5. Calibration et contrôle qualité
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
              Le contrôle qualité est entièrement automatisé :
            </p>
            <ul className="space-y-2 text-sm text-[#9DABBB]">
              <li className="flex items-start gap-2"><span className="text-[#2F7DFF]">✓</span> <span>Vérification automatique des critères de publication avant chaque pronostic.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#2F7DFF]">✓</span> <span>Nombre limité de pronostics publiés par jour (sélection des meilleures probabilités).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#2F7DFF]">✓</span> <span>Archive quotidienne horodatée et immuable (un pronostic publié n'est jamais modifié rétroactivement).</span></li>
              <li className="flex items-start gap-2"><span className="text-[#2F7DFF]">✓</span> <span>Vérification post-match via les sources publiques.</span></li>
              <li className="flex items-start gap-2"><span className="text-[#2F7DFF]">✓</span> <span>Gestion automatique des données manquantes (voir section 7).</span></li>
            </ul>
            <p className="text-xs text-[#9DABBB] mt-3 leading-relaxed">
              ⚠️ Il n'y a pas de validation humaine de chaque pronostic. Le modèle est exécuté automatiquement plusieurs fois par jour via GitHub Actions.
            </p>
          </section>

          {/* Section 6 — Couverture et robustesse */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              6. Couverture et robustesse
            </h2>
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(47, 125, 255, 0.06)', border: '1px solid rgba(47, 125, 255, 0.2)' }}>
              <ul className="space-y-2 text-sm text-[#9DABBB]">
                <li>• Le moteur couvre les compétitions disponibles dans les données de prédiction.</li>
                <li>• Chaque match est analysé à partir de la dynamique offensive et défensive récente des deux équipes, sur leurs derniers matchs.</li>
                <li>• Le moteur s&apos;appuie sur les données disponibles des équipes pour produire ses estimations.</li>
                <li>• Les compétitions aux formats atypiques (coupes nationales, internationales, matchs amicaux) sont volontairement exclues pour préserver la qualité des pronostics.</li>
                <li>• Chaque pronostic est accompagné d'un indice de confiance transparent, basé sur la qualité des données disponibles.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 - Critères de qualité (combo of the day) */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              7. Critères de qualité
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
              BTTSPredict applique les critères de qualité suivants pour le AI Combo of the Day :
            </p>
            <ul className="space-y-2 text-sm text-[#9DABBB]">
              <li>• qualité des données différente de LOW ;</li>
              <li>• score de fiabilité d&apos;au moins 70 ;</li>
              <li>• probabilité BTTS d&apos;au moins 65 % ou probabilité Over 2.5 d&apos;au moins 65 %.</li>
            </ul>
            <p className="text-sm text-[#9DABBB] leading-relaxed mt-3">
              Si moins de trois matchs satisfont ces critères, aucun combo complet de trois sélections n&apos;est affiché. Cette règle empêche le système de forcer artificiellement des sélections lorsque les données disponibles sont insuffisantes.
            </p>
          </section>

          {/* Section 8 — Suivi public */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              8. Suivi public vérifiable
            </h2>
            <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
              Une nouvelle période de suivi public a été lancée le <strong className="text-[#F2F6FA]">8 août 2026</strong>. Tous les pronostics publiés à partir de cette date sont :
            </p>
            <ul className="space-y-2 text-sm text-[#9DABBB]">
              <li>• Enregistrés dans une archive quotidienne horodatée et immuable.</li>
              <li>• Vérifiés après le résultat officiel du match via les sources publiques de référence.</li>
              <li>• Comptabilisés en temps réel dans les statistiques publiques (taux, tendance 14 jours).</li>
              <li>• Conservés sans modification rétroactive — un pronostic publié ne change jamais.</li>
            </ul>
          </section>

          {/* Section 9 — Probabilité et transparence */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
              9. Probabilité et transparence
            </h2>
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(47, 125, 255, 0.06)', border: '1px solid rgba(47, 125, 255, 0.2)' }}>
              <p className="text-sm text-[#9DABBB] leading-relaxed mb-3">
                Une probabilité élevée signifie que, sur un échantillon de matchs aux caractéristiques similaires, le modèle s'attend à ce qu'une majorité se termine par le résultat prédit. BTTSPredict publie ces probabilités en toute transparence pour aider à la décision.
              </p>
              <p className="text-sm text-[#9DABBB] leading-relaxed">
                <strong className="text-[#2F7DFF]">Aucun résultat futur n'est garanti.</strong> Les paris sportifs comportent un risque de perte. Ne pariez jamais plus que ce que vous pouvez vous permettre de perdre. 18+.
              </p>
            </div>
          </section>

          {/* Liens utiles */}
          <section className="pt-8 border-t border-[#6B7A8C]">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="/btts/predictions/today" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all"
                style={{ backgroundColor: '#2F7DFF', color: '#FFFFFF' }}>
                Voir les pronostics du jour →
              </a>
              <a href="/jouer-responsable" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold transition-all"
                style={{ backgroundColor: 'transparent', color: '#F87171', border: '1px solid rgba(255, 122, 122, 0.3)' }}>
                Jouer responsable →
              </a>
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
