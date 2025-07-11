/**
 * THREAD-SAFE CACHE IMPLEMENTATION
 *
 * This replaces the unsafe SimpleCache with proper concurrency controls
 * to prevent race conditions and data corruption.
 */

import { CONFIG } from './config-constants';
import { globalLockManager } from './atomic-lock-manager';

interface CacheEntry<T> {
  value: T;
  expires: number;
  created: number;
}

/**
 * Thread-safe cache with atomic operations and proper cleanup
 *
 * CRITICAL FIXES:
 * - Atomic operations using AtomicLockManager
 * - Safe concurrent access patterns
 * - Guaranteed cleanup without race conditions
 * - Memory leak prevention with size limits
 */
export class ThreadSafeCache<T> {
  private data = new Map<string, CacheEntry<T>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxSize: number = CONFIG.cache.maxSize,
    private readonly defaultTtl: number = CONFIG.cache.ttl,
    private readonly cleanupIntervalMs: number = 5 * 60 * 1000 // 5 minutes
  ) {
    this.startCleanup();
  }

  /**
   * Thread-safe set operation with atomic guarantees
   */
  async set(key: string, value: T, ttl: number = this.defaultTtl): Promise<void> {
    return globalLockManager.withLock(
      `cache:${key}`,
      async () => {
        // Check size limits before adding
        if (this.data.size >= this.maxSize && !this.data.has(key)) {
          await this.evictOldestEntry();
        }

        this.data.set(key, {
          value,
          expires: Date.now() + ttl,
          created: Date.now(),
        });
      },
      { timeout: 5000, priority: 1 }
    );
  }

  /**
   * Thread-safe get operation
   */
  async get(key: string): Promise<T | null> {
    return globalLockManager.withLock(
      `cache:${key}`,
      async () => {
        const entry = this.data.get(key);

        if (!entry) {
          return null;
        }

        // Check if expired
        if (entry.expires < Date.now()) {
          this.data.delete(key);
          return null;
        }

        return entry.value;
      },
      { timeout: 3000, priority: 2 }
    );
  }

  /**
   * Thread-safe delete operation
   */
  async delete(key: string): Promise<boolean> {
    return globalLockManager.withLock(
      `cache:${key}`,
      async () => {
        return this.data.delete(key);
      },
      { timeout: 3000, priority: 1 }
    );
  }

  /**
   * Thread-safe clear operation
   */
  async clear(): Promise<void> {
    return globalLockManager.withLock(
      'cache:global',
      async () => {
        this.data.clear();
      },
      { timeout: 10000, priority: 0 }
    );
  }

  /**
   * Get cache statistics safely
   */
  async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  }> {
    return globalLockManager.withLock(
      'cache:global',
      async () => {
        const memoryUsage = this.calculateMemoryUsage();

        return {
          size: this.data.size,
          maxSize: this.maxSize,
          hitRate: 0, // Would need hit tracking for this
          memoryUsage,
        };
      },
      { timeout: 5000, priority: 3 }
    );
  }

  /**
   * Safely evict oldest entry when at capacity
   */
  private async evictOldestEntry(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.data.entries()) {
      if (entry.created < oldestTime) {
        oldestTime = entry.created;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.data.delete(oldestKey);
    }
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.data.entries()) {
      totalSize += key.length * 2; // String characters
      totalSize += JSON.stringify(entry.value).length * 2; // Value size
      totalSize += 24; // Entry object overhead
    }

    return totalSize;
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Thread-safe cleanup of expired entries
   */
  private async cleanup(): Promise<void> {
    try {
      return globalLockManager.withLock(
        'cache:cleanup',
        async () => {
          const now = Date.now();
          const keysToDelete: string[] = [];

          // Collect expired keys
          for (const [key, entry] of this.data.entries()) {
            if (entry.expires < now) {
              keysToDelete.push(key);
            }
          }

          // Delete expired entries
          for (const key of keysToDelete) {
            this.data.delete(key);
          }

          // Force cleanup if over size limit
          if (this.data.size > this.maxSize) {
            const excess = this.data.size - this.maxSize;
            const entries = Array.from(this.data.entries())
              .sort(([, a], [, b]) => a.created - b.created) // Sort by creation time
              .slice(0, excess); // Take oldest entries

            for (const [key] of entries) {
              this.data.delete(key);
            }
          }

          if (keysToDelete.length > 0) {
            console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} expired entries`);
          }
        },
        { timeout: 30000, priority: 0 }
      );
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  /**
   * Stop cleanup and release resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.clear();
  }
}

// Global thread-safe cache instances
const globalCache = new ThreadSafeCache<any>();
const enterpriseCache = new ThreadSafeCache<any>(10000, 300000); // Larger cache for enterprise

/**
 * Thread-safe cache operations (backwards compatible API)
 */
export async function setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
  return globalCache.set(key, value, ttl);
}

export async function getCached<T>(key: string): Promise<T | null> {
  return globalCache.get(key);
}

export async function deleteCache(key: string): Promise<boolean> {
  return globalCache.delete(key);
}

export async function clearCache(): Promise<void> {
  return globalCache.clear();
}

/**
 * Enterprise cache operations
 */
export async function setCachedEnterprise<T>(key: string, value: T, ttl?: number): Promise<void> {
  return enterpriseCache.set(key, value, ttl);
}

export async function getCachedEnterprise<T>(key: string): Promise<T | null> {
  return enterpriseCache.get(key);
}

export async function getEnterpriseCache(): Promise<ThreadSafeCache<any>> {
  return enterpriseCache;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  global: any;
  enterprise: any;
}> {
  const [globalStats, enterpriseStats] = await Promise.all([
    globalCache.getStats(),
    enterpriseCache.getStats(),
  ]);

  return {
    global: globalStats,
    enterprise: enterpriseStats,
  };
}

/**
 * Cleanup function for graceful shutdown
 */
export async function shutdownCache(): Promise<void> {
  await Promise.all([globalCache.destroy(), enterpriseCache.destroy()]);
}
