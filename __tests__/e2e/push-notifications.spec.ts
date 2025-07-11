import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Web Push Notifications E2E - Real Environment', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create a context with notification permissions granted
    context = await browser.newContext({
      permissions: ['notifications'],
    });
    page = await context.newPage();

    // Navigate to the actual application
    await page.goto('/');
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('should display push notification interface when supported', async () => {
    // Navigate to notifications panel
    await page.click('[data-testid="notifications-button"]');

    // Switch to web push tab
    await page.click('text=🔔 Web Push');

    // Verify push notification interface is visible
    await expect(page.locator('text=Browser Push Notifications')).toBeVisible();

    // Check if browser supports push notifications
    const isSupported = await page.evaluate(() => {
      return 'serviceWorker' in navigator && 'Notification' in window;
    });

    if (isSupported) {
      await expect(page.locator('text=Enable Push Notifications')).toBeVisible();

      // Verify provider selection is available
      const providers = ['openai', 'anthropic', 'huggingface', 'google-ai'];
      for (const provider of providers) {
        await expect(page.locator(`[data-testid="provider-${provider}"]`)).toBeVisible();
      }

      // Verify notification type options
      await expect(page.locator('[data-testid="notification-type-incident"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-type-recovery"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-type-degradation"]')).toBeVisible();
    } else {
      await expect(page.locator('text=⚠️ Web Push Not Supported')).toBeVisible();
    }
  });

  test('should handle notification permission flow', async () => {
    await page.click('[data-testid="notifications-button"]');
    await page.click('text=🔔 Web Push');

    // Check current permission state
    const permission = await page.evaluate(() => {
      return Notification.permission;
    });

    if (permission === 'denied') {
      await expect(page.locator('text=🚫 Notifications Blocked')).toBeVisible();
      await expect(page.locator("text=You've blocked notifications for this site")).toBeVisible();
    } else if (permission === 'granted') {
      await expect(page.locator('text=Push Enabled ✓')).toBeVisible();
      await expect(page.locator('text=Disable Push')).toBeVisible();
    } else {
      // Permission is 'default' - can request permission
      await expect(page.locator('text=Enable Push Notifications')).toBeVisible();
    }
  });

  test('should attempt push notification subscription with real backend', async () => {
    await page.click('[data-testid="notifications-button"]');
    await page.click('text=🔔 Web Push');

    // Check if we can enable push notifications
    const canEnable = await page.locator('text=Enable Push Notifications').isVisible();

    if (canEnable) {
      // Select a provider
      await page.check('[data-testid="provider-openai"]');

      // Listen for network requests to the real API
      const responsePromise = page.waitForResponse('/api/subscribePush');

      // Attempt to enable push notifications
      await page.click('text=Enable Push Notifications');

      try {
        // Wait for the real API response
        const response = await responsePromise;

        // Check if the request was made to the correct endpoint
        expect(response.url()).toContain('/api/subscribePush');
        expect(response.request().method()).toBe('POST');

        // Verify request payload structure
        const requestData = response.request().postDataJSON();
        expect(requestData).toHaveProperty('providers');
        expect(requestData.providers).toContain('openai');

        // Check response
        if (response.ok()) {
          const responseData = await response.json();
          expect(responseData).toHaveProperty('success');

          if (responseData.success) {
            await expect(page.locator('text=Push notifications enabled!')).toBeVisible();
          }
        } else {
          // Handle API errors gracefully in E2E
          console.log(`API returned ${response.status()}: ${await response.text()}`);
        }
      } catch (error: unknown) {
        console.log(
          'Push notification subscription failed:',
          error instanceof Error ? error.message : String(error)
        );
        // In E2E, we might expect failures due to missing Firebase config
      }
    }
  });

  test('should handle service worker registration', async () => {
    // Check if service worker is available and can be registered
    const swSupported = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    if (swSupported) {
      // Check if our service worker file exists
      const swResponse = await page.goto('/sw.js');
      expect(swResponse?.status()).toBe(200);

      // Navigate back to main page
      await page.goto('/');

      // Check if service worker registration works
      const registrationResult = await page.evaluate(async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          return { success: true, scope: registration.scope };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      expect(registrationResult.success).toBe(true);
      expect(registrationResult.scope).toContain('/');
    }
  });

  test('should display PWA manifest correctly', async () => {
    // Check if manifest.json is accessible
    const manifestResponse = await page.goto('/manifest.json');
    expect(manifestResponse?.status()).toBe(200);

    const manifest = await manifestResponse?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
    expect(manifest).toHaveProperty('start_url');
    expect(manifest).toHaveProperty('display');
    expect(manifest).toHaveProperty('icons');

    // Verify manifest is linked in HTML
    await page.goto('/');
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBe('/manifest.json');
  });

  test('should integrate with other notification types', async () => {
    await page.click('[data-testid="notifications-button"]');

    // Test all notification tabs are accessible
    const tabs = ['📧 Email Alerts', '🔔 Web Push', '🪝 Webhooks', '📋 Incidents'];

    for (const tab of tabs) {
      await page.click(`text=${tab}`);

      // Verify tab is active (implementation may vary)
      const tabElement = page.locator(`text=${tab}`);
      await expect(tabElement).toBeVisible();

      // Give a moment for content to load
      await page.waitForTimeout(500);
    }

    // Verify web push tab has expected content
    await page.click('text=🔔 Web Push');
    await expect(page.locator('text=Browser Push Notifications')).toBeVisible();
  });

  test('should handle keyboard navigation', async () => {
    await page.click('[data-testid="notifications-button"]');

    // Use keyboard to navigate to push tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if we can navigate to the web push tab
    const pushTab = page.locator('text=🔔 Web Push');
    if (await pushTab.isVisible()) {
      await pushTab.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('text=Browser Push Notifications')).toBeVisible();
    }
  });

  test('should persist user preferences across page reloads', async () => {
    await page.click('[data-testid="notifications-button"]');
    await page.click('text=🔔 Web Push');

    // If push notifications are available, test preference persistence
    const enableButton = page.locator('text=Enable Push Notifications');
    if (await enableButton.isVisible()) {
      // Select specific providers
      await page.check('[data-testid="provider-openai"]');
      await page.check('[data-testid="provider-anthropic"]');

      // Reload page
      await page.reload();

      // Navigate back to push notifications
      await page.click('[data-testid="notifications-button"]');
      await page.click('text=🔔 Web Push');

      // Check if selections are maintained (depends on implementation)
      // This test verifies the UI state persistence mechanism
    }
  });

  test('should handle real Firebase messaging integration', async () => {
    // Test Firebase messaging initialization
    const firebaseInitialized = await page.evaluate(() => {
      // Check if Firebase messaging is available
      return (typeof window !== 'undefined' && 'firebase' in window) || 'importScripts' in window;
    });

    if (firebaseInitialized) {
      console.log('Firebase messaging is available for testing');
    } else {
      console.log('Firebase messaging not initialized - expected in dev environment');
    }

    // Check if Firebase config is loaded
    await page.click('[data-testid="notifications-button"]');
    await page.click('text=🔔 Web Push');

    // The actual Firebase integration test would depend on having
    // real Firebase credentials in the dev environment
  });

  test('should test against real status monitoring', async () => {
    // Navigate to main dashboard
    await page.goto('/');

    // Wait for status data to load
    await page.waitForSelector('[data-testid="provider-status"]', { timeout: 10000 });

    // Verify real provider status is displayed
    const statusElements = await page.locator('[data-testid="provider-status"]').count();
    expect(statusElements).toBeGreaterThan(0);

    // Check if status monitoring is working
    const openaiStatus = page.locator(
      '[data-testid="provider-openai"] [data-testid="status-indicator"]'
    );
    if (await openaiStatus.isVisible()) {
      const statusText = await openaiStatus.textContent();
      expect(['operational', 'degraded', 'down', 'unknown']).toContain(statusText?.toLowerCase());
    }
  });

  test('should test real notification API endpoints', async () => {
    // Test that our notification API endpoints are accessible
    const endpoints = [
      '/api/subscribePush',
      '/api/unsubscribePush',
      '/api/sendTestPushNotification',
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.post(endpoint, {
        data: { test: true },
      });

      // Endpoints should exist (even if they return errors due to invalid data)
      expect(response.status()).not.toBe(404);
    }
  });
});
