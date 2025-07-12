import { test, expect } from '@playwright/test';

test.describe('SEO Tests', () => {
  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check title
    const title = await page.title();
    expect(title).toContain('AI Status Dashboard');
    expect(title.length).toBeGreaterThan(30);
    expect(title.length).toBeLessThan(60);

    // Check meta description
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(120);
    expect(description!.length).toBeLessThan(160);

    // Check keywords
    const keywords = await page.getAttribute('meta[name="keywords"]', 'content');
    expect(keywords).toContain('AI status');
    expect(keywords).toContain('OpenAI');
    expect(keywords).toContain('monitoring');
  });

  test('should have Open Graph tags', async ({ page }) => {
    await page.goto('/');

    const ogTags = {
      'og:title': await page.getAttribute('meta[property="og:title"]', 'content'),
      'og:description': await page.getAttribute('meta[property="og:description"]', 'content'),
      'og:type': await page.getAttribute('meta[property="og:type"]', 'content'),
      'og:url': await page.getAttribute('meta[property="og:url"]', 'content'),
      'og:image': await page.getAttribute('meta[property="og:image"]', 'content'),
    };

    expect(ogTags['og:title']).toBeTruthy();
    expect(ogTags['og:description']).toBeTruthy();
    expect(ogTags['og:type']).toBe('website');
    expect(ogTags['og:url']).toBeDefined();
    expect(ogTags['og:image']).toBeTruthy();
  });

  test('should have Twitter Card tags', async ({ page }) => {
    await page.goto('/');

    const twitterTags = {
      'twitter:card': await page.getAttribute('meta[name="twitter:card"]', 'content'),
      'twitter:title': await page.getAttribute('meta[name="twitter:title"]', 'content'),
      'twitter:description': await page.getAttribute('meta[name="twitter:description"]', 'content'),
      'twitter:image': await page.getAttribute('meta[name="twitter:image"]', 'content'),
    };

    expect(twitterTags['twitter:card']).toBe('summary_large_image');
    expect(twitterTags['twitter:title']).toBeTruthy();
    expect(twitterTags['twitter:description']).toBeTruthy();
    expect(twitterTags['twitter:image']).toBeTruthy();
  });

  test('should have structured data', async ({ page }) => {
    await page.goto('/');

    const jsonLd = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent || '{}') : null;
    });

    expect(jsonLd).toBeTruthy();
    expect(jsonLd['@type']).toBe('WebApplication');
    expect(jsonLd.name).toContain('AI Status Dashboard');
    expect(jsonLd.description).toBeTruthy();
  });

  test('should have canonical URL', async ({ page }) => {
    await page.goto('/');

    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    // In development, expect localhost; in production, expect the domain
    if (canonical?.includes('localhost')) {
      expect(canonical).toMatch(/^http:\/\/localhost:\d+\/?$/);
    } else {
      expect(canonical).toMatch(/^https:\/\/aistatusdashboard\.com\/?$/);
    }
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one h1
    const h1Count = await page.$$eval('h1', (elements) => elements.length);
    expect(h1Count).toBe(1);

    // H1 should contain main keywords
    const h1Text = await page.textContent('h1');
    expect(h1Text?.toLowerCase()).toContain('ai');
    expect(h1Text?.toLowerCase()).toContain('status');
  });

  test('should have sitemap', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);

    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('xml');
  });

  test('should have robots.txt', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);

    const text = await response?.text();
    expect(text).toContain('User-agent');
    expect(text).toContain('Sitemap');
  });
});
