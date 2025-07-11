/**
 * PRODUCTION RESILIENCE COMPONENTS
 * Using the actual installed resilience libraries from package.json
 */

import Bottleneck from 'bottleneck';
import { backOff } from 'exponential-backoff';
import { log } from './logger';

// =============================================================================
// PRODUCTION RATE LIMITER USING BOTTLENECK
// =============================================================================

export class ProductionRateLimiter {
  private limiters = new Map<string, Bottleneck>();
  private limiterConfigs = new Map<string, { maxConcurrent: number; minTime: number }>();
  
  constructor() {
    log('info', 'Production rate limiter initialized with Bottleneck');
  }

  /**
   * Get or create a rate limiter for a specific key
   */
  private getLimiter(key: string, maxConcurrent = 10, minTime = 100): Bottleneck {
    if (!this.limiters.has(key)) {
      const limiter = new Bottleneck({
        reservoir: 100,              // Start with 100 requests
        reservoirRefreshAmount: 100, // Refill 100 requests
        reservoirRefreshInterval: 60 * 1000, // Every minute
        maxConcurrent,               // Max concurrent requests
        minTime,                     // Minimum time between requests
        highWater: 1000,            // Queue size limit
        strategy: Bottleneck.strategy.LEAK
      });

      // Store configuration for stats
      this.limiterConfigs.set(key, { maxConcurrent, minTime });

      // Add error handling
      limiter.on('error', (error) => {
        log('error', `Rate limiter error for ${key}:`, error);
      });

      limiter.on('depleted', () => {
        log('warn', `Rate limiter depleted for ${key}`);
      });

      this.limiters.set(key, limiter);
    }
    
    return this.limiters.get(key)!;
  }

  /**
   * Execute operation with rate limiting
   */
  async execute<T>(key: string, operation: () => Promise<T>, options?: {
    maxConcurrent?: number;
    minTime?: number;
  }): Promise<T> {
    const limiter = this.getLimiter(
      key, 
      options?.maxConcurrent, 
      options?.minTime
    );
    
    return limiter.schedule(operation);
  }

  /**
   * Check if we can proceed without queuing
   */
  canProceed(key: string): boolean {
    const limiter = this.limiters.get(key);
    if (!limiter) return true;
    
    return (limiter as any).reservoir > 0 && (limiter as any).running < (limiter as any).maxConcurrent;
  }

  /**
   * Get stats for a rate limiter
   */
  getStats(key: string) {
    const limiter = this.limiters.get(key);
    const config = this.limiterConfigs.get(key);
    if (!limiter || !config) return null;
    
    return {
      reservoir: (limiter as any).reservoir || 0,
      running: (limiter as any).running || 0,
      queued: limiter.queued(),
      maxConcurrent: config.maxConcurrent,
      minTime: config.minTime
    };
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    for (const [key, limiter] of this.limiters) {
      await limiter.stop();
    }
    this.limiters.clear();
    this.limiterConfigs.clear();
    log('info', 'Production rate limiter shutdown completed');
  }
}

// =============================================================================
// PRODUCTION RETRY MANAGER USING EXPONENTIAL-BACKOFF
// =============================================================================

export class ProductionRetryManager {
  constructor() {
    log('info', 'Production retry manager initialized with exponential-backoff');
  }

  /**
   * Execute with exponential backoff using exponential-backoff library
   */
  async executeWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
      numOfAttempts?: number;
      startingDelay?: number;
      maxDelay?: number;
      jitter?: 'none' | 'full';
      delayFirstAttempt?: boolean;
      retry?: (error: any, attemptNumber: number) => boolean;
    } = {}
  ): Promise<T> {
    const {
      numOfAttempts = 5,
      startingDelay = 1000,
      maxDelay = 30000,
      jitter = 'full',
      delayFirstAttempt = false,
      retry: retryCondition
    } = options;

    return backOff(operation, {
      numOfAttempts,
      startingDelay,
      maxDelay,
      jitter,
      delayFirstAttempt,
      retry: retryCondition || ((error: any, attemptNumber: number) => {
        log('warn', `Backoff attempt ${attemptNumber} failed:`, error?.message || error);
        
        // Don't retry on auth errors
        if (error?.message?.includes('401') || error?.message?.includes('403')) {
          return false;
        }
        
        return true;
      })
    });
  }

  /**
   * Simple retry with manual backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      factor?: number;
      minTimeout?: number;
      maxTimeout?: number;
      randomize?: boolean;
      onRetry?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      retries = 3,
      factor = 2,
      minTimeout = 1000,
      maxTimeout = 30000,
      randomize = true,
      onRetry
    } = options;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain errors
        if (lastError.message.includes('401') || lastError.message.includes('403')) {
          throw lastError;
        }
        
        if (attempt <= retries) {
          const delay = Math.min(
            minTimeout * Math.pow(factor, attempt - 1),
            maxTimeout
          );
          
          const finalDelay = randomize ? delay * (0.5 + Math.random() * 0.5) : delay;
          
          log('warn', `Retry attempt ${attempt} failed, waiting ${finalDelay}ms:`, { error: lastError.message });
          onRetry?.(lastError, attempt);
          
          await new Promise(resolve => setTimeout(resolve, finalDelay));
        }
      }
    }
    
    throw lastError!;
  }
}

// =============================================================================
// PRODUCTION CIRCUIT BREAKER
// =============================================================================

export class ProductionCircuitBreaker {
  private circuits = new Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastFailure: number;
    lastSuccess: number;
    threshold: number;
    timeout: number;
    monitor: {
      totalRequests: number;
      failedRequests: number;
      successfulRequests: number;
    };
  }>();

  constructor() {
    log('info', 'Production circuit breaker initialized');
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      threshold?: number;
      timeout?: number;
      resetTimeout?: number;
    } = {}
  ): Promise<T> {
    const {
      threshold = 5,
      timeout = 60000,
      resetTimeout = 30000
    } = options;

    let circuit = this.circuits.get(key);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        lastSuccess: 0,
        threshold,
        timeout,
        monitor: {
          totalRequests: 0,
          failedRequests: 0,
          successfulRequests: 0
        }
      };
      this.circuits.set(key, circuit);
    }

    circuit.monitor.totalRequests++;

    // Check if circuit should transition from open to half-open
    if (circuit.state === 'open') {
      if (Date.now() - circuit.lastFailure > resetTimeout) {
        circuit.state = 'half-open';
        log('info', `Circuit breaker ${key} transitioning to half-open`);
      } else {
        circuit.monitor.failedRequests++;
        throw new Error(`Circuit breaker ${key} is open`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit if it was half-open
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
        log('info', `Circuit breaker ${key} reset to closed`);
      }
      
      circuit.lastSuccess = Date.now();
      circuit.monitor.successfulRequests++;
      
      return result;
      
    } catch (error) {
      circuit.failures++;
      circuit.lastFailure = Date.now();
      circuit.monitor.failedRequests++;
      
      // Open circuit if threshold exceeded
      if (circuit.failures >= circuit.threshold && circuit.state === 'closed') {
        circuit.state = 'open';
        log('error', `Circuit breaker ${key} opened after ${circuit.failures} failures`);
      }
      
      throw error;
    }
  }

  /**
   * Get circuit state
   */
  getState(key: string): string {
    return this.circuits.get(key)?.state || 'closed';
  }

  /**
   * Get circuit stats
   */
  getStats(key: string) {
    const circuit = this.circuits.get(key);
    if (!circuit) return null;
    
    return {
      state: circuit.state,
      failures: circuit.failures,
      threshold: circuit.threshold,
      lastFailure: circuit.lastFailure,
      lastSuccess: circuit.lastSuccess,
      monitor: { ...circuit.monitor }
    };
  }

  /**
   * Manually reset circuit
   */
  reset(key: string): void {
    const circuit = this.circuits.get(key);
    if (circuit) {
      circuit.state = 'closed';
      circuit.failures = 0;
      log('info', `Circuit breaker ${key} manually reset`);
    }
  }

  /**
   * Get all circuit stats
   */
  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [key, circuit] of this.circuits) {
      stats[key] = {
        state: circuit.state,
        failures: circuit.failures,
        monitor: { ...circuit.monitor }
      };
    }
    return stats;
  }
}

// =============================================================================
// INTEGRATED RESILIENCE MANAGER
// =============================================================================

export class IntegratedResilienceManager {
  private rateLimiter: ProductionRateLimiter;
  private retryManager: ProductionRetryManager;
  private circuitBreaker: ProductionCircuitBreaker;

  constructor() {
    this.rateLimiter = new ProductionRateLimiter();
    this.retryManager = new ProductionRetryManager();
    this.circuitBreaker = new ProductionCircuitBreaker();
    
    log('info', 'Integrated resilience manager initialized with all production tools');
  }

  /**
   * Execute operation with full resilience stack
   */
  async executeResilient<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      // Rate limiting
      maxConcurrent?: number;
      minTime?: number;
      // Circuit breaker
      circuitThreshold?: number;
      circuitTimeout?: number;
      // Retry
      retries?: number;
      retryFactor?: number;
      minTimeout?: number;
      maxTimeout?: number;
    } = {}
  ): Promise<T> {
    // Wrap with circuit breaker
    const circuitProtectedOperation = () => 
      this.circuitBreaker.execute(key, operation, {
        threshold: options.circuitThreshold,
        timeout: options.circuitTimeout
      });

    // Wrap with retry logic
    const retryProtectedOperation = () =>
      this.retryManager.executeWithRetry(circuitProtectedOperation, {
        retries: options.retries,
        factor: options.retryFactor,
        minTimeout: options.minTimeout,
        maxTimeout: options.maxTimeout
      });

    // Wrap with rate limiting
    return this.rateLimiter.execute(key, retryProtectedOperation, {
      maxConcurrent: options.maxConcurrent,
      minTime: options.minTime
    });
  }

  /**
   * Get comprehensive stats
   */
  getStats() {
    return {
      circuits: this.circuitBreaker.getAllStats(),
      rateLimiters: Array.from(['api', 'status', 'health']).map(key => ({
        key,
        stats: this.rateLimiter.getStats(key)
      })).filter(item => item.stats !== null)
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const stats = this.getStats();
    
    // Check for open circuits
    const openCircuits = Object.entries(stats.circuits)
      .filter(([_, circuit]) => circuit.state === 'open');
    
    // Check rate limiter health
    const rateLimiterIssues = stats.rateLimiters
      .filter(rl => rl.stats && rl.stats.queued > 100);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (openCircuits.length > 0) {
      status = openCircuits.length > 2 ? 'unhealthy' : 'degraded';
    }
    
    if (rateLimiterIssues.length > 0) {
      status = status === 'healthy' ? 'degraded' : 'unhealthy';
    }

    return {
      status,
      details: {
        openCircuits: openCircuits.length,
        rateLimiterIssues: rateLimiterIssues.length,
        stats
      }
    };
  }

  /**
   * Shutdown all components
   */
  async shutdown(): Promise<void> {
    await this.rateLimiter.shutdown();
    log('info', 'Integrated resilience manager shutdown completed');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function createProductionRateLimiter(): ProductionRateLimiter {
  return new ProductionRateLimiter();
}

export function createProductionRetryManager(): ProductionRetryManager {
  return new ProductionRetryManager();
}

export function createProductionCircuitBreaker(): ProductionCircuitBreaker {
  return new ProductionCircuitBreaker();
}

export function createIntegratedResilienceManager(): IntegratedResilienceManager {
  return new IntegratedResilienceManager();
} 