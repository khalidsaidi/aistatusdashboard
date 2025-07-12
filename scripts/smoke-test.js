#!/usr/bin/env node

/**
 * Smoke Testing Script for AI Status Dashboard
 * Verifies basic functionality after deployment
 */

const http = require('http');
const https = require('https');

const TIMEOUT = 10000; // 10 seconds

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const request = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });
    
    request.setTimeout(TIMEOUT, () => {
      request.destroy();
      reject(new Error(`Request timeout after ${TIMEOUT}ms`));
    });
    
    request.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Test endpoint
 */
async function testEndpoint(name, url, expectedStatus = 200, validator = null) {
  console.log(`🧪 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await makeRequest(url);
    
    // Check status code
    if (response.statusCode !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus}, got ${response.statusCode}`);
    }
    
    // Run custom validator if provided
    if (validator) {
      validator(response);
    }
    
    console.log(`   ✅ PASS - Status: ${response.statusCode}`);
    return { name, url, success: true, statusCode: response.statusCode };
    
  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return { name, url, success: false, error: error.message };
  }
}

/**
 * Validate JSON response
 */
function validateJSON(response) {
  try {
    const data = JSON.parse(response.data);
    if (!data || typeof data !== 'object') {
      throw new Error('Response is not valid JSON object');
    }
    return data;
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message}`);
  }
}

/**
 * Validate HTML response
 */
function validateHTML(response) {
  const html = response.data;
  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    throw new Error('Response does not appear to be valid HTML');
  }
  if (html.includes('<title>')) {
    console.log(`   📄 Page title found`);
  }
  return html;
}

/**
 * Main smoke test function
 */
async function main() {
  console.log('💨 Starting Smoke Tests...');
  console.log('===========================');
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  const apiUrl = process.env.TEST_API_BASE_URL || `${baseUrl}/api`;
  
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`📍 API URL: ${apiUrl}`);
  console.log('');
  
  const tests = [
    // Frontend tests
    {
      name: 'Homepage',
      url: baseUrl,
      expectedStatus: 200,
      validator: validateHTML,
    },
    {
      name: 'Favicon',
      url: `${baseUrl}/favicon.ico`,
      expectedStatus: 200,
    },
    
    // API tests
    {
      name: 'API Health Check',
      url: `${apiUrl}/health`,
      expectedStatus: 200,
      validator: (response) => {
        const data = validateJSON(response);
        if (!data.status || data.status !== 'ok') {
          throw new Error('Health check status is not "ok"');
        }
        console.log(`   💚 Health status: ${data.status}`);
      },
    },
    {
      name: 'API Status Endpoint',
      url: `${apiUrl}/status`,
      expectedStatus: 200,
      validator: (response) => {
        const data = validateJSON(response);
        if (!Array.isArray(data) && !data.providers) {
          throw new Error('Status response does not contain providers data');
        }
        console.log(`   📊 Status data structure valid`);
      },
    },
    
    // Static assets
    {
      name: 'Next.js Build Manifest',
      url: `${baseUrl}/_next/static/chunks/pages/_app.js`,
      expectedStatus: 200,
    },
  ];
  
  const results = [];
  let passedTests = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(
      test.name,
      test.url,
      test.expectedStatus,
      test.validator
    );
    
    results.push(result);
    if (result.success) {
      passedTests++;
    }
    
    console.log(''); // Add spacing between tests
  }
  
  // Summary
  console.log('📊 Smoke Test Summary:');
  console.log('======================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  const successRate = (passedTests / tests.length) * 100;
  console.log(`\n📈 Success Rate: ${passedTests}/${tests.length} (${successRate.toFixed(1)}%)`);
  
  if (passedTests === tests.length) {
    console.log('\n🎉 All smoke tests passed!');
    console.log('🚀 Application is ready for production!');
    process.exit(0);
  } else {
    console.log('\n💥 Some smoke tests failed!');
    console.log('🚨 Application may have issues!');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run smoke tests
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Smoke test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testEndpoint, validateJSON, validateHTML, makeRequest }; 