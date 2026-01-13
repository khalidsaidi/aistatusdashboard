import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Metrics Dataset',
  description: 'Aggregated metrics dataset from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets/metrics',
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

export default function MetricsDatasetPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AIStatusDashboard Metrics Dataset',
    url: `${SITE_URL}/datasets/metrics`,
    description: 'Aggregated latency and reliability metrics across AI providers.',
    temporalCoverage: '2024-01-01/2025-12-31',
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${SITE_URL}/datasets/metrics.csv`,
      },
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Dataset
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Metrics CSV
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Download aggregated metrics and latency indicators.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <a href="/datasets/metrics.csv" className="cta-secondary text-xs">
              Download metrics.csv
            </a>
            <a href="/datasets/schemas/metrics.schema.json" className="cta-secondary text-xs">
              View JSON schema
            </a>
          </section>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
