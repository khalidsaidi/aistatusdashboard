/**
 * @jest-environment node
 */

/**
 * End-to-End Tests for Provider Status Checking Workflow
 * Tests the complete flow from queueing to processing to storage
 */

import { initializeApp, getApps } from 'firebase/app';
import { FirebaseWorkerQueue } from '../../lib/firebase-worker-queue';
import { HorizontalScalingManager } from '../../lib/horizontal-scaling-manager';
import * as db from '../../lib/firestore-database';

describe('Provider Workflow Integration', () => {
  let queue: FirebaseWorkerQueue;
  let scalingManager: HorizontalScalingManager;

  beforeAll(() => {
    // Initialize Firebase for testing
    try {
      if (!getApps().length) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'ai-status-dashboard-dev',
          apiKey: process.env.FIREBASE_API_KEY,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.FIREBASE_APP_ID
        });
      }
    } catch (error) {
      console.warn('Firebase initialization failed, workflow tests will be skipped:', error);
    }
  });

  beforeEach(() => {
    queue = new FirebaseWorkerQueue({
      concurrency: 2,
      maxRetries: 2,
      backoffDelay: 1000,
      stalledInterval: 5000,
      maxStalledCount: 1,
      maxQueueSize: 1000,
      rateLimitPerSecond: 10,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 30000
    });

    scalingManager = new HorizontalScalingManager({
      minWorkers: 1,
      maxWorkers: 3,
      targetConcurrency: 2,
      scaleUpThreshold: 5,
      scaleDownThreshold: 1,
      scaleUpCooldown: 500,
      scaleDownCooldown: 500,
      healthCheckInterval: 1000
    });
  });

  afterEach(async () => {
    if (queue) {
      await queue.shutdown(false);
    }
    if (scalingManager) {
      await scalingManager.destroy();
    }
  });

  afterAll(async () => {
    // Cleanup any remaining resources
    if (scalingManager) {
      await scalingManager.destroy();
    }
    
    // Wait for any pending async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Complete Workflow', () => {
    it('should process provider batch through complete workflow', async () => {
      // Initialize systems
      await queue.initialize();
      await scalingManager.initialize();

      // Queue a batch of test providers
      const testProviders = ['test-provider-1', 'test-provider-2'];
      const jobIds = await scalingManager.queueProviderBatch(testProviders, 5);

      expect(jobIds).toHaveLength(2);
      expect(jobIds.every(id => typeof id === 'string')).toBe(true);

      // Wait for processing (with timeout)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check metrics
      const metrics = await queue.getMetrics();
      expect(metrics.workers).toBeGreaterThan(0);
    }, 10000);
  });
}); 