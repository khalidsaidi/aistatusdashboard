import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    const h1 = await page.$$('h1');
    expect(h1).toHaveLength(1);
    
    // Check heading order
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => 
      elements.map(el => ({ 
        level: parseInt(el.tagName[1]), 
        text: el.textContent 
      }))
    );
    
    // Verify no heading levels are skipped
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i].level - headings[i-1].level;
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check status indicators have labels
    const statusDots = await page.$$('.status-dot');
    for (const dot of statusDots) {
      const ariaLabel = await dot.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Status:/);
    }
    
    // Check links have proper labels
    const links = await page.$$('a');
    for (const link of links) {
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Should be able to tab to all interactive elements
    const interactiveElements = await page.$$('a, button, input, select, textarea');
    
    for (let i = 0; i < interactiveElements.length; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement);
      expect(focused).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    
    expect(results.violations).toHaveLength(0);
  });

  test('should work with screen readers', async ({ page }) => {
    await page.goto('/');
    
    // Check for skip links
    const skipLink = await page.$('[href="#main"]');
    expect(skipLink).toBeTruthy();
    
    // Check main content area has proper landmark
    const main = await page.$('main');
    expect(main).toBeTruthy();
    
    // Check for proper page structure
    const nav = await page.$('nav');
    const footer = await page.$('footer');
    expect(nav || footer).toBeTruthy();
  });
}); 