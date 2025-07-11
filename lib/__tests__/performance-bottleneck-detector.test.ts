/**
 * Tests for Performance Bottleneck Detection System
 */

import { PerformanceBottleneckDetector, monitorPerformance } from '../performance-bottleneck-detector';

describe('PerformanceBottleneckDetector', () => {
  let detector: PerformanceBottleneckDetector;

  beforeEach(() => {
    detector = new PerformanceBottleneckDetector();
  });

  afterEach(async () => {
    await detector.destroy();
  });

  describe('Operation Tracking', () => {
    it('should track operation start and end', () => {
      const operationId = 'test-op-' + Date.now();
      detector.startOperation(operationId, 'test operation');
      
      detector.endOperation(operationId, 'completed');
      
      const stats = detector.getPerformanceStats();
      expect(stats.completedOperations).toBeGreaterThanOrEqual(1);
    });

    it('should detect slow operations', () => {
      const operationId = 'slow-op-' + Date.now();
      detector.startOperation(operationId, 'slow operation');
      
      // Simulate slow operation by manually setting start time
      const operations = (detector as any).runningOperations;
      if (operations.has(operationId)) {
        operations.get(operationId).startTime = Date.now() - 6000; // 6 seconds ago (above threshold)
      }
      
      detector.endOperation(operationId, 'completed');
      
      const stats = detector.getPerformanceStats();
      expect(stats.slowOperations).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance Decorator', () => {
    it('should monitor decorated function performance', async () => {
      class TestClass {
        @monitorPerformance('testMethod')
        async testMethod(delay: number = 0): Promise<string> {
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return 'success';
        }
      }

      const instance = new TestClass();
      const result = await instance.testMethod();
      
      expect(result).toBe('success');
      
      // Allow time for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
}); 