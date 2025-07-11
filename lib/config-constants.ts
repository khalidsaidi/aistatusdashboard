/**
 * Configuration constants for the AI Status Dashboard
 */

export const CONFIG = {
  cache: {
    maxSize: 1000,
    ttl: 60000, // 1 minute default TTL
  },
  rateLimiter: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute window
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
  },
  performance: {
    maxOperationTime: 5000, // 5 seconds
    maxConcurrentOperations: 100,
  },
  memory: {
    maxHeapSize: 512 * 1024 * 1024, // 512MB
    warningThreshold: 0.8, // 80%
  },
} as const;
