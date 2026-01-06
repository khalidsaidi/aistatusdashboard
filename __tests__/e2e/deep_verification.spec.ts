import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const runVerify = (cmd: string, arg1: string) => {
    try {
        const output = execSync(`node scripts/verify-db.js ${cmd} "${arg1}"`, {
            env: process.env
        }).toString().trim();
        return output;
    } catch (e) {
        return 'ERROR';
    }
};

test('deep end-to-end verification', async ({ page }) => {
    console.log(`Test Script Process Project ID: ${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    const PORT = 3001;
    const runId = Date.now().toString().slice(-6);
    const testEmail = `e2e-${runId}@example.com`;
    const testComment = `Deep E2E Verification Comment ${runId}`;
    const testWebhook = `https://e2e-webhook-${runId}.com`;

    // 1. Load Dashboard
    await page.goto(`http://localhost:${PORT}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('input[placeholder*="Search providers"]')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveTitle(/AI Status Dashboard/);

    // 2. Scenario: Subscription Persistence (UI -> DB)
    const notificationsTab = page.getByRole('button', { name: /Notifications/i });
    await notificationsTab.click();
    await page.fill('input[placeholder="name@example.com"]', testEmail);
    const openaiButton = page.getByRole('button', { name: /OpenAI/i }).first();
    await openaiButton.scrollIntoViewIfNeeded();
    await openaiButton.click({ force: true });
    page.on('dialog', dialog => dialog.dismiss());
    await Promise.all([
        page.waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return (
                    res.request().method() === 'POST' &&
                    (url.pathname === '/api/email/subscribe' || url.pathname === '/api/subscribeEmail')
                );
            } catch {
                return false;
            }
        }, { timeout: 30_000 }),
        page.click('button:has-text("Subscribe to Alerts")'),
    ]);

    // VERIFY DB
    await expect
        .poll(() => runVerify('subscription', testEmail), { timeout: 30_000 })
        .toBe('FOUND');
    console.log(`✅ Subscription verified in DB for ${testEmail}`);

    // 3. Scenario: Webhook Registration (UI -> DB)
    const webhookSubTab = page.locator('button', { hasText: /^Webhooks$/ });
    await webhookSubTab.click();
    await page.fill('input[placeholder="https://api.yoursite.com/webhook"]', testWebhook);
    await Promise.all([
        page.waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return (
                    res.request().method() === 'POST' &&
                    (url.pathname === '/api/webhooks' || url.pathname === '/api/subscribeWebhook')
                );
            } catch {
                return false;
            }
        }, { timeout: 30_000 }),
        page.click('button:has-text("Register Webhook")'),
    ]);

    // VERIFY DB
    await expect
        .poll(() => runVerify('webhook', testWebhook), { timeout: 30_000 })
        .toBe('FOUND');
    console.log(`✅ Webhook verified in DB for ${testWebhook}`);

    // 4. Scenario: Comment Lifecycle (UI -> DB)
    const commentsTab = page.getByRole('button', { name: /Comments/i });
    await commentsTab.click();
    await page.fill('input[placeholder="Your name"]', 'E2E Bot');
    await page.fill('textarea[placeholder="Share your thoughts..."]', testComment);
    await Promise.all([
        page.waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return res.request().method() === 'POST' && url.pathname === '/api/comments';
            } catch {
                return false;
            }
        }, { timeout: 30_000 }),
        page.click('button:has-text("Post Comment")'),
    ]);

    // VERIFY DB
    await expect
        .poll(() => runVerify('comment', testComment), { timeout: 30_000 })
        .toBe('FOUND');
    console.log(`✅ Comment verified in DB: "${testComment}"`);

    // 5. Scenario: Incident Propagation (DB -> UI)
    // Inject a "down" status for Anthropic
    execSync(`node scripts/verify-db.js inject anthropic down`, { env: process.env });
    console.log('📡 Injected "down" status for Anthropic into DB');

    // Return to dashboard and verify UI update
    const dashboardTab = page.getByRole('button', { name: /Dashboard/i });
    await dashboardTab.click();
    await page.reload(); // Ensure fresh data

    // 5. Scenario: Data Propagation (DB -> UI)
    // We navigate to Incidents sub-tab under Notifications
    const navNotifications = page.getByRole('button', { name: /Notifications/i });
    await navNotifications.click();

    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(1000);

    const incidentRow = page.locator('text=Anthropic').first();
    await expect(incidentRow).toContainText(/down/i);
    await page.screenshot({ path: 'screenshots/deep-e2e-propagation.png' });
    console.log('✅ UI correctly reflected the injected DB state change in Incidents tab (Propagation Success)');

    console.log('🚀 Deep End-to-End Verification Successful');
});
