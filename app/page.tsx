import { PROVIDERS } from '@/lib/providers';
import { fetchProviderStatus } from '@/lib/status-fetcher';
// import { saveStatusResults } from '@/lib/database'; // Now handled by Cloud Functions
import { log } from '@/lib/logger';
import DashboardTabs from './components/DashboardTabs';
import ClientWrapper from './components/ClientWrapper';

// Fallback component for when status fetching fails
function ErrorFallback({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <main className="flex-1 bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
            <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">
              Service Temporarily Unavailable
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-6 max-w-md mx-auto">
              We&apos;re experiencing issues fetching provider status data. This may be due to high load or temporary network issues.
            </p>
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-md p-4 mb-6">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>Error:</strong> {error}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                Refresh Page
              </button>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-md font-medium transition-colors inline-block"
              >
                Check System Health
              </a>
            </div>
          </div>
          
          {/* Fallback status information */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Expected Providers
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROVIDERS.map(provider => (
                <div key={provider.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{provider.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status unavailable</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// This is a server component by default in Next.js 13+
export default async function DashboardPage() {
  let statuses;
  let error: string | null = null;

  try {
    // Fetch all provider statuses with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
    });

    const statusPromise = Promise.all(
      PROVIDERS.map(async (provider) => {
        try {
          return await fetchProviderStatus(provider);
        } catch (providerError) {
          // Return a fallback status for this provider
          log('warn', 'Individual provider fetch failed', {
            provider: provider.id,
            error: providerError instanceof Error ? providerError.message : 'Unknown error'
          });
          
          return {
            id: provider.id,
            name: provider.name,
            status: 'unknown' as const,
            statusPageUrl: provider.statusPageUrl,
            responseTime: 0,
            lastChecked: new Date().toISOString(),
            error: providerError instanceof Error ? providerError.message : 'Unknown error'
          };
        }
      })
    );

    statuses = await Promise.race([statusPromise, timeoutPromise]) as any;

    // Validate that we got valid results
    if (!Array.isArray(statuses) || statuses.length === 0) {
      throw new Error('No provider statuses received');
    }

    // Check if too many providers failed
    const failedProviders = statuses.filter(s => s.status === 'unknown' || s.error);
    if (failedProviders.length === statuses.length) {
      throw new Error('All providers failed to respond');
    }

    // Log partial failures
    if (failedProviders.length > 0) {
      log('warn', 'Some providers failed to respond', {
        totalProviders: statuses.length,
        failedProviders: failedProviders.length,
        failedIds: failedProviders.map(p => p.id)
      });
    }

    log('info', 'Successfully fetched provider statuses', {
      totalProviders: statuses.length,
      operational: statuses.filter(s => s.status === 'operational').length,
      degraded: statuses.filter(s => s.status === 'degraded').length,
      down: statuses.filter(s => s.status === 'down').length,
      unknown: statuses.filter(s => s.status === 'unknown').length
    });

  } catch (fetchError) {
    error = fetchError instanceof Error ? fetchError.message : 'Unknown error occurred';
    
    log('error', 'Failed to fetch provider statuses', { 
      error,
      providersCount: PROVIDERS.length 
    });

    // Try to provide some fallback data
    statuses = PROVIDERS.map(provider => ({
      id: provider.id,
      name: provider.name,
      status: 'unknown' as const,
      statusPageUrl: provider.statusPageUrl,
      responseTime: 0,
      lastChecked: new Date().toISOString(),
      error: 'Service temporarily unavailable'
    }));
  }

  // If we have a critical error, show error page
  if (error && (!statuses || statuses.every((s: any) => s.status === 'unknown'))) {
    return <ErrorFallback error={error} />;
  }

  return (
    <main className="flex-1 bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 py-8">
        {/* Show warning if some providers failed */}
        {error && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                  Partial Service Degradation
                </p>
              </div>
              <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-2">
                Some provider data may be stale or unavailable. The system is working to restore full functionality.
              </p>
            </div>
          </div>
        )}

        <ClientWrapper>
          <DashboardTabs statuses={statuses} />
        </ClientWrapper>
      </div>
    </main>
  );
} 