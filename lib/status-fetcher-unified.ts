/**
 * UNIFIED STATUS FETCHER - Single, Simple Implementation
 *
 * Replaces 6+ over-engineered status fetchers with one clean solution.
 * Designed for 50-200 providers with exponential user growth.
 */

import { log } from './logger';

// Simple, focused types
export interface Provider {
  id: string;
  name: string;
  statusUrl: string;
  category: string;
  timeout?: number;
  enabled?: boolean;
  priority?: number;
  statusPageUrl?: string; // Added for tests
}

export interface StatusResult {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  lastChecked: string;
  error?: string;
  statusPageUrl?: string; // Added for tests
}

export interface StatusFetchOptions {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  progressCallback?: (completed: number, total: number) => void;
}

/**
 * Simple, efficient status fetcher
 * Handles 50-200 providers easily without over-engineering
 */
export class StatusFetcher {
  private cache = new Map<string, { result: StatusResult; expires: number }>();
  private readonly cacheTTL = 60 * 1000; // 60 seconds
  private readonly defaultTimeout = 10000; // 10 seconds
  private readonly defaultRetries = 2;

  /**
   * Check status of a single provider
   */
  async checkProvider(provider: Provider, options: StatusFetchOptions = {}): Promise<StatusResult> {
    const startTime = Date.now();
    const timeout = options.timeout || provider.timeout || this.defaultTimeout;
    const retries = options.retries || this.defaultRetries;

    // Check cache first
    const cached = this.getCached(provider.id);
    if (cached) {
      return cached;
    }

    let lastError: string | undefined;

    // Simple retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(provider.statusUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'AI-Status-Dashboard/1.0',
            Accept: 'application/json,text/html,*/*',
          },
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        const result: StatusResult = {
          id: provider.id,
          name: provider.name,
          status: this.parseStatus(response),
          statusPageUrl: provider.statusPageUrl,
          responseTime,
          lastChecked: new Date().toISOString(),
          error: lastError,
        };

        // Cache successful results
        this.setCached(provider.id, result);

        log('info', 'Provider status checked', {
          provider: provider.id,
          status: result.status,
          responseTime,
          attempt: attempt + 1,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        if (attempt === retries) {
          // Final attempt failed
          const result: StatusResult = {
            id: provider.id,
            name: provider.name,
            status: 'unknown',
            statusPageUrl: provider.statusPageUrl,
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: lastError,
          };

          log('error', 'Provider status check failed', {
            provider: provider.id,
            error: lastError,
            attempts: retries + 1,
          });

          return result;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // Should never reach here, but TypeScript safety
    throw new Error('Unexpected error in status check');
  }

  /**
   * Check multiple providers efficiently
   * Uses Promise.allSettled for reliability
   */
  async checkProviders(
    providers: Provider[],
    options: StatusFetchOptions = {}
  ): Promise<StatusResult[]> {
    const enabledProviders = providers.filter((p) => p.enabled !== false);

    log('info', 'Starting batch status check', {
      totalProviders: enabledProviders.length,
      parallel: options.parallel !== false,
    });

    let completed = 0;
    const updateProgress = () => {
      completed++;
      if (options.progressCallback) {
        options.progressCallback(completed, enabledProviders.length);
      }
    };

    if (options.parallel === false) {
      // Sequential processing (for rate-limited APIs)
      const results: StatusResult[] = [];
      for (const provider of enabledProviders) {
        const result = await this.checkProvider(provider, options);
        results.push(result);
        updateProgress();
      }
      return results;
    } else {
      // Parallel processing (default - efficient for most cases)
      const promises = enabledProviders.map(async (provider) => {
        const result = await this.checkProvider(provider, options);
        updateProgress();
        return result;
      });

      const settledResults = await Promise.allSettled(promises);

      return settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Fallback for rejected promises
          const provider = enabledProviders[index];
          return {
            id: provider.id,
            name: provider.name,
            status: 'unknown' as const,
            statusPageUrl: provider.statusPageUrl,
            responseTime: 0,
            lastChecked: new Date().toISOString(),
            error: 'Promise rejected: ' + result.reason,
          };
        }
      });
    }
  }

  /**
   * Get cached result if still valid
   */
  private getCached(providerId: string): StatusResult | null {
    const cached = this.cache.get(providerId);
    if (cached && Date.now() < cached.expires) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache result with TTL
   */
  private setCached(providerId: string, result: StatusResult): void {
    this.cache.set(providerId, {
      result,
      expires: Date.now() + this.cacheTTL,
    });
  }

  /**
   * Parse HTTP response to status
   * Simple but effective logic
   */
  private parseStatus(response: Response): 'operational' | 'degraded' | 'down' {
    if (response.ok) {
      return 'operational';
    } else if (response.status >= 500) {
      return 'down';
    } else {
      return 'degraded';
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
    };
  }
}

// Singleton instance for app-wide use
export const statusFetcher = new StatusFetcher();

/**
 * Convenience function for checking all providers
 */
export async function checkAllProviders(
  providers: Provider[],
  options?: StatusFetchOptions
): Promise<StatusResult[]> {
  return statusFetcher.checkProviders(providers, options);
}

/**
 * Convenience function for checking single provider
 */
export async function checkProvider(
  provider: Provider,
  options?: StatusFetchOptions
): Promise<StatusResult> {
  return statusFetcher.checkProvider(provider, options);
}
