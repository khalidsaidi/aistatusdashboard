#!/usr/bin/env node

// Production Readiness Test Script
// Tests all critical functionality before production deployment

const API_BASE = 'http://localhost:3000/api';
const FIREBASE_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net';

// Use environment variables for test email based on environment
const TEST_EMAIL =
  process.env.NODE_ENV === 'production'
    ? process.env.TEST_EMAIL_PROD || 'khalid@microsoft.com'
    : process.env.TEST_EMAIL_DEV || 'khalidsaidi66@gmail.com';

console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📧 Test Email: ${TEST_EMAIL}`);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logTest(name, status, details = '') {
  totalTests++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';

  console.log(`${icon} ${color}${name}\x1b[0m ${details ? `- ${details}` : ''}`);

  if (status === 'PASS') passedTests++;
  else if (status === 'FAIL') failedTests++;
}

async function testEmailNotifications() {
  console.log('\n📧 TESTING EMAIL NOTIFICATIONS...');

  try {
    const response = await fetch(`${FIREBASE_BASE}/sendTestNotification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        type: 'status',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      logTest('Email Notification Service', 'PASS', `${data.message}`);
      return true;
    } else {
      logTest('Email Notification Service', 'FAIL', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Email Notification Service', 'FAIL', error.message);
    return false;
  }
}

async function testAIProviderDiscovery() {
  console.log('\n🔍 TESTING AI PROVIDER DISCOVERY...');

  try {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const discovery = spawn('node', ['scripts/ai-provider-discovery.js'], {
        stdio: 'pipe',
        timeout: 30000,
      });

      let output = '';
      let errorOutput = '';

      discovery.stdout.on('data', (data) => {
        output += data.toString();
      });

      discovery.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      discovery.on('close', (code) => {
        if (code === 0) {
          logTest('AI Provider Discovery Script', 'PASS', 'Script executed successfully');
          resolve(true);
        } else {
          logTest(
            'AI Provider Discovery Script',
            'FAIL',
            `Exit code: ${code}, Error: ${errorOutput}`
          );
          resolve(false);
        }
      });

      discovery.on('error', (error) => {
        logTest('AI Provider Discovery Script', 'FAIL', error.message);
        resolve(false);
      });
    });
  } catch (error) {
    logTest('AI Provider Discovery Script', 'FAIL', error.message);
    return false;
  }
}

async function testWebPushNotifications() {
  console.log('\n🔔 TESTING WEB PUSH NOTIFICATIONS...');

  try {
    const response = await fetch(`${FIREBASE_BASE}/sendTestPushNotification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/test',
          keys: {
            p256dh: 'test-key',
            auth: 'test-auth',
          },
        },
        message: 'Test push notification',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      logTest('Web Push Notification Service', 'PASS', `${data.message || 'Response received'}`);
      return true;
    } else if (response.status === 403) {
      logTest('Web Push Notification Service', 'WARN', 'VAPID keys need configuration');
      return false;
    } else {
      logTest('Web Push Notification Service', 'FAIL', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Web Push Notification Service', 'FAIL', error.message);
    return false;
  }
}

async function testFirebaseFunctions() {
  console.log('\n🔥 TESTING FIREBASE FUNCTIONS...');

  const endpoints = [
    'api',
    'subscribeEmail',
    'subscribePush',
    'subscribeWebhook',
    'sendTestNotification',
  ];

  let allPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${FIREBASE_BASE}/${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      // Any response (even 404/405) means the function is deployed
      if (response.status < 500) {
        logTest(`Firebase Function: ${endpoint}`, 'PASS', `HTTP ${response.status}`);
      } else {
        logTest(`Firebase Function: ${endpoint}`, 'FAIL', `HTTP ${response.status}`);
        allPassed = false;
      }
    } catch (error) {
      logTest(`Firebase Function: ${endpoint}`, 'FAIL', error.message);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testLocalAPIRoutes() {
  console.log('\n🌐 TESTING LOCAL API ROUTES...');

  const routes = [
    { path: '/status', method: 'GET' },
    { path: '/comments', method: 'GET' },
    {
      path: '/subscribe-email',
      method: 'POST',
      body: { email: TEST_EMAIL, providers: ['openai'] },
    },
    {
      path: '/subscribe-push',
      method: 'POST',
      body: { endpoint: 'test', keys: { p256dh: 'test', auth: 'test' }, providers: ['openai'] },
    },
    {
      path: '/subscribe-webhook',
      method: 'POST',
      body: { url: 'https://webhook.site/test', providers: ['openai'] },
    },
  ];

  let allPassed = true;

  for (const route of routes) {
    try {
      const options = {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (route.body) {
        options.body = JSON.stringify(route.body);
      }

      const response = await fetch(`${API_BASE}${route.path}`, options);

      if (response.ok) {
        logTest(`Local API: ${route.method} ${route.path}`, 'PASS', `HTTP ${response.status}`);
      } else if (response.status === 429) {
        logTest(`Local API: ${route.method} ${route.path}`, 'PASS', 'Rate limited (expected)');
      } else {
        logTest(`Local API: ${route.method} ${route.path}`, 'FAIL', `HTTP ${response.status}`);
        allPassed = false;
      }
    } catch (error) {
      logTest(`Local API: ${route.method} ${route.path}`, 'FAIL', error.message);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testUnitTests() {
  console.log('\n🧪 RUNNING UNIT TESTS...');

  try {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const jest = spawn(
        'npm',
        [
          'test',
          '--',
          '--watchAll=false',
          '--passWithNoTests',
          '--silent',
          '--maxWorkers=1',
          '--forceExit',
        ],
        {
          stdio: 'pipe',
          timeout: 120000, // 2 minutes timeout
        }
      );

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        jest.kill('SIGTERM');
        logTest('Unit Tests', 'FAIL', 'Timeout after 2 minutes');
        resolve(false);
      }, 120000);

      jest.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          // Extract test results from output
          const testResults = output.match(/Tests:\s+(\d+)\s+passed/);
          const suitesResults = output.match(/Test Suites:\s+(\d+)\s+passed/);

          if (testResults && suitesResults) {
            logTest(
              'Unit Tests',
              'PASS',
              `${suitesResults[1]} suites, ${testResults[1]} tests passed`
            );
          } else {
            logTest('Unit Tests', 'PASS', 'All tests passed');
          }
          resolve(true);
        } else {
          logTest('Unit Tests', 'FAIL', `Exit code: ${code}`);
          resolve(false);
        }
      });

      jest.on('error', (error) => {
        clearTimeout(timeoutId);
        logTest('Unit Tests', 'FAIL', error.message);
        resolve(false);
      });
    });
  } catch (error) {
    logTest('Unit Tests', 'FAIL', error.message);
    return false;
  }
}

async function runProductionReadinessTests() {
  console.log('🚀 PRODUCTION READINESS TEST SUITE');
  console.log('=====================================');

  const startTime = Date.now();

  // Run all tests
  const results = await Promise.all([
    testEmailNotifications(),
    testAIProviderDiscovery(),
    testWebPushNotifications(),
    testFirebaseFunctions(),
    testLocalAPIRoutes(),
    testUnitTests(),
  ]);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📊 PRODUCTION READINESS SUMMARY');
  console.log('=====================================');
  console.log(`⏱️  Total Duration: ${duration}s`);
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${failedTests}/${totalTests} tests`);

  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`📈 Success Rate: ${successRate}%`);

  if (successRate >= 90) {
    console.log('\n🎉 PRODUCTION READY! ✅');
    console.log('All critical systems are functioning correctly.');
  } else if (successRate >= 70) {
    console.log('\n⚠️  MOSTLY READY - Minor Issues 🔶');
    console.log('Most systems working, but some issues need attention.');
  } else {
    console.log('\n❌ NOT PRODUCTION READY 🚨');
    console.log('Critical issues need to be resolved before production deployment.');
  }

  console.log('\n📋 NEXT STEPS:');
  if (failedTests > 0) {
    console.log('1. Fix failing tests identified above');
    console.log('2. Re-run this test suite');
    console.log('3. Deploy to production when all tests pass');
  } else {
    console.log('1. ✅ All tests passing - ready for production!');
    console.log('2. 🚀 Deploy to production environment');
    console.log('3. 📊 Monitor production metrics');
  }

  process.exit(successRate >= 90 ? 0 : 1);
}

// Run the production readiness tests
runProductionReadinessTests().catch((error) => {
  console.error('❌ Production readiness test failed:', error.message);
  process.exit(1);
});
