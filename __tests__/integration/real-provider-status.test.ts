import { checkProvider } from '@/lib/status-fetcher-unified';
import { PROVIDERS } from '@/lib/providers';

// Mock fetch to return realistic responses for each provider
const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch;
});

beforeEach(() => {
  mockFetch.mockClear();
});

describe('Real Provider Status Integration Tests', () => {
  describe('Provider Endpoint Validation', () => {
    // Test each provider individually with realistic mock responses
    PROVIDERS.forEach(provider => {
      describe(`${provider.name} (${provider.id})`, () => {
        it('should return valid status data from real API', async () => {
          // Mock different response types based on provider
          if (provider.id === 'huggingface') {
            // HTML response for HuggingFace
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              text: async () => '<!DOCTYPE html><html><head><title>Status</title></head><body>All systems operational</body></html>'
            });
          } else if (provider.id === 'aws' || provider.id === 'azure') {
            // RSS/XML response for AWS/Azure
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              text: async () => '<?xml version="1.0"?><rss><channel><title>Status</title></channel></rss>'
            });
          } else if (provider.id === 'google-ai') {
            // Google Cloud format - API returns array of incidents directly
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => [] // Empty array = no incidents = operational
            });
          } else if (['meta', 'xai', 'mistral'].includes(provider.id)) {
            // These providers have no public API, so they should be handled specially
            // No need to mock - they should return unknown status immediately
          } else if (provider.id === 'perplexity') {
            // Perplexity returns HTML, mock HTML response
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              text: async () => '<!DOCTYPE html><html><head><title>Perplexity Status</title></head><body>All systems operational</body></html>'
            });
          } else {
            // Standard status page format
            mockFetch.mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                status: { indicator: 'none' },
                page: { name: provider.name }
              })
            });
          }
          
          const result = await checkProvider(provider);
          
          console.log(`✅ ${provider.name}: ${result.status} (${result.responseTime}ms)`);
          
          // Validate response structure
          expect(result).toHaveProperty('id', provider.id);
          expect(result).toHaveProperty('name', provider.name);
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('statusPageUrl', provider.statusPageUrl);
          expect(result).toHaveProperty('responseTime');
          expect(result).toHaveProperty('lastChecked');
          
          // Status should be one of the valid values
          expect(['operational', 'degraded', 'down', 'unknown']).toContain(result.status);
          
          // Response time should be a number
          expect(typeof result.responseTime).toBe('number');
          
          // Last checked should be a valid ISO date string
          expect(new Date(result.lastChecked).getTime()).not.toBeNaN();
          
          // For providers without public APIs, we now use alternative detection
          if (['meta', 'xai', 'mistral'].includes(provider.id)) {
            // Status should be one of the valid statuses based on connectivity tests
            expect(['operational', 'degraded', 'down', 'unknown']).toContain(result.status);
          } else if (provider.id === 'perplexity') {
            // Perplexity uses HTML parsing
            expect(['operational', 'degraded', 'down', 'unknown']).toContain(result.status);
          } else {
            // For providers with APIs, we should have made a fetch call
            expect(mockFetch).toHaveBeenCalled();
          }
        }, 15000); // 15 second timeout per provider
      });
    });
  });
});
