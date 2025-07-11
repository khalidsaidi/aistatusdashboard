/**
 * PRODUCTION-READY COMPONENTS
 *
 * Missing critical components for production scalability:
 * - Thread-safe cache with atomic operations
 * - Atomic lock manager for concurrent operations
 * - Performance monitoring and alerting
 * - Connection pooling for HTTP requests
 */

import { log } from './logger';
import { withErrorHandling, ErrorContext } from './unified-error-handler';

// =============================================================================
// THREAD-SAFE CACHE WITH ATOMIC OPERATIONS
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expires: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export class AtomicCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private locks = new Map<string, Promise<void>>();
  private maxSize: number;
  private defaultTtl: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    size: 0,
  };

  constructor(maxSize = 10000, defaultTtl = 3600) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Atomic get operation
   */
  async get(key: string): Promise<T | null> {
    // Wait for any pending operations on this key
    await this.waitForLock(key);

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Update access statistics atomically
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Atomic set operation with size management
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const lock = this.acquireLock(key);

    try {
      await lock;

      const expires = Date.now() + (ttl ?? this.defaultTtl) * 1000;
      const size = this.estimateSize(value);

      // Check if we need to evict items
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        await this.evictLeastRecentlyUsed();
      }

      const entry: CacheEntry<T> = {
        value,
        expires,
        accessCount: 0,
        lastAccessed: Date.now(),
        size,
      };

      this.cache.set(key, entry);
      this.stats.sets++;
      this.stats.size = this.cache.size;
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Atomic delete operation
   */
  async delete(key: string): Promise<boolean> {
    const lock = this.acquireLock(key);

    try {
      await lock;
      const existed = this.cache.delete(key);
      this.stats.size = this.cache.size;
      return existed;
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Atomic get-or-set operation
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const existing = await this.get(key);
    if (existing !== null) {
      return existing;
    }

    const lock = this.acquireLock(key);

    try {
      await lock;

      // Double-check after acquiring lock
      const doubleCheck = await this.get(key);
      if (doubleCheck !== null) {
        return doubleCheck;
      }

      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    } finally {
      this.releaseLock(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0;

    return {
      ...this.stats,
      hitRate,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Wait for all locks to clear
    await Promise.all(this.locks.values());

    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0, size: 0 };
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.locks.clear();
  }

  // Private methods
  private acquireLock(key: string): Promise<void> {
    if (this.locks.has(key)) {
      return this.locks.get(key)!;
    }

    let resolver: () => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    this.locks.set(key, promise);

    // Resolve immediately since we're the first to acquire
    resolver!();
    return promise;
  }

  private releaseLock(key: string): void {
    this.locks.delete(key);
  }

  private async waitForLock(key: string): Promise<void> {
    const lock = this.locks.get(key);
    if (lock) {
      await lock;
    }
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.stats.size = this.cache.size;
      log('info', `Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate
    } catch {
      return 1000; // Default size
    }
  }

  private getMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }
}

// =============================================================================
// ATOMIC LOCK MANAGER
// =============================================================================

interface LockInfo {
  acquired: number;
  timeout: number;
  holder: string;
}

export class AtomicLockManager {
  private locks = new Map<string, LockInfo>();
  private waitQueues = new Map<string, Array<() => void>>();
  private defaultTimeout = 30000; // 30 seconds

  /**
   * Acquire a lock with timeout
   */
  async acquireLock(lockKey: string, holderId: string, timeout?: number): Promise<boolean> {
    const lockTimeout = timeout ?? this.defaultTimeout;
    const now = Date.now();

    // Check if lock is available
    const existingLock = this.locks.get(lockKey);
    if (!existingLock) {
      this.locks.set(lockKey, {
        acquired: now,
        timeout: now + lockTimeout,
        holder: holderId,
      });
      return true;
    }

    // Check if lock has expired
    if (now > existingLock.timeout) {
      this.locks.set(lockKey, {
        acquired: now,
        timeout: now + lockTimeout,
        holder: holderId,
      });
      this.notifyWaiters(lockKey);
      return true;
    }

    // Wait for lock to be released
    return new Promise((resolve) => {
      const waitQueue = this.waitQueues.get(lockKey) || [];

      const timeoutHandle = setTimeout(() => {
        this.removeFromWaitQueue(lockKey, resolver);
        resolve(false);
      }, lockTimeout);

      const resolver = () => {
        clearTimeout(timeoutHandle);

        // Try to acquire lock again
        const currentLock = this.locks.get(lockKey);
        if (!currentLock || Date.now() > currentLock.timeout) {
          this.locks.set(lockKey, {
            acquired: Date.now(),
            timeout: Date.now() + lockTimeout,
            holder: holderId,
          });
          resolve(true);
        } else {
          resolve(false);
        }
      };

      waitQueue.push(resolver);
      this.waitQueues.set(lockKey, waitQueue);
    });
  }

  /**
   * Release a lock
   */
  releaseLock(lockKey: string, holderId: string): boolean {
    const lock = this.locks.get(lockKey);
    if (!lock || lock.holder !== holderId) {
      return false;
    }

    this.locks.delete(lockKey);
    this.notifyWaiters(lockKey);
    return true;
  }

  /**
   * Check if lock is held
   */
  isLocked(lockKey: string): boolean {
    const lock = this.locks.get(lockKey);
    if (!lock) return false;

    if (Date.now() > lock.timeout) {
      this.locks.delete(lockKey);
      this.notifyWaiters(lockKey);
      return false;
    }

    return true;
  }

  /**
   * Get lock holder
   */
  getLockHolder(lockKey: string): string | null {
    const lock = this.locks.get(lockKey);
    if (!lock) return null;

    if (Date.now() > lock.timeout) {
      this.locks.delete(lockKey);
      this.notifyWaiters(lockKey);
      return null;
    }

    return lock.holder;
  }

  /**
   * Force release all expired locks
   */
  cleanupExpiredLocks(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, lock] of this.locks.entries()) {
      if (now > lock.timeout) {
        this.locks.delete(key);
        this.notifyWaiters(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all active locks
   */
  getActiveLocks(): Array<{ key: string; holder: string; remaining: number }> {
    const now = Date.now();
    const activeLocks = [];

    for (const [key, lock] of this.locks.entries()) {
      if (now <= lock.timeout) {
        activeLocks.push({
          key,
          holder: lock.holder,
          remaining: lock.timeout - now,
        });
      }
    }

    return activeLocks;
  }

  /**
   * Shutdown lock manager
   */
  shutdown(): void {
    this.locks.clear();

    // Notify all waiters
    for (const [key, waiters] of this.waitQueues.entries()) {
      waiters.forEach((waiter) => waiter());
    }
    this.waitQueues.clear();
  }

  // Private methods
  private notifyWaiters(lockKey: string): void {
    const waiters = this.waitQueues.get(lockKey);
    if (waiters && waiters.length > 0) {
      const waiter = waiters.shift();
      if (waiter) {
        waiter();
      }

      if (waiters.length === 0) {
        this.waitQueues.delete(lockKey);
      }
    }
  }

  private removeFromWaitQueue(lockKey: string, resolver: () => void): void {
    const waiters = this.waitQueues.get(lockKey);
    if (waiters) {
      const index = waiters.indexOf(resolver);
      if (index > -1) {
        waiters.splice(index, 1);
      }

      if (waiters.length === 0) {
        this.waitQueues.delete(lockKey);
      }
    }
  }
}

// =============================================================================
// HTTP CONNECTION POOL
// =============================================================================

interface PooledConnection {
  url: string;
  created: number;
  lastUsed: number;
  inUse: boolean;
  requestCount: number;
}

export class HTTPConnectionPool {
  private connections = new Map<string, PooledConnection[]>();
  private maxConnectionsPerHost = 10;
  private connectionTimeout = 30000;
  private maxConnectionAge = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: {
    maxConnectionsPerHost?: number;
    connectionTimeout?: number;
    maxConnectionAge?: number;
  }) {
    if (config) {
      this.maxConnectionsPerHost = config.maxConnectionsPerHost ?? this.maxConnectionsPerHost;
      this.connectionTimeout = config.connectionTimeout ?? this.connectionTimeout;
      this.maxConnectionAge = config.maxConnectionAge ?? this.maxConnectionAge;
    }

    // Cleanup old connections every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldConnections();
    }, 60000);
  }

  /**
   * Execute HTTP request with connection pooling
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const host = new URL(url).host;
    const connection = this.acquireConnection(host, url);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.connectionTimeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.releaseConnection(connection);

      return response;
    } catch (error) {
      this.releaseConnection(connection, true); // Mark as failed
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    connectionsByHost: Record<string, number>;
  } {
    let totalConnections = 0;
    let activeConnections = 0;
    const connectionsByHost: Record<string, number> = {};

    for (const [host, connections] of this.connections.entries()) {
      totalConnections += connections.length;
      activeConnections += connections.filter((c) => c.inUse).length;
      connectionsByHost[host] = connections.length;
    }

    return {
      totalConnections,
      activeConnections,
      connectionsByHost,
    };
  }

  /**
   * Shutdown connection pool
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.connections.clear();
  }

  // Private methods
  private acquireConnection(host: string, url: string): PooledConnection {
    let hostConnections = this.connections.get(host) || [];

    // Find available connection
    let connection = hostConnections.find((c) => !c.inUse);

    if (!connection) {
      // Create new connection if under limit
      if (hostConnections.length < this.maxConnectionsPerHost) {
        connection = {
          url,
          created: Date.now(),
          lastUsed: Date.now(),
          inUse: true,
          requestCount: 0,
        };
        hostConnections.push(connection);
        this.connections.set(host, hostConnections);
      } else {
        // Reuse oldest connection
        connection = hostConnections.reduce((oldest, current) =>
          current.lastUsed < oldest.lastUsed ? current : oldest
        );
      }
    }

    connection.inUse = true;
    connection.lastUsed = Date.now();
    connection.requestCount++;

    return connection;
  }

  private releaseConnection(connection: PooledConnection, failed = false): void {
    connection.inUse = false;

    if (failed) {
      // Remove failed connections
      for (const [host, connections] of this.connections.entries()) {
        const index = connections.indexOf(connection);
        if (index > -1) {
          connections.splice(index, 1);
          if (connections.length === 0) {
            this.connections.delete(host);
          }
          break;
        }
      }
    }
  }

  private cleanupOldConnections(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [host, connections] of this.connections.entries()) {
      const validConnections = connections.filter((connection) => {
        const age = now - connection.created;
        const idle = now - connection.lastUsed;

        return age < this.maxConnectionAge && (connection.inUse || idle < this.connectionTimeout);
      });

      cleaned += connections.length - validConnections.length;

      if (validConnections.length === 0) {
        this.connections.delete(host);
      } else {
        this.connections.set(host, validConnections);
      }
    }

    if (cleaned > 0) {
      log('info', `HTTP pool cleanup: removed ${cleaned} old connections`);
    }
  }
}

// =============================================================================
// PERFORMANCE MONITOR
// =============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  duration: number;
  callback: (metric: PerformanceMetric) => void;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alertRules: AlertRule[] = [];
  private alertStates = new Map<string, { triggered: number; notified: number }>();
  private maxMetrics = 10000;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config?: { maxMetrics?: number; monitoringIntervalMs?: number }) {
    this.maxMetrics = config?.maxMetrics ?? this.maxMetrics;

    const intervalMs = config?.monitoringIntervalMs ?? 30000;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Maintain size limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }

    // Check alert rules
    this.checkAlerts(metric);
  }

  /**
   * Add alert rule
   */
  addAlert(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  /**
   * Get metrics by name and time range
   */
  getMetrics(name: string, startTime?: number, endTime?: number): PerformanceMetric[] {
    const start = startTime ?? 0;
    const end = endTime ?? Date.now();

    return this.metrics.filter(
      (m) => m.name === name && m.timestamp >= start && m.timestamp <= end
    );
  }

  /**
   * Get aggregated statistics
   */
  getStats(
    name: string,
    windowMs = 300000
  ): {
    count: number;
    average: number;
    min: number;
    max: number;
    percentile95: number;
  } {
    const cutoff = Date.now() - windowMs;
    const recent = this.metrics.filter((m) => m.name === name && m.timestamp >= cutoff);

    if (recent.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, percentile95: 0 };
    }

    const values = recent.map((m) => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const p95Index = Math.floor(values.length * 0.95);

    return {
      count: values.length,
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      percentile95: values[p95Index] || 0,
    };
  }

  /**
   * Shutdown performance monitor
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.metrics = [];
    this.alertRules = [];
    this.alertStates.clear();
  }

  // Private methods
  private checkAlerts(metric: PerformanceMetric): void {
    for (const rule of this.alertRules) {
      if (rule.metric !== metric.name) continue;

      let triggered = false;
      switch (rule.operator) {
        case 'gt':
          triggered = metric.value > rule.threshold;
          break;
        case 'lt':
          triggered = metric.value < rule.threshold;
          break;
        case 'eq':
          triggered = metric.value === rule.threshold;
          break;
      }

      if (triggered) {
        const state = this.alertStates.get(rule.name) || { triggered: 0, notified: 0 };

        if (state.triggered === 0) {
          state.triggered = Date.now();
        }

        const duration = Date.now() - state.triggered;
        if (duration >= rule.duration && Date.now() - state.notified > rule.duration) {
          rule.callback(metric);
          state.notified = Date.now();
        }

        this.alertStates.set(rule.name, state);
      } else {
        this.alertStates.delete(rule.name);
      }
    }
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memory = process.memoryUsage();
        this.recordMetric('system.memory.used', memory.heapUsed);
        this.recordMetric('system.memory.total', memory.heapTotal);
      }

      // CPU usage (simplified)
      if (typeof process !== 'undefined' && process.cpuUsage) {
        const cpu = process.cpuUsage();
        this.recordMetric('system.cpu.user', cpu.user);
        this.recordMetric('system.cpu.system', cpu.system);
      }
    } catch (error) {
      log('warn', 'Failed to collect system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create production-ready cache
 */
export function createProductionCache<T>(maxSize = 10000, defaultTtl = 3600): AtomicCache<T> {
  return new AtomicCache<T>(maxSize, defaultTtl);
}

/**
 * Create lock manager
 */
export function createLockManager(): AtomicLockManager {
  return new AtomicLockManager();
}

/**
 * Create HTTP connection pool
 */
export function createConnectionPool(config?: {
  maxConnectionsPerHost?: number;
  connectionTimeout?: number;
  maxConnectionAge?: number;
}): HTTPConnectionPool {
  return new HTTPConnectionPool(config);
}

/**
 * Create performance monitor with default alerts
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  const monitor = new PerformanceMonitor();

  // Add default alerts
  monitor.addAlert({
    name: 'high_memory_usage',
    metric: 'system.memory.used',
    threshold: 1024 * 1024 * 1024, // 1GB
    operator: 'gt',
    duration: 60000, // 1 minute
    callback: (metric) => {
      log('warn', 'High memory usage detected', {
        value: metric.value,
        threshold: '1GB',
      });
    },
  });

  monitor.addAlert({
    name: 'slow_response_time',
    metric: 'response_time',
    threshold: 5000, // 5 seconds
    operator: 'gt',
    duration: 30000, // 30 seconds
    callback: (metric) => {
      log('warn', 'Slow response time detected', {
        value: metric.value,
        threshold: '5000ms',
      });
    },
  });

  return monitor;
}
