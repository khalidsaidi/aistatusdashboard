#!/usr/bin/env node

/**
 * Production Smoke Testing Script
 * Minimal real tests for production environment
 * Only tests critical functionality with minimal impact
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.PRODUCTION_URL,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@yourdomain.com',
  timeout: 15000,
  maxTests: 5, // Limit tests in production
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Dynamic import for fetch
let fetch;

async function initializeFetch() {
  if (!fetch) {
    // Try to use built-in fetch (Node 18+) or import node-fetch
    if (typeof globalThis.fetch !== 'undefined') {
      fetch = globalThis.fetch;
    } else {
      try {
        const nodeFetch = await import('node-fetch');
        fetch = nodeFetch.default;
      } catch (error) {
        // Fallback to a simple mock for testing
        fetch = async function (url, options = {}) {
          return {
            ok: false,
            status: 500,
            statusText: 'Fetch not available',
            json: async () => ({ error: 'Fetch not available in this environment' }),
            text: async () => 'Fetch not available in this environment',
          };
        };
      }
    }
  }
  return fetch;
}

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
}

function recordTest(name, passed, message = '') {
  results.tests.push({ name, passed, message, timestamp: new Date().toISOString() });
  if (passed) {
    results.passed++;
    log(`${name}: PASSED ${message}`, 'success');
  } else {
    results.failed++;
    log(`${name}: FAILED ${message}`, 'error');
  }
}

async function makeRequest(url, options = {}) {
  await initializeFetch();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Smoke test functions (minimal impact)
async function testHealthEndpoint() {
  log('Testing Health Endpoint...', 'info');

  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/health`);

    if (response.ok) {
      const data = await response.json();
      recordTest('Health Endpoint', true, `Service healthy: ${data.status || 'OK'}`);
      return true;
    } else {
      recordTest('Health Endpoint', false, `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Health Endpoint', false, `Network error: ${error.message}`);
    return false;
  }
}

async function testStatusAPIAvailability() {
  log('Testing Status API Availability...', 'info');

  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/status`);

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        recordTest('Status API', true, `API responsive, ${data.length} providers`);
        return true;
      } else {
        recordTest('Status API', false, 'No data returned');
        return false;
      }
    } else {
      recordTest('Status API', false, `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Status API', false, `Network error: ${error.message}`);
    return false;
  }
}

async function testMainPageLoad() {
  log('Testing Main Page Load...', 'info');

  try {
    const response = await makeRequest(CONFIG.baseUrl);

    if (response.ok) {
      const html = await response.text();

      // Check for key elements
      const hasTitle = html.includes('AI Status Dashboard');
      const hasContent = html.length > 1000;

      if (hasTitle && hasContent) {
        recordTest('Main Page Load', true, 'Page loads with expected content');
        return true;
      } else {
        recordTest('Main Page Load', false, 'Page missing expected content');
        return false;
      }
    } else {
      recordTest('Main Page Load', false, `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Main Page Load', false, `Network error: ${error.message}`);
    return false;
  }
}

async function testCriticalEndpoints() {
  log('Testing Critical Endpoints...', 'info');

  const endpoints = ['/api/status', '/api/providers', '/manifest.json', '/sw.js'];

  let successCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${CONFIG.baseUrl}${endpoint}`);

      if (response.ok) {
        successCount++;
        log(`${endpoint}: ✅ Accessible`, 'success');
      } else {
        log(`${endpoint}: ❌ HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      log(`${endpoint}: ❌ ${error.message}`, 'error');
    }
  }

  const allWorking = successCount === endpoints.length;
  recordTest(
    'Critical Endpoints',
    allWorking,
    `${successCount}/${endpoints.length} endpoints accessible`
  );
  return allWorking;
}

async function testMinimalEmailNotification() {
  log('Testing Minimal Email Notification (Admin Only)...', 'info');

  // Only send ONE test email to admin in production
  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/sendTestNotification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Production-Test': 'true', // Special header for production testing
      },
      body: JSON.stringify({
        email: CONFIG.adminEmail,
        type: 'production-smoke-test',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        recordTest('Email Notification', true, 'Production smoke test email sent to admin');
        return true;
      } else {
        recordTest('Email Notification', false, `Email service error: ${data.error}`);
        return false;
      }
    } else if (response.status === 429) {
      recordTest('Email Notification', true, 'Rate limiting active (expected in production)');
      return true;
    } else {
      recordTest('Email Notification', false, `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    recordTest('Email Notification', false, `Network error: ${error.message}`);
    return false;
  }
}

// Main smoke test runner
async function runSmokeTests() {
  log('🚀 Starting Production Smoke Tests...', 'info');
  log(`Base URL: ${CONFIG.baseUrl}`, 'info');
  log(`Admin Email: ${CONFIG.adminEmail}`, 'info');

  if (!CONFIG.baseUrl) {
    log('❌ PRODUCTION_URL not configured', 'error');
    process.exit(1);
  }

  const tests = [
    { name: 'Health Check', fn: testHealthEndpoint },
    { name: 'Status API', fn: testStatusAPIAvailability },
    { name: 'Main Page', fn: testMainPageLoad },
    { name: 'Critical Endpoints', fn: testCriticalEndpoints },
    { name: 'Email Service', fn: testMinimalEmailNotification },
  ];

  for (const test of tests) {
    await test.fn();
    // Add spacing between tests

    // Small delay between tests in production
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Generate test report

  // Save minimal results (no sensitive data)
  const reportPath = path.join(__dirname, '../smoke-test-results.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        summary: {
          passed: results.passed,
          failed: results.failed,
          total: results.passed + results.failed,
          successRate: (results.passed / (results.passed + results.failed)) * 100,
          timestamp: new Date().toISOString(),
          environment: 'production',
          baseUrl: CONFIG.baseUrl.replace(/https?:\/\//, ''), // Remove protocol for security
        },
        tests: results.tests.map((test) => ({
          name: test.name,
          passed: test.passed,
          timestamp: test.timestamp,
          // Don't include detailed messages in production logs
        })),
      },
      null,
      2
    )
  );

  log(`📄 Smoke test results saved to: ${reportPath}`, 'info');

  // Production smoke tests should be more tolerant
  const criticalFailures = results.tests.filter(
    (test) => !test.passed && ['Health Check', 'Main Page', 'Status API'].includes(test.name)
  ).length;

  const exitCode = criticalFailures > 0 ? 1 : 0;

  if (criticalFailures > 0) {
    log(`⚠️ ${criticalFailures} critical failures detected in production`, 'error');
  } else {
    log('✅ All critical systems operational', 'success');
  }

  process.exit(exitCode);
}

// Error handling
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at ${promise}: ${reason}`, 'error');
  process.exit(1);
});

// Run smoke tests
if (require.main === module) {
  runSmokeTests().catch((error) => {
    log(`Smoke test runner error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { runSmokeTests };
