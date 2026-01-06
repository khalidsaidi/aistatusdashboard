const nextConfig = require('eslint-config-next');

module.exports = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'test-results-all/**',
      '.ai/**',
      'public/sdk/**',
    ],
  },
  ...nextConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
];
