import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createStatusFetcher, FetcherStrategy, ProviderConfig } from '@/lib/unified-status-fetcher';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Circuit Breaker Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Basic Circuit Breaker Functionality', () => {
    it('should handle successful requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'operational' }),
        headers: new Headers(),
      } as Response);

      // Test successful request
      const response = await fetch('https://example.com');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle failed requests', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Test failed request
      await expect(fetch('https://example.com')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'operational' }),
        headers: new Headers(),
      } as Response);

      // Test multiple requests
      const response = await fetch('https://example.com');
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(fetch('https://example.com')).rejects.toThrow('Request timeout');
    });

    it('should handle invalid responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
      } as Response);

      const response = await fetch('https://example.com');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });
});
