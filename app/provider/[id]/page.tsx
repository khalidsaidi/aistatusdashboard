import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import sourcesConfig from '@/lib/data/sources.json';

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const sourcePolls = new Map<string, number>();
(sourcesConfig as { sources?: Array<{ providerId?: string; pollIntervalSeconds?: number }> }).sources?.forEach(
  (source) => {
    if (!source.providerId || typeof source.pollIntervalSeconds !== 'number') return;
    const current = sourcePolls.get(source.providerId);
    sourcePolls.set(
      source.providerId,
      typeof current === 'number' ? Math.min(current, source.pollIntervalSeconds) : source.pollIntervalSeconds
    );
  }
);

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const provider = providerService.getProvider(params.id);
  if (!provider) {
    return {
      title: 'Provider Not Found',
      robots: { index: false, follow: false },
    };
  }

  const displayName = provider.displayName || provider.name;
  const title = `${displayName} Status`;
  const description = `Live status, incidents, and uptime signals for ${displayName}.`;
  const url = `${SITE_URL}/provider/${provider.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        'application/rss+xml': `${SITE_URL}/rss.xml?provider=${provider.id}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}

export default async function ProviderPage({ params }: { params: { id: string } }) {
  const provider = providerService.getProvider(params.id);
  if (!provider) return notFound();

  const displayName = provider.displayName || provider.name;
  const baseStatus = await statusService.checkProvider(provider);

  let summaries: any[] = [];
  try {
    summaries = await intelligenceService.getProviderSummaries();
  } catch {
    summaries = [];
  }

  const summary = summaries.find((entry) => entry.providerId === provider.id);
  const pollSeconds = sourcePolls.get(provider.id) ?? 120;
  const updatedAt = summary?.lastUpdated ? Date.parse(summary.lastUpdated) : NaN;
  const isFresh =
    Number.isFinite(updatedAt) && Date.now() - updatedAt <= pollSeconds * 2 * 1000 + 60000;
  const hasEvidence =
    (summary?.activeIncidentCount || 0) > 0 ||
    (summary?.activeMaintenanceCount || 0) > 0 ||
    (summary?.degradedComponentCount || 0) > 0;
  const useSummary = summary?.status && summary.status !== 'unknown' && hasEvidence && isFresh;

  const mergedStatus = useSummary ? summary.status : baseStatus.status;
  const lastUpdated = useSummary ? summary.lastUpdated || baseStatus.lastChecked : baseStatus.lastChecked;

  const detail = await intelligenceService.getProviderDetail(provider.id);
  const incidents = detail.incidents
    .map(normalizeIncidentDates)
    .filter((incident) => incident.status !== 'resolved')
    .slice(0, 5);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${displayName} Status`,
    serviceType: 'Status Monitoring',
    provider: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.statusPageUrl,
    },
    url: `${SITE_URL}/provider/${provider.id}`,
  };

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Status Dashboard',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/provider/${provider.id}`,
    description: `Provider status, incidents, and uptime signals for ${displayName}.`,
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <section className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Provider status
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              {displayName} status
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Live availability signals, recent incidents, and official status references for {displayName}.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {mergedStatus}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Last updated {formatDate(lastUpdated)}
              </span>
              <a
                href={provider.statusPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
              >
                Official status page
              </a>
              <a
                href={`/rss.xml?provider=${provider.id}`}
                className="text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
              >
                RSS feed
              </a>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent incidents</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Active or recently reported incidents pulled from official sources and normalized feeds.
            </p>
            <div className="mt-4 space-y-3">
              {incidents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No active incidents reported in the current window.
                </p>
              ) : (
                incidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{incident.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Started {formatDate(incident.startedAt)}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                        {incident.severity}
                      </span>
                    </div>
                    {incident.rawUrl && (
                      <a
                        href={incident.rawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white mt-2 inline-block"
                      >
                        View official update
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How we verify</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              We combine official status updates, normalized incident feeds, and synthetic probes to detect
              disruptions early. If signals are uncertain, we default to operational and show an advisory note
              rather than issuing a false alert.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/how-it-works" className="cta-secondary text-xs">
                Methodology
              </Link>
              <Link href="/providers" className="cta-secondary text-xs">
                Browse all providers
              </Link>
            </div>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>Provider snapshot: /api/public/v1/status/summary and /api/public/v1/incidents</p>
            </div>
          </noscript>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([structuredData, appJsonLd]) }}
      />
    </main>
  );
}
