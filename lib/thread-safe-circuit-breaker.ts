/**
 * THREAD-SAFE CIRCUIT BREAKER
 *
 * Critical fixes for race conditions and memory leaks
 */

import { globalLockManager } from './atomic-lock-manager';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
  successThreshold: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  halfOpenAttempts: number;
  successCount: number;
  totalRequests: number;
}

/**
 * Thread-safe circuit breaker with atomic state transitions
 *
 * CRITICAL FIXES:
 * - Atomic state transitions using AtomicLockManager
 * - Safe concurrent access
 * - Proper half-open state handling
 * - Memory leak prevention
 */
export class ThreadSafeCircuitBreaker {
  private states = new Map<string, CircuitBreakerState>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxAttempts: 3,
      successThreshold: 2,
    },
    private readonly maxStates: number = 10000,
    private readonly cleanupIntervalMs: number = 10 * 60 * 1000 // 10 minutes
  ) {
    this.startCleanup();
  }

  /**
   * Thread-safe check if operation should be allowed
   */
  async shouldAllowRequest(
    key: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): Promise<boolean> {
    const finalConfig = { ...this.defaultConfig, ...config };

    return globalLockManager.withLock(
      `circuit:${key}`,
      async () => {
        const state = this.getOrCreateState(key);
        const now = Date.now();

        switch (state.state) {
          case 'closed':
            return true;

          case 'open':
            // Check if reset timeout has passed
            if (now - state.lastFailure >= finalConfig.resetTimeout) {
              state.state = 'half-open';
              state.halfOpenAttempts = 0;
              state.successCount = 0;
              console.log(`🔄 Circuit breaker half-open for ${key}`);
              return true;
            }
            return false;

          case 'half-open':
            // Allow limited attempts in half-open state
            if (state.halfOpenAttempts < finalConfig.halfOpenMaxAttempts) {
              state.halfOpenAttempts++;
              return true;
            }
            return false;

          default:
            return false;
        }
      },
      { timeout: 5000, priority: 2 }
    );
  }

  /**
   * Thread-safe record of request success
   */
  async recordSuccess(key: string, config: Partial<CircuitBreakerConfig> = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    return globalLockManager.withLock(
      `circuit:${key}`,
      async () => {
        const state = this.getOrCreateState(key);

        state.totalRequests++;

        if (state.state === 'half-open') {
          state.successCount++;

          if (state.successCount >= finalConfig.successThreshold) {
            state.state = 'closed';
            state.failures = 0;
            state.halfOpenAttempts = 0;
            state.successCount = 0;

            console.log(`✅ Circuit breaker closed for ${key} after successful recovery`);
          }
        } else if (state.state === 'closed') {
          // Reset failure count on success in closed state
          state.failures = 0;
        }
      },
      { timeout: 5000, priority: 2 }
    );
  }

  /**
   * Thread-safe record of request failure
   */
  async recordFailure(key: string, config: Partial<CircuitBreakerConfig> = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    return globalLockManager.withLock(
      `circuit:${key}`,
      async () => {
        const state = this.getOrCreateState(key);
        const now = Date.now();

        state.failures++;
        state.lastFailure = now;
        state.totalRequests++;

        if (state.state === 'closed' && state.failures >= finalConfig.failureThreshold) {
          state.state = 'open';
          state.halfOpenAttempts = 0;

          // Circuit breaker opened - handled internally
        } else if (state.state === 'half-open') {
          // Failed during half-open, go back to open
          state.state = 'open';
          state.halfOpenAttempts = 0;
          state.successCount = 0;

          console.log(`🚨 Circuit breaker returned to open for ${key} during half-open test`);
        }
      },
      { timeout: 5000, priority: 2 }
    );
  }

  /**
   * Get circuit breaker state
   */
  async getState(key: string): Promise<CircuitBreakerState | null> {
    return globalLockManager.withLock(
      `circuit:${key}`,
      async () => {
        const state = this.states.get(key);
        return state ? { ...state } : null;
      },
      { timeout: 3000, priority: 3 }
    );
  }

  /**
   * Get circuit breaker statistics
   */
  async getStats(): Promise<{
    totalCircuits: number;
    maxCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    memoryUsage: number;
  }> {
    return globalLockManager.withLock(
      'circuit:global',
      async () => {
        let openCircuits = 0;
        let halfOpenCircuits = 0;
        let closedCircuits = 0;

        for (const state of Array.from(this.states.values())) {
          switch (state.state) {
            case 'open':
              openCircuits++;
              break;
            case 'half-open':
              halfOpenCircuits++;
              break;
            case 'closed':
              closedCircuits++;
              break;
          }
        }

        return {
          totalCircuits: this.states.size,
          maxCircuits: this.maxStates,
          openCircuits,
          halfOpenCircuits,
          closedCircuits,
          memoryUsage: this.calculateMemoryUsage(),
        };
      },
      { timeout: 5000, priority: 3 }
    );
  }

  /**
   * Get or create state for a key
   */
  private getOrCreateState(key: string): CircuitBreakerState {
    let state = this.states.get(key);

    if (!state) {
      state = {
        failures: 0,
        lastFailure: 0,
        state: 'closed',
        halfOpenAttempts: 0,
        successCount: 0,
        totalRequests: 0,
      };

      this.states.set(key, state);
    }

    return state;
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, state] of Array.from(this.states.entries())) {
      totalSize += key.length * 2; // String characters
      totalSize += 48; // State object overhead
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
   * Thread-safe cleanup of old states
   */
  private async cleanup(): Promise<void> {
    try {
      return globalLockManager.withLock(
        'circuit:cleanup',
        async () => {
          const now = Date.now();
          const keysToDelete: string[] = [];

          // Collect old closed circuits that haven't been used recently
          for (const [key, state] of Array.from(this.states.entries())) {
            if (
              state.state === 'closed' &&
              state.totalRequests === 0 &&
              now - state.lastFailure > 24 * 60 * 60 * 1000
            ) {
              // 24 hours
              keysToDelete.push(key);
            }
          }

          // Delete old states
          for (const key of keysToDelete) {
            this.states.delete(key);
          }

          // Force cleanup if over size limit
          if (this.states.size > this.maxStates) {
            await this.forceCleanup();
          }

          if (keysToDelete.length > 0) {
            // Circuit breaker cleanup completed
          }
        },
        { timeout: 30000, priority: 0 }
      );
    } catch (error) {
      // Circuit breaker cleanup error handled silently
    }
  }

  /**
   * Force cleanup when over capacity
   */
  private async forceCleanup(): Promise<void> {
    const states = Array.from(this.states.entries()).sort(
      ([, a], [, b]) => a.lastFailure - b.lastFailure
    ); // Sort by last activity

    const toRemove = states.slice(0, this.states.size - this.maxStates);

    for (const [key] of toRemove) {
      this.states.delete(key);
    }

    // Circuit breaker force cleanup completed
  }

  /**
   * Shutdown and cleanup
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.states.clear();
  }
}

// Global thread-safe circuit breaker
const globalCircuitBreaker = new ThreadSafeCircuitBreaker();

/**
 * Thread-safe circuit breaker functions (backwards compatible)
 */
export async function canMakeRequest(
  key: string,
  config?: Partial<CircuitBreakerConfig>
): Promise<boolean> {
  const result = await globalCircuitBreaker.shouldAllowRequest(key, config);
  return result;
}

export async function recordSuccess(
  key: string,
  config?: Partial<CircuitBreakerConfig>
): Promise<void> {
  return globalCircuitBreaker.recordSuccess(key, config);
}

export async function recordFailure(
  key: string,
  config?: Partial<CircuitBreakerConfig>
): Promise<void> {
  return globalCircuitBreaker.recordFailure(key, config);
}

export async function getCircuitBreakerStats(): Promise<any> {
  return globalCircuitBreaker.getStats();
}

/**
 * Cleanup for graceful shutdown
 */
export async function shutdownCircuitBreaker(): Promise<void> {
  return globalCircuitBreaker.destroy();
}
