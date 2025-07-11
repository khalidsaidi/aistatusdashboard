/**
 * Unit Tests for Firebase Worker Queue (No Firebase Connectivity Required)
 */

import { FirebaseWorkerQueue, WorkerConfig } from '../firebase-worker-queue';

describe('FirebaseWorkerQueue Unit Tests', () => {
  let queue: FirebaseWorkerQueue;
  let testConfig: WorkerConfig;

  beforeEach(() => {
    testConfig = {
      concurrency: 2,
      maxRetries: 3,
      backoffDelay: 1000,
      stalledInterval: 5000,
      maxStalledCount: 2,
      maxQueueSize: 1000,
      rateLimitPerSecond: 10,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 30000
    };
    
    queue = new FirebaseWorkerQueue(testConfig);
  });

  afterEach(async () => {
    if (queue) {
      await queue.shutdown(false); // Force shutdown without waiting
    }
  });

  describe('Configuration', () => {
    it('should use provided configuration', () => {
      expect(queue).toBeInstanceOf(FirebaseWorkerQueue);
    });

    it('should use default configuration when none provided', () => {
      const defaultQueue = new FirebaseWorkerQueue();
      expect(defaultQueue).toBeInstanceOf(FirebaseWorkerQueue);
    });
  });

  describe('Metrics', () => {
    it('should return initial metrics', async () => {
      const metrics = await queue.getMetrics();
      
      expect(metrics).toHaveProperty('activeJobs');
      expect(metrics).toHaveProperty('waitingJobs');
      expect(metrics).toHaveProperty('completedJobs');
      expect(metrics).toHaveProperty('failedJobs');
      expect(metrics).toHaveProperty('workers');
      expect(metrics).toHaveProperty('throughput');
      
      expect(metrics.activeJobs).toBe(0);
      expect(metrics.waitingJobs).toBe(0);
      expect(metrics.completedJobs).toBe(0);
      expect(metrics.failedJobs).toBe(0);
    });

    it('should return queue status', async () => {
      const status = await queue.getQueueStatus();
      
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('details');
      expect(['healthy', 'degraded', 'critical']).toContain(status.health);
    });
  });

  describe('Queue Control', () => {
    it('should handle pause and resume', async () => {
      await queue.pauseQueue();
      await queue.resumeQueue();
      
      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should emit events on pause/resume', async () => {
      const pausePromise = new Promise(resolve => {
        queue.once('queuePaused', resolve);
      });

      const resumePromise = new Promise(resolve => {
        queue.once('queueResumed', resolve);
      });

      await queue.pauseQueue();
      await pausePromise;

      await queue.resumeQueue();
      await resumePromise;

      expect(true).toBe(true);
    });

    it('should reject operations when shutting down', async () => {
      await queue.pauseQueue(); // This sets isShuttingDown to true
      
      await expect(queue.queueProvider('test-provider')).rejects.toThrow(
        'System is shutting down, cannot queue new jobs'
      );
    });
  });

  describe('Worker Management', () => {
    it('should track worker count in metrics', async () => {
      const initialMetrics = await queue.getMetrics();
      expect(initialMetrics.workers).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should be an EventEmitter', () => {
      expect(queue.on).toBeDefined();
      expect(queue.emit).toBeDefined();
      expect(queue.removeListener).toBeDefined();
    });

    it('should emit events', (done) => {
      queue.once('test-event', (data) => {
        expect(data).toBe('test-data');
        done();
      });

      queue.emit('test-event', 'test-data');
    });
  });
}); 