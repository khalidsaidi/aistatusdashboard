const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/__tests__/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'functions/src/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  testMatch: [
    '<rootDir>/__tests__/unit/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/integration/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/functions/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/lib/**/__tests__/**/*.{js,jsx,ts,tsx}',
  ],
  testTimeout: 60000,
  maxWorkers: '50%',
  verbose: true,
  setupFiles: [
    '<rootDir>/jest.env.js'
  ],
  testEnvironmentOptions: {
    // Frontend runs on localhost, backend is Firebase
    url: 'http://localhost:3000'
  },
  // Global test environment variables
  globals: {
    TEST_FRONTEND_URL: 'http://localhost:3000',
    TEST_API_BASE_URL: process.env.TEST_API_BASE_URL || 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'ai-status-dashboard-dev'
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/dist/',
    '/build/',
    '/__tests__/',
    '/test-utils/',
    '/mocks/',
    '.d.ts'
  ]
}

module.exports = createJestConfig(customJestConfig) 