import type { Metadata } from 'next'
import { Navbar, Footer, FreePredictions } from '@/components/bttsbet'
import HistoriqueClient from './HistoriqueClient'

export const metadata: Metadata = {
  title: 'Historique vérifié — Nouveau suivi public',
  description: "Historique vérifié BTTSPredict : chaque pronostic enregistré, horodaté et évalué après le résultat officiel. 18+.",
  alternates: { canonical: 'https://bttspredict.com/historique' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Historique vérifié',
    description: "Nouveau suivi public des pronostics vérifiés. Volume insuffisant pendant les premières semaines. Aucun résultat futur n'est garanti.",
    url: 'https://bttspredict.com/historique',
    type: 'website',
  },
}

export default function HistoriquePage({ srH1 }: { srH1?: string } = {}) {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col text-[#F2F6FA]">
      <Navbar />
      <main id="main-content" className="flex-1">
        <h1 className="sr-only">{srH1 ?? 'Historique vérifié — BTTSPredict'}</h1>
        <HistoriqueClient />
              <section className="max-w-5xl mx-auto px-4 py-8">
          <FreePredictions />
        </section>
      </main>
      <Footer />
    </div>
  )
}
