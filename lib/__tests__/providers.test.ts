import { fetchProviderStatus } from '../status-fetcher';
import { PROVIDERS } from '../providers';
import { StatusResult } from '../types';
import { _testOnlyCache } from '../cache';

// Mock fetch is already set up in jest.setup.js

describe('Providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache before each test
    _testOnlyCache.clear();
  });

  describe('providers array', () => {
    it('should have required providers', () => {
      const providerIds = PROVIDERS.map(p => p.id);
      expect(providerIds).toContain('openai');
      expect(providerIds).toContain('anthropic');
      expect(providerIds).toContain('google-ai');
      expect(providerIds).toContain('cohere');
      expect(providerIds).toContain('huggingface');
    });

    it('should have valid properties for each provider', () => {
      PROVIDERS.forEach(provider => {
        expect(provider.id).toBeTruthy();
        expect(provider.name).toBeTruthy();
        expect(provider.statusPageUrl).toMatch(/^https:\/\//);
      });
    });
  });

  describe('fetchProviderStatus', () => {
    it('should return operational status for successful response', async () => {
      // Mock fetch to return successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ 
          status: { indicator: 'none' }, // This maps to 'operational'
          page: { name: 'OpenAI' }
        }),
      } as Response);

      // Mock Date.now to return predictable response time
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 50; // First call: 0, second call: 50 (50ms response)
      });

      const provider = PROVIDERS[0];
      const status = await fetchProviderStatus(provider);

      expect(status.id).toBe('openai');
      expect(status.name).toBe('OpenAI');
      expect(status.status).toBe('operational'); // Should be operational when indicator is 'none'
      expect(status.lastChecked).toBeTruthy();
      expect(status.responseTime).toBe(50); // Should be 50ms
      expect(status.statusPageUrl).toBe(provider.statusPageUrl);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle different status indicators correctly', async () => {
      const testCases = [
        { indicator: 'none', expected: 'operational' },
        { indicator: 'minor', expected: 'degraded' },
        { indicator: 'major', expected: 'down' },
        { indicator: 'critical', expected: 'down' },
      ];

      for (const testCase of testCases) {
        // Clear cache before each iteration
        _testOnlyCache.clear();
        
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: { indicator: testCase.indicator }
          }),
          text: async () => '<!DOCTYPE html>' // Add text method for HuggingFace
        });

        const provider = PROVIDERS[0];
        const status = await fetchProviderStatus(provider);
        expect(status.status).toBe(testCase.expected);
      }
    });

    it('should return unknown status on network error', async () => {
      // Mock persistent network failures (all retries fail)
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const provider = PROVIDERS[0];
      const status = await fetchProviderStatus(provider);

      expect(status.status).toBe('unknown');
      expect(status.id).toBe(provider.id);
      expect(status.lastChecked).toBeTruthy();
      expect(status.error).toContain('Network error'); // Use toContain since error message might be wrapped
    });

    it('should measure response time', async () => {
      // Use jest fake timers for more predictable timing
      jest.useFakeTimers();
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ status: { indicator: 'none' } }),
              text: async () => '<!DOCTYPE html>'
            });
          }, 100);
        });
      });

      const promise = fetchProviderStatus(PROVIDERS[0]);
      
      // Advance timers by 100ms
      jest.advanceTimersByTime(100);
      
      const status = await promise;

      expect(status.responseTime).toBeDefined();
      expect(status.responseTime).toBeGreaterThanOrEqual(100);
      
      jest.useRealTimers();
    });
  });

  describe('fetchAllProviders', () => {
    it('should check all providers in parallel', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: { indicator: 'none' }
        }),
        text: async () => '<!DOCTYPE html>'
      });

      const results = await Promise.all(PROVIDERS.map(p => fetchProviderStatus(p)));

      expect(results).toHaveLength(PROVIDERS.length);
      // With alternative detection, providers without public APIs now make multiple fetch calls
      // Each provider without API tests 3 endpoints, so we expect more calls
      expect(global.fetch).toHaveBeenCalled();
      // Don't check exact count since alternative detection makes variable calls
    });

    it('should handle mixed success and failure', async () => {
      // Clear cache before test
      _testOnlyCache.clear();
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: { indicator: 'none' } }),
          text: async () => '<!DOCTYPE html>'
        })
        // Mock persistent failure for second provider (all retries fail)
        .mockRejectedValue(new Error('Network error'));

      // Test first two providers only to avoid complexity with different provider types
      const results = await Promise.all(PROVIDERS.slice(0, 2).map(p => fetchProviderStatus(p)));

      const statuses = results.map(r => r.status);
      
      // First provider should be operational
      expect(statuses[0]).toBe('operational');
      // Second provider should be unknown (persistent network error)
      expect(statuses[1]).toBe('unknown');
    });

    it('should not throw if one provider fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: { indicator: 'none' } }),
          text: async () => '<!DOCTYPE html>'
        })
        .mockRejectedValueOnce(new Error('Critical failure'));

      const promise = Promise.all(PROVIDERS.slice(0, 2).map(p => fetchProviderStatus(p)));
      await expect(promise).resolves.toBeDefined();
    });
  });
}); 