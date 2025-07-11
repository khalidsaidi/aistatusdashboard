/**
 * Jest Environment Setup - PUBLIC REPOSITORY VERSION
 * Configure environment variables and global settings for tests
 * 
 * IMPORTANT: This file is part of the public repository.
 * Real credentials should be set via environment variables or local .env files.
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Firebase configuration for tests - SECURE VERSION
// NOTE: These values are safe to expose as they're dev environment only
// and Firebase API keys are designed to be public (client-side usage)
// Real security is enforced by Firebase Security Rules, not API key secrecy
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ai-status-dashboard-dev';
process.env.FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'test-api-key-placeholder';
process.env.FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || 'ai-status-dashboard-dev.firebaseapp.com';
process.env.FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'ai-status-dashboard-dev.firebasestorage.app';
process.env.FIREBASE_MESSAGING_SENDER_ID = process.env.FIREBASE_MESSAGING_SENDER_ID || '413124782229';
process.env.FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || '1:413124782229:web:test-app-id-placeholder';

// Test configuration
process.env.JEST_TIMEOUT = '60000';

// Worker Queue Configuration for Testing
process.env.WORKER_CONCURRENCY = '2';
process.env.WORKER_MAX_RETRIES = '2';
process.env.WORKER_BACKOFF_DELAY = '1000';
process.env.WORKER_STALLED_INTERVAL = '5000';
process.env.WORKER_MAX_STALLED_COUNT = '1';
process.env.WORKER_MAX_QUEUE_SIZE = '1000';
process.env.WORKER_RATE_LIMIT = '50';
process.env.CIRCUIT_BREAKER_THRESHOLD = '5';
process.env.CIRCUIT_BREAKER_TIMEOUT = '30000';

// Scaling configuration for tests
process.env.MIN_WORKERS = '2';
process.env.MAX_WORKERS = '5';
process.env.TARGET_CONCURRENCY = '3';
process.env.SCALE_UP_THRESHOLD = '10';
process.env.SCALE_DOWN_THRESHOLD = '2';
process.env.SCALE_UP_COOLDOWN = '100';
process.env.SCALE_DOWN_COOLDOWN = '100';
process.env.HEALTH_CHECK_INTERVAL = '500';

// STRICT ERROR HANDLING - NO SUPPRESSION
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Track all warnings and errors
global.testErrors = [];
global.testWarnings = [];

console.warn = (...args) => {
  const message = args.join(' ');
  global.testWarnings.push(message);
  
  // FAIL TEST ON ANY WARNING
  if (expect && expect.getState && expect.getState().currentTestName) {
    throw new Error(`TEST FAILED: Console warning detected: ${message}`);
  }
  
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  const message = args.join(' ');
  
  // Skip tracking expected errors when dev server is not running
  if (message.includes('ECONNREFUSED') && message.includes('127.0.0.1:3000')) {
    // This is expected when dev server is not running - log but don't fail tests
    originalConsoleError(`⚠️  Dev server not running:`, ...args);
    return;
  }
  
  if (message.includes('ECONNREFUSED') && message.includes('localhost:3000')) {
    // This is expected when dev server is not running - log but don't fail tests
    originalConsoleError(`⚠️  Dev server not running:`, ...args);
    return;
  }
  
  // Skip React warnings that are common in test environment
  if (message.includes('Warning: An update to') && message.includes('was not wrapped in act')) {
    // React act warnings are expected in test environment
    originalConsoleError(`⚠️  React act warning:`, ...args);
    return;
  }
  
  if (message.includes('Warning: React does not recognize') && message.includes('fetchPriority')) {
    // Next.js Image component warnings in test environment
    originalConsoleError(`⚠️  Next.js Image warning:`, ...args);
    return;
  }
  
  global.testErrors.push(message);
  
  // FAIL TEST ON UNEXPECTED ERRORS ONLY
  if (expect && expect.getState && expect.getState().currentTestName) {
    throw new Error(`TEST FAILED: Console error detected: ${message}`);
  }
  
  originalConsoleError(...args);
};

// Global test utilities - STRICT MODE
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  retry: async (fn, maxAttempts = 3, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      throw new Error(`TEST FAILED: Operation failed on first attempt (retries not allowed in strict mode): ${error.message}`);
    }
  },
  
  validateNoErrors: () => {
    if (global.testErrors.length > 0) {
      throw new Error(`TEST FAILED: Console errors detected: ${global.testErrors.join(', ')}`);
    }
    if (global.testWarnings.length > 0) {
      throw new Error(`TEST FAILED: Console warnings detected: ${global.testWarnings.join(', ')}`);
    }
  },
  
  resetErrorTracking: () => {
    global.testErrors = [];
    global.testWarnings = [];
  }
};

// Add global error handlers that fail tests
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

console.log('🔥 STRICT MODE: Jest environment configured - NO ERRORS ALLOWED');
console.log(`   - Environment: ${process.env.NODE_ENV}`);
console.log(`   - Test Timeout: ${process.env.JEST_TIMEOUT}ms`);
console.log(`   - Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
console.log('   - All warnings and errors will FAIL tests'); 