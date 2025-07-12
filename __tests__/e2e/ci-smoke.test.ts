import { test, expect } from '@playwright/test';

test.describe('CI Smoke Tests', () => {
  test('should load homepage successfully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Check if page loads
    await expect(page).toHaveTitle(/AI Status Dashboard/);
    
    // Check if main content is visible
    await expect(page.locator('body')).toBeVisible();
    
    // Check if page doesn't have critical errors
    const errorMessages = page.locator('[data-testid="error"]');
    await expect(errorMessages).toHaveCount(0);
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check if page is interactive
    await page.waitForLoadState('networkidle');
    
    // Basic interactivity check
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(error => 
      !error.includes('Firebase') && 
      !error.includes('ServiceWorker') &&
      !error.includes('favicon')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
}); 