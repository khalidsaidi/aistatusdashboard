import type { Metadata } from 'next';
import './globals.css';

import { ErrorBoundary } from './components/ErrorBoundary';
import ClientTimestamp from './components/ClientTimestamp';
import { geistSans, geistMono } from './fonts';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Suspense } from 'react';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import GlobalErrorHandler from './components/GlobalErrorHandler';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-HPNE6D3YQW';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'AI Status Dashboard',
    template: '%s | AI Status Dashboard',
  },
  description:
    'Real-time status monitoring dashboard for AI provider APIs including OpenAI, Anthropic, Google AI, and more. Monitor service availability, response times, and incidents.',
  keywords: [
    'AI status',
    'API monitoring',
    'OpenAI status',
    'Anthropic status',
    'Google AI status',
    'service monitoring',
    'uptime monitoring',
    'API dashboard',
    'real-time status',
    'AI provider monitoring',
  ],
  authors: [{ name: 'AI Status Dashboard Team' }],
  creator: 'AI Status Dashboard',
  publisher: 'AI Status Dashboard',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com',
    siteName: 'AI Status Dashboard',
    title: 'AI Status Dashboard - Real-time AI Provider Monitoring',
    description:
      'Monitor the status of major AI providers including OpenAI, Anthropic, Google AI, and more in real-time.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI Status Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Status Dashboard',
    description: 'Real-time monitoring of AI provider APIs',
    images: ['/og-image.png'],
    creator: '@aistatusdash',
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com',
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  category: 'technology',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#3b82f6',
      },
    ],
  },
  other: {
    'msapplication-TileColor': '#3b82f6',
    'theme-color': '#3b82f6',
  },
};

// Client-side Firebase initialization component
function FirebaseInit() {
  if (typeof window === 'undefined') return null;

  // Import Firebase modules only on client side
  import('../lib/firebase').then(({ trackPageLoad }) => {
    trackPageLoad('app_layout');
  });

  // Import crashlytics for error tracking
  import('../lib/crashlytics').then(({ logError, setBreadcrumb }) => {
    setBreadcrumb('App initialized', 'navigation');

    // Set up global error handler
    window.addEventListener('error', (event) => {
      logError(event.error, 'global_error_handler');
    });

    window.addEventListener('unhandledrejection', (event) => {
      logError(new Error(event.reason), 'unhandled_promise_rejection');
    });
  });

  return null;
}

// Google Analytics component
function GoogleAnalytics() {
  if (typeof window === 'undefined') return null;

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      ></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'AI Status Dashboard',
    description: 'Real-time status monitoring dashboard for AI provider APIs',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '127',
    },
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="AI Status Dashboard" />
        <meta name="apple-mobile-web-app-title" content="AI Status Dashboard" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
      </head>
      <body className={geistSans.className}>
        <ErrorBoundary>
          <Providers>
            <GlobalErrorHandler />
            <Suspense fallback={null}>
              <FirebaseInit />
            </Suspense>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-3 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Skip to main content
            </a>
            <Navbar />
            <div id="main" className="flex-1">
              {children}
            </div>

            <Footer />
          </Providers>
        </ErrorBoundary>
        <noscript>
          <div className="error-boundary">
            <h2>JavaScript Required</h2>
            <p>
              This application requires JavaScript to function properly. Please enable JavaScript in
              your browser settings.
            </p>
          </div>
        </noscript>

        {/* Service Worker Registration */}
        <Script id="sw-registration" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('SW registered: ', registration);
                  })
                  .catch(function(registrationError) {
                    console.log('SW registration failed: ', registrationError);
                  });
              });
            }
          `}
        </Script>

        {/* Firebase Messaging - Temporarily disabled to avoid import issues */}
        {/* 
        <Script id="firebase-messaging" strategy="afterInteractive">
          {`
            // Initialize Firebase messaging when the page loads
            if (typeof window !== 'undefined') {
              import('../lib/firebase-messaging').then(module => {
                module.initializePushNotifications();
              }).catch(console.error);
            }
          `}
        </Script>
        */}

        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      </body>
    </html>
  );
}
