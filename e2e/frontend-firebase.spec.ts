/**
 * Frontend Firebase Integration Tests
 * 
 * These tests would have caught the Firebase API key error
 * by actually loading the page in a browser environment
 */

import { chromium, Browser, Page } from 'playwright';

describe('Frontend Firebase Integration', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });
  });

  afterEach(async () => {
    await page.close();
  });

  it('should load homepage without Firebase errors', async () => {
    const errors: string[] = [];
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Firebase')) {
        errors.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      if (error.message.includes('Firebase')) {
        errors.push(error.message);
      }
    });

    // Navigate to homepage
    await page.goto(baseUrl);
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for Firebase initialization
    await page.waitForTimeout(3000);

    // Check for Firebase errors
    expect(errors).toHaveLength(0);
    
    // Verify page loaded successfully
    const title = await page.title();
    expect(title).toContain('AI Status Dashboard');
  });

  it('should have valid Firebase configuration', async () => {
    await page.goto(baseUrl);
    
    // Check if Firebase config is properly set
    const firebaseConfig = await page.evaluate(() => {
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasValidApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_firebase_api_key_here'
      };
    });

    expect(firebaseConfig.hasValidApiKey).toBe(true);
    expect(firebaseConfig.apiKey).toBeTruthy();
    expect(firebaseConfig.projectId).toBeTruthy();
  });

  it('should not have 404 errors for critical resources', async () => {
    const failedRequests: string[] = [];
    
    page.on('response', (response) => {
      if (response.status() === 404) {
        failedRequests.push(response.url());
      }
    });

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Filter out non-critical 404s
    const criticalFailures = failedRequests.filter(url => 
      !url.includes('favicon') && 
      !url.includes('manifest') &&
      !url.includes('browserconfig')
    );

    expect(criticalFailures).toHaveLength(0);
  });

  it('should display status dashboard correctly', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Wait for status data to load
    await page.waitForSelector('[data-testid="status-dashboard"], .status-dashboard, h1', { timeout: 10000 });

    // Check if dashboard elements are present
    const hasStatusInfo = await page.locator('text=Operational').count() > 0;
    const hasProviderCards = await page.locator('[class*="provider"], [class*="card"]').count() > 0;
    
    expect(hasStatusInfo || hasProviderCards).toBe(true);
  });

  it('should handle real-time updates without errors', async () => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Wait for potential real-time updates
    await page.waitForTimeout(5000);

    // Check for JavaScript errors during updates
    const jsErrors = errors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('manifest')
    );

    expect(jsErrors).toHaveLength(0);
  });
}); 