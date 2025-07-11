/**
 * Toast Error Detection Tests
 * Verifies that the Jest setup properly detects application errors in toast notifications
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Type declarations for global test utilities
declare global {
  var testUtils: {
    getToastErrors: () => string[];
    getToastWarnings: () => string[];
    getApplicationErrors: () => string[];
    resetToastTracking: () => void;
    expectNoToastErrors: () => void;
    expectToastError: (expectedMessage: string) => void;
  };
  var toastErrors: string[];
  var toastWarnings: string[];
  var applicationErrors: string[];
}

describe('Toast Error Detection System', () => {
  beforeEach(() => {
    // Reset toast tracking before each test
    if (global.testUtils && global.testUtils.resetToastTracking) {
      global.testUtils.resetToastTracking();
    }
  });

  it('should have toast error detection utilities available', () => {
    expect(global.testUtils).toBeDefined();
    expect(global.testUtils.getToastErrors).toBeDefined();
    expect(global.testUtils.getToastWarnings).toBeDefined();
    expect(global.testUtils.expectNoToastErrors).toBeDefined();
    expect(global.testUtils.expectToastError).toBeDefined();
  });

  it('should track toast errors globally', () => {
    expect(global.toastErrors).toBeDefined();
    expect(global.toastWarnings).toBeDefined();
    expect(global.applicationErrors).toBeDefined();
    expect(Array.isArray(global.toastErrors)).toBe(true);
    expect(Array.isArray(global.toastWarnings)).toBe(true);
    expect(Array.isArray(global.applicationErrors)).toBe(true);
  });

  it('should start with empty error arrays', () => {
    const toastErrors = global.testUtils.getToastErrors();
    const toastWarnings = global.testUtils.getToastWarnings();
    const applicationErrors = global.testUtils.getApplicationErrors();

    expect(toastErrors).toHaveLength(0);
    expect(toastWarnings).toHaveLength(0);
    expect(applicationErrors).toHaveLength(0);
  });

  it('should provide utility to expect no toast errors', () => {
    // This should not throw since we start with no errors
    expect(() => {
      global.testUtils.expectNoToastErrors();
    }).not.toThrow();
  });

  it('should simulate toast error detection', () => {
    // Simulate a toast error being detected
    global.toastErrors.push('Network Error: Unable to connect to server');

    const toastErrors = global.testUtils.getToastErrors();
    expect(toastErrors).toHaveLength(1);
    expect(toastErrors[0]).toContain('Network Error');

    // This should now throw since we have an error
    expect(() => {
      global.testUtils.expectNoToastErrors();
    }).toThrow('Expected no toast errors');

    // Clean up for afterEach hook
    global.testUtils.resetToastTracking();
  });

  it('should simulate toast warning detection', () => {
    // Simulate a toast warning being detected
    global.toastWarnings.push('Font Loading Error: Some fonts failed to load');

    const toastWarnings = global.testUtils.getToastWarnings();
    expect(toastWarnings).toHaveLength(1);
    expect(toastWarnings[0]).toContain('Font Loading Error');
  });

  it('should validate expected toast error detection', () => {
    // Simulate a specific error
    global.toastErrors.push('API Error: Service temporarily unavailable');

    // This should not throw since we expect this error
    expect(() => {
      global.testUtils.expectToastError('Service temporarily unavailable');
    }).not.toThrow();

    // This should throw since we don't have this error
    expect(() => {
      global.testUtils.expectToastError('Database connection failed');
    }).toThrow('Expected toast error containing');

    // Clean up for afterEach hook
    global.testUtils.resetToastTracking();
  });

  it('should reset toast tracking properly', () => {
    // Add some errors
    global.toastErrors.push('Test error');
    global.toastWarnings.push('Test warning');
    global.applicationErrors.push('Test app error');

    // Verify they exist
    expect(global.toastErrors).toHaveLength(1);
    expect(global.toastWarnings).toHaveLength(1);
    expect(global.applicationErrors).toHaveLength(1);

    // Reset tracking
    global.testUtils.resetToastTracking();

    // Verify they're cleared
    expect(global.toastErrors).toHaveLength(0);
    expect(global.toastWarnings).toHaveLength(0);
    expect(global.applicationErrors).toHaveLength(0);
  });
});
