import { test, expect } from '@playwright/test';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

test.describe('🧭 NAVIGATION UX - User-Friendly Links Only', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test('should never show raw JSON to users via navigation links', async ({ page }) => {
    // Test desktop navigation links
    const desktopNavLinks = await page.locator('nav a, header a').all();
    
    for (const link of desktopNavLinks) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }
      
      // Click the link
      await link.click();
      await page.waitForLoadState('networkidle');
      
      // Check that we're not showing raw JSON
      const pageContent = await page.content();
      const isJsonPage = pageContent.includes('[{') && pageContent.includes('}]') && 
                        !pageContent.includes('<html') && !pageContent.includes('<!DOCTYPE');
      
      expect(isJsonPage).toBe(false);
      
      // Check that we have proper HTML structure
      const hasHtmlStructure = pageContent.includes('<html') || pageContent.includes('<!DOCTYPE');
      expect(hasHtmlStructure).toBe(true);
      
      // Go back to homepage for next test
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
    }
  });

  test('should have API link point to API documentation tab', async ({ page }) => {
    // Find API link in navigation
    const apiLink = page.locator('nav a:has-text("API"), header a:has-text("API")').first();
    await expect(apiLink).toBeVisible();
    
    // Check that it points to the API tab
    const href = await apiLink.getAttribute('href');
    expect(href).toContain('tab=api');
    
    // Click the API link
    await apiLink.click();
    await page.waitForLoadState('networkidle');
    
    // Should be on the API tab with documentation
    await expect(page.locator('text=AI Status Dashboard API')).toBeVisible();
    await expect(page.locator('text=Cloud Function endpoints')).toBeVisible();
    await expect(page.locator('button:has-text("Test")')).toBeVisible();
  });

  test('should have mobile navigation links work correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Open mobile menu
    const mobileMenuButton = page.locator('button[aria-label*="navigation menu"]');
    await mobileMenuButton.click();
    
    // Test mobile navigation links
    const mobileNavLinks = await page.locator('nav a').all();
    
    for (const link of mobileNavLinks) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }
      
      // Click the link
      await link.click();
      await page.waitForLoadState('networkidle');
      
      // Check that we're not showing raw JSON
      const pageContent = await page.content();
      const isJsonPage = pageContent.includes('[{') && pageContent.includes('}]') && 
                        !pageContent.includes('<html') && !pageContent.includes('<!DOCTYPE');
      
      expect(isJsonPage).toBe(false);
      
      // Go back to homepage for next test
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
      
      // Reopen mobile menu for next iteration
      await page.setViewportSize({ width: 375, height: 667 });
      await page.locator('button[aria-label*="navigation menu"]').click();
    }
  });

  test('should have footer links work correctly', async ({ page }) => {
    // Test footer links
    const footerLinks = await page.locator('footer a').all();
    
    for (const link of footerLinks) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('https://github.com')) {
        continue; // Skip external links
      }
      
      // Click the link
      await link.click();
      await page.waitForLoadState('networkidle');
      
      // Check that we're not showing raw JSON for internal links
      if (!href.startsWith('http')) {
        const pageContent = await page.content();
        const isJsonPage = pageContent.includes('[{') && pageContent.includes('}]') && 
                          !pageContent.includes('<html') && !pageContent.includes('<!DOCTYPE');
        
        expect(isJsonPage).toBe(false);
      }
      
      // Go back to homepage for next test
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
    }
  });

  test('should validate all user-facing links have proper content', async ({ page }) => {
    const allLinks = await page.locator('a[href^="/"], a[href^="?"]').all();
    
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (!href || href.includes('/api/') || href.includes('.json') || href.includes('.xml')) {
        continue; // Skip API endpoints and data files
      }
      
      // Click the link
      await link.click();
      await page.waitForLoadState('networkidle');
      
      // Should have proper page structure
      const hasTitle = await page.locator('h1, h2, title').count() > 0;
      expect(hasTitle).toBe(true);
      
      // Should not be raw data
      const pageContent = await page.content();
      const isRawData = (pageContent.includes('[{') && pageContent.includes('}]') && 
                        !pageContent.includes('<html')) ||
                       (pageContent.startsWith('<?xml') && !pageContent.includes('<html'));
      
      expect(isRawData).toBe(false);
      
      // Go back to homepage for next test
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
    }
  });

  test('should have tab switching work via URL parameters', async ({ page }) => {
    // Test direct URL access to API tab
    await page.goto(`${baseUrl}/?tab=api`);
    await page.waitForLoadState('networkidle');
    
    // Should be on API tab
    await expect(page.locator('text=AI Status Dashboard API')).toBeVisible();
    await expect(page.locator('text=Cloud Function endpoints')).toBeVisible();
    
    // Test notifications tab
    await page.goto(`${baseUrl}/?tab=notifications`);
    await page.waitForLoadState('networkidle');
    
    // Should be on notifications tab
    await expect(page.locator('text=Email Alerts')).toBeVisible();
    
    // Test comments tab
    await page.goto(`${baseUrl}/?tab=comments`);
    await page.waitForLoadState('networkidle');
    
    // Should be on comments tab
    await expect(page.locator('text=Community')).toBeVisible();
  });
}); 