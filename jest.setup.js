import '@testing-library/jest-dom';

// Basic mocks
if (typeof fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Polyfill for TextEncoder/Decoder if needed
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
