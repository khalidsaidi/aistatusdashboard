import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Page should load in under 3 seconds
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    
    expect(lcp).toBeLessThan(2500); // Good LCP is under 2.5s
  });

  test('should handle slow network gracefully', async ({ page, browser }) => {
    // Create a context with slow network
    const context = await browser.newContext();
    const slowPage = await context.newPage();
    
    // Slow down all network requests
    await slowPage.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });
    
    await slowPage.goto('/');
    
    // Should eventually load even with slow network - use .first() to avoid strict mode violation
    await expect(slowPage.locator('[data-testid="provider-card"]').first()).toBeVisible({ timeout: 15000 });
    
    await context.close();
  });

  test('should lazy load images', async ({ page }) => {
    await page.goto('/');
    
    // Check if images have loading="lazy" attribute
    const images = await page.$$('img');
    for (const img of images) {
      const loading = await img.getAttribute('loading');
      expect(loading).toBe('lazy');
    }
  });

  test('should have efficient bundle size', async ({ page }) => {
    const resourceSizes: number[] = [];
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('.js') || url.includes('.css')) {
        const headers = response.headers();
        const size = headers['content-length'];
        if (size) {
          resourceSizes.push(parseInt(size));
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const totalSize = resourceSizes.reduce((a, b) => a + b, 0);
    expect(totalSize).toBeLessThan(500000); // Total JS/CSS should be under 500KB
  });

  test('should cache static assets', async ({ page }) => {
    // Visit page twice to test caching
    await page.goto('/');
    
    // Clear any existing data
    await page.context().clearCookies();
    
    // Second visit should use browser cache
    await page.goto('/');
    
    // Verify page loads quickly on second visit (cached resources)
    const loadTime = await page.evaluate(() => performance.timing.loadEventEnd - performance.timing.navigationStart);
    expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds with cache
  });
}); 