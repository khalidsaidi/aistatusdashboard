import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { log } from '@/lib/utils/logger';
import DashboardTabs from './components/DashboardTabs';
import ClientWrapper from './components/ClientWrapper';
import { Suspense } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Fallback component
function ErrorFallback({ error }: { error: string }) {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="surface-card-strong p-8 border border-rose-200/70 dark:border-rose-700/70">
            <h2 className="text-2xl font-semibold text-rose-700 dark:text-rose-200 mb-4">
              Service Unavailable
            </h2>
            <p className="text-rose-600 dark:text-rose-300 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block cta-primary"
            >
              Refresh Page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function DashboardPage() {
  let statuses;
  let error: string | null = null;

  try {
    const providers = providerService.getProviders();
    log('info', 'Fetching statuses', { count: providers.length });

    const fallbackStatuses = await statusService.checkAll(providers);
    let summaries: any[] = [];
    try {
      summaries = await intelligenceService.getProviderSummaries();
    } catch (innerError) {
      log('warn', 'Provider summary fetch failed, falling back to direct status', { innerError });
    }

    const summaryMap = new Map(summaries.map((summary) => [summary.providerId, summary]));

    statuses = fallbackStatuses.map((status) => {
      const summary = summaryMap.get(status.id);
      if (!summary) return status;
      const hasEvidence =
        (summary.activeIncidentCount || 0) > 0 ||
        (summary.activeMaintenanceCount || 0) > 0 ||
        (summary.degradedComponentCount || 0) > 0;
      const mergedStatus = summary.status && summary.status !== 'unknown' && hasEvidence
        ? summary.status
        : status.status;
      return {
        ...status,
        status: mergedStatus,
        details: summary.description || status.details,
        lastChecked: summary.lastUpdated || status.lastChecked,
      };
    });

    // Calculate stats
    const stats = {
      total: statuses.length,
      operational: statuses.filter(s => s.status === 'operational').length,
      down: statuses.filter(s => s.status === 'down' || s.status === 'major_outage').length,
      degraded: statuses.filter(s => s.status === 'degraded' || s.status === 'partial_outage').length,
      unknown: statuses.filter(s => s.status === 'unknown').length
    };

    log('info', 'Status fetch complete', stats);

    if (stats.unknown > stats.total / 2) {
      error = 'High rate of unknown statuses detected';
    }

  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    log('error', 'Dashboard load failed', { error });
  }

  if (error && !statuses) {
    return <ErrorFallback error={error} />;
  }

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-8">
        {error && (
          <div className="max-w-6xl mx-auto mb-6 surface-card border border-amber-200/70 dark:border-amber-700/70 p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              Warning: {error}
            </p>
          </div>
        )}
        <ClientWrapper>
          <Suspense fallback={null}>
            <DashboardTabs statuses={statuses || []} />
          </Suspense>
        </ClientWrapper>
      </div>
    </main>
  );
}
