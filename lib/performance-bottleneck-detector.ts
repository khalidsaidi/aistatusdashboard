/**
 * PERFORMANCE BOTTLENECK DETECTOR
 *
 * Identifies and prevents blocking operations that cause
 * timeouts and performance degradation under load.
 */

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'timeout' | 'error';
  metadata?: any;
}

interface BottleneckAlert {
  type: 'blocking_operation' | 'memory_leak' | 'infinite_loop' | 'quota_exhaustion';
  severity: 'warning' | 'critical' | 'emergency';
  operation: string;
  duration: number;
  impact: string;
  recommendation: string;
  timestamp: number;
}

/**
 * Performance bottleneck detector with real-time monitoring
 */
export class PerformanceBottleneckDetector {
  private runningOperations = new Map<string, PerformanceMetric>();
  private completedOperations: PerformanceMetric[] = [];
  private bottleneckAlerts: BottleneckAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  private readonly thresholds = {
    operationTimeout: 30000, // 30 seconds
    blockingThreshold: 5000, // 5 seconds
    memoryLeakThreshold: 100, // 100 operations without cleanup
    emergencyThreshold: 60000, // 1 minute
  };

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start tracking an operation
   */
  startOperation(operationId: string, operationName: string, metadata?: any): void {
    const metric: PerformanceMetric = {
      operation: operationName,
      startTime: Date.now(),
      status: 'running',
      metadata,
    };

    this.runningOperations.set(operationId, metric);

    // Set automatic timeout detection
    setTimeout(() => {
      this.checkOperationTimeout(operationId);
    }, this.thresholds.operationTimeout);
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId: string, status: 'completed' | 'error' = 'completed'): void {
    const metric = this.runningOperations.get(operationId);

    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.status = status;

      // Move to completed operations
      this.runningOperations.delete(operationId);
      this.completedOperations.push(metric);

      // Analyze for bottlenecks
      this.analyzeOperation(metric);

      // Cleanup old completed operations
      this.cleanupCompletedOperations();
    }
  }

  /**
   * Check for operation timeout
   */
  private checkOperationTimeout(operationId: string): void {
    const metric = this.runningOperations.get(operationId);

    if (metric && metric.status === 'running') {
      const duration = Date.now() - metric.startTime;

      if (duration >= this.thresholds.operationTimeout) {
        // Mark as timeout
        metric.status = 'timeout';
        metric.endTime = Date.now();
        metric.duration = duration;

        // Create alert
        this.createBottleneckAlert({
          type: 'blocking_operation',
          severity: duration >= this.thresholds.emergencyThreshold ? 'emergency' : 'critical',
          operation: metric.operation,
          duration,
          impact: `Operation blocked for ${duration}ms, likely causing user timeouts`,
          recommendation:
            'Add timeout protection, break into smaller operations, or implement async processing',
          timestamp: Date.now(),
        });

        // Move to completed
        this.runningOperations.delete(operationId);
        this.completedOperations.push(metric);
      }
    }
  }

  /**
   * Analyze operation for performance issues
   */
  private analyzeOperation(metric: PerformanceMetric): void {
    if (!metric.duration) return;

    // Check for blocking operations
    if (metric.duration >= this.thresholds.blockingThreshold) {
      const severity: 'warning' | 'critical' | 'emergency' =
        metric.duration >= this.thresholds.emergencyThreshold
          ? 'emergency'
          : metric.duration >= this.thresholds.operationTimeout
            ? 'critical'
            : 'warning';

      this.createBottleneckAlert({
        type: 'blocking_operation',
        severity,
        operation: metric.operation,
        duration: metric.duration,
        impact: `Slow operation detected - ${metric.duration}ms execution time`,
        recommendation: this.getRecommendationForOperation(metric),
        timestamp: Date.now(),
      });
    }

    // Check for memory leak patterns
    this.checkMemoryLeakPattern(metric);
  }

  /**
   * Check for memory leak patterns
   */
  private checkMemoryLeakPattern(metric: PerformanceMetric): void {
    // Count similar operations in recent history
    const recentSimilarOps = this.completedOperations.filter(
      (op) => op.operation === metric.operation && Date.now() - op.startTime < 60000 // Last minute
    ).length;

    if (recentSimilarOps >= this.thresholds.memoryLeakThreshold) {
      this.createBottleneckAlert({
        type: 'memory_leak',
        severity: 'critical',
        operation: metric.operation,
        duration: 0,
        impact: `Potential memory leak: ${recentSimilarOps} instances of '${metric.operation}' in last minute`,
        recommendation: 'Check for resource cleanup, event listener removal, and cache management',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get performance recommendation for operation
   */
  private getRecommendationForOperation(metric: PerformanceMetric): string {
    const operation = metric.operation.toLowerCase();

    if (operation.includes('database') || operation.includes('firestore')) {
      return 'Use batch operations, implement pagination, add connection pooling';
    }

    if (operation.includes('fetch') || operation.includes('http')) {
      return 'Add request timeout, implement retry with backoff, use connection pooling';
    }

    if (operation.includes('cache') || operation.includes('memory')) {
      return 'Implement cache size limits, add automatic cleanup, use weak references';
    }

    if (operation.includes('lock') || operation.includes('mutex')) {
      return 'Add lock timeout, implement deadlock detection, use atomic operations';
    }

    if (operation.includes('queue') || operation.includes('batch')) {
      return 'Implement queue size limits, add processing timeout, use parallel processing';
    }

    return 'Add timeout protection, implement async processing, break into smaller operations';
  }

  /**
   * Create bottleneck alert
   */
  private createBottleneckAlert(alert: BottleneckAlert): void {
    this.bottleneckAlerts.push(alert);

    // Log alert based on severity
    const logLevel =
      alert.severity === 'emergency' ? 'error' : alert.severity === 'critical' ? 'warn' : 'info';

    console[logLevel](`🚨 PERFORMANCE BOTTLENECK [${alert.severity.toUpperCase()}]:`, {
      type: alert.type,
      operation: alert.operation,
      duration: alert.duration,
      impact: alert.impact,
      recommendation: alert.recommendation,
    });

    // Emergency actions
    if (alert.severity === 'emergency') {
      this.triggerEmergencyActions(alert);
    }

    // Cleanup old alerts
    this.cleanupOldAlerts();
  }

  /**
   * Trigger emergency actions for critical bottlenecks
   */
  private triggerEmergencyActions(alert: BottleneckAlert): void {
    console.error('🚨 EMERGENCY PERFORMANCE ISSUE - Taking corrective actions');

    // Force garbage collection if available
    if (global.gc) {
      try {
        global.gc();
        console.log('🧹 Emergency garbage collection triggered');
      } catch (error) {
        console.warn('Failed to trigger garbage collection:', error);
      }
    }

    // Cancel long-running operations
    if (alert.type === 'blocking_operation') {
      this.cancelLongRunningOperations();
    }

    // Clear caches if memory leak detected
    if (alert.type === 'memory_leak') {
      this.emergencyMemoryCleanup();
    }
  }

  /**
   * Cancel long-running operations
   */
  private cancelLongRunningOperations(): void {
    const now = Date.now();
    const operationsToCancel: string[] = [];

    for (const [operationId, metric] of this.runningOperations.entries()) {
      if (now - metric.startTime >= this.thresholds.emergencyThreshold) {
        operationsToCancel.push(operationId);
      }
    }

    for (const operationId of operationsToCancel) {
      console.warn(`⚡ Emergency cancellation of operation: ${operationId}`);
      this.endOperation(operationId, 'error');
    }
  }

  /**
   * Emergency memory cleanup
   */
  private emergencyMemoryCleanup(): void {
    // Clear completed operations history
    this.completedOperations.length = 0;

    // Clear old alerts
    this.bottleneckAlerts.length = 0;

    console.log('🧹 Emergency memory cleanup completed');
  }

  /**
   * Monitor running operations for bottlenecks
   */
  private monitorRunningOperations(): void {
    const now = Date.now();

    for (const [operationId, metric] of this.runningOperations.entries()) {
      const duration = now - metric.startTime;

      // Check for potential infinite loops
      if (duration >= this.thresholds.emergencyThreshold * 2) {
        this.createBottleneckAlert({
          type: 'infinite_loop',
          severity: 'emergency',
          operation: metric.operation,
          duration,
          impact: `Potential infinite loop detected - operation running for ${duration}ms`,
          recommendation: 'Kill operation immediately, check for infinite loops in code',
          timestamp: now,
        });
      }
    }
  }

  /**
   * Start monitoring interval
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.monitorRunningOperations();
    }, 5000); // Check every 5 seconds

    // In test environment, unref the interval to prevent hanging
    if (process.env.NODE_ENV === 'test') {
      this.monitoringInterval.unref();
    }
  }

  /**
   * Cleanup old completed operations
   */
  private cleanupCompletedOperations(): void {
    const maxHistory = 1000;
    if (this.completedOperations.length > maxHistory) {
      this.completedOperations.splice(0, this.completedOperations.length - maxHistory);
    }
  }

  /**
   * Cleanup old alerts
   */
  private cleanupOldAlerts(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    this.bottleneckAlerts = this.bottleneckAlerts.filter((alert) => now - alert.timestamp < maxAge);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    runningOperations: number;
    completedOperations: number;
    averageOperationTime: number;
    slowOperations: number;
    bottleneckAlerts: number;
    emergencyAlerts: number;
  } {
    const slowOperations = this.completedOperations.filter(
      (op) => op.duration && op.duration >= this.thresholds.blockingThreshold
    ).length;

    const averageTime =
      this.completedOperations.length > 0
        ? this.completedOperations.reduce((sum, op) => sum + (op.duration || 0), 0) /
          this.completedOperations.length
        : 0;

    const emergencyAlerts = this.bottleneckAlerts.filter(
      (alert) => alert.severity === 'emergency'
    ).length;

    return {
      runningOperations: this.runningOperations.size,
      completedOperations: this.completedOperations.length,
      averageOperationTime: Math.round(averageTime),
      slowOperations,
      bottleneckAlerts: this.bottleneckAlerts.length,
      emergencyAlerts,
    };
  }

  /**
   * Get recent bottleneck alerts
   */
  getRecentAlerts(limit: number = 10): BottleneckAlert[] {
    return this.bottleneckAlerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Shutdown and cleanup
   */
  destroy(): void {
    // Clear monitoring interval immediately in test environment
    if (process.env.NODE_ENV === 'test') {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.runningOperations.clear();
    this.completedOperations.length = 0;
    this.bottleneckAlerts.length = 0;
  }
}

// Global performance detector instance
export const globalPerformanceDetector = new PerformanceBottleneckDetector();

/**
 * Decorator for automatic performance monitoring
 */
export function monitorPerformance(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      globalPerformanceDetector.startOperation(operationId, operation, {
        args: args.length,
        className: target.constructor.name,
        methodName: propertyKey,
      });

      try {
        const result = await originalMethod.apply(this, args);
        globalPerformanceDetector.endOperation(operationId, 'completed');
        return result;
      } catch (error) {
        globalPerformanceDetector.endOperation(operationId, 'error');
        throw error;
      }
    };

    return descriptor;
  };
}
