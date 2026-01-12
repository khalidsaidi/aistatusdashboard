import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Incidents Dataset',
  description: 'Normalized incident dataset from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets/incidents',
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

export default function IncidentsDatasetPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AIStatusDashboard Incidents Dataset',
    url: `${SITE_URL}/datasets/incidents`,
    description: 'Normalized incidents across AI providers with updates and severity metadata.',
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/x-ndjson',
        contentUrl: `${SITE_URL}/datasets/incidents.ndjson`,
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
              Incidents NDJSON
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Download the machine-readable incidents feed.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <a href="/datasets/incidents.ndjson" className="cta-secondary text-xs">
              Download incidents.ndjson
            </a>
            <a href="/datasets/schemas/incidents.schema.json" className="cta-secondary text-xs">
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
