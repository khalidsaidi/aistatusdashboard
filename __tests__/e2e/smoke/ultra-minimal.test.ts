import { test, expect } from '@playwright/test';

test.describe('Ultra Minimal Smoke Test', () => {
  test('homepage loads and has title', async ({ page }) => {
    // Navigate with minimal waiting
    await page.goto('/', { timeout: 10000 });
    
    // Just check the title exists
    const title = await page.title();
    expect(title).toBeTruthy();
    
    console.log('✅ Ultra minimal test passed - title:', title);
  });
}); 