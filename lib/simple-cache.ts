import { getConfig } from './config-secure';

// =============================================================================
// SIMPLE TTL CACHE IMPLEMENTATION
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Simple TTL cache with automatic cleanup
 */
class SimpleCache<T> {
  private data = new Map<string, CacheEntry<T>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private readonly maxSize: number = 1000,
    private readonly defaultTtl: number = getConfig().performance.cacheTtl
  ) {
    // Start cleanup interval
    this.startCleanup();
  }
  
  /**
   * Set cache entry with TTL
   */
  set(key: string, value: T, ttl: number = this.defaultTtl): void {
    // Clean up expired entries if we're near capacity
    if (this.data.size >= this.maxSize) {
      this.cleanup();
    }
    
    // If still at capacity, remove oldest entry
    if (this.data.size >= this.maxSize) {
      const firstKey = this.data.keys().next().value;
      if (firstKey) {
        this.data.delete(firstKey);
      }
    }
    
    this.data.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }
  
  /**
   * Get cache entry
   */
  get(key: string): T | null {
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
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.data.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
  } {
    return {
      size: this.data.size,
      maxSize: this.maxSize
    };
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.data.forEach((entry, key) => {
      if (entry.expires < now) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.data.delete(key);
    });
  }
  
  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    
    // Don't keep process alive for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  /**
   * Stop automatic cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// =============================================================================
// GLOBAL CACHE INSTANCES
// =============================================================================

const config = getConfig();

/**
 * Global cache for provider status
 */
const statusCache = new SimpleCache<any>(1000, config.performance.cacheTtl);

/**
 * Global cache for rate limiting
 */
const rateLimitCache = new SimpleCache<{
  count: number;
  resetTime: number;
}>(1000, config.performance.rateLimitWindow);

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get cached value
 */
export function getCached<T>(key: string): T | null {
  return statusCache.get(key);
}

/**
 * Set cached value
 */
export function setCache<T>(key: string, value: T, ttl?: number): void {
  statusCache.set(key, value, ttl);
}

/**
 * Check if key exists in cache
 */
export function hasCached(key: string): boolean {
  return statusCache.has(key);
}

/**
 * Delete cached value
 */
export function deleteCached(key: string): boolean {
  return statusCache.delete(key);
}

/**
 * Clear all cached values
 */
export function clearCache(): void {
  statusCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    status: statusCache.getStats(),
    rateLimit: rateLimitCache.getStats()
  };
}

/**
 * Rate limiting functions
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const key = identifier;
  
  let entry = rateLimitCache.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.performance.rateLimitWindow
    };
    rateLimitCache.set(key, entry, config.performance.rateLimitWindow);
  }
  
  // Increment count
  entry.count++;
  rateLimitCache.set(key, entry, config.performance.rateLimitWindow);
  
  const allowed = entry.count <= config.performance.rateLimitRequests;
  const remaining = Math.max(0, config.performance.rateLimitRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime
  };
}

/**
 * Clean up caches on process exit
 */
if (typeof process !== 'undefined' && !(global as any).__simpleCacheExitHandlerRegistered) {
  (global as any).__simpleCacheExitHandlerRegistered = true;
  
  const cleanup = () => {
    statusCache.destroy();
    rateLimitCache.destroy();
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
} 