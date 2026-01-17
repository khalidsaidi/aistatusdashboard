import { test, expect } from '@playwright/test';

const casualPages = ['/casual/chatgpt', '/casual/claude', '/casual/gemini'];

test('casual pages render without JS and show status card', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  for (const path of casualPages) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Casual Mode')).toBeVisible();
    await expect(page.locator('text=What you may feel')).toBeVisible();
    await expect(page.locator('text=What to do now')).toBeVisible();
  }

  await context.close();
});
