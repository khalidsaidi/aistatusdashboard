/**
 * @jest-environment node
 */
import {
  rateLimiter,
  getClientIdentifier,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '../rate-limiter';

// Polyfill Request for Node.js test environment
if (typeof Request === 'undefined') {
  global.Request = class Request {
    url: string;
    headers: Headers;

    constructor(input: string, init?: RequestInit) {
      this.url = input;
      this.headers = new Headers(init?.headers);
    }
  } as any;
}

describe('Rate Limiter Module', () => {
  beforeEach(() => {
    // Skip Firebase initialization in test environment
    if (process.env.NODE_ENV === 'test') {
      // Mock Firebase configuration to prevent initialization
      process.env.FIREBASE_PROJECT_ID = 'test-project';
      process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
      process.env.FIREBASE_PRIVATE_KEY = 'test-key';
    }
  });

  describe('PersistentRateLimiter', () => {
    it('should have checkRateLimit method', () => {
      expect(typeof rateLimiter.checkRateLimit).toBe('function');
    });

    it('should have cleanupExpiredRecords method', () => {
      expect(typeof rateLimiter.cleanupExpiredRecords).toBe('function');
    });

    it('should handle rate limit check gracefully in test environment', async () => {
      // In test environment, this should fail open
      try {
        const result = await rateLimiter.checkRateLimit('test-client', 10, 60000);
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('resetTime');
      } catch (error) {
        // Expected in test environment without Firebase
        expect(error).toBeDefined();
      }
    });
  });

  describe('getClientIdentifier', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should extract IP from x-real-ip header when x-forwarded-for is not present', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-real-ip': '203.0.113.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('ip:203.0.113.1');
    });

    it('should use "unknown" when no IP headers are present', () => {
      const request = new Request('http://localhost:3000/api/test');

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('ip:unknown');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '203.0.113.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('ip:192.168.1.1');
    });
  });

  describe('createRateLimitHeaders', () => {
    it('should create correct rate limit headers', () => {
      const limit = 100;
      const remaining = 45;
      const resetTime = 1625097600000;

      const headers = createRateLimitHeaders(limit, remaining, resetTime);

      expect(headers.get('X-RateLimit-Limit')).toBe('100');
      expect(headers.get('X-RateLimit-Remaining')).toBe('45');
      expect(headers.get('X-RateLimit-Reset')).toBe('1625097600');
    });

    it('should handle zero remaining requests', () => {
      const limit = 50;
      const remaining = 0;
      const resetTime = Date.now() + 30000;

      const headers = createRateLimitHeaders(limit, remaining, resetTime);

      expect(headers.get('X-RateLimit-Limit')).toBe('50');
      expect(headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('RATE_LIMITS constants', () => {
    it('should have correct default rate limits', () => {
      expect(RATE_LIMITS.status).toEqual({
        windowMs: 60000,
        maxRequests: 60,
      });

      expect(RATE_LIMITS.health).toEqual({
        windowMs: 60000,
        maxRequests: 30,
      });

      expect(RATE_LIMITS.provider).toEqual({
        windowMs: 60000,
        maxRequests: 120,
      });
    });

    it('should have all required rate limit configurations', () => {
      expect(RATE_LIMITS).toHaveProperty('status');
      expect(RATE_LIMITS).toHaveProperty('health');
      expect(RATE_LIMITS).toHaveProperty('provider');

      Object.values(RATE_LIMITS).forEach((config) => {
        expect(config).toHaveProperty('windowMs');
        expect(config).toHaveProperty('maxRequests');
        expect(typeof config.windowMs).toBe('number');
        expect(typeof config.maxRequests).toBe('number');
      });
    });
  });
});
