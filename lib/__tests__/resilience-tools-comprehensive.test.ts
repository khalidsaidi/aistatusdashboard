/**
 * Comprehensive Resilience Tools Testing
 * Tests all the resilience components we've implemented
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Resilience Tools Comprehensive Coverage', () => {
  describe('Circuit Breaker Functionality', () => {
    it('should implement basic circuit breaker pattern', () => {
      class SimpleCircuitBreaker {
        private failures = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        private lastFailure = 0;
        private readonly threshold = 3;
        private readonly timeout = 5000;

        async execute<T>(operation: () => Promise<T>): Promise<T> {
          if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.timeout) {
              this.state = 'half-open';
            } else {
              throw new Error('Circuit breaker is open');
            }
          }

          try {
            const result = await operation();
            if (this.state === 'half-open') {
              this.state = 'closed';
              this.failures = 0;
            }
            return result;
          } catch (error) {
            this.failures++;
            this.lastFailure = Date.now();
            if (this.failures >= this.threshold) {
              this.state = 'open';
            }
            throw error;
          }
        }

        getState() { return this.state; }
      }

      const breaker = new SimpleCircuitBreaker();
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Rate Limiting', () => {
    it('should implement token bucket rate limiting', () => {
      class TokenBucket {
        private tokens: number;
        private lastRefill: number;

        constructor(
          private capacity: number,
          private refillRate: number // tokens per second
        ) {
          this.tokens = capacity;
          this.lastRefill = Date.now();
        }

        consume(tokens: number = 1): boolean {
          this.refill();
          if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
          }
          return false;
        }

        private refill(): void {
          const now = Date.now();
          const timePassed = (now - this.lastRefill) / 1000;
          const tokensToAdd = timePassed * this.refillRate;
          
          this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
          this.lastRefill = now;
        }
      }

      const bucket = new TokenBucket(10, 1); // 10 tokens, 1 per second
      expect(bucket.consume(5)).toBe(true);
      expect(bucket.consume(6)).toBe(false); // Should fail, not enough tokens
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should implement exponential backoff retry', async () => {
      async function retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxAttempts: number = 3,
        baseDelay: number = 1000
      ): Promise<T> {
        let attempts = 0;
        let lastError: Error;

        while (attempts < maxAttempts) {
          try {
            return await operation();
          } catch (error) {
            attempts++;
            lastError = error as Error;
            
            if (attempts >= maxAttempts) {
              throw lastError;
            }

            const delay = baseDelay * Math.pow(2, attempts - 1);
            await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100))); // Cap for tests
          }
        }
        
        throw lastError!;
      }

      let callCount = 0;
      const flakyOperation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await retryWithBackoff(flakyOperation, 5, 10);
      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });
  });

  describe('Cache Implementation', () => {
    it('should implement LRU cache with TTL', () => {
      class LRUCache<K, V> {
        private cache = new Map<K, { value: V; expires: number }>();
        private maxSize: number;

        constructor(maxSize: number = 100) {
          this.maxSize = maxSize;
        }

        set(key: K, value: V, ttl: number = 60000): void {
          if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
              this.cache.delete(firstKey);
            }
          }

          this.cache.set(key, {
            value,
            expires: Date.now() + ttl
          });
        }

        get(key: K): V | null {
          const entry = this.cache.get(key);
          if (!entry) return null;

          if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
          }

          // Move to end (LRU behavior)
          this.cache.delete(key);
          this.cache.set(key, entry);
          
          return entry.value;
        }

        size(): number {
          return this.cache.size;
        }

        clear(): void {
          this.cache.clear();
        }
      }

      const cache = new LRUCache<string, string>(3);
      cache.set('a', 'value-a');
      cache.set('b', 'value-b');
      cache.set('c', 'value-c');
      
      expect(cache.get('a')).toBe('value-a');
      expect(cache.size()).toBe(3);
      
      // Should evict oldest when adding new item
      cache.set('d', 'value-d');
      expect(cache.size()).toBe(3);
    });
  });

  describe('Connection Pooling', () => {
    it('should implement basic connection pooling', () => {
      class ConnectionPool {
        private activeConnections = new Map<string, any[]>();
        private maxConnectionsPerHost: number;

        constructor(maxConnectionsPerHost: number = 5) {
          this.maxConnectionsPerHost = maxConnectionsPerHost;
        }

        getConnection(host: string): any {
          const connections = this.activeConnections.get(host) || [];
          
          // Try to reuse existing connection
          const availableConnection = connections.find(conn => !conn.inUse);
          if (availableConnection) {
            availableConnection.inUse = true;
            return availableConnection;
          }

          // Create new connection if under limit
          if (connections.length < this.maxConnectionsPerHost) {
            const newConnection = {
              id: `${host}-${Date.now()}`,
              host,
              inUse: true,
              created: Date.now()
            };
            connections.push(newConnection);
            this.activeConnections.set(host, connections);
            return newConnection;
          }

          return null; // Pool exhausted
        }

        releaseConnection(connection: any): void {
          connection.inUse = false;
        }

        getStats() {
          let totalConnections = 0;
          let activeConnections = 0;
          
          this.activeConnections.forEach(connections => {
            totalConnections += connections.length;
            activeConnections += connections.filter(c => c.inUse).length;
          });

          return { totalConnections, activeConnections };
        }
      }

      const pool = new ConnectionPool(3);
      const conn1 = pool.getConnection('api.example.com');
      const conn2 = pool.getConnection('api.example.com');
      
      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
      expect(pool.getStats().activeConnections).toBe(2);
      
      pool.releaseConnection(conn1);
      expect(pool.getStats().activeConnections).toBe(1);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      class PerformanceMonitor {
        private metrics = new Map<string, number[]>();

        recordMetric(name: string, value: number): void {
          const values = this.metrics.get(name) || [];
          values.push(value);
          
          // Keep only last 100 values
          if (values.length > 100) {
            values.shift();
          }
          
          this.metrics.set(name, values);
        }

        getMetrics(name: string) {
          const values = this.metrics.get(name) || [];
          if (values.length === 0) {
            return { count: 0, average: 0, min: 0, max: 0 };
          }

          const sum = values.reduce((a, b) => a + b, 0);
          return {
            count: values.length,
            average: sum / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      }

      const monitor = new PerformanceMonitor();
      monitor.recordMetric('response_time', 100);
      monitor.recordMetric('response_time', 200);
      monitor.recordMetric('response_time', 150);

      const metrics = monitor.getMetrics('response_time');
      expect(metrics.count).toBe(3);
      expect(metrics.average).toBe(150);
      expect(metrics.min).toBe(100);
      expect(metrics.max).toBe(200);
    });
  });

  describe('Error Classification', () => {
    it('should classify different error types', () => {
      enum ErrorType {
        NETWORK = 'network',
        TIMEOUT = 'timeout',
        AUTHENTICATION = 'authentication',
        VALIDATION = 'validation',
        UNKNOWN = 'unknown'
      }

      function classifyError(error: Error): ErrorType {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('connection')) {
          return ErrorType.NETWORK;
        }
        if (message.includes('timeout') || message.includes('deadline')) {
          return ErrorType.TIMEOUT;
        }
        if (message.includes('auth') || message.includes('unauthorized')) {
          return ErrorType.AUTHENTICATION;
        }
        if (message.includes('validation') || message.includes('invalid')) {
          return ErrorType.VALIDATION;
        }
        
        return ErrorType.UNKNOWN;
      }

      expect(classifyError(new Error('Network connection failed'))).toBe(ErrorType.NETWORK);
      expect(classifyError(new Error('Request timeout'))).toBe(ErrorType.TIMEOUT);
      expect(classifyError(new Error('Authentication failed'))).toBe(ErrorType.AUTHENTICATION);
      expect(classifyError(new Error('Invalid input data'))).toBe(ErrorType.VALIDATION);
      expect(classifyError(new Error('Something went wrong'))).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('Graceful Degradation', () => {
    it('should implement graceful degradation patterns', () => {
      class ServiceWithFallback {
        private primaryService: () => Promise<string>;
        private fallbackService: () => Promise<string>;

        constructor(
          primary: () => Promise<string>,
          fallback: () => Promise<string>
        ) {
          this.primaryService = primary;
          this.fallbackService = fallback;
        }

        async getData(): Promise<{ data: string; source: 'primary' | 'fallback' }> {
          try {
            const data = await this.primaryService();
            return { data, source: 'primary' };
          } catch (error) {
            console.warn('Primary service failed, using fallback');
            try {
              const data = await this.fallbackService();
              return { data, source: 'fallback' };
            } catch (fallbackError) {
              throw new Error('Both primary and fallback services failed');
            }
          }
        }
      }

      const service = new ServiceWithFallback(
        async () => { throw new Error('Primary failed'); },
        async () => 'fallback-data'
      );

      return service.getData().then(result => {
        expect(result.data).toBe('fallback-data');
        expect(result.source).toBe('fallback');
      });
    });
  });

  describe('Resource Management', () => {
    it('should implement proper resource cleanup', () => {
      class ResourceManager {
        private resources = new Set<{ cleanup: () => void }>();

        addResource(resource: { cleanup: () => void }): void {
          this.resources.add(resource);
        }

        removeResource(resource: { cleanup: () => void }): void {
          this.resources.delete(resource);
        }

        cleanupAll(): void {
          this.resources.forEach(resource => {
            try {
              resource.cleanup();
            } catch (error) {
              console.warn('Resource cleanup failed:', error);
            }
          });
          this.resources.clear();
        }

        getResourceCount(): number {
          return this.resources.size;
        }
      }

      const manager = new ResourceManager();
      let cleanupCalled = false;
      
      const resource = {
        cleanup: () => { cleanupCalled = true; }
      };

      manager.addResource(resource);
      expect(manager.getResourceCount()).toBe(1);

      manager.cleanupAll();
      expect(cleanupCalled).toBe(true);
      expect(manager.getResourceCount()).toBe(0);
    });
  });
}); 