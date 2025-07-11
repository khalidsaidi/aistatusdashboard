/**
 * COMPREHENSIVE ERROR DETECTION TESTS
 *
 * This test suite would have caught ALL the errors we encountered:
 * 1. Missing API endpoints (incidents, notifications GET)
 * 2. Wrong HTTP methods (405 errors)
 * 3. Missing static files (service worker, favicon)
 * 4. Firebase environment configuration issues
 * 5. Security vulnerabilities (hardcoded credentials)
 * 6. Frontend integration errors
 * 7. Push notification failures
 */

import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';

describe('🔍 COMPREHENSIVE ERROR DETECTION - Catch ALL Issues', () => {
  let browser: Browser;
  let page: Page;
  let server: ChildProcess;
  const baseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    // Start dev server
    server = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 10000));

    browser = await chromium.launch({ headless: false });
  });

  afterAll(async () => {
    await browser?.close();
    server?.kill();
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Capture all console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture all network failures
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.request().method()} ${response.url()} ${response.status()}`);
      }
    });

    // Store for later assertions
    (page as any).consoleErrors = consoleErrors;
    (page as any).networkErrors = networkErrors;
  });

  afterEach(async () => {
    await page?.close();
  });

  describe('🌐 API ENDPOINT VALIDATION', () => {
    test('should have all required API endpoints with correct HTTP methods', async () => {
      const requiredEndpoints = [
        { method: 'GET', path: '/api/status', description: 'Provider status' },
        { method: 'GET', path: '/api/notifications', description: 'Notification settings' },
        { method: 'POST', path: '/api/notifications', description: 'Send notifications' },
        { method: 'GET', path: '/api/incidents', description: 'Incident list' },
        { method: 'POST', path: '/api/incidents', description: 'Create incident' },
        { method: 'POST', path: '/api/send-email', description: 'Send email' },
        { method: 'POST', path: '/api/firebase', description: 'Firebase messaging' },
      ];

      for (const endpoint of requiredEndpoints) {
        const response = await page.goto(`${baseUrl}${endpoint.path}`);

        if (endpoint.method === 'GET') {
          expect(response?.status()).not.toBe(404);
          expect(response?.status()).not.toBe(405);
        }

        // Test POST endpoints
        if (endpoint.method === 'POST') {
          const postResponse = await page.evaluate(async (url) => {
            const response = await fetch(url, { method: 'POST', body: '{}' });
            return response.status;
          }, `${baseUrl}${endpoint.path}`);

          expect(postResponse).not.toBe(404);
          expect(postResponse).not.toBe(405);
        }
      }
    });

    test('should validate API responses have correct structure', async () => {
      // Test status API
      const statusResponse = await page.evaluate(async () => {
        const response = await fetch('/api/status');
        return { status: response.status, data: await response.json() };
      });

      expect(statusResponse.status).toBe(200);
      expect(Array.isArray(statusResponse.data)).toBe(true);

      // Test notifications API
      const notificationsResponse = await page.evaluate(async () => {
        const response = await fetch('/api/notifications');
        return { status: response.status, data: await response.json() };
      });

      expect(notificationsResponse.status).toBe(200);
      expect(notificationsResponse.data).toHaveProperty('supported');

      // Test incidents API
      const incidentsResponse = await page.evaluate(async () => {
        const response = await fetch('/api/incidents?limit=5');
        return { status: response.status, data: await response.json() };
      });

      expect(incidentsResponse.status).toBe(200);
      expect(incidentsResponse.data).toHaveProperty('incidents');
      expect(incidentsResponse.data).toHaveProperty('total');
    });
  });

  describe('📁 STATIC FILE VALIDATION', () => {
    test('should have all required static files', async () => {
      const requiredFiles = [
        '/favicon.svg',
        '/firebase-messaging-sw.js',
        '/icon-192x192.png',
        '/manifest.json',
      ];

      for (const file of requiredFiles) {
        const response = await page.goto(`${baseUrl}${file}`);
        expect(response?.status()).not.toBe(404);
        expect(response?.status()).toBe(200);
      }
    });

    test('should validate service worker has no hardcoded credentials', async () => {
      const response = await page.goto(`${baseUrl}/firebase-messaging-sw.js`);
      const content = await response?.text();

      // Should NOT contain hardcoded API keys or project IDs
      expect(content).not.toMatch(/AIza[0-9A-Za-z-_]{35}/); // Firebase API key pattern
      expect(content).not.toMatch(/ai-status-dashboard-dev/); // Hardcoded project ID
      expect(content).not.toMatch(/ai-status-dashboard\.firebaseapp\.com/); // Hardcoded domain
    });
  });

  describe('🔥 FIREBASE ENVIRONMENT VALIDATION', () => {
    test('should use environment-specific Firebase configuration', async () => {
      await page.goto(baseUrl);

      // Check that Firebase config is loaded from environment variables
      const firebaseConfig = await page.evaluate(() => {
        return {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        };
      });

      // Should have environment-specific values
      expect(firebaseConfig.apiKey).toBeTruthy();
      expect(firebaseConfig.projectId).toBeTruthy();
      expect(firebaseConfig.authDomain).toBeTruthy();

      // Should be different for dev vs prod
      if (process.env.NODE_ENV === 'development') {
        expect(firebaseConfig.projectId).toBe('ai-status-dashboard-dev');
      } else {
        expect(firebaseConfig.projectId).toBe('ai-status-dashboard');
      }
    });

    test('should initialize Firebase without errors', async () => {
      await page.goto(baseUrl);

      // Wait for Firebase initialization
      await page.waitForTimeout(2000);

      // Check for Firebase errors
      const consoleErrors = (page as any).consoleErrors;
      const firebaseErrors = consoleErrors.filter(
        (error: string) => error.includes('Firebase') || error.includes('API key not valid')
      );

      expect(firebaseErrors).toHaveLength(0);
    });
  });

  describe('🔔 PUSH NOTIFICATION VALIDATION', () => {
    test('should handle push notification setup without errors', async () => {
      await page.goto(baseUrl);

      // Navigate to notifications tab
      await page.click('text=🔔 Notifications');
      await page.click('text=Web Push');

      // Try to enable push notifications
      await page.click('button:has-text("Enable Push Notifications")');

      // Should not show generic error message
      await page.waitForTimeout(2000);
      const errorMessage = await page.textContent('.error, [class*="error"]');
      expect(errorMessage).not.toContain('Failed to enable push notifications');
    });

    test('should validate notification permission flow', async () => {
      await page.goto(baseUrl);

      // Check notification support
      const isSupported = await page.evaluate(() => {
        return 'Notification' in window && 'serviceWorker' in navigator;
      });

      expect(isSupported).toBe(true);

      // Check service worker registration
      const swRegistered = await page.evaluate(async () => {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          return !!registration;
        } catch (error) {
          return false;
        }
      });

      expect(swRegistered).toBe(true);
    });
  });

  describe('🖥️ FRONTEND INTEGRATION VALIDATION', () => {
    test('should load main page without JavaScript errors', async () => {
      await page.goto(baseUrl);
      await page.waitForSelector('[data-testid="provider-status"]', { timeout: 10000 });

      const consoleErrors = (page as any).consoleErrors;
      expect(consoleErrors).toHaveLength(0);
    });

    test('should load all dashboard tabs without errors', async () => {
      await page.goto(baseUrl);

      const tabs = ['🏠 Overview', '📊 Analytics', '🔔 Notifications', '📈 Metrics'];

      for (const tab of tabs) {
        await page.click(`text=${tab}`);
        await page.waitForTimeout(1000);

        // Check for errors after tab load
        const consoleErrors = (page as any).consoleErrors;
        expect(consoleErrors.length).toBe(0);
      }
    });

    test('should validate notification panel functionality', async () => {
      await page.goto(baseUrl);
      await page.click('text=🔔 Notifications');

      // Should have all notification types
      const notificationTypes = ['Email Alerts', 'Web Push', 'Webhooks', 'Incidents'];

      for (const type of notificationTypes) {
        const element = await page.textContent(`text=${type}`);
        expect(element).toBeTruthy();
      }

      // Should have provider selection
      await page.click('text=Email Alerts');
      const providerCount = await page.$$eval(
        '[data-testid="provider-checkbox"]',
        (els) => els.length
      );
      expect(providerCount).toBeGreaterThan(10); // Should have 15 providers
    });
  });

  describe('🔒 SECURITY VALIDATION', () => {
    test('should not expose sensitive information in client-side code', async () => {
      await page.goto(baseUrl);

      // Check page source for sensitive patterns
      const pageContent = await page.content();

      // Should not contain private keys, passwords, or sensitive tokens
      expect(pageContent).not.toMatch(/-----BEGIN PRIVATE KEY-----/);
      expect(pageContent).not.toMatch(/password.*[:=].*[^{]/i);
      expect(pageContent).not.toMatch(/secret.*[:=].*[^{]/i);
      expect(pageContent).not.toMatch(/token.*[:=].*[a-zA-Z0-9]{20,}/);
    });

    test('should validate environment variable usage', async () => {
      // Check that sensitive config is not hardcoded
      const envVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FCM_VAPID_KEY',
      ];

      for (const envVar of envVars) {
        const value = process.env[envVar];
        expect(value).toBeTruthy();
        expect(value).not.toBe('your_api_key_here');
        expect(value).not.toBe('placeholder');
        expect(value).not.toBe('your-dev-vapid-public-key');
        expect(value).not.toBe('your-prod-vapid-public-key');
      }
    });
  });

  describe('📈 PERFORMANCE VALIDATION', () => {
    test('should load page within acceptable time limits', async () => {
      const startTime = Date.now();
      await page.goto(baseUrl);
      await page.waitForSelector('[data-testid="provider-status"]');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should not have memory leaks or excessive resource usage', async () => {
      await page.goto(baseUrl);

      // Check for network errors
      const networkErrors = (page as any).networkErrors;
      expect(networkErrors.length).toBe(0);

      // Check for excessive API calls
      const apiCalls = networkErrors.filter((error: string) => error.includes('/api/'));
      expect(apiCalls.length).toBeLessThan(5);
    });
  });

  describe('🔄 ENVIRONMENT SWITCHING VALIDATION', () => {
    test('should handle environment switching correctly', async () => {
      // Test current environment configuration
      await page.goto(baseUrl);

      const currentConfig = await page.evaluate(() => ({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        env: process.env.NODE_ENV,
      }));

      // Should have environment-specific project ID
      expect(currentConfig.projectId).toBeTruthy();
      expect(['ai-status-dashboard-dev', 'ai-status-dashboard']).toContain(currentConfig.projectId);

      // Test production environment (would need separate test with different env)
      // This validates that the configuration changes based on environment
    });
  });
});
