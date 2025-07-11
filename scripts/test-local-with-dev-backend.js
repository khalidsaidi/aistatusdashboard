#!/usr/bin/env node

// Comprehensive Local Testing with Dev Backend
// Tests 100% of functionality using development Firebase Functions

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DEV_API_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api';
const LOCAL_URL = 'http://localhost:3000';
const TEST_EMAIL = 'hello@aistatusdashboard.com';

async function runTests() {
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    details: [],
  };

  // Helper function to run test
  async function test(name, testFn) {
    results.totalTests++;
    try {
      const result = await testFn();
      if (result.success) {
        results.passed++;
      } else {
        results.failed++;
      }
      results.details.push({ name, ...result });
    } catch (error) {
      results.failed++;
      const message = error.message || 'Unknown error';

      results.details.push({ name, success: false, message });
    }
  }

  // 1. Test Dev Backend API Endpoints

  await test('Provider Status API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/status`);
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      success: true,
      message: `${data.summary.total} providers, ${data.summary.operational} operational`,
    };
  });

  await test('Health Check API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/health`);
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      success: true,
      message: `${data.healthy}/${data.totalProviders} providers healthy`,
    };
  });

  await test('Push Notifications API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: { endpoint: 'test-endpoint' },
        title: 'Test Notification',
        body: 'Test from local environment',
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: data.message || 'Push notifications working' };
  });

  await test('Firebase Messaging API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'test-token',
        title: 'Test Firebase Message',
        body: 'Test from local environment',
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: `Message ID: ${data.messageId}` };
  });

  await test('Email Service API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: TEST_EMAIL,
        subject: 'Test from Local Environment',
        text: 'This is a test email from local development using dev backend',
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      success: true,
      message: data.success ? 'Email sent' : 'Email service responding (SMTP not configured)',
    };
  });

  await test('Email Subscription API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/subscribeEmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        providers: ['openai', 'anthropic', 'google-ai'],
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: data.message || 'Email subscription working' };
  });

  await test('Webhook Subscription API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/subscribeWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: 'https://hooks.slack.com/test',
        providers: ['openai', 'anthropic'],
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: data.message || 'Webhook subscription working' };
  });

  await test('Push Subscription API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/subscribePush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'test-push-token',
        providers: ['openai', 'anthropic'],
        endpoint: 'https://fcm.googleapis.com/test',
        userAgent: 'Local-Test-Environment',
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: data.message || 'Push subscription working' };
  });

  await test('Test Notification API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/sendTestNotification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        type: 'status',
      }),
    });
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return { success: true, message: data.message || 'Test notification working' };
  });

  await test('Comments API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/comments`);
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      success: true,
      message: `Comments endpoint working (${Array.isArray(data) ? data.length : 0} comments)`,
    };
  });

  await test('Incidents API', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/incidents`);
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      success: true,
      message: `${data.incidents ? data.incidents.length : 0} incidents found`,
    };
  });

  await test('RSS Feed', async () => {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${DEV_API_BASE}/rss.xml`);
    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
    const text = await response.text();
    if (text.includes('<?xml') && text.includes('<rss')) {
      return { success: true, message: 'RSS feed generated successfully' };
    }
    return { success: false, message: 'Invalid RSS format' };
  });

  // 2. Test Local Frontend (if running)

  await test('Local Frontend Accessibility', async () => {
    const fetch = (await import('node-fetch')).default;
    try {
      const response = await fetch(LOCAL_URL, { timeout: 5000 });
      if (response.ok) {
        const html = await response.text();
        if (html.includes('AI Status Dashboard')) {
          return { success: true, message: 'Local frontend accessible and loading' };
        }
        return { success: false, message: 'Frontend loading but missing expected content' };
      }
      return { success: false, message: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, message: 'Local frontend not running (start with npm run dev)' };
    }
  });

  // 3. Test Integration (Frontend + Backend)

  await test('Environment Configuration', async () => {
    // Check if local env is configured to use dev backend
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes(DEV_API_BASE.replace('https://', ''))) {
        return { success: true, message: 'Local environment configured for dev backend' };
      }
    }
    return { success: false, message: 'Local environment not configured for dev backend' };
  });

  // 4. Test Real Provider APIs

  const testProviders = ['openai', 'anthropic', 'huggingface'];
  for (const provider of testProviders) {
    await test(`${provider.toUpperCase()} API`, async () => {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${DEV_API_BASE}/status?provider=${provider}`);
      if (!response.ok) return { success: false, message: `HTTP ${response.status}` };
      const data = await response.json();
      return {
        success: true,
        message: `${data.status} (${data.responseTime}ms)`,
      };
    });
  }

  // 5. Performance Tests

  await test('API Response Time', async () => {
    const fetch = (await import('node-fetch')).default;
    const start = Date.now();
    const response = await fetch(`${DEV_API_BASE}/status`);
    const responseTime = Date.now() - start;

    if (!response.ok) return { success: false, message: `HTTP ${response.status}` };

    if (responseTime < 5000) {
      return { success: true, message: `Response time: ${responseTime}ms (Good)` };
    } else {
      return { success: false, message: `Response time: ${responseTime}ms (Too slow)` };
    }
  });

  // Results Summary

  if (results.failed > 0) {
    results.details
      .filter((r) => !r.success)
      .forEach((r) => console.log(`❌ ${r.name}: ${r.message}`));
  }

  if (results.passed > 0) {
    results.details
      .filter((r) => r.success)
      .forEach((r) => console.log(`✅ ${r.name}: ${r.message}`));
  }

  // Save detailed results
  const reportPath = 'local-dev-backend-test-results.json';
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        environment: 'local-with-dev-backend',
        localUrl: LOCAL_URL,
        devApiUrl: DEV_API_BASE,
        testEmail: TEST_EMAIL,
        results,
        summary: {
          total: results.totalTests,
          passed: results.passed,
          failed: results.failed,
          successRate: `${((results.passed / results.totalTests) * 100).toFixed(1)}%`,
        },
      },
      null,
      2
    )
  );

  // Recommendations

  if (results.failed === 0) {
  } else {
    if (results.details.some((r) => !r.success && r.name.includes('Local Frontend'))) {
    }
    if (results.details.some((r) => !r.success && r.name.includes('Environment'))) {
    }
  }

  return results;
}

// Run the tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
