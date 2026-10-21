import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import "./globals.css";

const BottomNavigation = dynamic(() => import("@/components/bttsbet/BottomNavigation"), { loading: () => null });
const CookieConsent = dynamic(() => import("@/components/bttsbet/CookieConsent"), { loading: () => null });
const AnalyticsLoader = dynamic(() => import("@/components/bttsbet/AnalyticsLoader"), { loading: () => null });
const GiftPopup = dynamic(() => import("@/components/bttsbet/GiftPopup"), { loading: () => null }); // Paquet cadeau Bonus 300% — global (SSR: null, zéro impact SEO/CLS)

// ─── Local fonts (no network fetch during build) ───────────────────────────
// Use next/font/local instead of next/font/google to avoid:
//   - 'Can\'t resolve \'@vercel/turbopack-next/internal/font/google/font\'' on CI
//   - 404 errors on fonts.gstatic.com during build in restricted networks (GitHub Actions)
//
// Files downloaded from fonts.googleapis.com (latin subset) and stored locally.
// Design v2 : vrais poids chargés — plus de faux gras (synthetic bold) partout.
// Inter & JetBrains Mono sont servis en fontes VARIABLES (1 fichier = tous les poids).
const poppins = localFont({
  variable: "--font-display",
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
  display: 'swap',
});

const inter = localFont({
  variable: "--font-body",
  src: "./fonts/inter-var.woff2",
  display: 'swap',
  weight: '400 700',
});

const jetbrainsMono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-var.woff2", weight: "500 600", style: "normal" },
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bttspredict.com/"),
  title: {
    default: "BTTSPredict — Pronostics BTTS, Over 2,5 et Score exact",
    template: "%s | BTTSPredict",
  },
  description: "Pronostics BTTS, Over 2,5 et score exact sur des matchs internationaux. Données horodatées, historique public et méthode documentée. 18+.",
  authors: [
    { name: "BTTSPredict", url: "https://bttspredict.com" },
  ],
  creator: "BTTSPredict",
  publisher: "BTTSPredict",
  alternates: {
    canonical: "https://bttspredict.com/",
    languages: {
      'fr': 'https://bttspredict.com/',
      'en': 'https://bttspredict.com/en',
      'ar': 'https://bttspredict.com/ar',
      'x-default': 'https://bttspredict.com/',
    },
  },
  other: {
    'referrer': 'strict-origin-when-cross-origin',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "BTTSPredict — Pronostics BTTS du jour et Over 2,5",
    description: "Sélections BTTS, Over 2,5 et score exact sur des matchs internationaux, avec données horodatées et méthode documentée. 18+.",
    url: "https://bttspredict.com",
    siteName: "BTTSPredict",
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "BTTSPredict — Plateforme BTTS et Over 2,5" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BTTSPredict — Pronostics BTTS du jour et Over 2,5",
    description: "Sélections BTTS, Over 2,5 et score exact sur des matchs internationaux, avec données horodatées et méthode documentée. 18+.",
    images: ["/og-image.png"],
  },
  category: "sports",
  // Vérification des moteurs de recherche
  verification: {
      other: {
        "msvalidate.01": "DCC3F51EC848E81F65438B72666C59ED",
      },
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BTTSPredict" />
        {/* Préchargement des ressources critiques */}
        <link rel="dns-prefetch" href="https://bttspredict.com" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var locale = location.pathname.split('/')[1];
            if (locale === 'en' || locale === 'ar') {
              document.documentElement.lang = locale;
              document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
            }
          })();
        ` }} />
        {/* Trust signals for crawlers */}
        <meta name="author" content="BTTSPredict" />
        <meta name="rating" content="general" />
        <meta name="distribution" content="global" />
        <meta name="revisit-after" content="1 day" />
        <meta name="language" content="French" />
        <meta name="expires" content="never" />
        <meta name="HandheldFriendly" content="True" />
        <meta name="MobileOptimized" content="390" />
        {/* Redirection HTTP → HTTPS (le serveur LWS ne gère pas la redirection) */}
        <script dangerouslySetInnerHTML={{ __html: `
          if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            location.replace('https://' + location.hostname + location.pathname + location.search + location.hash);
          }
        `}} />
        {/* Cache-busting + service worker cleanup — forces users to see latest version */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var VERSION = 'bttspredict-v67-master-fix-2026-08-09';
                try {
                  if('serviceWorker' in navigator){
                    navigator.serviceWorker.getRegistrations().then(function(regs){
                      regs.forEach(function(reg){ reg.unregister(); });
                    });
                  }
                  if(window.caches){
                    caches.keys().then(function(names){
                      names.forEach(function(name){ caches.delete(name); });
                    });
                  }
                  var stored = localStorage.getItem('bttspredict_ver');
                  if(stored && stored !== VERSION){
                    localStorage.setItem('bttspredict_ver', VERSION);
                    window.location.reload();
                  } else if(!stored){
                    localStorage.setItem('bttspredict_ver', VERSION);
                  }
                } catch(e){}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AnalyticsLoader />
        {children}
        <BottomNavigation />
        <CookieConsent />
        <GiftPopup />
        <div aria-hidden="true" className="lg:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
      </body>
    </html>
  );
}
