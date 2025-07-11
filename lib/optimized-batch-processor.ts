/**
 * OPTIMIZED BATCH PROCESSOR
 *
 * Replaces O(N²) operations with efficient algorithms optimized for
 * processing hundreds of AI providers simultaneously.
 */

import { log } from './logger';
import { withErrorHandling, ErrorContext } from './unified-error-handler';

// =============================================================================
// INTERFACES
// =============================================================================

export interface BatchItem<T = any> {
  id: string;
  data: T;
  priority: number;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface BatchResult<T = any> {
  id: string;
  success: boolean;
  result?: T;
  error?: string;
  processingTime: number;
  retryCount: number;
}

export interface BatchProcessorConfig {
  maxConcurrency: number;
  batchSize: number;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  priorityLevels: number;
  enableMetrics: boolean;
}

export interface ProcessorMetrics {
  totalProcessed: number;
  successfullyProcessed: number;
  failedProcessed: number;
  averageProcessingTime: number;
  throughputPerSecond: number;
  currentConcurrency: number;
  queueSize: number;
  retryRate: number;
}

// =============================================================================
// PRIORITY QUEUE IMPLEMENTATION
// =============================================================================

class PriorityQueue<T> {
  private heap: Array<{ priority: number; item: T }> = [];

  enqueue(item: T, priority: number): void {
    this.heap.push({ priority, item });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!.item;

    const result = this.heap[0].item;
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return result;
  }

  peek(): T | null {
    return this.heap.length > 0 ? this.heap[0].item : null;
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  clear(): void {
    this.heap = [];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority >= this.heap[index].priority) break;

      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let maxIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].priority > this.heap[maxIndex].priority
      ) {
        maxIndex = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].priority > this.heap[maxIndex].priority
      ) {
        maxIndex = rightChild;
      }

      if (maxIndex === index) break;

      [this.heap[index], this.heap[maxIndex]] = [this.heap[maxIndex], this.heap[index]];
      index = maxIndex;
    }
  }
}

// =============================================================================
// WORKER POOL IMPLEMENTATION
// =============================================================================

class WorkerPool<T, R> {
  private workers: Set<Promise<void>> = new Set();
  private maxWorkers: number;
  private processingFunction: (item: T) => Promise<R>;

  constructor(maxWorkers: number, processingFunction: (item: T) => Promise<R>) {
    this.maxWorkers = maxWorkers;
    this.processingFunction = processingFunction;
  }

  async execute(items: T[]): Promise<R[]> {
    if (items.length === 0) return [];

    const results: R[] = new Array(items.length);
    const promises: Promise<void>[] = [];

    let itemIndex = 0;

    const createWorker = async (): Promise<void> => {
      while (itemIndex < items.length) {
        const currentIndex = itemIndex++;
        const item = items[currentIndex];

        try {
          results[currentIndex] = await this.processingFunction(item);
        } catch (error) {
          // Error handling is done by the processing function
          throw error;
        }
      }
    };

    // Create workers up to max concurrency
    const workerCount = Math.min(this.maxWorkers, items.length);
    for (let i = 0; i < workerCount; i++) {
      promises.push(createWorker());
    }

    await Promise.all(promises);
    return results;
  }

  getCurrentWorkerCount(): number {
    return this.workers.size;
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers);
    this.workers.clear();
  }
}

// =============================================================================
// OPTIMIZED BATCH PROCESSOR
// =============================================================================

export class OptimizedBatchProcessor<T, R> {
  private config: BatchProcessorConfig;
  private queue: PriorityQueue<BatchItem<T>>;
  private processing = false;
  private metrics: ProcessorMetrics;
  private workerPool: WorkerPool<BatchItem<T>, BatchResult<R>>;
  private processingStartTime = 0;
  private processedItems = 0;

  constructor(
    private processor: (item: T) => Promise<R>,
    config: Partial<BatchProcessorConfig> = {}
  ) {
    this.config = {
      maxConcurrency: 50, // Optimized for hundreds of providers
      batchSize: 25, // Optimal batch size
      defaultTimeout: 10000, // 10 seconds
      maxRetries: 2, // Quick retries
      retryDelay: 1000, // 1 second retry delay
      priorityLevels: 5, // 5 priority levels
      enableMetrics: true,
      ...config,
    };

    this.queue = new PriorityQueue<BatchItem<T>>();
    this.metrics = this.initializeMetrics();

    this.workerPool = new WorkerPool(this.config.maxConcurrency, (item) =>
      this.processItemWithRetry(item)
    );
  }

  /**
   * Add item to processing queue
   */
  enqueue(item: BatchItem<T>): void {
    this.queue.enqueue(item, item.priority);
    this.updateQueueMetrics();
  }

  /**
   * Add multiple items to queue
   */
  enqueueBatch(items: BatchItem<T>[]): void {
    for (const item of items) {
      this.queue.enqueue(item, item.priority);
    }
    this.updateQueueMetrics();
  }

  /**
   * Process all queued items
   */
  async processAll(): Promise<BatchResult<R>[]> {
    if (this.processing) {
      throw new Error('Batch processor is already running');
    }

    this.processing = true;
    this.processingStartTime = Date.now();

    try {
      const allResults: BatchResult<R>[] = [];

      while (!this.queue.isEmpty()) {
        // Extract batch from queue
        const batch = this.extractBatch();

        if (batch.length === 0) break;

        log('info', `Processing batch of ${batch.length} items`);

        // Process batch using worker pool
        const batchResults = await this.workerPool.execute(batch);
        allResults.push(...batchResults);

        // Update metrics
        this.updateProcessingMetrics(batchResults);

        // Small delay between batches to prevent overwhelming
        if (!this.queue.isEmpty()) {
          await this.delay(100);
        }
      }

      log('info', `Completed processing ${allResults.length} items`);
      return allResults;
    } finally {
      this.processing = false;
      this.updateThroughputMetrics();
    }
  }

  /**
   * Process specific items immediately
   */
  async processItems(items: BatchItem<T>[]): Promise<BatchResult<R>[]> {
    if (items.length === 0) return [];

    log('info', `Processing ${items.length} items immediately`);

    // Group items by priority for optimal processing
    const priorityGroups = this.groupByPriority(items);
    const allResults: BatchResult<R>[] = [];

    // Process high priority items first
    for (const priority of Object.keys(priorityGroups).sort((a, b) => Number(b) - Number(a))) {
      const group = priorityGroups[Number(priority)];
      const batches = this.createBatches(group, this.config.batchSize);

      for (const batch of batches) {
        const batchResults = await this.workerPool.execute(batch);
        allResults.push(...batchResults);
        this.updateProcessingMetrics(batchResults);
      }
    }

    return allResults;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Check if processor is currently running
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.clear();
    this.updateQueueMetrics();
  }

  /**
   * Shutdown the processor
   */
  async shutdown(): Promise<void> {
    this.processing = false;
    this.clearQueue();
    await this.workerPool.shutdown();
    log('info', 'Optimized batch processor shutdown completed');
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Extract optimal batch from queue
   */
  private extractBatch(): BatchItem<T>[] {
    const batch: BatchItem<T>[] = [];
    const maxBatchSize = this.config.batchSize;

    // Extract items with preference for higher priority
    while (batch.length < maxBatchSize && !this.queue.isEmpty()) {
      const item = this.queue.dequeue();
      if (item) {
        batch.push(item);
      }
    }

    return batch;
  }

  /**
   * Process single item with retry logic
   */
  private async processItemWithRetry(item: BatchItem<T>): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const maxRetries = item.maxRetries ?? this.config.maxRetries;
    let retryCount = item.retryCount ?? 0;

    const context: ErrorContext = {
      component: 'BatchProcessor',
      operation: 'processItem',
      metadata: { itemId: item.id, retryCount },
    };

    while (retryCount <= maxRetries) {
      try {
        const result = await withErrorHandling(() => this.processWithTimeout(item), context);

        return {
          id: item.id,
          success: true,
          result,
          processingTime: Date.now() - startTime,
          retryCount,
        };
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          return {
            id: item.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Date.now() - startTime,
            retryCount: retryCount - 1,
          };
        }

        // Exponential backoff with jitter
        const delay = this.config.retryDelay * Math.pow(2, retryCount - 1);
        const jitter = Math.random() * 1000;
        await this.delay(delay + jitter);
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      id: item.id,
      success: false,
      error: 'Max retries exceeded',
      processingTime: Date.now() - startTime,
      retryCount: maxRetries,
    };
  }

  /**
   * Process item with timeout
   */
  private async processWithTimeout(item: BatchItem<T>): Promise<R> {
    const timeout = item.timeout ?? this.config.defaultTimeout;

    return Promise.race([
      this.processor(item.data),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      ),
    ]);
  }

  /**
   * Group items by priority
   */
  private groupByPriority(items: BatchItem<T>[]): Record<number, BatchItem<T>[]> {
    const groups: Record<number, BatchItem<T>[]> = {};

    for (const item of items) {
      const priority = item.priority;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(item);
    }

    return groups;
  }

  /**
   * Create batches from items array
   */
  private createBatches<U>(items: U[], batchSize: number): U[][] {
    const batches: U[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(results: BatchResult<R>[]): void {
    if (!this.config.enableMetrics) return;

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = results.length > 0 ? totalTime / results.length : 0;
    const retries = results.reduce((sum, r) => sum + r.retryCount, 0);

    this.metrics.totalProcessed += results.length;
    this.metrics.successfullyProcessed += successful;
    this.metrics.failedProcessed += failed;

    // Update running average
    const totalProcessed = this.metrics.totalProcessed;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalProcessed - results.length) + totalTime) /
      totalProcessed;

    // Update retry rate
    this.metrics.retryRate = retries / results.length;

    this.processedItems += results.length;
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(): void {
    if (!this.config.enableMetrics) return;

    this.metrics.queueSize = this.queue.size();
    this.metrics.currentConcurrency = this.workerPool.getCurrentWorkerCount();
  }

  /**
   * Update throughput metrics
   */
  private updateThroughputMetrics(): void {
    if (!this.config.enableMetrics || this.processingStartTime === 0) return;

    const duration = (Date.now() - this.processingStartTime) / 1000; // Convert to seconds
    this.metrics.throughputPerSecond = this.processedItems / duration;
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): ProcessorMetrics {
    return {
      totalProcessed: 0,
      successfullyProcessed: 0,
      failedProcessed: 0,
      averageProcessingTime: 0,
      throughputPerSecond: 0,
      currentConcurrency: 0,
      queueSize: 0,
      retryRate: 0,
    };
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an optimized batch processor for status fetching
 */
export function createStatusFetchProcessor<T, R>(
  processor: (item: T) => Promise<R>,
  config?: Partial<BatchProcessorConfig>
): OptimizedBatchProcessor<T, R> {
  const optimizedConfig: Partial<BatchProcessorConfig> = {
    maxConcurrency: 50,
    batchSize: 25,
    defaultTimeout: 10000,
    maxRetries: 2,
    retryDelay: 1000,
    priorityLevels: 3,
    enableMetrics: true,
    ...config,
  };

  return new OptimizedBatchProcessor(processor, optimizedConfig);
}

/**
 * Create batch items from simple data array
 */
export function createBatchItems<T>(
  data: T[],
  idExtractor: (item: T, index: number) => string,
  priorityExtractor?: (item: T, index: number) => number
): BatchItem<T>[] {
  return data.map((item, index) => ({
    id: idExtractor(item, index),
    data: item,
    priority: priorityExtractor ? priorityExtractor(item, index) : 1,
    retryCount: 0,
  }));
}
