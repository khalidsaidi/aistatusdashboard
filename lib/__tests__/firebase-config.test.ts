import { describe, it, expect } from '@jest/globals';
import { getApiUrl } from '../config';

describe('Firebase Configuration', () => {
  describe('API URL Configuration', () => {
    it('should return correct API URL with status endpoint', () => {
      const apiUrl = getApiUrl('status');
      
      // Should contain the correct endpoint
      expect(apiUrl).toContain('/status');
      expect(apiUrl).toMatch(/https:\/\/.*cloudfunctions\.net\/api\/status/);
    });

    it('should handle different endpoints', () => {
      const statusUrl = getApiUrl('status');
      const commentsUrl = getApiUrl('comments');
      
      expect(statusUrl).toContain('/status');
      expect(commentsUrl).toContain('/comments');
    });

    it('should return valid URLs', () => {
      const apiUrl = getApiUrl('status');
      
      expect(() => new URL(apiUrl)).not.toThrow();
      expect(apiUrl).toMatch(/^https?:\/\//);
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
      expect(fs.existsSync('functions/src/index.ts')).toBe(true);
    });
  });
}); 