import { test, expect } from '@playwright/test';

test.describe('Hydration Tests', () => {
  test('should not have hydration mismatches', async ({ page }) => {
    // Set up error tracking
    const hydrationErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        
        // Check for hydration-specific errors
        if (text.includes('Hydration failed') || 
            text.includes('Text content does not match') ||
            text.includes('server-rendered HTML')) {
          hydrationErrors.push(text);
        }
      }
    });

    page.on('pageerror', error => {
      const message = error.message;
      consoleErrors.push(message);
      
      // Check for hydration errors
      if (message.includes('Hydration failed') || 
          message.includes('Text content does not match') ||
          message.includes('server-rendered HTML')) {
        hydrationErrors.push(message);
      }
    });

    // Navigate to the page
    await page.goto('/');
    
    // Wait for hydration to complete
    await page.waitForLoadState('networkidle');
    
    // Additional wait for any delayed hydration
    await page.waitForTimeout(2000);

    // Check for hydration errors
    expect(hydrationErrors).toHaveLength(0);
    
    // Log any console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    }
  });

  test('should have consistent server and client timestamps', async ({ page }) => {
    await page.goto('/');
    
    // Wait for client-side hydration
    await page.waitForTimeout(1000);
    
    // Get the timestamp text
    const timestampElement = await page.locator('text=Last updated:');
    const timestampText = await timestampElement.textContent();
    
    expect(timestampText).not.toContain('Loading...');
    expect(timestampText).toMatch(/Last updated: \d{1,2}:\d{2}:\d{2}/);
  });

  test('should handle client-side state changes without hydration issues', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForSelector('[data-testid="tab-dashboard"], button:has-text("Status Dashboard")', { timeout: 10000 });
    
    // Switch between tabs to test client-side navigation
    const commentTab = await page.locator('button:has-text("Comments")');
    await commentTab.click();
    
    // Wait for comment section to load
    await page.waitForSelector('text=Dashboard Comments & Feedback', { timeout: 5000 });
    
    // Switch back to dashboard
    const dashboardTab = await page.locator('button:has-text("Status Dashboard")');
    await dashboardTab.click();
    
    // Verify dashboard content is visible
    await page.waitForSelector('text=System Health', { timeout: 5000 });
    
    // No hydration errors should occur during client-side navigation
    const hasHydrationError = await page.evaluate(() => {
      const errors = (window as any).__hydrationErrors || [];
      return errors.length > 0;
    });
    
    expect(hasHydrationError).toBe(false);
  });

  test('should not have layout shift during hydration', async ({ page }) => {
    await page.goto('/');
    
    // Measure initial layout
    const initialLayout = await page.evaluate(() => {
      const element = document.querySelector('h1');
      return element ? element.getBoundingClientRect() : null;
    });
    
    // Wait for hydration
    await page.waitForTimeout(2000);
    
    // Measure layout after hydration
    const finalLayout = await page.evaluate(() => {
      const element = document.querySelector('h1');
      return element ? element.getBoundingClientRect() : null;
    });
    
    // Layout should be stable (no significant shift)
    expect(initialLayout).toEqual(finalLayout);
  });

  test('should handle time-sensitive content properly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial render
    await page.waitForSelector('text=Last updated:');
    const initialTimestamp = await page.locator('text=Last updated:').textContent();
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // Get updated timestamp
    const updatedTimestamp = await page.locator('text=Last updated:').textContent();
    
    // Both should be valid timestamp formats
    expect(initialTimestamp).toMatch(/Last updated: \d{1,2}:\d{2}:\d{2}/);
    expect(updatedTimestamp).toMatch(/Last updated: \d{1,2}:\d{2}:\d{2}/);
  });
}); 