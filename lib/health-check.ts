import { PROVIDERS } from './providers';
import { log } from './logger';
import { Provider, ProviderStatus } from './types';

interface HealthCheckResult {
  providerId: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: string;
}

/**
 * Performs a health check on a single provider
 */
async function checkProviderHealth(provider: Provider): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health checks

    const response = await fetch(provider.statusUrl, {
      signal: controller.signal,
      method: 'HEAD', // Use HEAD for faster checks
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    const healthy = response.ok;

    const result: HealthCheckResult = {
      providerId: provider.id,
      healthy,
      responseTime,
      timestamp: new Date().toISOString(),
    };

    if (!healthy) {
      result.error = `HTTP ${response.status}`;
    }

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      providerId: provider.id,
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Runs health checks for all providers
 */
export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  log('info', 'Starting health checks for all providers');

  const results = await Promise.all(PROVIDERS.map((provider) => checkProviderHealth(provider)));

  // Log summary
  const healthy = results.filter((r) => r.healthy).length;
  const unhealthy = results.filter((r) => !r.healthy).length;

  log('info', 'Health check completed', {
    totalProviders: results.length,
    healthy,
    unhealthy,
    avgResponseTime: Math.round(
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    ),
  });

  // Log individual failures
  results
    .filter((r) => !r.healthy)
    .forEach((result) => {
      log('warn', 'Provider health check failed', {
        provider: result.providerId,
        error: result.error,
        responseTime: result.responseTime,
      });
    });

  return results;
}

// Store health check results in memory
let lastHealthCheck: HealthCheckResult[] = [];
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Starts periodic health checks
 */
export function startHealthCheckMonitoring(intervalMs: number = 5 * 60 * 1000) {
  // 5 minutes default
  if (healthCheckInterval) {
    log('warn', 'Health check monitoring already running');
    return;
  }

  log('info', 'Starting health check monitoring', { intervalMs });

  // Run initial check
  runHealthChecks().then((results) => {
    lastHealthCheck = results;
  });

  // Set up periodic checks
  healthCheckInterval = setInterval(async () => {
    const results = await runHealthChecks();
    lastHealthCheck = results;
  }, intervalMs);
}

/**
 * Stops periodic health checks
 */
export function stopHealthCheckMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    log('info', 'Stopped health check monitoring');
  }
}

/**
 * Gets the latest health check results
 */
export function getLatestHealthCheck(): HealthCheckResult[] {
  return lastHealthCheck;
}

/**
 * Gets health status for a specific provider
 */
export function getProviderHealth(providerId: string): HealthCheckResult | undefined {
  return lastHealthCheck.find((r) => r.providerId === providerId);
}
