import { getProviders } from '@/lib/providers';
import { checkAllProviders } from '@/lib/status-fetcher-unified';
import { log } from '@/lib/logger';
import DashboardTabs from './components/DashboardTabs';
import ClientWrapper from './components/ClientWrapper';
import { headers } from 'next/headers';

// Simple in-memory cache for server-side rendering
const statusCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// Fallback component for when status fetching fails
function ErrorFallback({ error }: { error: string }) {
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
              We&apos;re experiencing issues fetching provider status data. Please try refreshing the page.
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
        </div>
      </div>
    </main>
  );
}

// Get cached status data
function getCachedStatuses(): any[] | null {
  const cached = statusCache.get('statuses');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

// Set cached status data
function setCachedStatuses(data: any[]): void {
  statusCache.set('statuses', { data, timestamp: Date.now() });
}

// Generate fallback statuses
function getFallbackStatuses(): any[] {
  return getProviders().map(provider => ({
    id: provider.id,
    name: provider.name,
    status: 'unknown' as const,
    statusPageUrl: provider.statusPageUrl,
    responseTime: 0,
    lastChecked: new Date().toISOString(),
    error: 'Service temporarily unavailable'
  }));
}

// Main dashboard page component
export default async function DashboardPage() {
  // PERFORMANCE: Skip heavy operations for HEAD requests
  const headersList = headers();
  const isHeadRequest = headersList.get('x-request-method') === 'HEAD';
  
  if (isHeadRequest) {
    const fallbackStatuses = getFallbackStatuses();
    return (
      <main className="flex-1 bg-gray-50 dark:bg-gray-900">
        <div className="px-4 sm:px-6 py-8">
          <ClientWrapper>
            <DashboardTabs statuses={fallbackStatuses} />
          </ClientWrapper>
        </div>
      </main>
    );
  }

  let statuses;
  let error: string | null = null;

  try {
    // Check cache first
    const cachedStatuses = getCachedStatuses();
    if (cachedStatuses) {
      log('info', 'Using cached status data');
      statuses = cachedStatuses;
    } else {
      // Fetch all provider statuses with true concurrency
      const providers = [...getProviders()]; // Convert readonly array to mutable
      
      log('info', 'Fetching provider statuses', { count: providers.length });
      
      // Use the simplified fetcher with true concurrency
      statuses = await checkAllProviders(providers);

      // Cache successful results
      if (Array.isArray(statuses) && statuses.length > 0) {
        setCachedStatuses(statuses);
      }
    }

    // Validate results
    if (!Array.isArray(statuses) || statuses.length === 0) {
      throw new Error('No provider statuses received');
    }

    // Log results
    const operational = statuses.filter(s => s.status === 'operational').length;
    const degraded = statuses.filter(s => s.status === 'degraded').length;
    const down = statuses.filter(s => s.status === 'down').length;
    const unknown = statuses.filter(s => s.status === 'unknown').length;

    log('info', 'Successfully fetched provider statuses', {
      total: statuses.length,
      operational,
      degraded,
      down,
      unknown
    });

    // Show warning if many providers failed
    if (unknown > statuses.length / 2) {
      error = `${unknown} out of ${statuses.length} providers are unavailable`;
    }

  } catch (fetchError) {
    error = fetchError instanceof Error ? fetchError.message : 'Unknown error occurred';
    
    log('error', 'Failed to fetch provider statuses', { 
      error,
      providersCount: getProviders().length 
    });

    // Try cached data as fallback
    const cachedStatuses = getCachedStatuses();
    if (cachedStatuses) {
      log('info', 'Using stale cached data due to fetch error');
      statuses = cachedStatuses;
    } else {
      statuses = getFallbackStatuses();
    }
  }

  // Show error page for critical failures
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
                {error}. Some data may be stale or unavailable.
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