import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test('should display correctly on mobile devices', async ({ browser }) => {
    const iPhone = devices['iPhone 12'];
    const context = await browser.newContext({
      ...iPhone,
    });
    const page = await context.newPage();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    // Check viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(400);
    
    // Cards should stack vertically
    const cards = await page.$$('[data-testid="provider-card"]');
    const positions = await Promise.all(
      cards.map(async (card) => {
        const box = await card.boundingBox();
        return box;
      })
    );
    
    // Verify cards are stacked (same x position)
    const xPositions = positions.map(p => p?.x || 0);
    const uniqueX = Array.from(new Set(xPositions));
    expect(uniqueX.length).toBe(1);
    
    await context.close();
  });

  test('should have touch-friendly tap targets', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();
    
    await page.goto('/');
    
    // Check all clickable elements
    const clickables = await page.$$('a, button');
    
    for (const element of clickables) {
      const box = await element.boundingBox();
      if (box) {
        const tagName = await element.evaluate(el => el.tagName);
        const textContent = await element.evaluate(el => el.textContent?.trim() || '');
        const className = await element.evaluate(el => el.className);
        
        // Touch targets should be at least 44x44px (iOS guideline)
        try {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        } catch (error) {
          console.log(`Failed element: ${tagName} with text "${textContent}" and class "${className}" - Size: ${box.width}x${box.height}`);
          throw error;
        }
      }
    }
    
    await context.close();
  });

  test('should handle landscape orientation', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12 landscape'],
    });
    const page = await context.newPage();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="provider-card"]');
    
    // Content should still be readable
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 0;
    
    // No horizontal scroll
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    
    await context.close();
  });

  test('should have readable text on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();
    
    await page.goto('/');
    
    // Check font sizes
    const textElements = await page.$$('p, span, h1, h2, h3');
    
    for (const element of textElements) {
      const fontSize = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        const fontSizeValue = style.fontSize;
        // Convert font size to pixels for comparison
        if (fontSizeValue.includes('px')) {
          return parseFloat(fontSizeValue.replace('px', ''));
        } else if (fontSizeValue.includes('rem')) {
          const remValue = parseFloat(fontSizeValue.replace('rem', ''));
          const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
          return remValue * rootFontSize;
        } else if (fontSizeValue.includes('em')) {
          const emValue = parseFloat(fontSizeValue.replace('em', ''));
          const parentFontSize = parseFloat(getComputedStyle(el.parentElement || document.body).fontSize);
          return emValue * parentFontSize;
        }
        return parseFloat(fontSizeValue) || 14; // fallback to 14px
      });
      
      expect(fontSize).toBeGreaterThanOrEqual(12); // Minimum readable size
    }
    
    await context.close();
  });

  test('should have mobile-optimized navigation', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();
    
    await page.goto('/');
    
    // Check if there's a mobile menu or simplified navigation
    const mobileMenu = await page.$('[data-testid="mobile-menu"]');
    const desktopNav = await page.$('[data-testid="desktop-nav"]');
    
    if (mobileMenu) {
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }
    
    if (desktopNav) {
      await expect(page.locator('[data-testid="desktop-nav"]')).toBeHidden();
    }
    
    await context.close();
  });

  test('should optimize images for mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();
    
    await page.goto('/');
    
    const images = await page.$$('img');
    
    for (const img of images) {
      const src = await img.getAttribute('src');
      const srcset = await img.getAttribute('srcset');
      
      // Should have responsive images
      expect(src || srcset).toBeTruthy();
      
      // Check image dimensions don't exceed viewport
      const box = await img.boundingBox();
      const viewport = page.viewportSize();
      
      if (box && viewport) {
        expect(box.width).toBeLessThanOrEqual(viewport.width);
      }
    }
    
    await context.close();
  });
}); 