import { checkRateLimit, getClientIdentifier, createRateLimitHeaders, RATE_LIMITS } from '../rate-limiter';

// Mock Request constructor for Node.js test environment
const mockRequest = (url: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  return {
    url,
    headers,
    get: function(name: string) {
      return headers.get(name);
    }
  } as unknown as Request;
};

// Mock global Request if not available
if (typeof Request === 'undefined') {
  global.Request = mockRequest as any;
}

// Mock Headers if not available
if (typeof Headers === 'undefined') {
  global.Headers = class MockHeaders {
    private map = new Map<string, string>();
    
    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
        }
      }
    }
    
    get(name: string): string | null {
      return this.map.get(name.toLowerCase()) || null;
    }
    
    set(name: string, value: string): void {
      this.map.set(name.toLowerCase(), value);
    }
  } as any;
}

describe('Rate Limiter Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      // Arrange
      const identifier = 'test-client';
      const config = { windowMs: 60000, maxRequests: 10 };

      // Act
      const result = checkRateLimit(identifier, config);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1 = 9
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should deny requests when rate limit exceeded', () => {
      // Arrange
      const identifier = 'rate-limited-client';
      const config = { windowMs: 60000, maxRequests: 2 };

      // Act - Make requests up to limit
      const firstResult = checkRateLimit(identifier, config);
      const secondResult = checkRateLimit(identifier, config);
      const thirdResult = checkRateLimit(identifier, config); // Should be denied

      // Assert
      expect(firstResult.allowed).toBe(true);
      expect(firstResult.remaining).toBe(1);
      
      expect(secondResult.allowed).toBe(true);
      expect(secondResult.remaining).toBe(0);
      
      expect(thirdResult.allowed).toBe(false);
      expect(thirdResult.remaining).toBe(0);
    });

    it('should reset rate limit after window expires', () => {
      // Arrange
      const identifier = 'reset-client';
      const config = { windowMs: 1000, maxRequests: 1 }; // 1 second window
      
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);

      // Act - Exhaust rate limit
      const firstResult = checkRateLimit(identifier, config);
      const secondResult = checkRateLimit(identifier, config); // Should be denied
      
      // Fast-forward past window
      currentTime += 1001; // 1001ms later
      const thirdResult = checkRateLimit(identifier, config); // Should be allowed again

      // Assert
      expect(firstResult.allowed).toBe(true);
      expect(secondResult.allowed).toBe(false);
      expect(thirdResult.allowed).toBe(true);
      expect(thirdResult.remaining).toBe(0); // Used 1 of 1

      // Cleanup
      Date.now = originalNow;
    });

    it('should handle different identifiers separately', () => {
      // Arrange
      const identifier1 = 'client-1';
      const identifier2 = 'client-2';
      const config = { windowMs: 60000, maxRequests: 1 };

      // Act
      const result1 = checkRateLimit(identifier1, config);
      const result2 = checkRateLimit(identifier2, config);
      const result1Again = checkRateLimit(identifier1, config); // Should be denied
      const result2Again = checkRateLimit(identifier2, config); // Should be denied

      // Assert
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1Again.allowed).toBe(false);
      expect(result2Again.allowed).toBe(false);
    });

    it('should maintain correct remaining count', () => {
      // Arrange
      const identifier = 'counting-client';
      const config = { windowMs: 60000, maxRequests: 5 };

      // Act & Assert
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }

      // 6th request should be denied
      const deniedResult = checkRateLimit(identifier, config);
      expect(deniedResult.allowed).toBe(false);
      expect(deniedResult.remaining).toBe(0);
    });
  });

  describe('getClientIdentifier', () => {
    it('should extract IP from x-forwarded-for header', () => {
      // Arrange
      const request = mockRequest('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      // Act
      const identifier = getClientIdentifier(request);

      // Assert
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should extract IP from x-real-ip header when x-forwarded-for is not present', () => {
      // Arrange
      const request = mockRequest('http://localhost:3000/api/test', {
        headers: {
          'x-real-ip': '203.0.113.1',
        },
      });

      // Act
      const identifier = getClientIdentifier(request);

      // Assert
      expect(identifier).toBe('ip:203.0.113.1');
    });

    it('should use "unknown" when no IP headers are present', () => {
      // Arrange
      const request = mockRequest('http://localhost:3000/api/test');

      // Act
      const identifier = getClientIdentifier(request);

      // Assert
      expect(identifier).toBe('ip:unknown');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      // Arrange
      const request = mockRequest('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '203.0.113.1',
        },
      });

      // Act
      const identifier = getClientIdentifier(request);

      // Assert
      expect(identifier).toBe('ip:192.168.1.1');
    });
  });

  describe('createRateLimitHeaders', () => {
    it('should create correct rate limit headers', () => {
      // Arrange
      const limit = 100;
      const remaining = 45;
      const resetTime = 1625097600000; // Fixed timestamp

      // Act
      const headers = createRateLimitHeaders(limit, remaining, resetTime);

      // Assert
      expect(headers.get('X-RateLimit-Limit')).toBe('100');
      expect(headers.get('X-RateLimit-Remaining')).toBe('45');
      expect(headers.get('X-RateLimit-Reset')).toBe('1625097600'); // Unix timestamp
    });

    it('should handle zero remaining requests', () => {
      // Arrange
      const limit = 50;
      const remaining = 0;
      const resetTime = Date.now() + 30000;

      // Act
      const headers = createRateLimitHeaders(limit, remaining, resetTime);

      // Assert
      expect(headers.get('X-RateLimit-Limit')).toBe('50');
      expect(headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('RATE_LIMITS constants', () => {
    it('should have correct default rate limits', () => {
      // Assert
      expect(RATE_LIMITS.status).toEqual({
        windowMs: 60000,
        maxRequests: 60
      });
      
      expect(RATE_LIMITS.health).toEqual({
        windowMs: 60000,
        maxRequests: 30
      });
      
      expect(RATE_LIMITS.provider).toEqual({
        windowMs: 60000,
        maxRequests: 120
      });
    });

    it('should have all required rate limit configurations', () => {
      // Assert
      expect(RATE_LIMITS).toHaveProperty('status');
      expect(RATE_LIMITS).toHaveProperty('health');
      expect(RATE_LIMITS).toHaveProperty('provider');
      
      // Check structure
      Object.values(RATE_LIMITS).forEach(config => {
        expect(config).toHaveProperty('windowMs');
        expect(config).toHaveProperty('maxRequests');
        expect(typeof config.windowMs).toBe('number');
        expect(typeof config.maxRequests).toBe('number');
      });
    });
  });
}); 