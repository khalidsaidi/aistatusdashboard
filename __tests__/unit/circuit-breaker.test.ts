import { fetchProviderStatus, getCircuitBreakerStats, resetCircuitBreakers } from '@/lib/status-fetcher';
import { PROVIDERS } from '@/lib/providers';

// Mock the cache to control test behavior
jest.mock('@/lib/cache', () => ({
  getCached: jest.fn(),
  setCache: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  log: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Circuit Breaker Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit breaker state between tests
    resetCircuitBreakers();
    // Clear cache mocks
    const { getCached } = require('@/lib/cache');
    getCached.mockReturnValue(null);
  });

  describe('Circuit Breaker States', () => {
    it('should start in closed state for new providers', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: { indicator: 'none' } }),
        text: async () => '<!DOCTYPE html>',
      } as Response);

      const provider = PROVIDERS[0];
      await fetchProviderStatus(provider);

      const stats = getCircuitBreakerStats();
      const providerStats = stats.find(s => s.providerId === provider.id);
      
      expect(providerStats).toBeDefined();
      expect(providerStats?.state).toBe('closed');
      expect(providerStats?.failures).toBe(0);
    });

    it('should open circuit breaker after 5 consecutive failures', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Simulate 5 consecutive failures (each will retry 3 times)
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      for (let i = 0; i < 5; i++) {
        await fetchProviderStatus(provider);
      }

      const stats = getCircuitBreakerStats();
      const providerStats = stats.find(s => s.providerId === provider.id);
      
      expect(providerStats?.state).toBe('open');
      expect(providerStats?.failures).toBe(5);
    }, 60000); // Increase timeout for retry delays

    it('should prevent requests when circuit breaker is open', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Force circuit breaker to open
      for (let i = 0; i < 5; i++) {
        mockFetch.mockRejectedValue(new Error('Network error'));
        await fetchProviderStatus(provider);
      }

      // Reset mock call count
      mockFetch.mockClear();

      // Try to fetch again - should not make network request
      const result = await fetchProviderStatus(provider);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.status).toBe('unknown');
      expect(result.error).toContain('Circuit breaker open');
    });

    it('should use last known good status when circuit breaker is open', async () => {
      const { getCached } = require('@/lib/cache');
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Mock last known good status
      const lastKnownStatus = {
        id: provider.id,
        name: provider.name,
        status: 'operational',
        statusPageUrl: provider.statusPageUrl,
        responseTime: 100,
        lastChecked: '2025-01-01T00:00:00.000Z'
      };

      getCached.mockImplementation((key: string) => {
        if (key.includes('last_known')) {
          return lastKnownStatus;
        }
        return null;
      });

      // Force circuit breaker to open
      for (let i = 0; i < 5; i++) {
        mockFetch.mockRejectedValue(new Error('Network error'));
        await fetchProviderStatus(provider);
      }

      // Try to fetch again
      const result = await fetchProviderStatus(provider);

      expect(result.status).toBe('unknown');
      expect(result.error).toContain('Circuit breaker open - using last known status');
      expect(result.name).toBe(provider.name);
    });

    it('should transition to half-open after reset timeout', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Force circuit breaker to open
      for (let i = 0; i < 5; i++) {
        mockFetch.mockRejectedValue(new Error('Network error'));
        await fetchProviderStatus(provider);
      }

      // Mock time advancement (circuit breaker reset timeout is 60 seconds)
      const originalDate = Date.now;
      Date.now = jest.fn(() => originalDate() + 61000); // 61 seconds later

      // Mock successful response for half-open test
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: { indicator: 'none' } }),
        text: async () => '<!DOCTYPE html>',
      } as Response);

      const result = await fetchProviderStatus(provider);

      expect(result.status).toBe('operational');
      
      const stats = getCircuitBreakerStats();
      const providerStats = stats.find(s => s.providerId === provider.id);
      expect(providerStats?.state).toBe('closed'); // Should close after successful request

      // Restore original Date.now
      Date.now = originalDate;
    });

    it('should reset failure count on successful request', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Simulate some failures (but not enough to open circuit)
      for (let i = 0; i < 3; i++) {
        mockFetch.mockRejectedValue(new Error('Network error'));
        await fetchProviderStatus(provider);
      }

      // Then a successful request
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: { indicator: 'none' } }),
        text: async () => '<!DOCTYPE html>',
      } as Response);

      await fetchProviderStatus(provider);

      const stats = getCircuitBreakerStats();
      const providerStats = stats.find(s => s.providerId === provider.id);
      
      expect(providerStats?.state).toBe('closed');
      expect(providerStats?.failures).toBe(0);
    });
  });

  describe('Retry Logic with Circuit Breaker', () => {
    it('should retry failed requests up to 3 times before updating circuit breaker', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Mock all retries to fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      await fetchProviderStatus(provider);

      // Should have made 4 calls total (1 initial + 3 retries)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should succeed on retry and not increment circuit breaker failures', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const provider = PROVIDERS[0];

      // Mock first call to fail, second to succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: { indicator: 'none' } }),
          text: async () => '<!DOCTYPE html>',
        } as Response);

      const result = await fetchProviderStatus(provider);

      expect(result.status).toBe('operational');
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 failure + 1 successful retry

      const stats = getCircuitBreakerStats();
      const providerStats = stats.find(s => s.providerId === provider.id);
      expect(providerStats?.failures).toBe(0); // Should reset on success
    });
  });

  describe('Circuit Breaker Statistics', () => {
    it('should provide accurate circuit breaker statistics', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Test multiple providers
      const provider1 = PROVIDERS[0];
      const provider2 = PROVIDERS[1];

      // Make provider1 fail enough to open circuit breaker
      for (let i = 0; i < 5; i++) {
        mockFetch.mockRejectedValue(new Error('Network error'));
        await fetchProviderStatus(provider1);
      }

      // Make provider2 succeed
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: { indicator: 'none' } }),
        text: async () => '<!DOCTYPE html>',
      } as Response);
      await fetchProviderStatus(provider2);

      const stats = getCircuitBreakerStats();
      
      expect(stats.length).toBeGreaterThanOrEqual(2);
      
      const provider1Stats = stats.find(s => s.providerId === provider1.id);
      const provider2Stats = stats.find(s => s.providerId === provider2.id);
      
      expect(provider1Stats?.state).toBe('open');
      expect(provider1Stats?.failures).toBe(5);
      expect(provider1Stats?.lastFailure).toBeTruthy();
      
      expect(provider2Stats?.state).toBe('closed');
      expect(provider2Stats?.failures).toBe(0);
    });
  });
}); 