/**
 * CRITICAL MEMORY MONITOR
 *
 * Prevents system crashes from memory exhaustion by monitoring
 * and enforcing memory limits across all operations.
 */

interface MemoryThresholds {
  warning: number; // 80% - start cleanup
  critical: number; // 90% - aggressive cleanup
  emergency: number; // 95% - emergency shutdown
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  usagePercent: number;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly thresholds: MemoryThresholds = {
    warning: 0.8, // 80%
    critical: 0.9, // 90%
    emergency: 0.95, // 95%
  };

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 10000); // Check every 10 seconds
  }

  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();

    if (stats.usagePercent >= this.thresholds.emergency) {
      this.handleEmergency(stats);
    } else if (stats.usagePercent >= this.thresholds.critical) {
      this.handleCritical(stats);
    } else if (stats.usagePercent >= this.thresholds.warning) {
      this.handleWarning(stats);
    }
  }

  private getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      usagePercent: memUsage.rss / totalMemory,
    };
  }

  private handleWarning(stats: MemoryStats): void {
    // Start gentle cleanup
    if (global.gc) {
      global.gc();
    }
  }

  private handleCritical(stats: MemoryStats): void {
    // Aggressive cleanup
    if (global.gc) {
      global.gc();
    }

    // Clear caches
    this.clearSystemCaches();
  }

  private handleEmergency(stats: MemoryStats): void {
    // Emergency shutdown to prevent crash
    process.exit(1);
  }

  private clearSystemCaches(): void {
    // Clear various system caches
    try {
      // Clear require cache for non-core modules
      Object.keys(require.cache).forEach((key) => {
        if (!key.includes('node_modules')) {
          delete require.cache[key];
        }
      });
    } catch (error) {
      // Ignore cache clearing errors
    }
  }

  checkMemoryLimit(operation: string, threshold: number = 0.85): boolean {
    const stats = this.getMemoryStats();

    if (stats.usagePercent > threshold) {
      throw new Error(
        `Memory limit exceeded for operation: ${operation} (${(stats.usagePercent * 100).toFixed(1)}% used)`
      );
    }

    return true;
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Global memory monitor instance
export const globalMemoryMonitor = MemoryMonitor.getInstance();

// Memory guard decorator for critical operations
export function memoryGuard(threshold: number = 0.85) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      globalMemoryMonitor.checkMemoryLimit(`${target.constructor.name}.${propertyKey}`, threshold);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
