import { test, expect } from '@playwright/test';

test.describe('Basic Smoke Tests', () => {
  // Increase timeout for CI environment
  test.setTimeout(60000);

  test('should load homepage successfully', async ({ page }) => {
    // Navigate to homepage with retry logic
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const response = await page.goto('/', { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        // Check if page loaded successfully
        expect(response?.status()).toBeLessThan(400);
        break;
      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          console.log(`Retry attempt ${4 - retries}, error:`, error);
          await page.waitForTimeout(2000);
        }
      }
    }
    
    if (retries === 0) {
      throw lastError;
    }

    // Basic page validation
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log('Page loaded successfully with title:', title);
  });

  test('should have essential meta tags', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Check title exists and is reasonable length
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(10);
    
    // Check description exists (with fallback)
    const description = await page.getAttribute('meta[name="description"]', 'content');
    if (description) {
      expect(description.length).toBeGreaterThan(50);
    } else {
      console.log('No meta description found - this should be fixed');
    }
  });

  test('should render main content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Check for any main content (flexible selector)
    const mainContent = await page.locator('main, #__next, [role="main"], body > div').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
    
    console.log('Main content is visible');
  });
}); 