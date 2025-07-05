import { log } from './logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

// Default rate limits for different endpoints
export const RATE_LIMITS = {
  status: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60       // 60 requests per minute
  },
  health: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 30       // 30 requests per minute
  },
  provider: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 120      // 120 requests per minute
  }
} as const;

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  
  let entry = rateLimitStore.get(key);
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment count
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  if (!allowed) {
    log('warn', 'Rate limit exceeded', {
      identifier,
      count: entry.count,
      maxRequests: config.maxRequests,
      resetTime: entry.resetTime
    });
  }
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime
  };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // For API endpoints, we could also use API keys in the future
  return `ip:${ip}`;
}

/**
 * Create rate limit headers
 */
export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTime: number
): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
  return headers;
} 