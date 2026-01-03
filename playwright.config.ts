import { defineConfig, devices } from '@playwright/test';

/**
 * Test Categories:
 * @critical - Core user journeys (must pass for deployment)
 * @smoke - Basic functionality checks (fast validation)
 * @extended - Comprehensive testing (full regression)
 * @accessibility - A11y compliance tests
 * @performance - Performance and load tests
 * @security - Security and vulnerability tests
 * @integration - API and backend integration tests
 * @ui - User interface and interaction tests
 * @mobile - Mobile-specific tests
 * @cross-browser - Cross-browser compatibility tests
 * 
 * Usage:
 * - npm run test:e2e:critical (PR validation)
 * - npm run test:e2e:smoke (quick validation)
 * - npm run test:e2e:extended (full regression)
 * - npm run test:e2e (all tests)
 */

// Test filtering based on environment variables
const getTestFilter = () => {
  const testType = process.env.TEST_TYPE || 'all';
  
  switch (testType) {
    case 'critical':
      return '**/critical/**/*.{spec,test}.{ts,js}';
    case 'smoke':
      return '**/smoke/**/*.{spec,test}.{ts,js}';
    case 'extended':
      return '**/extended/**/*.{spec,test}.{ts,js}';
    case 'accessibility':
      return '**/accessibility/**/*.{spec,test}.{ts,js}';
    case 'performance':
      return '**/performance/**/*.{spec,test}.{ts,js}';
    case 'security':
      return '**/security/**/*.{spec,test}.{ts,js}';
    case 'integration':
      return '**/integration/**/*.{spec,test}.{ts,js}';
    case 'ui':
      return '**/ui/**/*.{spec,test}.{ts,js}';
    case 'mobile':
      return '**/mobile/**/*.{spec,test}.{ts,js}';
    case 'cross-browser':
      return '**/cross-browser/**/*.{spec,test}.{ts,js}';
    default:
      return '**/*.{spec,test}.{ts,js}';
  }
};

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: getTestFilter(),
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  // These E2E tests mutate shared Firestore collections (clear/seed),
  // so they must not run concurrently to remain deterministic.
  workers: 1,
  /* Add timeout based on test type */
  timeout: (() => {
    if (process.env.TEST_TYPE === 'performance') return 120000; // 2 minutes for performance tests
    if (process.env.TEST_TYPE === 'extended') return 60000; // 1 minute for extended tests
    if (process.env.TEST_TYPE === 'smoke') return process.env.CI ? 60000 : 30000; // Longer timeout for smoke tests in CI
    return process.env.CI ? 30000 : 60000; // 30s in CI, 60s locally
  })(),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: `test-results-${process.env.TEST_TYPE || 'all'}/html`, open: 'never' }],
    ['github'],
    ['junit', { outputFile: `test-results-${process.env.TEST_TYPE || 'all'}/junit.xml` }],
    ['json', { outputFile: `test-results-${process.env.TEST_TYPE || 'all'}/results.json` }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_FRONTEND_URL || 'http://localhost:3001',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
    /* Add navigation timeout based on test type */
    navigationTimeout: process.env.TEST_TYPE === 'performance' ? 30000 : 
                      process.env.TEST_TYPE === 'smoke' ? (process.env.CI ? 30000 : 15000) :
                      (process.env.CI ? 15000 : 30000),
    /* Add action timeout based on test type */
    actionTimeout: process.env.TEST_TYPE === 'performance' ? 15000 :
                   process.env.TEST_TYPE === 'smoke' ? (process.env.CI ? 20000 : 10000) :
                   (process.env.CI ? 10000 : 30000),
  },

  /* Configure projects for major browsers with conditional execution */
  projects: (() => {
    const testType = process.env.TEST_TYPE || 'all';
    
    // Critical and smoke tests: Chromium only for speed
    if (testType === 'critical' || testType === 'smoke') {
      return [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ];
    }
    
    // Cross-browser tests: All browsers
    if (testType === 'cross-browser') {
      return [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'Microsoft Edge',
          use: { ...devices['Desktop Edge'], channel: 'msedge' },
        },
        {
          name: 'Google Chrome',
          use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        },
      ];
    }
    
    // Mobile tests: Mobile devices only
    if (testType === 'mobile') {
      return [
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'Mobile Safari',
          use: { ...devices['iPhone 12'] },
        },
      ];
    }
    
    // CI environment: Chromium only unless specifically testing cross-browser
    if (process.env.CI && testType !== 'extended') {
      return [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ];
    }
    
    // Local development or extended tests: All browsers
    return [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
      {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
      },
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
      {
        name: 'Microsoft Edge',
        use: { ...devices['Desktop Edge'], channel: 'msedge' },
      },
      {
        name: 'Google Chrome',
        use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      },
    ];
  })(),

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'node scripts/start-dev.js',
        url: 'http://localhost:3001',
        reuseExistingServer: true, // Use existing server if available
        timeout: 120 * 1000, // 2 minutes
      },
});
