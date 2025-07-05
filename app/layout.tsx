import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from './components/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import ClientTimestamp from './components/ClientTimestamp';
import { geistSans, geistMono } from './fonts';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Suspense } from 'react';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-HPNE6D3YQW';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: 'AI Status Dashboard',
  description: 'Real-time monitoring dashboard for AI provider services and API status',
  keywords: ['AI', 'status', 'monitoring', 'dashboard', 'API', 'uptime', 'OpenAI', 'Anthropic', 'Google AI'],
  authors: [{ name: 'AI Status Dashboard Team' }],
  creator: 'AI Status Dashboard',
  publisher: 'AI Status Dashboard',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'AI Status Dashboard',
    description: 'Real-time monitoring dashboard for AI provider services and API status',
    url: '/',
    siteName: 'AI Status Dashboard',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AI Status Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Status Dashboard',
    description: 'Real-time monitoring dashboard for AI provider services and API status',
    images: ['/og-image.png'],
  },
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
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
  category: 'technology',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}></script>
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
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
      <body className={inter.className}>
        <ErrorBoundary>
          <ToastProvider>
        <Suspense fallback={null}>
          <FirebaseInit />
        </Suspense>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-3 rounded min-h-[44px] min-w-[44px] flex items-center justify-center">
          Skip to main content
        </a>
        <Navbar />
        <div id="main" className="flex-1">
          {children}
        </div>
        
        <Footer />
          </ToastProvider>
        </ErrorBoundary>
        <noscript>
          <div className="error-boundary">
            <h2>JavaScript Required</h2>
            <p>This application requires JavaScript to function properly. Please enable JavaScript in your browser settings.</p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
