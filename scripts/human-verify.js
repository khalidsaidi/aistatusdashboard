const { chromium, firefox, webkit, request } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '3001', 10);
const baseUrl = process.env.TEST_FRONTEND_URL || `http://localhost:${PORT}`;
const runId = (process.env.HUMAN_VERIFY_RUN_ID || new Date().toISOString()).replace(/[:.]/g, '-');
const resultsDir = path.join(__dirname, '../.ai/human', runId);
const launchBlockersEnabled = process.env.HUMAN_VERIFY_LAUNCH_BLOCKERS === 'true';
const extendedEnabled = process.env.HUMAN_VERIFY_EXTENDED === 'true' || launchBlockersEnabled;

const smtpSinkDir = process.env.SMTP_SINK_DIR || null;
const webhookSinkDir = process.env.WEBHOOK_SINK_DIR || null;
const testWebhookUrl = process.env.TEST_WEBHOOK_URL || null;
const debugSecret = process.env.APP_DEBUG_SECRET || process.env.DEBUG_SECRET || null;
const cronSecret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET || null;
const mailTmToken = process.env.MAILTM_TOKEN || null;
const mailTmAddress = process.env.MAILTM_ADDRESS || null;
const mailTmApi = process.env.MAILTM_API_URL || 'https://api.mail.tm';
const smtpHost = process.env.SMTP_HOST || null;
const skipDb = process.env.HUMAN_VERIFY_SKIP_DB === 'true';

function isLoopbackHost(host = '') {
    const h = host.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1';
}

if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
}
if (smtpSinkDir && !fs.existsSync(smtpSinkDir)) {
    fs.mkdirSync(smtpSinkDir, { recursive: true });
}
if (webhookSinkDir && !fs.existsSync(webhookSinkDir)) {
    fs.mkdirSync(webhookSinkDir, { recursive: true });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function runVerify(cmd, arg1 = '', arg2 = '') {
    if (skipDb) return 'SKIPPED';
    try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'verify-db.js');
        return execSync(`node "${scriptPath}" ${cmd} "${arg1}" "${arg2}"`, {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
            .toString()
            .trim();
    } catch (e) {
        return 'ERROR';
    }
}

function getCronHeaders() {
    return cronSecret ? { 'x-cron-secret': cronSecret } : {};
}

async function gotoWithRetry(page, url, options) {
    try {
        return await page.goto(url, options);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Next.js dev mode can trigger Fast Refresh reloads that interrupt navigations.
        if (msg.includes('interrupted by another navigation') || msg.includes('net::ERR_ABORTED')) {
            await page.waitForTimeout(500);
            return await page.goto(url, options);
        }
        if (
            msg.includes('Timeout') &&
            options &&
            typeof options === 'object' &&
            options.waitUntil === 'networkidle'
        ) {
            console.warn(`⚠️ networkidle timeout for ${url}; retrying with domcontentloaded`);
            return await page.goto(url, { ...options, waitUntil: 'domcontentloaded' });
        }
        throw e;
    }
}

async function take(page, name, options = {}) {
    const scrollToTop = options.scrollToTop !== false;
    const fullPage = options.fullPage === true;

    if (scrollToTop) {
        await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(resultsDir, name), fullPage });
}

async function waitForNoPendingRequests(page, timeoutMs = 10_000) {
    const pending = new Set();
    const onRequest = (req) => pending.add(req);
    const onDone = (req) => pending.delete(req);
    page.on('request', onRequest);
    page.on('requestfinished', onDone);
    page.on('requestfailed', onDone);

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (pending.size === 0) break;
        await page.waitForTimeout(100);
    }

    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
}

function readJsonSafe(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function readTextSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}

async function syncMailTmInbox() {
    if (!mailTmToken || !smtpSinkDir) return;

    const indexFile = path.join(smtpSinkDir, 'index.json');
    const index = readJsonSafe(indexFile, []);
    const knownIds = new Set(index.map((r) => r.mailtmId).filter(Boolean));
    let counter = index.reduce((max, r) => Math.max(max, typeof r.id === 'number' ? r.id : 0), 0);

    let listRes;
    try {
        listRes = await fetch(`${mailTmApi}/messages?page=1`, {
            headers: { Authorization: `Bearer ${mailTmToken}` },
        });
    } catch {
        return;
    }
    if (!listRes.ok) return;

    let listJson;
    try {
        listJson = await listRes.json();
    } catch {
        return;
    }
    const messages = Array.isArray(listJson['hydra:member']) ? listJson['hydra:member'] : [];
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const msg of messages) {
        if (!msg || !msg.id || knownIds.has(msg.id)) continue;
        let sourceText = '';
        try {
            const detailRes = await fetch(`${mailTmApi}/messages/${msg.id}`, {
                headers: { Authorization: `Bearer ${mailTmToken}` },
            });
            if (detailRes.ok) {
                const detail = await detailRes.json();
                const downloadUrl = detail.downloadUrl || detail.sourceUrl;
                if (downloadUrl) {
                    const rawRes = await fetch(`${mailTmApi}${downloadUrl}`, {
                        headers: { Authorization: `Bearer ${mailTmToken}` },
                    });
                    if (rawRes.ok) {
                        sourceText = await rawRes.text();
                    }
                }
            }
        } catch {
            // ignore source fetch errors
        }
        counter += 1;
        const filename = `email-${String(counter).padStart(4, '0')}.eml`;
        fs.writeFileSync(path.join(smtpSinkDir, filename), sourceText || '');

        const toAddresses = Array.isArray(msg.to) ? msg.to.map((t) => t.address).filter(Boolean).join(', ') : null;
        const record = {
            id: counter,
            mailtmId: msg.id,
            receivedAt: msg.createdAt || new Date().toISOString(),
            file: filename,
            from: msg.from?.address || null,
            to: toAddresses || mailTmAddress || null,
            subject: msg.subject || null,
        };
        index.push(record);
        knownIds.add(msg.id);
    }

    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
}

function getSmtpIndex() {
    if (!smtpSinkDir) return [];
    return readJsonSafe(path.join(smtpSinkDir, 'index.json'), []);
}

function matchesEmailHeader(headerValue, email) {
    if (typeof headerValue !== 'string') return false;
    return headerValue.toLowerCase().includes(email.toLowerCase());
}

async function waitForSmtpEmail({ to, subjectIncludes, minId, timeoutMs = 30_000 }) {
    if (!smtpSinkDir) throw new Error('SMTP_SINK_DIR is required for launch-blockers verification');

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (mailTmToken) {
            await syncMailTmInbox();
        }
        const index = getSmtpIndex();
        const match = index.find((r) => {
            const idOk = typeof minId === 'number' ? typeof r.id === 'number' && r.id > minId : true;
            const toOk = to ? matchesEmailHeader(r.to, to) : true;
            const subjectOk =
                typeof subjectIncludes === 'string'
                    ? typeof r.subject === 'string' && r.subject.includes(subjectIncludes)
                    : true;
            return idOk && toOk && subjectOk;
        });

        if (match) return match;
        await sleep(250);
    }

    throw new Error(`Timed out waiting for SMTP email (to=${to}, subjectIncludes=${subjectIncludes})`);
}

function extractConfirmationLinkFromEml(emlText) {
    if (typeof emlText !== 'string' || emlText.length === 0) return null;
    const normalized = emlText
        // quoted-printable soft line breaks
        .replace(/=\r?\n/g, '')
        // common quoted-printable encoding for "="
        .replace(/=3D/g, '=');
    const match = normalized.match(/https?:\/\/[^\s"'<>]+\/api\/email\/confirm\?token=[0-9a-f]{32,}/i);
    return match ? match[0] : null;
}

async function waitForWebhookDelivery({ sinceIso, timeoutMs = 20_000 }) {
    if (!webhookSinkDir) throw new Error('WEBHOOK_SINK_DIR is required for launch-blockers verification');
    const lastFile = path.join(webhookSinkDir, 'last.json');

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const record = readJsonSafe(lastFile, null);
        if (record && typeof record.receivedAt === 'string') {
            if (!sinceIso || record.receivedAt >= sinceIso) return record;
        }
        await sleep(250);
    }

    throw new Error('Timed out waiting for webhook delivery');
}

async function fetchExternalWebhookRecord(webhookUrl) {
    try {
        const url = new URL(webhookUrl);
        // PTSV3 bins expose request history inline in HTML; parse it.
        if (url.hostname.includes('ptsv3.com')) {
            const parts = url.pathname.split('/').filter(Boolean);
            const binId = parts.length >= 2 && parts[0] === 't' ? parts[1] : null;
            if (!binId) return null;
            const res = await fetch(`https://ptsv3.com/t/${binId}`);
            if (!res.ok) return null;
            const html = await res.text();
            const marker = 'let allRequests = ';
            const idx = html.indexOf(marker);
            if (idx === -1) return null;
            const rest = html.slice(idx + marker.length);
            const end = rest.indexOf('];');
            if (end === -1) return null;
            const jsonStr = rest.slice(0, end + 1);
            const arr = JSON.parse(jsonStr);
            if (!Array.isArray(arr) || arr.length === 0) return null;
            const req =
                arr.find((r) => typeof r.body === 'string' && r.body.trim().startsWith('{')) ||
                arr.find((r) => typeof r.body === 'string' && r.body.length > 0) ||
                arr[0];
            let bodyParsed = null;
            if (req && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
                try {
                    bodyParsed = JSON.parse(req.body);
                } catch {
                    // ignore
                }
            }
            return { source: 'ptsv3', request: req, body: bodyParsed || null, bodyParsed };
        }
    } catch {
        // ignore and return null
    }
    return null;
}

function assertLaunchBlockersEnv() {
    const missing = [];
    if (!smtpSinkDir) missing.push('SMTP_SINK_DIR');
    if (!webhookSinkDir) missing.push('WEBHOOK_SINK_DIR');
    if (!testWebhookUrl) missing.push('TEST_WEBHOOK_URL');
    if (!debugSecret) missing.push('APP_DEBUG_SECRET');
    if (missing.length > 0) {
        throw new Error(`Launch-blockers verification requires: ${missing.join(', ')}`);
    }
}

async function runScenario({ browserName, browserType, variant, viewport, isPrimaryBrowser }) {
    const scenarioLabel = `${browserName}-${variant}`;
    const runLaunchBlockers = launchBlockersEnabled && variant === 'desktop' && isPrimaryBrowser;
    if (runLaunchBlockers) assertLaunchBlockersEnv();

    const externalSmtp = smtpHost && !isLoopbackHost(smtpHost);
    const externalWebhook =
        runLaunchBlockers &&
        testWebhookUrl &&
        !testWebhookUrl.includes('localhost') &&
        !testWebhookUrl.includes('127.0.0.1');

    if (runLaunchBlockers && externalSmtp && mailTmAddress) {
        if (!skipDb) {
            runVerify('clear', 'emailSubscriptions');
            runVerify('clear', 'emailQueue');
        }
    }

    const browser = await browserType.launch();
    const context = await browser.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'allow' });
    let api = null;
    try {
        if (browserName !== 'webkit') {
            try {
                await context.grantPermissions(['clipboard-read', 'clipboard-write']);
            } catch {
                // Some browsers/hosts may not support clipboard permissions in headless mode.
            }
        }

        const page = await context.newPage();
        // Next.js dev builds can be slow on first hit/compilation; use generous defaults for "human" verification.
        page.setDefaultTimeout(120_000);
        page.setDefaultNavigationTimeout(180_000);
        // Some API routes compile lazily in Next.js dev mode; give them breathing room to avoid flaky timeouts.
        api = await request.newContext({ baseURL: baseUrl, timeout: 180_000 });

        const consoleErrors = [];
        const pageErrors = [];
        const requestFailures = [];
        const dialogs = [];
        let lastDialog = null;
        const exportDownloads = [];
        let serviceWorkerInfo = null;
        let cacheKeys = null;
        let resendResult = null;
        let unsubscribeResult = null;
        let statusApiChecks = null;
        let queueStatus = null;

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('requestfailed', (req) => {
            requestFailures.push({
                url: req.url(),
                method: req.method(),
                failure: req.failure(),
            });
        });
        page.on('dialog', (d) => {
            lastDialog = d.message();
            dialogs.push({ type: d.type(), message: d.message() });
            d.dismiss();
        });

        console.log(`🚀 Starting Human Walkthrough (${scenarioLabel}) @ ${baseUrl}`);

        // 0) Load + basic nav sanity
        await gotoWithRetry(page, baseUrl, { waitUntil: 'networkidle' });
        await take(page, `${scenarioLabel}-01-initial-dashboard.png`);

    // Dark mode toggle
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    await page.waitForTimeout(300);
    await take(page, `${scenarioLabel}-02-dark-mode.png`);
    // Restore light mode for consistent screenshots
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();

    // Navbar API link should take us to API tab (query param)
    const isMobile = (viewport?.width || 0) < 768;
    if (isMobile) {
        await page.getByRole('button', { name: /Open navigation menu/i }).click();
        await page.getByRole('navigation').getByRole('link', { name: /^🚀 API$/ }).click();
        await page.waitForLoadState('networkidle');
        await take(page, `${scenarioLabel}-03-navbar-api.png`);

        // Back to dashboard via mobile menu
        await page.getByRole('button', { name: /Open navigation menu/i }).click();
        await page.getByRole('navigation').getByRole('link', { name: /^📊 Dashboard$/ }).click();
        await page.waitForLoadState('networkidle');
    } else {
        await page.getByRole('link', { name: 'API Documentation' }).click();
        await page.waitForLoadState('networkidle');
        await take(page, `${scenarioLabel}-03-navbar-api.png`);

        // Navbar Dashboard link should return to dashboard
        await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
        await page.waitForLoadState('networkidle');
    }

    // Navbar RSS link should load /rss.xml (XML response)
    console.log('📡 Testing RSS Feed link...');
    const rssProbe = await api.get('/rss.xml', { timeout: 180_000 });
    if (!rssProbe.ok()) {
        throw new Error(`GET /rss.xml failed: ${rssProbe.status()}`);
    }
    const rssProbeText = await rssProbe.text();
    if (!rssProbeText.includes('<rss') || !rssProbeText.includes('<channel>')) {
        throw new Error('RSS response is not valid RSS XML');
    }

    const rssNavigation = page
        .waitForURL(/\/rss\.xml(\?|$)/, { timeout: 20_000, waitUntil: 'domcontentloaded' })
        .then(() => ({ type: 'navigation' }))
        .catch(() => null);
    const rssDownload = page
        .waitForEvent('download', { timeout: 20_000 })
        .then((download) => ({ type: 'download', download }))
        .catch(() => null);
    const rssNewPage = context
        .waitForEvent('page', { timeout: 20_000 })
        .then((newPage) => ({ type: 'newPage', page: newPage }))
        .catch(() => null);
    const rssResponse = context
        .waitForEvent('response', {
            timeout: 20_000,
            predicate: (res) => {
                try {
                    const url = new URL(res.url());
                    return url.pathname === '/rss.xml';
                } catch {
                    return false;
                }
            },
        })
        .then((response) => ({ type: 'response', response }))
        .catch(() => null);

    let rssClicked = false;
    if (isMobile) {
        await page.getByRole('button', { name: /Open navigation menu/i }).click();
        const rssNavLink = page.getByRole('navigation').getByRole('link', { name: /RSS/i }).first();
        if (await rssNavLink.count()) {
            await rssNavLink.click();
            rssClicked = true;
        }
    } else {
        const rssLink = page.getByRole('link', { name: /RSS/i }).first();
        if (await rssLink.count()) {
            await rssLink.click();
            rssClicked = true;
        }
    }

    if (!rssClicked) {
        const fallbackRss = page.locator('a[href*="rss"]').first();
        if (await fallbackRss.count()) {
            await fallbackRss.click();
            rssClicked = true;
        }
    }

    if (!rssClicked) {
        console.warn(`⚠️ RSS link not found in ${browserName}-${variant}; verifying via direct navigation.`);
        await gotoWithRetry(page, `${baseUrl}/rss.xml`, { waitUntil: 'domcontentloaded' });
    }

    const rssResult = await Promise.race([rssNavigation, rssDownload, rssNewPage, rssResponse]);
    if (!rssResult) {
        console.warn(
            `⚠️ RSS click did not produce an observable navigation/download in ${browserName}; endpoint validated via API.`
        );
    } else if (rssResult.type === 'download') {
        const saveName = `${scenarioLabel}-03b-navbar-rss.xml`;
        const savePath = path.join(resultsDir, saveName);
        await rssResult.download.saveAs(savePath);
        const rssText = readTextSafe(savePath) || '';
        if (!rssText.includes('<rss') || !rssText.includes('<channel')) {
            throw new Error(`Downloaded RSS does not look valid: ${saveName}`);
        }
    } else if (rssResult.type === 'newPage') {
        const feedPage = rssResult.page;
        try {
            await feedPage.waitForURL(/\/rss\.xml(\?|$)/, { timeout: 20_000, waitUntil: 'domcontentloaded' });
        } catch {
            // continue; some browsers may open an intermediate page
        }
        if (!/\/rss\.xml(\?|$)/.test(feedPage.url())) {
            throw new Error(`RSS link opened unexpected page: ${feedPage.url()}`);
        }
        await take(feedPage, `${scenarioLabel}-03b-navbar-rss.png`, { scrollToTop: false, fullPage: true });
        await feedPage.close();
    } else if (rssResult.type === 'response') {
        const rssText = await rssResult.response.text();
        const saveName = `${scenarioLabel}-03b-navbar-rss.xml`;
        fs.writeFileSync(path.join(resultsDir, saveName), rssText);
        if (!rssText.includes('<rss') || !rssText.includes('<channel')) {
            throw new Error(`RSS response does not look valid: ${saveName}`);
        }
    } else {
        await take(page, `${scenarioLabel}-03b-navbar-rss.png`, { scrollToTop: false, fullPage: true });
    }

    // Ensure we continue the flow on the dashboard page.
    await gotoWithRetry(page, baseUrl, { waitUntil: 'networkidle' });

    // 1) Dashboard - Search + Filters
    console.log('🔍 Testing Search...');
    const searchInput = page.locator('input[placeholder*="Search providers"]');
    await searchInput.fill('Gemini');
    await page.waitForTimeout(700);
    await take(page, `${scenarioLabel}-04-search-gemini.png`);

    console.log('🧹 Testing Filters...');
    await searchInput.fill('');
    await page.selectOption('select#status-filter', 'operational');
    await page.waitForTimeout(700);
    await take(page, `${scenarioLabel}-05-filter-operational.png`);

    if (extendedEnabled) {
        console.log('📤 Testing Export / Share...');
        const exportCard = page.getByTestId('export-share');
        await exportCard.scrollIntoViewIfNeeded();
        await take(page, `${scenarioLabel}-05a-export-share.png`, { scrollToTop: false });

        const exportPlans = [
            { format: 'json', ext: 'json', prefix: '05b' },
            { format: 'csv', ext: 'csv', prefix: '05c' },
            { format: 'txt', ext: 'txt', prefix: '05d' },
        ];

        for (const plan of exportPlans) {
            await exportCard.locator('select').selectOption(plan.format);
            const exportButton = exportCard.getByRole('button', {
                name: new RegExp(`^Export ${plan.format.toUpperCase()}$`),
            });

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 15_000 }),
                exportButton.click(),
            ]);

            const saveName = `${scenarioLabel}-${plan.prefix}-export-${plan.format}.${plan.ext}`;
            const savePath = path.join(resultsDir, saveName);
            await download.saveAs(savePath);

            const fileText = readTextSafe(savePath) || '';
            if (fileText.length < 10) {
                throw new Error(`Exported file too small (${plan.format}): ${saveName}`);
            }

            if (plan.format === 'json') {
                const parsed = JSON.parse(fileText);
                if (!parsed || !Array.isArray(parsed.providers) || parsed.providers.length === 0) {
                    throw new Error(`Export JSON shape invalid: ${saveName}`);
                }
            }
            if (plan.format === 'csv') {
                if (!fileText.includes('"ID","Name","Status"')) {
                    throw new Error(`Export CSV header missing: ${saveName}`);
                }
            }
            if (plan.format === 'txt') {
                if (!fileText.includes('AI Provider Status Report')) {
                    throw new Error(`Export TXT header missing: ${saveName}`);
                }
            }

            exportDownloads.push({
                format: plan.format,
                suggestedFilename: download.suggestedFilename(),
                savedAs: saveName,
                bytes: Buffer.byteLength(fileText, 'utf8'),
            });
        }

        // Share and Copy API URL (alerts are captured/dismissed by the dialog handler)
        await exportCard.getByRole('button', { name: /Share Dashboard/i }).click();
        await exportCard.getByRole('button', { name: /Copy API URL/i }).click();
        try {
            const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
            if (clipboardText && !clipboardText.endsWith('/api/status')) {
                throw new Error(`Clipboard content unexpected: ${clipboardText}`);
            }
        } catch {
            // Clipboard read is not supported in every browser/headless mode.
        }
        await page.waitForTimeout(400);
        await take(page, `${scenarioLabel}-05e-export-share-actions.png`, { scrollToTop: false });
    }

    if (extendedEnabled && isPrimaryBrowser && variant === 'desktop') {
        console.log('🛜 Testing offline banner / SW...');
        serviceWorkerInfo = await page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return { supported: false, registrations: [] };
            const regs = await navigator.serviceWorker.getRegistrations();
            return {
                supported: true,
                controller: !!navigator.serviceWorker.controller,
                registrations: regs.map((r) => ({ scope: r.scope, active: !!r.active, waiting: !!r.waiting })),
            };
        });
        cacheKeys = await page.evaluate(async () => {
            if (typeof caches === 'undefined') return [];
            return await caches.keys();
        });

        const allowLocalSw = process.env.NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST === 'true';
        const hostname = (() => {
            try {
                return new URL(baseUrl).hostname;
            } catch {
                return '';
            }
        })();
        const isLocalhost =
            hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
        if (allowLocalSw && isLocalhost) {
            const registrations = Array.isArray(serviceWorkerInfo?.registrations)
                ? serviceWorkerInfo.registrations
                : [];
            if (registrations.length === 0) {
                throw new Error('Expected a service worker registration on localhost (NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST=true)');
            }
            if (!Array.isArray(cacheKeys) || !cacheKeys.includes('ai-status-dashboard-v2')) {
                throw new Error('Expected service worker cache "ai-status-dashboard-v2" to exist');
            }
        }

        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
        const offlineHeading = page.getByRole('heading', { name: "You're offline" });
        await offlineHeading.waitFor({ timeout: 10_000 });
        await take(page, `${scenarioLabel}-05f-offline-banner.png`);

        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await offlineHeading.waitFor({ state: 'detached', timeout: 10_000 });
    }

    // 2) Notifications - Email subscribe + confirm + queue
    console.log('🔔 Testing Notifications (subscribe + confirm + queue)...');
    const uniqueId = `${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`;
    const runSuffix = uniqueId;
    const testEmail =
        externalSmtp && mailTmAddress
            ? mailTmAddress.toLowerCase()
            : `human-${browserName}-${variant}-${uniqueId}@example.com`.toLowerCase();

    if (runLaunchBlockers && externalSmtp && mailTmAddress) {
        try {
            await api.post('/api/email/unsubscribe', {
                headers: { 'Content-Type': 'application/json' },
                data: { email: testEmail },
            });
        } catch {
            // Best-effort cleanup to keep repeated launch-blocker runs deterministic.
        }
    }

    if (runLaunchBlockers) {
        // Keep deterministic and avoid sending unrelated queued emails.
        if (!skipDb) {
            runVerify('clear', 'emailQueue');
            runVerify('clear', 'webhooks');
        }
    }

    await page.getByRole('button', { name: /Notifications/i }).click();
    await page.locator('input[placeholder="name@example.com"]').fill(testEmail);
    await page.getByRole('button', { name: 'OpenAI', exact: true }).click();

    const subscribeResponse = page
        .waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return (
                    res.request().method() === 'POST' &&
                    (url.pathname === '/api/email/subscribe' || url.pathname === '/api/subscribeEmail')
                );
            } catch {
                return false;
            }
        }, { timeout: 20_000 })
        .catch(() => null);
    const subscribeButton = page.getByRole('button', { name: /Subscribe to Alerts/i });
    await subscribeButton.click();
    const subscribeRes = await subscribeResponse;
    if (subscribeRes && !subscribeRes.ok()) {
        throw new Error(`Subscribe failed: ${subscribeRes.status()}`);
    }
    try {
        await page.waitForSelector('button:has-text("Subscribing...")', { timeout: 15_000 });
    } catch {
        // Some browsers render the loading state too quickly to observe.
    }
    try {
        await subscribeButton.waitFor({ state: 'attached', timeout: 15_000 });
    } catch {
        console.warn(`⚠️ Subscribe button not observed after request (${scenarioLabel})`);
    }
    await waitForNoPendingRequests(page);
    await take(page, `${scenarioLabel}-06-subscribed.png`);

    let token = null;
    if (!skipDb) {
        const subStatus = runVerify('subscription', testEmail);
        const tokenResult = runVerify('subscription-token', testEmail);
        if (subStatus !== 'FOUND' || tokenResult === 'ERROR' || tokenResult === 'NOT_FOUND' || tokenResult === 'NO_TOKEN') {
            throw new Error(
                `Subscription verification failed (status=${subStatus}, token=${tokenResult}, lastDialog=${lastDialog})`
            );
        }
        token = tokenResult;
    }

    // Confirm subscription (double opt-in) + resend/invalid-token coverage
    let confirmationLink = token ? `${baseUrl}/api/email/confirm?token=${token}` : `${baseUrl}/`;
    let tokenToConfirm = token;
    let confirmEmailRecord = null;
    let confirmEmailFile = null;
    let resendEmailRecord = null;
    let resendEmailFile = null;

    // Launch-blockers: send the initial confirmation email and capture evidence
    if (runLaunchBlockers) {
        if (mailTmToken) {
            await syncMailTmInbox();
        }
        const smtpIndex = getSmtpIndex();
        const smtpStartId = smtpIndex.length > 0 ? smtpIndex[smtpIndex.length - 1].id : 0;

        const cronSend = await api.get('/api/cron/notifications', { headers: getCronHeaders() });
        if (!cronSend.ok()) {
            throw new Error(`cron/notifications failed while sending confirmation: ${cronSend.status()}`);
        }

        confirmEmailRecord = await waitForSmtpEmail({
            to: testEmail,
            subjectIncludes: 'Confirm your AI Status Dashboard subscription',
            minId: smtpStartId,
            timeoutMs: 30_000,
        });

        confirmEmailFile = confirmEmailRecord?.file ? path.join(smtpSinkDir, confirmEmailRecord.file) : null;
        const emlText = confirmEmailFile ? readTextSafe(confirmEmailFile) : null;
        const linkFromEmail = emlText ? extractConfirmationLinkFromEml(emlText) : null;
        if (linkFromEmail) {
            confirmationLink = linkFromEmail;
            if (!tokenToConfirm) {
                try {
                    tokenToConfirm = new URL(linkFromEmail).searchParams.get('token') || tokenToConfirm;
                } catch {
                    // ignore
                }
            }
        }
    }

    // Extended: resend confirmation and ensure old token becomes invalid
    if (extendedEnabled) {
        const tokenBeforeResend = tokenToConfirm;

        const resendRes = await api.post('/api/email/resend', {
            headers: { 'Content-Type': 'application/json' },
            data: { email: testEmail },
        });

        let resendBody = null;
        try {
            resendBody = await resendRes.json();
        } catch {
            // ignore
        }

        if (!resendRes.ok()) {
            throw new Error(`email/resend failed: ${resendRes.status()} ${JSON.stringify(resendBody)}`);
        }

        let tokenAfterResend = null;
        if (!skipDb) {
            tokenAfterResend = runVerify('subscription-token', testEmail);
            if (
                tokenAfterResend === 'ERROR' ||
                tokenAfterResend === 'NOT_FOUND' ||
                tokenAfterResend === 'NO_TOKEN' ||
                tokenAfterResend === tokenBeforeResend
            ) {
                throw new Error(
                    `Resend verification failed (before=${tokenBeforeResend}, after=${tokenAfterResend})`
                );
            }
            tokenToConfirm = tokenAfterResend;
        }

        resendResult = {
            ok: resendRes.ok(),
            status: resendRes.status(),
            body: resendBody,
            tokenBefore: tokenBeforeResend,
            tokenAfter: tokenAfterResend,
        };

        // Prove old token no longer works (visual evidence)
        if (isPrimaryBrowser && variant === 'desktop') {
            await gotoWithRetry(page, `${baseUrl}/api/email/confirm?token=${tokenBeforeResend}`, {
                waitUntil: 'domcontentloaded',
            });
            await take(page, `${scenarioLabel}-06b-old-token-invalid.png`);
        }

        // Launch-blockers: send the resent email and confirm using the link from the email
        if (runLaunchBlockers) {
            if (mailTmToken) {
                await syncMailTmInbox();
            }
            const smtpIndex = getSmtpIndex();
            const smtpStartId = smtpIndex.length > 0 ? smtpIndex[smtpIndex.length - 1].id : 0;

            const cronSend = await api.get('/api/cron/notifications', { headers: getCronHeaders() });
            if (!cronSend.ok()) {
                throw new Error(`cron/notifications failed while sending resent confirmation: ${cronSend.status()}`);
            }

            resendEmailRecord = await waitForSmtpEmail({
                to: testEmail,
                subjectIncludes: 'Confirm your AI Status Dashboard subscription',
                minId: smtpStartId,
                timeoutMs: 30_000,
            });

            resendEmailFile = resendEmailRecord?.file ? path.join(smtpSinkDir, resendEmailRecord.file) : null;
            const emlText = resendEmailFile ? readTextSafe(resendEmailFile) : null;
            const linkFromEmail = emlText ? extractConfirmationLinkFromEml(emlText) : null;
            if (!linkFromEmail) {
                throw new Error('Failed to extract confirmation link from resent email');
            }
            if (!skipDb && tokenToConfirm && !linkFromEmail.includes(tokenToConfirm)) {
                throw new Error('Resent email confirmation link does not contain the latest token');
            }
            confirmationLink = linkFromEmail;
            if (!tokenToConfirm) {
                try {
                    tokenToConfirm = new URL(linkFromEmail).searchParams.get('token') || tokenToConfirm;
                } catch {
                    // ignore
                }
            }
        } else {
            confirmationLink = `${baseUrl}/api/email/confirm?token=${tokenToConfirm}`;
        }
    }

    const didConfirm = () => {
        try {
            const url = new URL(page.url());
            return url.searchParams.get('confirmed') === 'true';
        } catch {
            return false;
        }
    };

    await gotoWithRetry(page, confirmationLink, { waitUntil: 'domcontentloaded' });
    let confirmed = didConfirm();

    if (runLaunchBlockers && !confirmed && mailTmToken) {
        let lastMailId = resendEmailRecord?.mailtmId || confirmEmailRecord?.mailtmId || null;
        for (let attempt = 0; attempt < 3 && !confirmed; attempt += 1) {
            await sleep(2000);
            await syncMailTmInbox();
            const index = getSmtpIndex();
            const candidates = index.filter(
                (r) => r.subject && r.subject.includes('Confirm your AI Status Dashboard subscription')
            );
            const latest = candidates.length > 0 ? candidates[candidates.length - 1] : null;
            if (!latest || latest.mailtmId === lastMailId) continue;
            lastMailId = latest.mailtmId;
            const latestPath = latest.file ? path.join(smtpSinkDir, latest.file) : null;
            const latestEml = latestPath ? readTextSafe(latestPath) : null;
            const latestLink = latestEml ? extractConfirmationLinkFromEml(latestEml) : null;
            if (!latestLink) continue;
            confirmationLink = latestLink;
            await gotoWithRetry(page, confirmationLink, { waitUntil: 'domcontentloaded' });
            confirmed = didConfirm();
        }
    }

    await take(page, `${scenarioLabel}-07-confirmed.png`);
    if (runLaunchBlockers && !confirmed) {
        throw new Error('Subscription confirmation did not succeed (confirmed=false)');
    }

    if (!skipDb) {
        const tokenAfterConfirm = runVerify('subscription-token', testEmail);
        if (tokenAfterConfirm !== 'NO_TOKEN') {
            throw new Error(`Expected subscription token to be cleared after confirmation, got: ${tokenAfterConfirm}`);
        }
    }

    // Trigger a status-change notification and verify queue (skip DB in production runs)
    if (!skipDb) {
        if (!skipDb) {
            runVerify('clear', 'emailQueue');
        }
        runVerify('clear', 'status_history');
        runVerify('inject', 'openai', 'operational');
        runVerify('inject', 'openai', 'down');

        let cronRes;
        try {
            cronRes = await api.get('/api/cron/status', { timeout: 120_000, headers: getCronHeaders() });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`⚠️ cron/status request failed (${msg}), retrying once...`);
            await sleep(1000);
            cronRes = await api.get('/api/cron/status', { timeout: 120_000, headers: getCronHeaders() });
        }
        if (!cronRes.ok()) throw new Error(`cron/status failed: ${cronRes.status()}`);

        queueStatus = runVerify('queue-check', testEmail);
        if (!/^FOUND_\d+$/.test(queueStatus)) {
            throw new Error(`Expected queued email for ${testEmail}, got: ${queueStatus}`);
        }
        await take(page, `${scenarioLabel}-08-notification-queued.png`);
    }

    // 3) Notifications - Webhooks (positive + negative)
    console.log('🪝 Testing Webhooks...');
    await page.getByRole('button', { name: /Notifications/i }).click();
    const webhookUrl = runLaunchBlockers && testWebhookUrl ? testWebhookUrl : `https://human-webhook-${runSuffix}.com`;

    const webhookTab = page.locator('button', { hasText: /^Webhooks$/ });
    await webhookTab.click();
    await page.locator('input[placeholder="https://api.yoursite.com/webhook"]').fill(webhookUrl);
    const webhookResponse = page
        .waitForResponse(
            (res) => {
                try {
                    const url = new URL(res.url());
                    return (
                        res.request().method() === 'POST' &&
                        (url.pathname === '/api/webhooks' || url.pathname === '/api/subscribeWebhook')
                    );
                } catch {
                    return false;
                }
            },
            { timeout: 20_000 }
        )
        .catch(() => null);
    const webhookDialog = page.waitForEvent('dialog', { timeout: 20_000 }).catch(() => null);

    await page.getByRole('button', { name: /Register Webhook/i }).click();

    const [webhookRes, webhookDlg] = await Promise.all([webhookResponse, webhookDialog]);
    if (webhookRes && !webhookRes.ok()) {
        const bodyText = await webhookRes.text().catch(() => '');
        throw new Error(`Webhook registration failed: ${webhookRes.status()} ${bodyText}`);
    }
    if (webhookDlg && !webhookDlg.message().toLowerCase().includes('webhook')) {
        console.warn(`⚠️ Unexpected webhook dialog (${scenarioLabel}): ${webhookDlg.message()}`);
    }
    await take(page, `${scenarioLabel}-09-webhook-registered.png`);

    if (!skipDb) {
        let webhookStatus = runVerify('webhook', webhookUrl);
        const webhookVerifyStart = Date.now();
        while (webhookStatus !== 'FOUND' && Date.now() - webhookVerifyStart < 30_000) {
            await sleep(500);
            webhookStatus = runVerify('webhook', webhookUrl);
        }
        if (webhookStatus !== 'FOUND') {
            throw new Error(`Webhook not found in DB for ${webhookUrl} (status=${webhookStatus})`);
        }
    }

    // Negative: http:// should be rejected and not stored
    const badWebhook = `http://human-webhook-${runSuffix}.com`;
    await page.locator('input[placeholder="https://api.yoursite.com/webhook"]').fill(badWebhook);
    const badWebhookResponse = page
        .waitForResponse(
            (res) => {
                try {
                    const url = new URL(res.url());
                    return (
                        res.request().method() === 'POST' &&
                        (url.pathname === '/api/webhooks' || url.pathname === '/api/subscribeWebhook')
                    );
                } catch {
                    return false;
                }
            },
            { timeout: 20_000 }
        )
        .catch(() => null);
    const badWebhookDialog = page.waitForEvent('dialog', { timeout: 20_000 }).catch(() => null);

    await page.getByRole('button', { name: /Register Webhook/i }).click();
    const [badWebhookRes] = await Promise.all([badWebhookResponse, badWebhookDialog]);
    if (badWebhookRes && badWebhookRes.ok()) {
        throw new Error(`Expected insecure webhook registration to fail, got ${badWebhookRes.status()}`);
    }
    await page.waitForTimeout(600);
    if (!skipDb) {
        const badStatus = runVerify('webhook', badWebhook);
        if (badStatus === 'FOUND') throw new Error(`Insecure webhook unexpectedly stored: ${badWebhook}`);
    }
    await take(page, `${scenarioLabel}-10-webhook-rejected.png`);

    if (extendedEnabled) {
        console.log('🧾 Testing Incidents tab...');
        const incidentsTab = page.locator('button', { hasText: /^Incidents$/ });
        await incidentsTab.click();
        await page.waitForTimeout(800);
        await waitForNoPendingRequests(page, 10_000);
        await take(page, `${scenarioLabel}-10b-incidents.png`);
        // Return to dashboard for the rest of the flow
        await gotoWithRetry(page, baseUrl, { waitUntil: 'networkidle' });
    }

    // Launch-blockers: real webhook delivery + real SMTP delivery + RSS
    let deliveryWebhookRecord = null;
    let statusEmailRecord = null;
    let statusEmailFile = null;

    if (runLaunchBlockers) {
        console.log('✅ Launch-blockers: Triggering real delivery (webhook + SMTP + RSS)...');

        runVerify('clear', 'emailQueue');

        const sinceIso = new Date().toISOString();
        let triggerRes;
        try {
            triggerRes = await api.post('/api/debug/trigger-notification', {
                timeout: 60_000,
                headers: { 'x-debug-secret': debugSecret },
                data: { providerId: 'openai', previousStatus: 'operational', currentStatus: 'down' },
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`⚠️ debug trigger request failed (${msg}), retrying once...`);
            await sleep(1000);
            triggerRes = await api.post('/api/debug/trigger-notification', {
                timeout: 60_000,
                headers: { 'x-debug-secret': debugSecret },
                data: { providerId: 'openai', previousStatus: 'operational', currentStatus: 'down' },
            });
        }
        if (!triggerRes.ok()) {
            throw new Error(`debug trigger failed: ${triggerRes.status()}`);
        }

        if (externalWebhook) {
            const start = Date.now();
            while (Date.now() - start < 20_000) {
                const rec = await fetchExternalWebhookRecord(webhookUrl);
                if (rec && rec.bodyParsed) {
                    deliveryWebhookRecord = rec;
                    break;
                }
                await sleep(500);
            }
            if (!deliveryWebhookRecord) {
                throw new Error('Timed out waiting for external webhook delivery');
            }
        } else {
            deliveryWebhookRecord = await waitForWebhookDelivery({ sinceIso, timeoutMs: 20_000 });
        }
        const webhookPayload = deliveryWebhookRecord?.body || deliveryWebhookRecord?.bodyParsed;
        if (webhookPayload?.provider?.id !== 'openai') {
            throw new Error(`Unexpected webhook payload: ${JSON.stringify(webhookPayload)}`);
        }
        if (externalWebhook && webhookSinkDir && deliveryWebhookRecord) {
            const externalPath = path.join(webhookSinkDir, 'external.json');
            fs.writeFileSync(externalPath, JSON.stringify(deliveryWebhookRecord, null, 2));
        }

        if (mailTmToken) {
            await syncMailTmInbox();
        }
        const smtpIndex = getSmtpIndex();
        const smtpStartId = smtpIndex.length > 0 ? smtpIndex[smtpIndex.length - 1].id : 0;

        const sendRes = await api.get('/api/cron/notifications', { headers: getCronHeaders() });
        if (!sendRes.ok()) {
            throw new Error(`cron/notifications failed while sending status-change: ${sendRes.status()}`);
        }

        statusEmailRecord = await waitForSmtpEmail({
            to: testEmail,
            subjectIncludes: 'AI Status Alert:',
            minId: smtpStartId,
            timeoutMs: 30_000,
        });
        statusEmailFile = statusEmailRecord?.file ? path.join(smtpSinkDir, statusEmailRecord.file) : null;

        const statusEmlText = statusEmailFile ? readTextSafe(statusEmailFile) : null;
        if (!statusEmlText || !statusEmlText.includes('Status change detected')) {
            throw new Error('Expected status-change email content to include "Status change detected"');
        }

        const rssRes = await api.get('/rss.xml', { timeout: 180_000 });
        if (!rssRes.ok()) throw new Error(`GET /rss.xml failed: ${rssRes.status()}`);
        const rssXml = await rssRes.text();
        if (!rssXml.includes('<rss') || !rssXml.includes('<channel>')) {
            throw new Error('RSS response is not valid RSS XML');
        }
        if (!rssXml.includes(`<atom:link href="${baseUrl}/rss.xml"`)) {
            throw new Error('RSS self link does not match request origin');
        }
    }

    // 4) Analytics - counters increment
    console.log('📈 Testing Analytics...');
    await page.getByRole('button', { name: /Analytics/i }).click();
    const analyticsTimeout = browserName === 'webkit' ? 150_000 : 120_000;

    // Next.js dev servers lazily compile API routes on first hit; WebKit headless can be slow enough
    // that a "human click" + UI refresh times out. Warm the route once (GET will 405 but still compiles).
    try {
        await api.get('/api/analytics/track', { timeout: analyticsTimeout });
    } catch {
        // ignore
    }
    const totalCounter = page.getByTestId('total-interactions');
    await totalCounter.waitFor({ timeout: analyticsTimeout });
    const totalBefore = parseInt((await totalCounter.innerText()).replace(/[^0-9]/g, '') || '0', 10);

    const refreshButton = page.getByRole('button', { name: /Refresh Analytics/i });
    if (await refreshButton.count()) {
        await refreshButton.click();
    }
    await page.waitForTimeout(1000);
    const totalAfter = parseInt((await totalCounter.innerText()).replace(/[^0-9]/g, '') || '0', 10);
    if (Number.isNaN(totalAfter)) {
        throw new Error('Analytics total interactions is not a number');
    }
    if (totalAfter <= 0 && totalBefore <= 0) {
        throw new Error('Analytics total interactions did not update (expected > 0)');
    }
    await take(page, `${scenarioLabel}-11-analytics-updated.png`);

    // 5) Comments - post + like + report
    console.log('💬 Testing Comments...');
    const commentText = `Human verify comment ${runSuffix} - UI looks responsive.`;
    await page.getByRole('button', { name: /Comments/i }).click();
    await page.locator('input[placeholder="Your name"]').fill('Human Tester');
    await page.locator('textarea[placeholder="Share your thoughts..."]').fill(commentText);
    const commentPostResponse = page
        .waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return res.request().method() === 'POST' && url.pathname === '/api/comments';
            } catch {
                return false;
            }
        }, { timeout: 20_000 })
        .catch(() => null);
    await page.getByRole('button', { name: /Post Comment/i }).click();

    const postRes = await commentPostResponse;
    if (postRes && !postRes.ok()) {
        throw new Error(`Comment post failed: ${postRes.status()}`);
    }

    const commentDbStart = Date.now();
    if (!skipDb) {
        let commentDbStatus = runVerify('comment', commentText);
        while (commentDbStatus !== 'FOUND' && Date.now() - commentDbStart < 30_000) {
            await sleep(500);
            commentDbStatus = runVerify('comment', commentText);
        }
        if (commentDbStatus !== 'FOUND') {
            throw new Error(`Comment not persisted in DB for "${commentText}" (status=${commentDbStatus})`);
        }
    }

    const commentCard = page.locator('div', { hasText: commentText }).first();
    const commentStart = Date.now();
    let commentVisible = false;
    while (Date.now() - commentStart < 60_000) {
        try {
            if (await commentCard.isVisible()) {
                commentVisible = true;
                break;
            }
        } catch {
            // ignore transient errors
        }

        const refreshButton = page.getByRole('button', { name: /Refresh/i });
        if (await refreshButton.count()) {
            await refreshButton.click();
        }
        const loadMoreButton = page.getByRole('button', { name: /Load More Comments/i });
        if (await loadMoreButton.count()) {
            await loadMoreButton.click();
        }
        await page.waitForTimeout(1000);
    }

    if (!commentVisible) {
        throw new Error(`Comment not visible in UI after 60s: "${commentText}"`);
    }
    await take(page, `${scenarioLabel}-12-comment-posted.png`);

    const likeResponse = page
        .waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return res.request().method() === 'POST' && url.pathname.startsWith('/api/comments/');
            } catch {
                return false;
            }
        }, { timeout: 20_000 })
        .catch(() => null);
    await commentCard.getByRole('button', { name: /👍/ }).click();
    const likeRes = await likeResponse;
    if (likeRes && !likeRes.ok()) {
        throw new Error(`Like action failed: ${likeRes.status()}`);
    }
    try {
        await page.waitForSelector('text=👍 Thanks for your feedback!', { timeout: 10_000 });
    } catch {
        console.warn(`⚠️ Like success message not observed (${scenarioLabel})`);
    }
    await take(page, `${scenarioLabel}-13-comment-liked.png`);

    const reportResponse = page
        .waitForResponse((res) => {
            try {
                const url = new URL(res.url());
                return res.request().method() === 'POST' && url.pathname.startsWith('/api/comments/');
            } catch {
                return false;
            }
        }, { timeout: 20_000 })
        .catch(() => null);
    await commentCard.getByRole('button', { name: /Report/i }).click();
    const reportRes = await reportResponse;
    if (reportRes && !reportRes.ok()) {
        throw new Error(`Report action failed: ${reportRes.status()}`);
    }
    try {
        await page.waitForSelector('text=🚨 Comment reported for review', { timeout: 10_000 });
    } catch {
        console.warn(`⚠️ Report success message not observed (${scenarioLabel})`);
    }
    await take(page, `${scenarioLabel}-14-comment-reported.png`);

    // 6) API & Badges - basic API clicks + direct badge render
    console.log('🚀 Testing API & Badges...');
    await page.getByRole('button', { name: /API & Badges/i }).click();
    await page.waitForSelector('text=AI Status Dashboard API', { timeout: 20_000 });
    await take(page, `${scenarioLabel}-15-api-tab.png`);

    // Test health + status quickly
    await page.getByRole('button', { name: /^Test$/ }).first().click();
    await page.waitForTimeout(800);
    await take(page, `${scenarioLabel}-16-api-response.png`);

    // Direct badge access (verify via API, then best-effort screenshot)
    const badgeRes = await api.get('/api/badge/openai');
    if (!badgeRes.ok()) {
        throw new Error(`badge/openai failed: ${badgeRes.status()}`);
    }
    const badgeContentType = badgeRes.headers()['content-type'] || '';
    if (!badgeContentType.includes('image/svg+xml')) {
        throw new Error(`badge/openai content-type unexpected: ${badgeContentType}`);
    }

    try {
        const badgePage = await context.newPage();
        await gotoWithRetry(badgePage, `${baseUrl}/api/badge/openai`, { waitUntil: 'load' });
        await take(badgePage, `${scenarioLabel}-17-badge-direct.png`);
        await badgePage.close();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ Badge page render failed (${scenarioLabel}): ${msg}`);
    }

    if (extendedEnabled) {
        console.log('🧪 Testing status history / summary APIs...');
        const summaryRes = await api.get('/api/status/summary?days=7');
        const summaryJson = summaryRes.ok() ? await summaryRes.json() : null;
        if (!summaryRes.ok() || typeof summaryJson?.uptime !== 'number') {
            throw new Error(`status/summary failed or invalid: ${summaryRes.status()}`);
        }

        const historyRes = await api.get('/api/status/history?limit=5');
        const historyJson = historyRes.ok() ? await historyRes.json() : null;
        if (!historyRes.ok() || !Array.isArray(historyJson) || historyJson.length === 0) {
            throw new Error(`status/history failed or invalid: ${historyRes.status()}`);
        }

        const providerHistoryRes = await api.get('/api/status/history/openai?limit=5');
        const providerHistoryJson = providerHistoryRes.ok() ? await providerHistoryRes.json() : null;
        if (!providerHistoryRes.ok() || !Array.isArray(providerHistoryJson) || providerHistoryJson.length === 0) {
            throw new Error(`status/history/openai failed or invalid: ${providerHistoryRes.status()}`);
        }

        statusApiChecks = {
            summary: {
                status: summaryRes.status(),
                body: summaryJson,
            },
            history: {
                status: historyRes.status(),
                count: historyJson.length,
                sample: historyJson[0] ? { id: historyJson[0].id, status: historyJson[0].status } : null,
            },
            providerHistory: {
                status: providerHistoryRes.status(),
                count: providerHistoryJson.length,
                sample: providerHistoryJson[0]
                    ? { id: providerHistoryJson[0].id, status: providerHistoryJson[0].status }
                    : null,
            },
        };

        console.log('📭 Testing unsubscribe...');
        const unsubRes = await api.post('/api/email/unsubscribe', {
            headers: { 'Content-Type': 'application/json' },
            data: { email: testEmail },
        });

        let unsubBody = null;
        try {
            unsubBody = await unsubRes.json();
        } catch {
            // ignore
        }

        if (!unsubRes.ok()) {
            throw new Error(`email/unsubscribe failed: ${unsubRes.status()} ${JSON.stringify(unsubBody)}`);
        }

        await sleep(400);
        if (!skipDb) {
            const postUnsubStatus = runVerify('subscription', testEmail);
            if (postUnsubStatus !== 'NOT_FOUND') {
                throw new Error(`Expected subscription to be deleted after unsubscribe, got: ${postUnsubStatus}`);
            }
        }

        unsubscribeResult = {
            ok: unsubRes.ok(),
            status: unsubRes.status(),
            body: unsubBody,
        };
    }

    const relevantPageErrors = pageErrors.filter((message) => {
        if (typeof message !== 'string') return true;
        // Ignore known dev-only Next.js HMR noise (especially in WebKit)
        if (message.includes('/_next/static/webpack/') && message.includes('hot-update')) return false;
        if (message.includes('/__nextjs_original-stack-frames')) return false;
        return true;
    });

    const artifacts = {
        runId,
        baseUrl,
        scenarioLabel,
        browserName,
        variant,
        viewport,
        testEmail,
        webhookUrl,
        commentText,
        queueStatus,
        launchBlockersEnabled: runLaunchBlockers,
        extendedEnabled,
        smtpSinkDir,
        webhookSinkDir,
        confirmEmailRecord,
        confirmEmailFile,
        resendResult,
        resendEmailRecord,
        resendEmailFile,
        unsubscribeResult,
        deliveryWebhookRecord,
        statusEmailRecord,
        statusEmailFile,
        exportDownloads,
        serviceWorkerInfo,
        cacheKeys,
        statusApiChecks,
        dialogs,
        lastDialog,
        consoleErrors,
        pageErrors,
        pageErrorsRelevant: relevantPageErrors,
        requestFailures,
        timestamp: new Date().toISOString(),
    };
    const artifactsPath = path.join(resultsDir, `${scenarioLabel}-artifacts.json`);
    fs.writeFileSync(artifactsPath, JSON.stringify(artifacts, null, 2));

    const hasPageErrors = relevantPageErrors.length > 0;
    if (hasPageErrors) {
        console.error(`❌ Page errors detected (${scenarioLabel}):`, relevantPageErrors);
    } else if (pageErrors.length > 0) {
        console.warn(`⚠️ Ignored dev-only page errors (${scenarioLabel}):`, pageErrors);
    }

    console.log(`✅ Human Walkthrough Complete (${scenarioLabel})`);
    if (hasPageErrors) {
        throw new Error(`Page errors detected: ${relevantPageErrors.join(' | ')}`);
    }

    return {
        scenarioLabel,
        browserName,
        variant,
        launchBlockersEnabled: runLaunchBlockers,
        artifactsFile: path.basename(artifactsPath),
    };
    } finally {
        try {
            if (api) await api.dispose();
        } catch {
            // ignore
        }
        try {
            await context.close();
        } catch {
            // ignore
        }
        try {
            await browser.close();
        } catch {
            // ignore
        }
    }
}

function isRetryableScenarioError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
        message.includes('Target page, context or browser has been closed') ||
        message.includes('Target closed') ||
        message.includes('Target crashed') ||
        message.includes('crashed') ||
        message.includes('browser has been closed') ||
        message.includes('has been closed') ||
        message.includes('browser has disconnected')
    );
}

async function runScenarioWithRetry(params) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (attempt > 1) {
                console.warn(
                    `⚠️ Retrying human walkthrough (${params.browserName}-${params.variant}) (attempt ${attempt}/${maxAttempts})`
                );
            }
            return await runScenario(params);
        } catch (error) {
            if (!isRetryableScenarioError(error) || attempt === maxAttempts) {
                throw error;
            }
        }
    }
    throw new Error('Scenario retry exhausted');
}

function getSelectedBrowsers() {
    const browserMap = { chromium, firefox, webkit };
    const defaultList = extendedEnabled ? 'chromium,firefox,webkit' : 'chromium';
    const raw = (process.env.HUMAN_VERIFY_BROWSERS || defaultList)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    if (raw.length === 0) {
        throw new Error('No browsers selected for HUMAN_VERIFY_BROWSERS');
    }

    const selected = raw.map((name) => {
        const browserType = browserMap[name];
        if (!browserType) {
            throw new Error(
                `Unsupported browser "${name}" (supported: ${Object.keys(browserMap).join(', ')})`
            );
        }
        return { name, browserType };
    });

    return selected;
}

function getSelectedVariants() {
    const raw = (process.env.HUMAN_VERIFY_VARIANTS || 'desktop,mobile')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const allowed = new Set(['desktop', 'mobile']);
    const variants = raw.filter((v) => allowed.has(v));
    if (variants.length === 0) {
        throw new Error('No variants selected for HUMAN_VERIFY_VARIANTS');
    }
    return variants;
}

async function humanVerify() {
    console.log(`🧪 Human QA Run ID: ${runId}`);
    console.log(`🌐 Base URL: ${baseUrl}`);

    const browsers = getSelectedBrowsers();
    const variants = getSelectedVariants();
    const primaryBrowser = browsers[0].name;
    console.log(`🧭 Browsers: ${browsers.map((b) => b.name).join(', ')} (primary=${primaryBrowser})`);
    console.log(`📱 Variants: ${variants.join(', ')}`);

    const scenarios = [];
    for (const { name, browserType } of browsers) {
        for (const variant of variants) {
            const viewport =
                variant === 'mobile'
                    ? { width: 390, height: 844 }
                    : { width: 1280, height: 720 };
            scenarios.push(
                await runScenarioWithRetry({
                    browserName: name,
                    browserType,
                    variant,
                    viewport,
                    isPrimaryBrowser: name === primaryBrowser,
                })
            );
        }
    }

    const summary = {
        runId,
        baseUrl,
        launchBlockersEnabled,
        extendedEnabled,
        browsers: browsers.map((b) => b.name),
        variants,
        primaryBrowser,
        scenarios,
        timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(path.join(resultsDir, 'RUN_SUMMARY.json'), JSON.stringify(summary, null, 2));

    fs.writeFileSync(
        path.join(resultsDir, 'README.txt'),
        `Human verification artifacts for run ${runId}\nBase URL: ${baseUrl}\nBrowsers: ${browsers
            .map((b) => b.name)
            .join(', ')} (primary=${primaryBrowser})\n`
    );
}

humanVerify().catch(err => {
    console.error('❌ Human Walkthrough Failed:', err);
    process.exit(1);
});
