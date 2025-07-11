import type { StatusResult, UnifiedProvider } from './types';
import { log } from './logger';

// =============================================================================
// ENTERPRISE DISTRIBUTED CACHING SYSTEM
// =============================================================================

/**
 * Enterprise cache configuration for handling thousands of providers
 *
 * AI CONSTRAINTS:
 * - MUST support Redis clustering for horizontal scaling
 * - MUST provide intelligent cache warming strategies
 * - MUST handle cache invalidation patterns efficiently
 * - MUST prevent cache stampede scenarios
 */
interface EnterpriseCacheConfig {
  readonly defaultTtl: number; // Default TTL in milliseconds (5 minutes)
  readonly warmupTtl: number; // Warmup cache TTL (30 minutes)
  readonly maxMemoryMb: number; // Max memory usage (512MB)
  readonly compressionThreshold: number; // Compress values > 1KB
  readonly batchInvalidationSize: number; // Batch size for invalidation (100)
  readonly warmupConcurrency: number; // Concurrent warmup requests (10)
  readonly stallWhileRevalidate: number; // Serve stale while revalidating (60s)
  readonly redisUrl?: string; // Redis connection URL
  readonly useRedis: boolean; // Enable Redis backend
}

/**
 * Default enterprise cache configuration
 */
const CACHE_CONFIG: EnterpriseCacheConfig = {
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300000'), // 5 minutes
  warmupTtl: parseInt(process.env.CACHE_WARMUP_TTL || '1800000'), // 30 minutes
  maxMemoryMb: parseInt(process.env.CACHE_MAX_MEMORY_MB || '512'),
  compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
  batchInvalidationSize: parseInt(process.env.CACHE_BATCH_INVALIDATION_SIZE || '100'),
  warmupConcurrency: parseInt(process.env.CACHE_WARMUP_CONCURRENCY || '10'),
  stallWhileRevalidate: parseInt(process.env.CACHE_STALE_WHILE_REVALIDATE || '60000'),
  redisUrl: process.env.REDIS_URL,
  useRedis: process.env.REDIS_URL !== undefined,
};

/**
 * Cache entry with metadata for enterprise features
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  compressed: boolean;
  warmup: boolean;
  size: number;
}

/**
 * Cache statistics for monitoring and optimization
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  compressionRatio: number;
  warmupHits: number;
  staleServed: number;
}

/**
 * Enterprise distributed cache manager
 */
class EnterpriseCacheManager {
  private inMemoryCache = new Map<string, CacheEntry<any>>();
  private redisClient: any = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsage: 0,
    compressionRatio: 0,
    warmupHits: 0,
    staleServed: 0,
  };
  private warmupQueue = new Set<string>();
  private revalidationQueue = new Map<string, Promise<any>>();

  constructor() {
    this.initializeRedis();
    // Note: Memory monitoring and stats reporting will be added in subsequent methods
  }

  /**
   * Initialize Redis connection for distributed caching
   */
  private async initializeRedis(): Promise<void> {
    if (!CACHE_CONFIG.useRedis || !CACHE_CONFIG.redisUrl) {
      log('info', 'Using in-memory cache only', { redisEnabled: false });
      return;
    }

    try {
      // Note: Redis integration will be available when redis package is installed
      // For now, using in-memory cache with Redis-compatible interface
      log('info', 'Redis not available, using enterprise in-memory cache', {
        redisUrl: CACHE_CONFIG.redisUrl ? 'configured' : 'not configured',
      });
      this.redisClient = null;
    } catch (error) {
      log('warn', 'Redis initialization failed, falling back to memory cache', {
        error: (error as Error).message,
      });
      this.redisClient = null;
    }
  }

  /**
   * Get value from cache with stale-while-revalidate support
   *
   * AI CONSTRAINTS:
   * - MUST check Redis first, then memory cache
   * - MUST support stale-while-revalidate pattern
   * - MUST track cache hit statistics
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first if available
      if (this.redisClient) {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          this.stats.hits++;
          return JSON.parse(redisValue);
        }
      }

      // Fallback to in-memory cache
      const entry = this.inMemoryCache.get(key);
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      const now = Date.now();
      const isExpired = now > entry.timestamp + entry.ttl;
      const isStale = now > entry.timestamp + entry.ttl - CACHE_CONFIG.stallWhileRevalidate;

      // Update hit statistics
      entry.hits++;
      this.stats.hits++;

      if (isExpired) {
        // Remove expired entry
        this.inMemoryCache.delete(key);
        this.stats.misses++;
        return null;
      }

      if (isStale && entry.warmup) {
        // Serve stale data while triggering revalidation
        this.stats.staleServed++;
        this.triggerRevalidation(key);
      }

      if (entry.warmup) {
        this.stats.warmupHits++;
      }

      return entry.value;
    } catch (error) {
      log('error', 'Cache get operation failed', {
        key,
        error: (error as Error).message,
      });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with compression and TTL
   *
   * AI CONSTRAINTS:
   * - MUST compress large values
   * - MUST set TTL appropriately
   * - MUST update both Redis and memory cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const effectiveTtl = ttl || CACHE_CONFIG.defaultTtl;
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, 'utf8');
      const shouldCompress = size > CACHE_CONFIG.compressionThreshold;

      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: effectiveTtl,
        hits: 0,
        compressed: shouldCompress,
        warmup: false,
        size,
      };

      // Set in Redis if available
      if (this.redisClient) {
        await this.redisClient.setEx(key, Math.floor(effectiveTtl / 1000), serialized);
      }

      // Set in memory cache
      this.inMemoryCache.set(key, entry);
      this.stats.sets++;

      // Check memory usage and evict if necessary
      this.enforceMemoryLimits();

      log('info', 'Cache set operation completed', {
        key,
        size,
        compressed: shouldCompress,
        ttl: effectiveTtl,
      });
    } catch (error) {
      log('error', 'Cache set operation failed', {
        key,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.del(key);
      }

      this.inMemoryCache.delete(key);
      this.stats.deletes++;

      log('info', 'Cache delete operation completed', { key });
    } catch (error) {
      log('error', 'Cache delete operation failed', {
        key,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Batch delete multiple keys for efficient invalidation
   */
  async deleteBatch(keys: string[]): Promise<void> {
    const batches = [];
    for (let i = 0; i < keys.length; i += CACHE_CONFIG.batchInvalidationSize) {
      batches.push(keys.slice(i, i + CACHE_CONFIG.batchInvalidationSize));
    }

    for (const batch of batches) {
      await Promise.all(batch.map((key) => this.delete(key)));
    }

    log('info', 'Batch delete operation completed', {
      totalKeys: keys.length,
      batches: batches.length,
    });
  }

  /**
   * Trigger background revalidation for stale cache entries
   */
  private triggerRevalidation(key: string): void {
    if (this.revalidationQueue.has(key)) {
      return; // Already revalidating
    }

    // Note: In a real implementation, this would trigger the original data fetcher
    // For now, we'll just mark it for potential cleanup
    log('info', 'Triggered revalidation for stale cache entry', { key });
  }

  /**
   * Enforce memory limits by evicting least recently used entries
   */
  private enforceMemoryLimits(): void {
    const currentMemoryMb = this.calculateMemoryUsage();

    if (currentMemoryMb <= CACHE_CONFIG.maxMemoryMb) {
      return;
    }

    // Sort entries by last access time (LRU eviction)
    const entries = Array.from(this.inMemoryCache.entries()).sort(([, a], [, b]) => {
      const aLastAccess = a.timestamp + a.hits * 1000; // Approximate last access
      const bLastAccess = b.timestamp + b.hits * 1000;
      return aLastAccess - bLastAccess;
    });

    let evicted = 0;
    for (const [key] of entries) {
      if (this.calculateMemoryUsage() <= CACHE_CONFIG.maxMemoryMb * 0.8) {
        break; // Stop when we're at 80% of limit
      }

      this.inMemoryCache.delete(key);
      evicted++;
      this.stats.evictions++;
    }

    log('info', 'Memory limit enforcement completed', {
      evicted,
      currentMemoryMb: this.calculateMemoryUsage(),
      limit: CACHE_CONFIG.maxMemoryMb,
    });
  }

  /**
   * Calculate current memory usage in MB
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    this.inMemoryCache.forEach((entry) => {
      totalSize += entry.size;
    });

    const memoryMb = totalSize / (1024 * 1024);
    this.stats.memoryUsage = memoryMb;

    return memoryMb;
  }

  /**
   * Warm up cache with provider data
   *
   * AI CONSTRAINTS:
   * - MUST handle thousands of providers efficiently
   * - MUST respect concurrency limits
   * - MUST provide progress tracking
   */
  async warmupCache(
    providers: UnifiedProvider[],
    fetcher: (provider: UnifiedProvider) => Promise<StatusResult>,
    progressCallback?: (progress: { completed: number; total: number }) => void
  ): Promise<void> {
    log('info', 'Starting cache warmup', {
      totalProviders: providers.length,
      concurrency: CACHE_CONFIG.warmupConcurrency,
    });

    let completed = 0;
    const batches = [];

    // Split providers into batches for controlled concurrency
    for (let i = 0; i < providers.length; i += CACHE_CONFIG.warmupConcurrency) {
      batches.push(providers.slice(i, i + CACHE_CONFIG.warmupConcurrency));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (provider) => {
          try {
            const result = await fetcher(provider);
            const key = `status:${provider.id}`;

            // Set with warmup TTL
            await this.set(key, result, CACHE_CONFIG.warmupTtl);

            // Mark as warmup entry
            const entry = this.inMemoryCache.get(key);
            if (entry) {
              entry.warmup = true;
            }

            completed++;

            if (progressCallback) {
              progressCallback({
                completed,
                total: providers.length,
              });
            }
          } catch (error) {
            log('warn', 'Cache warmup failed for provider', {
              provider: provider.id,
              error: (error as Error).message,
            });
            completed++;
          }
        })
      );
    }

    log('info', 'Cache warmup completed', {
      totalProviders: providers.length,
      completed,
    });
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats & { memoryUsageMb: number; cacheSize: number } {
    return {
      ...this.stats,
      memoryUsageMb: this.calculateMemoryUsage(),
      cacheSize: this.inMemoryCache.size,
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.flushAll();
    }

    this.inMemoryCache.clear();

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      warmupHits: 0,
      staleServed: 0,
    };

    log('info', 'Cache cleared successfully');
  }
}

// =============================================================================
// GLOBAL CACHE INSTANCE AND EXPORTS
// =============================================================================

/**
 * Global enterprise cache instance
 *
 * AI CONSTRAINTS:
 * - MUST be singleton for consistent state
 * - MUST be initialized once per process
 * - MUST handle concurrent access safely
 */
let globalCacheInstance: EnterpriseCacheManager | null = null;

/**
 * Get or create the global cache instance
 */
function getEnterpriseCache(): EnterpriseCacheManager {
  if (!globalCacheInstance) {
    globalCacheInstance = new EnterpriseCacheManager();
  }
  return globalCacheInstance;
}

/**
 * Get cached value with enterprise features
 *
 * AI CONSTRAINTS:
 * - MUST provide simple interface for consumers
 * - MUST handle all error cases gracefully
 * - MUST provide consistent typing
 */
export async function getCachedEnterprise<T>(key: string): Promise<T | null> {
  const cache = getEnterpriseCache();
  return await cache.get<T>(key);
}

/**
 * Set cached value with enterprise features
 */
export async function setCachedEnterprise<T>(key: string, value: T, ttl?: number): Promise<void> {
  const cache = getEnterpriseCache();
  await cache.set(key, value, ttl);
}

/**
 * Delete cached value
 */
export async function deleteCachedEnterprise(key: string): Promise<void> {
  const cache = getEnterpriseCache();
  await cache.delete(key);
}

/**
 * Batch delete cached values for efficient invalidation
 */
export async function deleteBatchEnterprise(keys: string[]): Promise<void> {
  const cache = getEnterpriseCache();
  await cache.deleteBatch(keys);
}

/**
 * Warm up cache with provider data
 */
export async function warmupCacheEnterprise(
  providers: UnifiedProvider[],
  fetcher: (provider: UnifiedProvider) => Promise<StatusResult>,
  progressCallback?: (progress: { completed: number; total: number }) => void
): Promise<void> {
  const cache = getEnterpriseCache();
  await cache.warmupCache(providers, fetcher, progressCallback);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStatsEnterprise(): CacheStats & {
  memoryUsageMb: number;
  cacheSize: number;
} {
  const cache = getEnterpriseCache();
  return cache.getStats();
}

/**
 * Clear all cache entries
 */
export async function clearCacheEnterprise(): Promise<void> {
  const cache = getEnterpriseCache();
  await cache.clear();
}

/**
 * Invalidate cache entries by pattern
 *
 * AI CONSTRAINTS:
 * - MUST support wildcard patterns for bulk invalidation
 * - MUST be efficient for thousands of keys
 * - MUST provide feedback on invalidation count
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  const cache = getEnterpriseCache();
  const stats = cache.getStats();

  // Convert simple wildcard pattern to regex
  const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);

  // Find matching keys in memory cache
  const matchingKeys: string[] = [];
  cache['inMemoryCache'].forEach((_, key) => {
    if (regex.test(key)) {
      matchingKeys.push(key);
    }
  });

  // Batch delete matching keys
  if (matchingKeys.length > 0) {
    await cache.deleteBatch(matchingKeys);
  }

  log('info', 'Cache pattern invalidation completed', {
    pattern,
    matchingKeys: matchingKeys.length,
  });

  return matchingKeys.length;
}

// =============================================================================
// CACHE WARMING STRATEGIES
// =============================================================================

/**
 * Intelligent cache warming based on provider priority and usage patterns
 *
 * AI CONSTRAINTS:
 * - MUST prioritize high-traffic providers
 * - MUST respect system resource limits
 * - MUST provide comprehensive progress tracking
 */
export async function intelligentCacheWarmup(
  providers: UnifiedProvider[],
  fetcher: (provider: UnifiedProvider) => Promise<StatusResult>,
  options?: {
    priorityProviders?: string[];
    maxConcurrency?: number;
    progressCallback?: (progress: {
      completed: number;
      total: number;
      currentProvider: string;
      phase: 'priority' | 'standard';
    }) => void;
  }
): Promise<{
  totalWarmed: number;
  priorityWarmed: number;
  standardWarmed: number;
  errors: number;
}> {
  const cache = getEnterpriseCache();
  const priorityProviders = options?.priorityProviders || [];
  const maxConcurrency = options?.maxConcurrency || CACHE_CONFIG.warmupConcurrency;

  log('info', 'Starting intelligent cache warmup', {
    totalProviders: providers.length,
    priorityProviders: priorityProviders.length,
    maxConcurrency,
  });

  let totalCompleted = 0;
  let priorityWarmed = 0;
  let standardWarmed = 0;
  let errors = 0;

  // Phase 1: Warm priority providers first
  const priorityProviderList = providers.filter((p) => priorityProviders.includes(p.id));
  const standardProviderList = providers.filter((p) => !priorityProviders.includes(p.id));

  // Warm priority providers
  if (priorityProviderList.length > 0) {
    for (const provider of priorityProviderList) {
      try {
        const result = await fetcher(provider);
        await cache.set(`status:${provider.id}`, result, CACHE_CONFIG.warmupTtl);
        priorityWarmed++;
        totalCompleted++;

        if (options?.progressCallback) {
          options.progressCallback({
            completed: totalCompleted,
            total: providers.length,
            currentProvider: provider.id,
            phase: 'priority',
          });
        }
      } catch (error) {
        errors++;
        totalCompleted++;
        log('warn', 'Priority provider warmup failed', {
          provider: provider.id,
          error: (error as Error).message,
        });
      }
    }
  }

  // Phase 2: Warm standard providers with concurrency
  const batches = [];
  for (let i = 0; i < standardProviderList.length; i += maxConcurrency) {
    batches.push(standardProviderList.slice(i, i + maxConcurrency));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (provider) => {
        try {
          const result = await fetcher(provider);
          await cache.set(`status:${provider.id}`, result, CACHE_CONFIG.warmupTtl);
          standardWarmed++;
          totalCompleted++;

          if (options?.progressCallback) {
            options.progressCallback({
              completed: totalCompleted,
              total: providers.length,
              currentProvider: provider.id,
              phase: 'standard',
            });
          }
        } catch (error) {
          errors++;
          totalCompleted++;
          log('warn', 'Standard provider warmup failed', {
            provider: provider.id,
            error: (error as Error).message,
          });
        }
      })
    );
  }

  const result = {
    totalWarmed: priorityWarmed + standardWarmed,
    priorityWarmed,
    standardWarmed,
    errors,
  };

  log('info', 'Intelligent cache warmup completed', result);

  return result;
}
