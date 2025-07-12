#!/usr/bin/env node

/**
 * CI Health Check Script
 * Verifies that the application is running and responsive
 */

const http = require('http');
const https = require('https');

const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Make HTTP/HTTPS request with timeout
 */
function makeRequest(url, timeout = HEALTH_CHECK_TIMEOUT) {
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
    
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
    
    request.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check if URL is responsive
 */
async function checkHealth(url, retries = MAX_RETRIES) {
  console.log(`🔍 Checking health of: ${url}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${retries}...`);
      
      const response = await makeRequest(url);
      
      if (response.statusCode >= 200 && response.statusCode < 400) {
        console.log(`  ✅ Success! Status: ${response.statusCode}`);
        return {
          success: true,
          statusCode: response.statusCode,
          attempt: attempt,
        };
      } else {
        console.log(`  ⚠️  Unexpected status: ${response.statusCode}`);
        if (attempt === retries) {
          throw new Error(`Health check failed with status ${response.statusCode}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      
      if (attempt === retries) {
        throw error;
      }
      
      if (attempt < retries) {
        console.log(`  ⏳ Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
}

/**
 * Main health check function
 */
async function main() {
  console.log('🏥 Starting CI Health Check...');
  console.log('================================');
  
  const baseUrl = process.env.TEST_FRONTEND_URL || 'http://localhost:3000';
  const apiUrl = process.env.TEST_API_BASE_URL || `${baseUrl}/api`;
  
  const endpoints = [
    { name: 'Frontend Root', url: baseUrl },
    { name: 'API Health', url: `${apiUrl}/health` },
    { name: 'API Status', url: `${apiUrl}/status` },
  ];
  
  let allPassed = true;
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 Testing: ${endpoint.name}`);
      const result = await checkHealth(endpoint.url);
      results.push({ ...endpoint, ...result });
      console.log(`✅ ${endpoint.name}: PASSED`);
    } catch (error) {
      console.log(`❌ ${endpoint.name}: FAILED - ${error.message}`);
      results.push({ 
        ...endpoint, 
        success: false, 
        error: error.message 
      });
      allPassed = false;
    }
  }
  
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}: ${result.url}`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  if (allPassed) {
    console.log('\n🎉 All health checks passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some health checks failed!');
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

// Run health check
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { checkHealth, makeRequest };
