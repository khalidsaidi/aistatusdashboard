#!/usr/bin/env node

/**
 * Load Testing Script for AI Status Dashboard
 * Tests application performance under load
 */

const http = require('http');
const https = require('https');

const TEST_DURATION = 60000; // 1 minute
const CONCURRENT_USERS = 10;
const REQUEST_DELAY = 1000; // 1 second between requests per user

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const startTime = Date.now();

    const request = client.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        resolve({
          statusCode: res.statusCode,
          responseTime: endTime - startTime,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Simulate user load
 */
async function simulateUser(userId, testUrl, duration) {
  const results = [];
  const endTime = Date.now() + duration;

  console.log(`👤 User ${userId} starting load test...`);

  while (Date.now() < endTime) {
    try {
      const result = await makeRequest(testUrl);
      results.push(result);

      if (results.length % 10 === 0) {
        console.log(`👤 User ${userId}: ${results.length} requests completed`);
      }
    } catch (error) {
      results.push({
        statusCode: 0,
        responseTime: 0,
        success: false,
        error: error.message,
      });
    }

    // Wait before next request
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));
  }

  console.log(`👤 User ${userId} completed: ${results.length} requests`);
  return results;
}

/**
 * Calculate statistics
 */
function calculateStats(results) {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const responseTimes = successful.map((r) => r.responseTime);

  if (responseTimes.length === 0) {
    return {
      totalRequests: results.length,
      successfulRequests: 0,
      failedRequests: results.length,
      successRate: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
    };
  }

  return {
    totalRequests: results.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    successRate: (successful.length / results.length) * 100,
    avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    minResponseTime: Math.min(...responseTimes),
    maxResponseTime: Math.max(...responseTimes),
  };
}

/**
 * Main load test function
 */
async function main() {
  console.log('🚀 Starting Load Test...');
  console.log('========================');

  const testUrl = process.env.TEST_URL || 'http://localhost:3000';
  const apiUrl = process.env.TEST_API_BASE_URL || `${testUrl}/api/status`;

  console.log(`📍 Target URL: ${testUrl}`);
  console.log(`📍 API URL: ${apiUrl}`);
  console.log(`👥 Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`⏱️  Test Duration: ${TEST_DURATION / 1000} seconds`);
  console.log(`⏳ Request Delay: ${REQUEST_DELAY}ms`);

  const startTime = Date.now();

  // Start concurrent users
  const userPromises = [];
  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i, testUrl, TEST_DURATION));
  }

  console.log('\n🏃 Load test in progress...\n');

  // Wait for all users to complete
  const userResults = await Promise.all(userPromises);
  const allResults = userResults.flat();

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // Calculate statistics
  const stats = calculateStats(allResults);

  console.log('\n📊 Load Test Results:');
  console.log('=====================');
  console.log(`⏱️  Total Duration: ${totalDuration / 1000} seconds`);
  console.log(`📊 Total Requests: ${stats.totalRequests}`);
  console.log(`✅ Successful: ${stats.successfulRequests}`);
  console.log(`❌ Failed: ${stats.failedRequests}`);
  console.log(`📈 Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log(`⚡ Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
  console.log(`🏎️  Min Response Time: ${stats.minResponseTime}ms`);
  console.log(`🐌 Max Response Time: ${stats.maxResponseTime}ms`);
  console.log(`🔥 Requests/Second: ${(stats.totalRequests / (totalDuration / 1000)).toFixed(2)}`);

  // Determine if test passed
  const MINIMUM_SUCCESS_RATE = 95; // 95%
  const MAXIMUM_AVG_RESPONSE_TIME = 2000; // 2 seconds

  const passed =
    stats.successRate >= MINIMUM_SUCCESS_RATE && stats.avgResponseTime <= MAXIMUM_AVG_RESPONSE_TIME;

  if (passed) {
    console.log('\n🎉 Load test PASSED!');
    console.log(`✅ Success rate (${stats.successRate.toFixed(2)}%) >= ${MINIMUM_SUCCESS_RATE}%`);
    console.log(
      `✅ Avg response time (${stats.avgResponseTime.toFixed(2)}ms) <= ${MAXIMUM_AVG_RESPONSE_TIME}ms`
    );
    process.exit(0);
  } else {
    console.log('\n💥 Load test FAILED!');
    if (stats.successRate < MINIMUM_SUCCESS_RATE) {
      console.log(`❌ Success rate (${stats.successRate.toFixed(2)}%) < ${MINIMUM_SUCCESS_RATE}%`);
    }
    if (stats.avgResponseTime > MAXIMUM_AVG_RESPONSE_TIME) {
      console.log(
        `❌ Avg response time (${stats.avgResponseTime.toFixed(2)}ms) > ${MAXIMUM_AVG_RESPONSE_TIME}ms`
      );
    }
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

// Run load test
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Load test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { simulateUser, calculateStats, makeRequest };
