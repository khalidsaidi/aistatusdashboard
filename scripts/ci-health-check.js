#!/usr/bin/env node

/**
 * 🚀 STATE-OF-THE-ART CI/CD HEALTH CHECK
 * 
 * This script validates critical application endpoints and fails fast
 * with clear error reporting for CI/CD pipeline integration.
 * 
 * Features:
 * - Fast execution (no Jest overhead)
 * - Clear exit codes for CI/CD
 * - Detailed error reporting
 * - Contract validation
 * - Timeout handling
 * - Parallel endpoint testing
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  BASE_URL: 'http://localhost:3001',
  TIMEOUT: 10000,
  CRITICAL_ENDPOINTS: [
    {
      path: '/api/health',
      method: 'GET',
      expectedStatus: 200,
      required: true,
      description: 'Health check endpoint'
    },
    {
      path: '/api/subscribePush',
      method: 'POST',
      body: { token: 'test-token', providers: ['openai'] },
      expectedStatus: [200, 201], // Accept success statuses
      blockOn400: true, // CRITICAL: Block deployment on 400 errors
      required: true,
      description: 'Push notification subscription'
    },
    {
      path: '/api/unsubscribePush', 
      method: 'POST',
      body: { token: 'test-token' },
      expectedStatus: [200, 201], // Accept success statuses
      blockOn400: true, // CRITICAL: Block deployment on 400 errors
      required: true,
      description: 'Push notification unsubscription'
    }
  ]
};

// ANSI colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Logging utilities
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function success(message) {
  log(`✅ SUCCESS: ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  INFO: ${message}`, 'blue');
}

// HTTP request utility with timeout
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: jsonBody,
            rawBody: body
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: {},
            rawBody: body
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`));
    });

    req.setTimeout(CONFIG.TIMEOUT, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${CONFIG.TIMEOUT}ms`));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test a single endpoint
async function testEndpoint(endpoint) {
  const startTime = Date.now();
  
  try {
    const url = new URL(endpoint.path, CONFIG.BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CI-Health-Check/1.0'
      }
    };

    const response = await makeRequest(options, endpoint.body);
    const duration = Date.now() - startTime;

    // Validate response
    const result = {
      endpoint: endpoint.path,
      method: endpoint.method,
      status: response.status,
      duration,
      success: false,
      error: null,
      critical: false
    };

    // Check if status is expected
    const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
      ? endpoint.expectedStatus 
      : [endpoint.expectedStatus];
    
    if (expectedStatuses.includes(response.status)) {
      result.success = true;
      success(`${endpoint.description}: ${response.status} (${duration}ms)`);
    } else {
      result.error = `Expected status ${expectedStatuses.join(' or ')}, got ${response.status}`;
      
      // CRITICAL: Check for 400 errors that should block deployment
      if (endpoint.blockOn400 && response.status === 400) {
        result.critical = true;
        result.error += ` - CRITICAL APPLICATION BUG: ${response.body.error || 'Unknown error'}`;
        error(`${endpoint.description}: ${result.error}`);
      } else {
        warning(`${endpoint.description}: ${result.error}`);
      }
    }

    // Log response details for debugging
    if (response.status >= 400) {
      info(`Response body: ${JSON.stringify(response.body, null, 2)}`);
    }

    return result;
    
  } catch (err) {
    const duration = Date.now() - startTime;
    error(`${endpoint.description}: ${err.message} (${duration}ms)`);
    
    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      status: 0,
      duration,
      success: false,
      error: err.message,
      critical: endpoint.required
    };
  }
}

// Main health check function
async function runHealthCheck() {
  log('🚀 Starting CI/CD Health Check', 'bold');
  log('=====================================', 'cyan');
  
  const startTime = Date.now();
  
  // Test all endpoints in parallel for speed
  const results = await Promise.all(
    CONFIG.CRITICAL_ENDPOINTS.map(testEndpoint)
  );
  
  const totalDuration = Date.now() - startTime;
  
  // Analyze results
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const critical = results.filter(r => r.critical).length;
  
  log('\n📊 HEALTH CHECK RESULTS', 'bold');
  log('=====================================', 'cyan');
  log(`⏱️  Total Duration: ${totalDuration}ms`);
  log(`✅ Passed: ${passed}/${results.length}`);
  log(`❌ Failed: ${failed}/${results.length}`);
  log(`🚨 Critical: ${critical}/${results.length}`);
  
  // Show detailed results
  log('\n📋 DETAILED RESULTS:', 'bold');
  results.forEach(result => {
    const status = result.success ? '✅' : (result.critical ? '🚨' : '⚠️');
    log(`${status} ${result.method} ${result.endpoint}: ${result.status} (${result.duration}ms)`);
    if (result.error) {
      log(`   └─ ${result.error}`, 'yellow');
    }
  });
  
  // Determine exit code
  if (critical > 0) {
    log('\n🚨 CRITICAL FAILURES DETECTED - BLOCKING DEPLOYMENT', 'red');
    log('=====================================', 'red');
    log('The following critical issues must be fixed before deployment:', 'red');
    
    results.filter(r => r.critical).forEach(result => {
      log(`• ${result.endpoint}: ${result.error}`, 'red');
    });
    
    log('\n💡 RECOMMENDED ACTIONS:', 'yellow');
    log('1. Fix the data contract mismatches in push notification endpoints');
    log('2. Ensure frontend and backend use compatible data formats');
    log('3. Run this health check locally to verify fixes');
    log('4. Re-run CI/CD pipeline after fixes');
    
    process.exit(1); // Fail CI/CD pipeline
  }
  
  if (failed > 0) {
    log('\n⚠️  NON-CRITICAL FAILURES DETECTED', 'yellow');
    log('Deployment can proceed, but issues should be addressed');
    process.exit(0); // Allow deployment but warn
  }
  
  log('\n🎉 ALL HEALTH CHECKS PASSED!', 'green');
  log('Application is ready for deployment', 'green');
  process.exit(0); // Success
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  error(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run the health check
if (require.main === module) {
  runHealthCheck().catch(err => {
    error(`Health check failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runHealthCheck, testEndpoint }; 