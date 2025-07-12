const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  // Load polyfills for CI compatibility
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/e2e/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  testMatch: [
    '<rootDir>/__tests__/unit/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/__tests__/integration/**/*.{js,jsx,ts,tsx}',
  ],
  testTimeout: process.env.CI ? 120000 : 60000, // Longer timeout in CI
  // Transform Firebase ESM modules to CommonJS for Jest
  transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase|undici)/)'],
  // Use babel-jest to transform Firebase modules
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: { node: 'current' },
              modules: 'commonjs',
            },
          ],
          ['@babel/preset-typescript'],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
      },
    ],
  },
  // Enable ESM support for Firebase modules
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  // CI-specific options with better error handling
  ...(process.env.CI && {
    bail: false, // Don't stop on first failure in CI - let all tests run
    verbose: false, // Reduce verbosity in CI
    silent: true, // Suppress console output in CI
    passWithNoTests: true,
    detectOpenHandles: false, // Disable open handles detection in CI
    forceExit: true,
    maxWorkers: 1, // Use single worker in CI for stability
    // Use default reporter only in CI
    reporters: ['default'],
    // Increase timeouts for CI environment
    testTimeout: 30000,
  }),
  // Add error boundary for CI
  errorOnDeprecated: false,
};

module.exports = createJestConfig(customJestConfig);
