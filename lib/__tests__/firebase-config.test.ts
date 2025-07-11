import { describe, it, expect } from '@jest/globals';
import { getApiUrl } from '../config-secure';

describe('Firebase Configuration', () => {
  describe('API URL Configuration', () => {
    it('should return correct API URL with status endpoint', () => {
      const apiUrl = getApiUrl('status');
      
      // Should contain the correct endpoint
      expect(apiUrl).toContain('/status');
      // In dev environment, should use local API or cloud functions
      expect(apiUrl).toMatch(/^(\/api\/status|https:\/\/.*cloudfunctions\.net\/status)$/);
    });

    it('should handle different endpoints', () => {
      const statusUrl = getApiUrl('status');
      const commentsUrl = getApiUrl('comments');
      
      expect(statusUrl).toContain('/status');
      expect(commentsUrl).toContain('/comments');
      
      // Both should be valid URL formats
      expect(statusUrl).toMatch(/^(\/api\/|https:\/\/)/);
      expect(commentsUrl).toMatch(/^(\/api\/|https:\/\/)/);
    });

    it('should return valid URLs or paths', () => {
      const apiUrl = getApiUrl('status');
      
      // Should be either a valid URL or a valid path
      if (apiUrl.startsWith('http')) {
        expect(() => new URL(apiUrl)).not.toThrow();
      } else {
        expect(apiUrl).toMatch(/^\/api\//);
      }
    });
  });

  describe('Firebase Project Configuration', () => {
    it('should have proper Firebase config files', () => {
      const fs = require('fs');
      
      expect(fs.existsSync('.firebaserc')).toBe(true);
      expect(fs.existsSync('firebase.json')).toBe(true);
      expect(fs.existsSync('firestore.rules')).toBe(true);
      expect(fs.existsSync('firestore.indexes.json')).toBe(true);
    });

    it('should have Cloud Functions configured', () => {
      const fs = require('fs');
      
      expect(fs.existsSync('functions/package.json')).toBe(true);
      expect(fs.existsSync('functions/tsconfig.json')).toBe(true);
      
      // Check for actual function source files
      expect(fs.existsSync('functions/src')).toBe(true);
      
      // Check for at least one function file
      const srcFiles = fs.readdirSync('functions/src').filter((file: string) => file.endsWith('.ts'));
      expect(srcFiles.length).toBeGreaterThan(0);
      
      // Check for compiled output
      expect(fs.existsSync('functions/lib')).toBe(true);
    });
  });
}); 