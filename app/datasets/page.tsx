import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datasets',
  description: 'Public datasets for incidents and metrics from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets',
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

export default function DatasetsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'AIStatusDashboard Data Catalog',
    url: `${SITE_URL}/datasets`,
    description: 'Public incident and metrics datasets from AIStatusDashboard.',
    dataset: [
      {
        '@type': 'Dataset',
        name: 'AIStatusDashboard Incidents',
        url: `${SITE_URL}/datasets/incidents`,
        description: 'Normalized incident feed across AI providers.',
        temporalCoverage: '2024-01-01/2025-12-31',
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/x-ndjson',
            contentUrl: `${SITE_URL}/datasets/incidents.ndjson`,
          },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'AIStatusDashboard Metrics',
        url: `${SITE_URL}/datasets/metrics`,
        description: 'Aggregated latency and reliability metrics.',
        temporalCoverage: '2024-01-01/2025-12-31',
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'text/csv',
            contentUrl: `${SITE_URL}/datasets/metrics.csv`,
          },
        ],
      },
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Data Catalog
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Public datasets
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Machine-readable datasets with schema.org metadata.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Incidents</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Normalized incidents across AI providers.
            </p>
            <a href="/datasets/incidents" className="cta-secondary text-xs">View incidents dataset</a>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Metrics</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Aggregated latency and reliability metrics.
            </p>
            <a href="/datasets/metrics" className="cta-secondary text-xs">View metrics dataset</a>
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
