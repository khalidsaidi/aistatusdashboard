import { test, expect } from '@playwright/test';

test.describe('Dashboard Integration', () => {
  test('should load and display status data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for data to load
    await page.waitForSelector('text=AI Status Dashboard');
    
    // Check for provider cards
    const providerCards = await page.$$('[data-testid="provider-card"]');
    expect(providerCards.length).toBeGreaterThan(0);
    
    // Verify auto-refresh message
    await expect(page.locator('text=Updates every 60 seconds')).toBeVisible();
  });

  test('should show last updated time', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Last updated:');
    
    const timeText = await page.textContent('[data-testid="last-updated"]');
    expect(timeText).toMatch(/Last updated: .+ ago/);
  });

  test('should display provider status correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for providers to load
    await page.waitForSelector('[data-testid="provider-card"]');
    
    // Check OpenAI card
    const openAICard = await page.locator('[data-testid="provider-openai"]');
    await expect(openAICard).toBeVisible();
    
    // Check for status indicator
    const statusIndicator = await openAICard.locator('.status-dot');
    await expect(statusIndicator).toBeVisible();
    
    // Check for response time
    const responseTime = await openAICard.locator('[data-testid="response-time"]');
    await expect(responseTime).toContainText('ms');
  });

  test('should link to official status pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    // Check that each provider has a link to official status
    const officialLinks = await page.$$('[data-testid="official-status-link"]');
    expect(officialLinks.length).toBeGreaterThan(0);
    
    // Verify link has correct attributes
    const firstLink = await page.locator('[data-testid="official-status-link"]').first();
    await expect(firstLink).toHaveAttribute('target', '_blank');
    await expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Simulate API failure
    await page.route('/api/status', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto('/');
    
    // Should show error state
    await expect(page.locator('text=Error loading status')).toBeVisible();
  });

  test('should auto-refresh data', async ({ page }) => {
    await page.goto('/');
    
    // Get initial last updated time
    await page.waitForSelector('[data-testid="last-updated"]');
    const initialTime = await page.textContent('[data-testid="last-updated"]');
    
    // Wait for auto-refresh (faster refresh simulation for testing)
    await page.waitForTimeout(2000);
    
    // Check if data has been refreshed
    const updatedTime = await page.textContent('[data-testid="last-updated"]');
    expect(updatedTime).not.toBe(initialTime);
  });
}); 