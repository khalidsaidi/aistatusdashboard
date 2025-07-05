import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch for API calls
(global as any).fetch = jest.fn();

// Base URL for Cloud Functions
const CLOUD_FUNCTIONS_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api';

describe('API Endpoints Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ((global as any).fetch as jest.Mock).mockClear();
  });

  describe('/api/status endpoint', () => {
    it('should return all providers status without 503 errors', async () => {
      // This test will initially fail because API demo buttons return 503
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status`);
      
      expect(response.status).not.toBe(503); // Should not be Service Unavailable
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('providers');
      expect(Array.isArray(data.providers)).toBe(true);
      expect(data.summary).toHaveProperty('total');
      expect(data.summary).toHaveProperty('operational');
      expect(data.summary).toHaveProperty('degraded');
      expect(data.summary).toHaveProperty('down');
    });

    it('should return single provider status when provider query is specified', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status?provider=openai`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('id', 'openai');
      expect(data).toHaveProperty('name', 'OpenAI');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('responseTime');
      expect(data).toHaveProperty('statusPageUrl');
      expect(['operational', 'degraded', 'down']).toContain(data.status);
    });

    it('should return 404 for non-existent provider', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status?provider=nonexistent`);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Provider not found');
    });

    it('should handle rate limiting', async () => {
      // Simulate many requests
      const requests = Array(70).fill(null).map(() => fetch(`${CLOUD_FUNCTIONS_BASE}/status`));
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('/api/health endpoint', () => {
    it('should return system health summary without 503 errors', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('totalProviders');
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('unhealthy');
      expect(data).toHaveProperty('avgResponseTime');
      expect(data).toHaveProperty('providers');
      expect(Array.isArray(data.providers)).toBe(true);
    });

    it('should force fresh health check when force=true', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health?force=true`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('providers');
      expect(data.providers.length).toBeGreaterThan(0);
      
      // Should have recent timestamps when forced
      data.providers.forEach((provider: any) => {
        const lastChecked = new Date(provider.lastChecked);
        const now = new Date();
        const timeDiff = now.getTime() - lastChecked.getTime();
        expect(timeDiff).toBeLessThan(60000); // Within last minute
      });
    });

    it('should use cached results when force=false', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health?force=false`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('providers');
    });

    it('should handle rate limiting', async () => {
      // Simulate many requests
      const requests = Array(35).fill(null).map(() => fetch(`${CLOUD_FUNCTIONS_BASE}/health`));
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('API Demo Button Functionality', () => {
    it('should handle Get All Providers Status button', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.providers).toBeDefined();
      expect(data.providers.length).toBeGreaterThan(0);
    });

    it('should handle System Health Check button', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.totalProviders).toBeGreaterThan(0);
    });

    it('should handle Single Provider Status button', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status?provider=openai`);
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.id).toBe('openai');
    });

    it('should handle Webhook Registration button', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/subscribeWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: 'https://example.com/webhook',
          providers: ['openai']
        })
      });
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle Test Email Notification button', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/sendTestNotification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com'
        })
      });
      
      expect(response.status).not.toBe(503);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for invalid provider', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status?provider=invalid`);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Provider not found');
    });

    it('should handle malformed webhook requests', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/subscribeWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate webhook required parameters', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/subscribeWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing required fields
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should validate email notification required parameters', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/sendTestNotification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing email
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent JSON format for status endpoint', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/status`);
      const data = await response.json();
      
      expect(data).toMatchObject({
        timestamp: expect.any(String),
        summary: {
          total: expect.any(Number),
          operational: expect.any(Number),
          degraded: expect.any(Number),
          down: expect.any(Number),
          unknown: expect.any(Number)
        },
        providers: expect.any(Array)
      });
      
      // Validate provider structure
      if (data.providers.length > 0) {
        data.providers.forEach((provider: any) => {
          expect(provider).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            status: expect.any(String),
            responseTime: expect.any(Number),
            statusCode: expect.any(Number),
            lastChecked: expect.any(String),
            statusPageUrl: expect.any(String)
          });
        });
      }
    });

    it('should return consistent JSON format for health endpoint', async () => {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health`);
      const data = await response.json();
      
      expect(data).toMatchObject({
        timestamp: expect.any(String),
        totalProviders: expect.any(Number),
        healthy: expect.any(Number),
        unhealthy: expect.any(Number),
        avgResponseTime: expect.any(Number),
        providers: expect.any(Array)
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/health`);
      const endTime = Date.now();
      
      expect(response.ok).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => fetch(`${CLOUD_FUNCTIONS_BASE}/status`));
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500); // No server errors
      });
    });
  });
}); 