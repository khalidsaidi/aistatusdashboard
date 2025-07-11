#!/usr/bin/env node

/**
 * BACKEND ENFORCEMENT VALIDATION SCRIPT
 *
 * This script validates that the application strictly enforces
 * Firebase Functions usage and prevents local API route access.
 */

const https = require('https');
const http = require('http');

// Configuration
const FIREBASE_FUNCTIONS_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net';
const LOCAL_BASE = 'http://localhost:3000';

const ENDPOINTS = ['status', 'comments'];

function testUrl(url, name, expectSuccess = true) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const success = expectSuccess ? res.statusCode === 200 : res.statusCode !== 200;
          const icon = success ? '✅' : '❌';

          console.log(`${icon} ${name}: ${res.statusCode} (${responseTime}ms)`);

          if (res.statusCode === 503 && data.includes('firebase-functions-only')) {
            console.log('   🔒 Local API route correctly disabled');
          }

          if (!expectSuccess && res.statusCode === 200) {
            console.log(`   ⚠️  Expected failure but got success for: ${url}`);
          }

          resolve({ name, status: res.statusCode, responseTime, success, data });
        });
      })
      .on('error', (err) => {
        const responseTime = Date.now() - startTime;
        const success = !expectSuccess; // Error is success if we expect failure
        const icon = success ? '✅' : '❌';

        console.log(`${icon} ${name}: Error (${responseTime}ms) - ${err.message}`);
        resolve({ name, error: err.message, responseTime, success });
      });
  });
}

async function testFirebaseFunctions() {
  console.log('🔥 Testing Firebase Functions (should work)...\n');

  const tests = ENDPOINTS.map((endpoint) =>
    testUrl(`${FIREBASE_FUNCTIONS_BASE}/api/${endpoint}`, `Firebase ${endpoint}`, true)
  );

  return Promise.all(tests);
}

async function testLocalApiRoutes() {
  console.log('\n🚫 Testing Local API Routes (should be disabled)...\n');

  const tests = ENDPOINTS.map((endpoint) =>
    testUrl(`${LOCAL_BASE}/api/${endpoint}`, `Local ${endpoint}`, false)
  );

  return Promise.all(tests);
}

async function testConfigurationValidation() {
  console.log('\n🔧 Testing Configuration Validation...\n');

  try {
    // Test the validation functions
    const { validateBackendUsage, getApiUrl } = require('./lib/config.ts');

    console.log('📋 Testing getApiUrl function:');
    const statusUrl = getApiUrl('status');
    const commentsUrl = getApiUrl('comments');

    console.log(`   Status URL: ${statusUrl}`);
    console.log(`   Comments URL: ${commentsUrl}`);

    // Validate URLs
    if (statusUrl.includes('localhost') || commentsUrl.includes('localhost')) {
      console.log('❌ Configuration validation failed - localhost URLs detected');
      return false;
    }

    if (!statusUrl.includes('cloudfunctions.net') || !commentsUrl.includes('cloudfunctions.net')) {
      console.log('❌ Configuration validation failed - not using Firebase Functions');
      return false;
    }

    console.log('✅ Configuration validation passed');

    // Test backend validation
    validateBackendUsage();

    return true;
  } catch (error) {
    if (error.message.includes('LOCAL API ROUTES DETECTED')) {
      console.log('❌ Backend validation correctly detected local API usage');
      return false;
    } else {
      console.log(`❌ Configuration test failed: ${error.message}`);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('🚀 Backend Enforcement Validation\n');
  console.log('This script validates that the application strictly uses Firebase Functions\n');

  try {
    // Test Firebase Functions (should work)
    const firebaseResults = await testFirebaseFunctions();

    // Test local API routes (should be disabled)
    const localResults = await testLocalApiRoutes();

    // Test configuration
    const configValid = await testConfigurationValidation();

    // Summary
    console.log('\n📊 Test Results Summary:');

    const firebaseSuccess = firebaseResults.filter((r) => r.success).length;
    const localBlocked = localResults.filter((r) => r.success).length;

    console.log(`✅ Firebase Functions working: ${firebaseSuccess}/${firebaseResults.length}`);
    console.log(`🔒 Local API routes blocked: ${localBlocked}/${localResults.length}`);
    console.log(`🔧 Configuration valid: ${configValid ? 'Yes' : 'No'}`);

    const allPassed =
      firebaseSuccess === firebaseResults.length &&
      localBlocked === localResults.length &&
      configValid;

    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('✅ Firebase Functions enforcement is working correctly');
      console.log('🔒 Local API routes are properly disabled');
      console.log('📡 Application will use deployed backend only');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      console.log('   Please check the configuration and try again');
    }

    return allPassed;
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  runAllTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests };
