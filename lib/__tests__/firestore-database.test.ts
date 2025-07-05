import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const DEV_SERVICE_KEY_PATH = path.join(process.cwd(), 'config/firebase/dev-servicekey.json');

// Check if Firebase credentials are available
const hasFirebaseCredentials = () => {
  return fs.existsSync(DEV_SERVICE_KEY_PATH);
};

// Conditionally import Firebase functions
const getFirebaseFunctions = async () => {
  if (!hasFirebaseCredentials()) {
    return null;
  }
  
  // Set up Firebase credentials for testing
  process.env.GOOGLE_APPLICATION_CREDENTIALS = DEV_SERVICE_KEY_PATH;
  process.env.FIREBASE_PROJECT_ID = 'ai-status-dashboard-dev';
  
  return await import('../firestore-database');
};

describe('Firestore Database', () => {
  beforeAll(async () => {
    // Set up Firebase for testing
    if (hasFirebaseCredentials()) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = DEV_SERVICE_KEY_PATH;
      process.env.FIREBASE_PROJECT_ID = 'ai-status-dashboard-dev';
    }
  });

  afterAll(async () => {
    // Clean up environment variables
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_PROJECT_ID;
  });

  describe('saveStatusResults', () => {
    it('should save status results to Firestore', async () => {
      const firebase = await getFirebaseFunctions();
      if (!firebase) {
        console.log('⏭️  Skipping Firebase test - service key not found at config/firebase/dev-servicekey.json');
        return;
      }

      const mockStatusResults = [
        {
          id: 'test-provider-' + Date.now(),
          name: 'Test Provider',
          status: 'operational' as const,
          lastChecked: new Date().toISOString(),
          responseTime: 100,
          statusPageUrl: 'https://status.test.com',
        },
      ];

      // This should not throw if Firebase is properly configured
      await expect(firebase.saveStatusResults(mockStatusResults)).resolves.not.toThrow();
    });
  });

  describe('getRecentStatuses', () => {
    it('should retrieve recent statuses from Firestore', async () => {
      const firebase = await getFirebaseFunctions();
      if (!firebase) {
        console.log('⏭️  Skipping Firebase test - service key not found');
        return;
      }

      const results = await firebase.getRecentStatuses(1); // Get last 1 hour

      expect(Array.isArray(results)).toBe(true);
      // Results might be empty, which is fine for tests
    });
  });

  describe('calculateUptime', () => {
    it('should calculate uptime percentage correctly', async () => {
      const firebase = await getFirebaseFunctions();
      if (!firebase) {
        console.log('⏭️  Skipping Firebase test - service key not found');
        return;
      }

      const uptime = await firebase.calculateUptime('test-provider', 1);

      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThanOrEqual(100);
    });
  });

  describe('getAverageResponseTime', () => {
    it('should calculate average response time correctly', async () => {
      const firebase = await getFirebaseFunctions();
      if (!firebase) {
        console.log('⏭️  Skipping Firebase test - service key not found');
        return;
      }

      const avgTime = await firebase.getAverageResponseTime('test-provider', 1);

      expect(typeof avgTime).toBe('number');
      expect(avgTime).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for no data', async () => {
      const firebase = await getFirebaseFunctions();
      if (!firebase) {
        console.log('⏭️  Skipping Firebase test - service key not found');
        return;
      }

      // Use a non-existent provider to get no data
      const avgTime = await firebase.getAverageResponseTime('non-existent-provider-' + Date.now(), 1);

      expect(avgTime).toBe(0);
    });
  });
}); 