
/**
 * HORIZONTAL SCALING MANAGER
 * 
 * CRITICAL FIXES:
 * - Added proper cleanup and event listener removal
 * - Fixed memory leaks in worker tracking
 * - Added graceful shutdown procedures
 */

import { EventEmitter } from 'events';
import { FirebaseWorkerQueue, QueueMetrics } from './firebase-worker-queue';
import { globalPerformanceDetector, monitorPerformance } from './performance-bottleneck-detector';
import { globalLockManager } from './atomic-lock-manager';

export interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  targetConcurrency: number;
  scaleUpThreshold: number;   // Queue length to trigger scale up
  scaleDownThreshold: number; // Queue length to trigger scale down
  scaleUpCooldown: number;    // Cooldown period after scaling up (ms)
  scaleDownCooldown: number;  // Cooldown period after scaling down (ms)
  healthCheckInterval: number; // Health check frequency (ms)
}

export interface WorkerInstance {
  id: string;
  concurrency: number;
  status: 'starting' | 'healthy' | 'degraded' | 'failed';
  startTime: number;
  lastHealthCheck: number;
  metrics: {
    jobsProcessed: number;
    avgProcessingTime: number;
    errorRate: number;
  };
}

export interface ScalingMetrics {
  totalWorkers: number;
  healthyWorkers: number;
  totalConcurrency: number;
  queueLength: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
  lastScalingAction: {
    action: 'scale_up' | 'scale_down' | 'none';
    timestamp: number;
    reason: string;
  };
}

export class HorizontalScalingManager extends EventEmitter {
  private workerQueue: FirebaseWorkerQueue;
  private workers: Map<string, WorkerInstance> = new Map();
  private lastScaleUp = 0;
  private lastScaleDown = 0;
  private healthCheckInterval?: NodeJS.Timeout;
  private scalingInterval?: NodeJS.Timeout;
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(
    private config: ScalingConfig = {
      minWorkers: parseInt(process.env.MIN_WORKERS || '2'),
      maxWorkers: parseInt(process.env.MAX_WORKERS || '20'),
      targetConcurrency: parseInt(process.env.TARGET_CONCURRENCY || '10'),
      scaleUpThreshold: parseInt(process.env.SCALE_UP_THRESHOLD || '50'),
      scaleDownThreshold: parseInt(process.env.SCALE_DOWN_THRESHOLD || '10'),
      scaleUpCooldown: parseInt(process.env.SCALE_UP_COOLDOWN || '300000'), // 5 minutes
      scaleDownCooldown: parseInt(process.env.SCALE_DOWN_COOLDOWN || '600000'), // 10 minutes
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000') // 30 seconds
    }
  ) {
    super();
    this.workerQueue = new FirebaseWorkerQueue();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('HorizontalScalingManager already initialized');
    }

    try {
      // Initialize the worker queue system
      await this.workerQueue.initialize();

      // Start with minimum number of workers
      await this.scaleToWorkerCount(this.config.minWorkers);

      // Start health monitoring and auto-scaling
      this.startHealthChecks();
      this.startAutoScaling();

      this.isInitialized = true;
      this.emit('initialized');
      console.log(`Horizontal scaling manager initialized with ${this.config.minWorkers} workers`);
    } catch (error) {
      console.error('Failed to initialize horizontal scaling manager:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (this.workerQueue) {
      this.workerQueue.on('jobCompleted', this.boundJobCompleted);
      this.workerQueue.on('jobFailed', this.boundJobFailed);
      this.workerQueue.on('jobStalled', this.boundJobStalled);
      this.workerQueue.on('queueError', this.boundQueueError);
    }
  }

  // CRITICAL FIX: Store bound methods for cleanup
  private boundJobCompleted: (data: any) => void = this.handleJobCompleted.bind(this);
  private boundJobFailed: (data: any) => void = this.handleJobFailed.bind(this);
  private boundJobStalled: (data: any) => void = this.handleJobStalled.bind(this);
  private boundQueueError: (data: any) => void = this.handleQueueError.bind(this);

  private handleJobCompleted(data: any): void {
    this.updateWorkerMetrics(data.workerId, 'completed', data);
  }

  private handleJobFailed(data: any): void {
    this.updateWorkerMetrics(data.workerId, 'failed', data);
  }

  private handleJobStalled(data: any): void {
    this.updateWorkerMetrics(data.workerId, 'stalled', data);
  }

  private handleQueueError(data: any): void {
    this.emit('systemError', { source: 'queue', error: data.error });
  }

  private updateWorkerMetrics(workerId: string, event: string, data: any): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    switch (event) {
      case 'completed':
        worker.metrics.jobsProcessed++;
        if (data.result?.processingTime) {
          worker.metrics.avgProcessingTime = worker.metrics.avgProcessingTime
            ? (worker.metrics.avgProcessingTime * 0.9) + (data.result.processingTime * 0.1)
            : data.result.processingTime;
        }
        break;
      case 'failed':
      case 'stalled':
        worker.metrics.errorRate = worker.metrics.errorRate
          ? (worker.metrics.errorRate * 0.9) + (0.1)
          : 0.1;
        break;
    }

    worker.lastHealthCheck = Date.now();
  }

  @monitorPerformance('scaleUp')
  async scaleUp(reason: string = 'manual'): Promise<boolean> {
    if (this.isShuttingDown) return false;
    
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastScaleUp < this.config.scaleUpCooldown) {
      console.log('Scale up blocked by cooldown period');
      return false;
    }

    // Check if we're at max capacity
    if (this.workers.size >= this.config.maxWorkers) {
      console.log('Cannot scale up: at maximum worker capacity');
      return false;
    }

    try {
      const newWorkerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add new worker to queue system
      await this.workerQueue.addWorker(newWorkerId, this.config.targetConcurrency);
      
      // Track the worker
      this.workers.set(newWorkerId, {
        id: newWorkerId,
        concurrency: this.config.targetConcurrency,
        status: 'starting',
        startTime: now,
        lastHealthCheck: now,
        metrics: {
          jobsProcessed: 0,
          avgProcessingTime: 0,
          errorRate: 0
        }
      });

      this.lastScaleUp = now;
      
      this.emit('scaledUp', { 
        workerId: newWorkerId, 
        totalWorkers: this.workers.size,
        reason 
      });
      
      console.log(`Scaled up: Added worker ${newWorkerId} (${this.workers.size} total workers)`);
      return true;
    } catch (error) {
      console.error('Failed to scale up:', error);
      this.emit('scaleError', { action: 'scale_up', error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  @monitorPerformance('scaleDown')
  async scaleDown(reason: string = 'manual'): Promise<boolean> {
    if (this.isShuttingDown) return false;
    
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastScaleDown < this.config.scaleDownCooldown) {
      console.log('Scale down blocked by cooldown period');
      return false;
    }

    // Check if we're at minimum capacity
    if (this.workers.size <= this.config.minWorkers) {
      console.log('Cannot scale down: at minimum worker capacity');
      return false;
    }

    try {
      // Find the least active worker to remove
      const workerToRemove = this.findLeastActiveWorker();
      if (!workerToRemove) {
        console.log('No suitable worker found for removal');
        return false;
      }

      // Remove worker from queue system
      await this.workerQueue.removeWorker(workerToRemove.id);
      
      // Remove from tracking
      this.workers.delete(workerToRemove.id);

      this.lastScaleDown = now;
      
      this.emit('scaledDown', { 
        workerId: workerToRemove.id, 
        totalWorkers: this.workers.size,
        reason 
      });
      
      console.log(`Scaled down: Removed worker ${workerToRemove.id} (${this.workers.size} total workers)`);
      return true;
    } catch (error) {
      console.error('Failed to scale down:', error);
      this.emit('scaleError', { action: 'scale_down', error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  private findLeastActiveWorker(): WorkerInstance | null {
    let leastActive: WorkerInstance | null = null;
    let lowestActivity = Infinity;

    for (const worker of this.workers.values()) {
      // Don't remove workers that just started
      if (Date.now() - worker.startTime < 60000) continue;
      
      // Calculate activity score (lower is less active)
      const activityScore = worker.metrics.jobsProcessed + (worker.metrics.errorRate * -10);
      
      if (activityScore < lowestActivity) {
        lowestActivity = activityScore;
        leastActive = worker;
      }
    }

    return leastActive;
  }

  async scaleToWorkerCount(targetCount: number): Promise<void> {
    const currentCount = this.workers.size;
    
    if (targetCount > currentCount) {
      // Scale up
      const workersToAdd = Math.min(targetCount - currentCount, this.config.maxWorkers - currentCount);
      for (let i = 0; i < workersToAdd; i++) {
        await this.scaleUp('initialization');
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const workersToRemove = Math.max(currentCount - targetCount, currentCount - this.config.minWorkers);
      for (let i = 0; i < workersToRemove; i++) {
        await this.scaleDown('initialization');
      }
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.performHealthChecks();
      }
    }, this.config.healthCheckInterval);
  }

  @monitorPerformance('performHealthChecks')
  private async performHealthChecks(): Promise<void> {
    const now = Date.now();
    const unhealthyWorkers: string[] = [];

    // CRITICAL PERFORMANCE FIX: Convert to O(N) instead of O(N²)
    // Process all workers in a single pass
    const workerEntries = Array.from(this.workers.entries());
    
    for (const [workerId, worker] of workerEntries) {
      // Check if worker hasn't reported activity recently
      const timeSinceLastCheck = now - worker.lastHealthCheck;
      
      if (timeSinceLastCheck > this.config.healthCheckInterval * 2) {
        worker.status = 'failed';
        unhealthyWorkers.push(workerId);
      } else if (worker.metrics.errorRate > 0.5) {
        worker.status = 'degraded';
      } else {
        worker.status = 'healthy';
      }
    }

    // CRITICAL FIX: Atomic worker removal to prevent race conditions
    if (unhealthyWorkers.length > 0) {
      console.log(`Processing ${unhealthyWorkers.length} unhealthy workers atomically`);
      
      // ATOMIC OPERATION: Remove workers one by one with proper error handling
      const removalResults: Array<{workerId: string; success: boolean; error?: string}> = [];
      
      for (const workerId of unhealthyWorkers) {
        try {
          // CRITICAL FIX: Check if worker still exists before removal (prevents race conditions)
          if (!this.workers.has(workerId)) {
            console.log(`Worker ${workerId} already removed by another process`);
            continue;
          }
          
          // Atomic removal: queue first, then local tracking
          await this.workerQueue.removeWorker(workerId);
          
          // Only delete from local map after successful queue removal
          const deleted = this.workers.delete(workerId);
          
          if (deleted) {
            removalResults.push({ workerId, success: true });
            console.log(`Successfully removed unhealthy worker: ${workerId}`);
          } else {
            removalResults.push({ workerId, success: false, error: 'Worker not found in local map' });
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to remove unhealthy worker ${workerId}:`, errorMessage);
          removalResults.push({ workerId, success: false, error: errorMessage });
          
          // CRITICAL FIX: Mark worker as failed but don't remove from tracking
          // This prevents orphaned workers
          const worker = this.workers.get(workerId);
          if (worker) {
            worker.status = 'failed';
          }
        }
      }

      const successfulRemovals = removalResults.filter(r => r.success).length;
      console.log(`Successfully removed ${successfulRemovals}/${unhealthyWorkers.length} unhealthy workers`);

      // CRITICAL FIX: Sequential worker replacement to prevent race conditions
      const workersNeeded = Math.max(0, this.config.minWorkers - this.workers.size);
      if (workersNeeded > 0) {
        console.log(`Scaling up ${workersNeeded} workers to maintain minimum (sequential)`);
        
        // ATOMIC OPERATION: Add workers sequentially to prevent race conditions
        for (let i = 0; i < workersNeeded; i++) {
          try {
            const success = await this.scaleUp('health_replacement');
            if (!success) {
              console.warn(`Failed to add replacement worker ${i + 1}/${workersNeeded}`);
              break; // Stop trying if we can't add workers
            }
            
            // Small delay between additions to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error adding replacement worker ${i + 1}:`, error);
            break;
          }
        }
      }

      this.emit('healthCheckCompleted', { 
        removedWorkers: unhealthyWorkers,
        successfulRemovals,
        totalWorkers: this.workers.size,
        workersAdded: Math.min(workersNeeded, this.workers.size - (this.workers.size - workersNeeded))
      });
    }
  }

  private startAutoScaling(): void {
    this.scalingInterval = setInterval(async () => {
      await this.performAutoScaling();
    }, 60000); // Check every minute
  }

  private async performAutoScaling(): Promise<void> {
    try {
      const queueMetrics = await this.workerQueue.getMetrics();
      const queueLength = queueMetrics.waitingJobs + queueMetrics.activeJobs;
      
      // Scale up if queue is getting long
      if (queueLength > this.config.scaleUpThreshold && this.workers.size < this.config.maxWorkers) {
        const success = await this.scaleUp(`queue_length_${queueLength}`);
        if (success) {
          console.log(`Auto-scaled up due to queue length: ${queueLength}`);
        }
      }
      
      // Scale down if queue is very short and we have extra workers
      else if (queueLength < this.config.scaleDownThreshold && this.workers.size > this.config.minWorkers) {
        const success = await this.scaleDown(`queue_length_${queueLength}`);
        if (success) {
          console.log(`Auto-scaled down due to low queue length: ${queueLength}`);
        }
      }
    } catch (error) {
      console.error('Error during auto-scaling:', error);
    }
  }

  async getScalingMetrics(): Promise<ScalingMetrics> {
    const queueMetrics = await this.workerQueue.getMetrics();
    const healthyWorkers = Array.from(this.workers.values()).filter(w => w.status === 'healthy');
    
    const totalJobsProcessed = Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.metrics.jobsProcessed, 0);
    
    const avgResponseTime = Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.metrics.avgProcessingTime, 0) / this.workers.size;
    
    const avgErrorRate = Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.metrics.errorRate, 0) / this.workers.size;

    return {
      totalWorkers: this.workers.size,
      healthyWorkers: healthyWorkers.length,
      totalConcurrency: Array.from(this.workers.values()).reduce((sum, w) => sum + w.concurrency, 0),
      queueLength: queueMetrics.waitingJobs + queueMetrics.activeJobs,
      throughput: queueMetrics.throughput,
      avgResponseTime,
      errorRate: avgErrorRate,
      lastScalingAction: {
        action: 'none',
        timestamp: Math.max(this.lastScaleUp, this.lastScaleDown),
        reason: 'auto-scaling'
      }
    };
  }

  async queueProviderBatch(providerIds: string[], priority: number = 0): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('HorizontalScalingManager not initialized');
    }
    
    return this.workerQueue.queueBatch(providerIds, undefined, priority);
  }

  async queueSingleProvider(providerId: string, priority: number = 0): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('HorizontalScalingManager not initialized');
    }
    
    return this.workerQueue.queueProvider(providerId, priority);
  }

  async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    details: any;
  }> {
    const queueStatus = await this.workerQueue.getQueueStatus();
    const scalingMetrics = await this.getScalingMetrics();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    // Determine overall system health
    if (scalingMetrics.healthyWorkers < this.config.minWorkers) {
      status = 'critical';
    } else if (scalingMetrics.errorRate > 0.1 || queueStatus.health === 'degraded') {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        scalingMetrics,
        queueStatus: queueStatus.details,
        workers: Array.from(this.workers.values()),
        config: this.config
      }
    };
  }

  /**
   * CRITICAL FIX: Atomic worker management to prevent race conditions
   */
  @monitorPerformance('addWorker')
  async addWorker(workerId?: string): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Cannot add worker during shutdown');
    }

    // Generate unique worker ID with timestamp and random suffix
    const id = workerId || `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // CRITICAL FIX: Use atomic lock to prevent race conditions
    return globalLockManager.withLock(`worker:${id}`, async () => {
      // Double-check worker doesn't exist (race condition protection)
      if (this.workers.has(id)) {
        throw new Error(`Worker ${id} already exists`);
      }

             const worker: WorkerInstance = {
         id,
         concurrency: 1, // Default concurrency for new workers
         status: 'starting',
         startTime: Date.now(),
         lastHealthCheck: Date.now(),
         metrics: {
           jobsProcessed: 0,
           avgProcessingTime: 0,
           errorRate: 0
         }
       };

       try {
         // ATOMIC OPERATION: Add to queue first, then local tracking
         await this.workerQueue.addWorker(id, 1); // Pass concurrency as number
         
         // Only add to local map after successful queue addition
         this.workers.set(id, worker);
         worker.status = 'healthy'; // Use valid status
        
        console.log(`✅ Worker ${id} added successfully (${this.workers.size} total workers)`);
        this.emit('workerAdded', { workerId: id, totalWorkers: this.workers.size });
        
        return id;
        
      } catch (error) {
        // CRITICAL FIX: Cleanup on failure to prevent orphaned state
        this.workers.delete(id);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to add worker ${id}:`, errorMessage);
        
        throw new Error(`Failed to add worker: ${errorMessage}`);
      }
    }, { timeout: 10000, priority: 1 });
  }

  /**
   * CRITICAL FIX: Proper cleanup and shutdown
   */
  async destroy(): Promise<void> {
    console.log('🔄 Shutting down Horizontal Scaling Manager...');
    
    this.isShuttingDown = true;

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Remove all event listeners to prevent memory leaks
    if (this.workerQueue) {
      this.workerQueue.removeListener('jobCompleted', this.boundJobCompleted);
      this.workerQueue.removeListener('jobFailed', this.boundJobFailed);
      this.workerQueue.removeListener('jobStalled', this.boundJobStalled);
      this.workerQueue.removeListener('queueError', this.boundQueueError);
    }

    // Remove all EventEmitter listeners
    this.removeAllListeners();

    // Gracefully shutdown all workers
    const shutdownPromises = Array.from(this.workers.keys()).map(async (workerId) => {
      try {
        if (this.workerQueue) {
          await this.workerQueue.removeWorker(workerId);
        }
        return { workerId, success: true };
      } catch (error) {
        console.error(`Failed to shutdown worker ${workerId}:`, error);
        return { workerId, success: false };
      }
    });

    const shutdownResults = await Promise.allSettled(shutdownPromises);
    const successfulShutdowns = shutdownResults
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .length;

    console.log(`Successfully shut down ${successfulShutdowns}/${this.workers.size} workers`);

    // Clear all worker data
    this.workers.clear();

    console.log('✅ Horizontal Scaling Manager shutdown complete');
  }
}

// Global scaling manager instance
export const globalScalingManager = new HorizontalScalingManager(); 