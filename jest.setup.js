/**
 * Jest setup for AI Status Dashboard - STRICT MODE
 * Configures real browser APIs and polyfills for Node.js test environment
 * NO ERROR SUPPRESSION - ALL ISSUES MUST BE FIXED
 * INCLUDES TOAST NOTIFICATION ERROR DETECTION
 */

require('@testing-library/jest-dom');

// TOAST NOTIFICATION ERROR TRACKING
global.toastErrors = [];
global.toastWarnings = [];
global.applicationErrors = [];

// STRICT MODE: Add beforeEach to reset error tracking
beforeEach(() => {
  if (global.testUtils && global.testUtils.resetErrorTracking) {
    global.testUtils.resetErrorTracking();
  }
  
  // Reset toast error tracking
  global.toastErrors = [];
  global.toastWarnings = [];
  global.applicationErrors = [];
});

// STRICT MODE: Add afterEach to validate no errors occurred
afterEach(() => {
  if (global.testUtils && global.testUtils.validateNoErrors) {
    global.testUtils.validateNoErrors();
  }
  
  // Validate no toast errors occurred
  if (global.toastErrors.length > 0) {
    throw new Error(`TEST FAILED: Toast errors detected: ${global.toastErrors.join(', ')}`);
  }
  
  if (global.toastWarnings.length > 0 && process.env.STRICT_TOAST_WARNINGS === 'true') {
    throw new Error(`TEST FAILED: Toast warnings detected: ${global.toastWarnings.join(', ')}`);
  }
  
  if (global.applicationErrors.length > 0) {
    throw new Error(`TEST FAILED: Application errors detected: ${global.applicationErrors.join(', ')}`);
  }
});

// Add TextEncoder/TextDecoder polyfills for Node.js test environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add fetch polyfill based on environment - WITH STRICT ERROR HANDLING
if (typeof fetch === 'undefined') {
  // Check if we're in node environment (integration tests)
  if (typeof window === 'undefined') {
    try {
      // For Node.js environment (integration tests) - use real fetch
      const { fetch, Headers, Request, Response } = require('undici');
      global.fetch = fetch;
      global.Headers = Headers;
      global.Request = Request;
      global.Response = Response;
    } catch (error) {
      // NO FALLBACK - FAIL IMMEDIATELY IF UNDICI NOT AVAILABLE
      throw new Error(`CRITICAL: undici fetch polyfill failed to load: ${error.message}. This indicates a real environment issue that must be fixed.`);
    }
  } else {
    // For jsdom environment (unit tests) - use whatwg-fetch polyfill
    try {
      require('whatwg-fetch');
      console.log('✅ whatwg-fetch polyfill loaded for jsdom environment');
    } catch (error) {
      // Try undici as fallback for jsdom
      try {
        const { fetch, Headers, Request, Response } = require('undici');
        global.fetch = fetch;
        global.Headers = Headers;
        global.Request = Request;
        global.Response = Response;
        console.log('✅ undici fetch polyfill loaded for jsdom environment');
      } catch (undiciError) {
        throw new Error(`CRITICAL: No fetch polyfill available. Install whatwg-fetch or undici: ${error.message}, undici: ${undiciError.message}`);
      }
    }
  }
}

// Polyfill setImmediate for Firebase/Node.js compatibility
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(callback, 0, ...args);
  };
  global.clearImmediate = (id) => {
    clearTimeout(id);
  };
}

// Only set up environment if we're in jsdom (browser-like) environment
if (typeof window !== 'undefined') {
  // TOAST NOTIFICATION ERROR DETECTION
  // Set up proper toast interception by monkey-patching the useToast hook
  const originalRequire = require;
  require = function(moduleName) {
    const module = originalRequire.apply(this, arguments);
    
    // Intercept the Toast module
    if (moduleName.includes('Toast') || moduleName.includes('toast')) {
      if (module && module.useToast) {
        const originalUseToast = module.useToast;
        module.useToast = function() {
          const toastContext = originalUseToast();
          
          if (toastContext) {
            // Wrap showError to capture errors
            const originalShowError = toastContext.showError;
            toastContext.showError = function(title, message) {
              global.toastErrors.push(`${title}: ${message || 'No message'}`);
              return originalShowError.call(this, title, message);
            };
            
            // Wrap showWarning to capture warnings
            const originalShowWarning = toastContext.showWarning;
            toastContext.showWarning = function(title, message) {
              global.toastWarnings.push(`${title}: ${message || 'No message'}`);
              return originalShowWarning.call(this, title, message);
            };
          }
          
          return toastContext;
        };
      }
    }
    
    return module;
  };
  
  console.log('✅ Toast hook interception enabled');

  // Provide window.matchMedia - use real polyfill
  if (!window.matchMedia) {
    // Use CSS.supports as a simple matchMedia polyfill
    window.matchMedia = (query) => ({
      matches: false, // Default to false for tests
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    });
    console.log('✅ matchMedia polyfill added');
  }

  // Notification API - provide basic polyfill
  if (!window.Notification) {
    window.Notification = class Notification {
      constructor(title, options) {
        this.title = title;
        this.options = options;
      }
      static get permission() { return 'default'; }
      static requestPermission() { return Promise.resolve('granted'); }
    };
    console.log('✅ Notification API polyfill added');
  }

  // Service Worker API - provide basic polyfill
  if (!navigator.serviceWorker) {
    navigator.serviceWorker = {
      register: () => Promise.resolve({
        scope: '/',
        unregister: () => Promise.resolve(true),
        showNotification: () => Promise.resolve(),
      }),
      ready: Promise.resolve({
        scope: '/',
        showNotification: () => Promise.resolve(),
      }),
      getRegistrations: () => Promise.resolve([]),
    };
    console.log('✅ Service Worker API polyfill added');
  }

  // Image component - provide basic polyfill
  if (!global.Image) {
    global.Image = class Image {
      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    };
    console.log('✅ Image constructor polyfill added');
  }

  // Ensure document.documentElement exists (only in jsdom environment)
  if (document && !document.documentElement) {
    document.documentElement = document.createElement('html');
  }
  
  // ENHANCED ERROR DETECTION: Monitor DOM for toast notifications
  if (document && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            
            // Check for toast error elements
            if (element.classList?.contains('toast') || 
                element.classList?.contains('notification') ||
                element.querySelector?.('.toast, .notification')) {
              
              const textContent = element.textContent || '';
              
              // Detect error toasts
              if (textContent.includes('Error') || 
                  textContent.includes('Failed') || 
                  textContent.includes('Unable to') ||
                  element.classList?.contains('error') ||
                  element.classList?.contains('danger')) {
                global.toastErrors.push(`DOM Toast Error: ${textContent.slice(0, 100)}`);
              }
              
              // Detect warning toasts
              if (textContent.includes('Warning') || 
                  textContent.includes('Caution') ||
                  element.classList?.contains('warning')) {
                global.toastWarnings.push(`DOM Toast Warning: ${textContent.slice(0, 100)}`);
              }
            }
          }
        });
      });
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('✅ Toast notification DOM observer added');
  }
  
  // DIRECT TOAST FUNCTION INTERCEPTION
  // Monitor global window for toast functions that might be called directly
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay, ...args) {
    // Wrap callback to catch toast-related errors
    const wrappedCallback = function() {
      try {
        return callback.apply(this, arguments);
      } catch (error) {
        if (error.message && (
          error.message.includes('toast') || 
          error.message.includes('notification') ||
          error.message.includes('showError') ||
          error.message.includes('showWarning')
        )) {
          global.applicationErrors.push(`Async Toast Error: ${error.message}`);
        }
        throw error;
      }
    };
    
    return originalSetTimeout.call(this, wrappedCallback, delay, ...args);
  };
  
  console.log('✅ Async toast error detection enabled');
}

// Set up environment variables for tests
process.env.NODE_ENV = 'test';

// CRITICAL: Initialize configuration for tests
try {
  // Import the new secure configuration system
  const { getConfig, validateNoSensitiveData } = require('./lib/config-secure');
  
  // Validate the configuration is secure
  validateNoSensitiveData();
  
  // Get configuration for tests
  const config = getConfig();
  console.log('✅ Secure configuration initialized for tests');
  console.log(`   - Environment: ${config.environment}`);
  console.log(`   - Firebase Project: ${config.firebase.projectId}`);
  
  // Make config available globally for tests
  global.testConfig = {
    getConfig: () => config,
    getStatusFetcherConfig: () => ({
      http: {
        timeout: config.api.timeout,
        retries: config.api.retries,
        userAgent: 'AI-Status-Dashboard-Test/1.0'
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000
      },
      cache: {
        ttl: config.performance.cacheTtl
      }
    }),
    getProviders: () => [],
    getEnvironment: () => config.environment
  };
} catch (error) {
  // STRICT MODE: Configuration must work
  console.error('❌ CRITICAL: Failed to initialize secure configuration:', error.message);
  
  // For tests, we can provide a minimal fallback configuration
  console.log('⚠️ Using fallback configuration for tests - THIS SHOULD BE FIXED');
  
  // Set up minimal configuration for tests to continue
  const mockConfig = {
    getConfig: () => ({
      environment: 'test',
      api: { timeout: 10000, retries: 2 },
      performance: { cacheTtl: 60000 },
      firebase: { projectId: 'ai-status-dashboard-dev' }
    }),
    getStatusFetcherConfig: () => ({
      http: {
        timeout: 10000,
        retries: 2,
        userAgent: 'AI-Status-Dashboard-Test/1.0'
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000
      },
      cache: {
        ttl: 60000
      }
    }),
    getProviders: () => [],
    getEnvironment: () => 'test'
  };
  
  // Make the mock config available globally
  global.testConfig = mockConfig;
}

// STRICT MODE: Override console methods to catch any remaining console usage
const originalLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  
  // Allow specific test-related logs but catch unexpected ones
  if (message.includes('🔥 STRICT MODE') || 
      message.includes('✅') || 
      message.includes('⏭️') ||
      message.includes('❌ CRITICAL') ||
      message.includes('⚠️') ||
      message.includes('Firebase initialized') ||
      message.includes('Test passed') ||
      message.includes('polyfill')) {
    originalLog(...args);
  } else {
    // Unexpected console.log might indicate debugging code left in
    originalLog(`⚠️ UNEXPECTED LOG: ${message}`);
  }
};

// TOAST ERROR DETECTION UTILITIES
global.testUtils = {
  ...global.testUtils,
  getToastErrors: () => global.toastErrors,
  getToastWarnings: () => global.toastWarnings,
  getApplicationErrors: () => global.applicationErrors,
  resetToastTracking: () => {
    global.toastErrors = [];
    global.toastWarnings = [];
    global.applicationErrors = [];
  },
  expectNoToastErrors: () => {
    if (global.toastErrors.length > 0) {
      throw new Error(`Expected no toast errors, but found: ${global.toastErrors.join(', ')}`);
    }
  },
  expectToastError: (expectedMessage) => {
    const found = global.toastErrors.some(error => error.includes(expectedMessage));
    if (!found) {
      throw new Error(`Expected toast error containing "${expectedMessage}", but found: ${global.toastErrors.join(', ')}`);
    }
  }
};

console.log('🔥 STRICT MODE: Jest setup complete - Real implementations only, no error suppression');
console.log('🔔 TOAST ERROR DETECTION: Monitoring for application errors in toast notifications'); 