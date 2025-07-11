const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testEnvironment: 'jsdom',
  // CRITICAL: Load polyfills in multiple ways for CI compatibility
  setupFiles: [
    '<rootDir>/jest.polyfills.js',
    'whatwg-fetch'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/jest.polyfills.js'  // Load again after environment setup
  ],
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
  ],
  testTimeout: 60000,
  // CRITICAL: Ensure polyfills are available in all contexts
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  // Fix for Next.js 15 and Node.js compatibility
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  // CRITICAL: Transform Firebase ESM modules for Jest compatibility
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase|undici)/)'
  ],
  // Force transform Firebase modules
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
}

module.exports = createJestConfig(customJestConfig) 