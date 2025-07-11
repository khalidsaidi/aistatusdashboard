import { CacheItem } from './types';
import { log } from './logger';

const cache = new Map<string, CacheItem<any>>();
const CACHE_TTL = 60 * 1000; // 1 minute

// Export for testing purposes
export const _testOnlyCache = cache;

export function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data as T;
  }
  // Clean up expired entry
  if (item) {
    cache.delete(key);
  }
  return null;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}
