import { test, expect } from '@playwright/test';

test.describe('Minimal Smoke Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Basic check - page should have a title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have basic HTML structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for basic HTML elements
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Check for main content
    const main = await page.locator('main, #__next, [role="main"]');
    await expect(main.first()).toBeVisible();
  });
}); 