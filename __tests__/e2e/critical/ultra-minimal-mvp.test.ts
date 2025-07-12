import { test, expect } from '@playwright/test';

test.describe('Ultra-Minimal MVP Tests', () => {
  test('should display AI Status Dashboard title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('AI Status Dashboard');
  });

  test('should show at least 2 provider cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');

    const cards = await page.$$('[data-testid="provider-card"]');
    expect(cards.length).toBeGreaterThanOrEqual(2); // OpenAI and Anthropic minimum
  });

  test('should display provider names', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=Anthropic')).toBeVisible();
  });

  test('should show status for each provider', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');

    const statusTexts = await page.$$eval('[data-testid="status-text"]', (elements) =>
      elements.map((el) => el.textContent?.trim() || '')
    );

    statusTexts.forEach((status) => {
      // Remove emoji and any following spaces, handling multi-codepoint emojis
      const statusOnly = status.replace(/^[^A-Z]*/, '').trim();
      expect(['OPERATIONAL', 'DEGRADED', 'DOWN', 'UNKNOWN']).toContain(statusOnly);
    });
  });

  test('should display response times', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');

    const responseTimes = await page.$$('[data-testid="response-time"]');

    for (const timeElement of responseTimes) {
      const text = await timeElement.textContent();
      expect(text).toMatch(/\d+ms/);
    }
  });

  test('should show last updated time', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load and find the last updated text
    await page.waitForLoadState('networkidle');
    
    // Look for the "Last updated:" text in any element (not just p tags)
    const lastUpdatedElement = page.locator('text=Last updated:');
    await expect(lastUpdatedElement).toBeVisible();

    // Wait for the timestamp to be populated (not "Loading...")
    await page.waitForFunction(
      () => {
        const elements = Array.from(document.querySelectorAll('*'));
        const lastUpdatedElement = elements.find((el) => 
          el.textContent?.includes('Last updated:') && 
          !el.textContent?.includes('Loading...')
        );
        return lastUpdatedElement && lastUpdatedElement.textContent?.match(/\d{1,2}:\d{2}:\d{2}/);
      },
      { timeout: 15000 }
    );

    // Verify the format contains time
    const timeText = await lastUpdatedElement.textContent();
    expect(timeText).toMatch(/Last updated:.*\d{1,2}:\d{2}:\d{2}/);
  });

  test('should indicate auto-refresh', async ({ page }) => {
    await page.goto('/');

    const refreshText = await page.locator('text=Updates every 60 seconds');
    await expect(refreshText).toBeVisible();
  });

  test('should have proper color coding for status', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');

    // Check that operational status has green styling
    const operationalCard = await page
      .locator('[data-testid="provider-card"]')
      .filter({
        hasText: 'OPERATIONAL',
      })
      .first();

    if ((await operationalCard.count()) > 0) {
      await expect(operationalCard).toHaveClass(/border-green-500/);
    }
  });

  // Remove loading state test as it doesn't apply to static export
  // Static sites have pre-rendered content, no loading state

  // Remove error state test as it doesn't apply to static export
  // Errors are handled at build time for static sites
});
