import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { log } from '@/lib/utils/logger';
import DashboardTabs from './components/DashboardTabs';
import ClientWrapper from './components/ClientWrapper';
import { Suspense } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Fallback component
function ErrorFallback({ error }: { error: string }) {
  return (
    <main className="flex-1 bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
              Service Unavailable
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
            <Link
              href="/"
              className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md"
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

    statuses = await statusService.checkAll(providers);

    // Calculate stats
    const stats = {
      total: statuses.length,
      operational: statuses.filter(s => s.status === 'operational').length,
      down: statuses.filter(s => s.status === 'down').length,
      degraded: statuses.filter(s => s.status === 'degraded').length,
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
    <main className="flex-1 bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 py-8">
        {error && (
          <div className="max-w-6xl mx-auto mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 p-4 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Warning: {error}
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
