#!/usr/bin/env node

/**
 * Test Firebase Functions deployment
 * 
 * This script tests all deployed Firebase Functions to ensure they're working properly.
 */

const https = require('https');

const FIREBASE_FUNCTIONS = {
  API_BASE_URL: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api',
  SUBSCRIBE_EMAIL: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/subscribeEmail',
  UNSUBSCRIBE_EMAIL: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/unsubscribeEmail',
  SUBSCRIBE_WEBHOOK: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/subscribeWebhook',
  SUBSCRIBE_PUSH: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/subscribePush',
  UNSUBSCRIBE_PUSH: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/unsubscribePush',
  SEND_TEST_NOTIFICATION: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/sendTestNotification',
  SEND_TEST_PUSH: 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/sendTestPushNotification'
};

function testUrl(url, name) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    https.get(url, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ ${name}: ${res.statusCode} (${responseTime}ms)`);
        if (data && data.length < 200) {
          console.log(`   Response: ${data.trim()}`);
        }
        resolve({ name, status: res.statusCode, responseTime, success: true });
      });
    }).on('error', (err) => {
      const responseTime = Date.now() - startTime;
      console.log(`❌ ${name}: Error (${responseTime}ms) - ${err.message}`);
      resolve({ name, error: err.message, responseTime, success: false });
    });
  });
}

async function testAllFunctions() {
  console.log('🚀 Testing Firebase Functions deployment...\n');
  
  const tests = [
    testUrl(`${FIREBASE_FUNCTIONS.API_BASE_URL}/status`, 'Status API'),
    testUrl(`${FIREBASE_FUNCTIONS.API_BASE_URL}/comments`, 'Comments API'),
    testUrl(FIREBASE_FUNCTIONS.SUBSCRIBE_EMAIL, 'Email Subscribe'),
    testUrl(FIREBASE_FUNCTIONS.SUBSCRIBE_WEBHOOK, 'Webhook Subscribe'),
    testUrl(FIREBASE_FUNCTIONS.SUBSCRIBE_PUSH, 'Push Subscribe'),
    testUrl(FIREBASE_FUNCTIONS.SEND_TEST_NOTIFICATION, 'Test Notification'),
  ];
  
  const results = await Promise.all(tests);
  
  console.log('\n📊 Test Results:');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ ${successful}/${total} functions working`);
  
  if (successful === total) {
    console.log('🎉 All Firebase Functions are deployed and working!');
    console.log('\n🔧 Your frontend is now configured to ALWAYS use deployed Firebase Functions.');
    console.log('📝 No local server required for testing notifications and backend features.');
  } else {
    console.log('⚠️  Some functions may need attention.');
  }
  
  return successful === total;
}

if (require.main === module) {
  testAllFunctions().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testAllFunctions, FIREBASE_FUNCTIONS }; 