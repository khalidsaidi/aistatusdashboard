import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/');
  });

  test('should load the main dashboard page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/AI Status Dashboard/);
    
    // Check main heading
    await expect(page.locator('h1')).toContainText('AI Status Dashboard');
    
    // Check that provider cards are visible
    await expect(page.locator('[data-testid="provider-card"]').first()).toBeVisible();
  });

  test('should display provider status cards', async ({ page }) => {
    // Wait for provider cards to load
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });
    
    // Check that we have multiple provider cards
    const providerCards = page.locator('[data-testid="provider-card"]');
    const cardCount = await providerCards.count();
    expect(cardCount).toBeGreaterThan(5);
    
    // Check that each card has required elements
    const firstCard = providerCards.first();
    await expect(firstCard.locator('[data-testid="provider-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="provider-status"]')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="provider-card"]')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="provider-card"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="provider-card"]')).toBeVisible();
  });

  test('should update status in real-time', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="provider-card"]', { timeout: 10000 });
    
    // Get initial timestamp
    const initialTimestamp = await page.locator('[data-testid="last-updated"]').textContent();
    
    // Wait for update (assuming 60-second refresh)
    await page.waitForTimeout(65000);
    
    // Check if timestamp updated
    const updatedTimestamp = await page.locator('[data-testid="last-updated"]').textContent();
    expect(updatedTimestamp).not.toBe(initialTimestamp);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Block network requests to simulate offline
    await page.route('**/api/**', route => route.abort());
    
    // Reload page
    await page.reload();
    
    // Should show error state or cached data
    await expect(page.locator('body')).not.toContainText('Error 500');
    
    // Should show some indication of network issues
    await expect(page.locator('[data-testid="error-message"], [data-testid="offline-indicator"]')).toBeVisible();
  });
}); 