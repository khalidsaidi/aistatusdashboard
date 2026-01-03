import { test, expect } from '@playwright/test';

test('comprehensive ui and api verification', async ({ page }) => {
    // 1. Load Dashboard
    const PORT = 3001;
    await page.goto(`http://localhost:${PORT}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/AI Status Dashboard/);
    await page.screenshot({ path: 'screenshots/dashboard-load.png', fullPage: true });

    // 2. Test Notifications Tab
    const notificationsTab = page.getByRole('button', { name: /Notifications/i });
    await notificationsTab.click();
    await page.waitForTimeout(1000);

    // Email Sub-tab
    await page.fill('input[placeholder="name@example.com"]', 'verification@test.com');
    await page.click('button:has-text("Openai")');
    page.on('dialog', dialog => dialog.dismiss());
    await page.click('button:has-text("Subscribe to Alerts")');
    await page.screenshot({ path: 'screenshots/email-subscription-submitted.png' });

    // Webhooks Sub-tab
    const webhookSubTab = page.locator('button', { hasText: /^Webhooks$/ });
    await webhookSubTab.click();
    await page.fill('input[placeholder="https://api.yoursite.com/webhook"]', 'https://webhook.site/qa-test');
    await page.click('button:has-text("Register Webhook")');
    await page.screenshot({ path: 'screenshots/webhook-registration-submitted.png' });

    // Incidents Sub-tab
    const incidentsSubTab = page.locator('button', { hasText: /^Incidents$/ });
    await incidentsSubTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/incidents-view.png' });

    // 3. Test Analytics Tab
    const analyticsTab = page.getByRole('button', { name: /Analytics/i });
    await analyticsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/analytics-tab.png', fullPage: true });

    // 4. Test API & Badges Tab
    const apiTab = page.getByRole('button', { name: /API/i });
    await apiTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/api-tab.png' });

    // 5. Test Comments Tab
    const commentsTab = page.getByRole('button', { name: /Comments/i });
    await commentsTab.click();
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder="Your name"]', 'QA Bot');
    await page.fill('textarea[placeholder="Share your thoughts..."]', 'Verifying the new architecture components.');
    await page.click('button:has-text("Post Comment")');
    await page.screenshot({ path: 'screenshots/comments-tab.png' });

    // 6. Test Badge API directly
    const badgeResponse = await page.request.get(`http://localhost:${PORT}/api/badge/openai`);
    expect(badgeResponse.ok()).toBeTruthy();
    const badgeSvg = await badgeResponse.text();
    expect(badgeSvg).toContain('<svg');

    // 7. Test Health API directly
    const healthResponse = await page.request.get(`http://localhost:${PORT}/api/health`);
    expect(healthResponse.ok()).toBeTruthy();
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');

    console.log('Comprehensive UI & API Verification Successful');
});
