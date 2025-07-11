/**
 * FIREBASE BATCH PROCESSOR
 * 
 * Optimized batch processing with quota management
 */

import { getFirestore, collection, doc, writeBatch, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirebaseProviderRegistry } from './firebase-provider-registry';
import { globalQuotaOptimizer } from './firebase-quota-optimizer';
import { globalPerformanceDetector, monitorPerformance } from './performance-bottleneck-detector';

const db = getFirestore();

export interface BatchJob {
  id: string;
  providerId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  result?: any;
  error?: string;
}

export class FirebaseBatchProcessor {
  private static instance: FirebaseBatchProcessor;
  private registry: FirebaseProviderRegistry;
  
  static getInstance(): FirebaseBatchProcessor {
    if (!this.instance) {
      this.instance = new FirebaseBatchProcessor();
    }
    return this.instance;
  }

  constructor() {
    this.registry = FirebaseProviderRegistry.getInstance();
  }

  /**
   * Create batch jobs with quota optimization
   */
  @monitorPerformance('createBatchJobs')
  async createBatchJobs(maxProviders: number = 100): Promise<string[]> {
    const operationId = `batch_${Date.now()}`;
    globalPerformanceDetector.startOperation(operationId, 'createBatchJobs', { maxProviders });

    try {
      const providers = await this.registry.getProvidersByPriority(maxProviders);
      const batchId = `batch_${Date.now()}`;

      // CRITICAL FIX: Use quota optimizer for intelligent batching
      const statusResults = providers.map(provider => ({
        id: `${batchId}_${provider.id}`,
        providerId: provider.id,
        priority: provider.priority,
        status: 'pending' as const,
        createdAt: new Date(),
      }));

      // Use quota optimizer for bulk write
      await globalQuotaOptimizer.bulkWriteStatusResults(statusResults);

      const jobIds = statusResults.map(result => result.id);
      
      console.log(`QUOTA OPTIMIZED: Created ${jobIds.length} jobs using optimized Firestore operations`);
      
      globalPerformanceDetector.endOperation(operationId, 'completed');
      return jobIds;

    } catch (error) {
      globalPerformanceDetector.endOperation(operationId, 'error');
      console.error('Failed to create batch jobs:', error);
      throw error;
    }
  }

  /**
   * Process batch with performance monitoring
   */
  @monitorPerformance('processBatch')
  async processBatch(batchId: string): Promise<void> {
    const operationId = `process_${batchId}`;
    globalPerformanceDetector.startOperation(operationId, 'processBatch', { batchId });

    try {
      // Implementation would go here
      console.log(`Processing batch: ${batchId}`);
      
      globalPerformanceDetector.endOperation(operationId, 'completed');
    } catch (error) {
      globalPerformanceDetector.endOperation(operationId, 'error');
      throw error;
    }
  }

  /**
   * Get quota and performance statistics
   */
  async getStats(): Promise<{
    quotaStats: any;
    performanceStats: any;
  }> {
    const quotaStats = globalQuotaOptimizer.getQuotaMetrics();
    const performanceStats = globalPerformanceDetector.getPerformanceStats();

    return {
      quotaStats,
      performanceStats
    };
  }

  async getPendingJobs(maxJobs: number = 50): Promise<BatchJob[]> {
    const q = query(
      collection(db, 'statusJobs'),
      where('status', '==', 'pending'),
      orderBy('priority', 'desc'),
      orderBy('createdAt', 'asc'),
      limit(maxJobs)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as BatchJob);
  }

  async markJobProcessing(jobId: string): Promise<void> {
    const jobRef = doc(db, 'statusJobs', jobId);
    const batch = writeBatch(db);
    
    batch.update(jobRef, {
      status: 'processing',
      startedAt: new Date(),
    });
    
    await batch.commit();
  }

  async completeJob(jobId: string, result: any, error?: string): Promise<void> {
    const jobRef = doc(db, 'statusJobs', jobId);
    const batch = writeBatch(db);
    
    batch.update(jobRef, {
      status: error ? 'failed' : 'completed',
      completedAt: new Date(),
      result: result,
      error: error,
    });
    
    await batch.commit();
  }

  async getJobMetrics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [pendingSnapshot, processingSnapshot, completedSnapshot, failedSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'statusJobs'), where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'statusJobs'), where('status', '==', 'processing'))),
      getDocs(query(collection(db, 'statusJobs'), where('status', '==', 'completed'))),
      getDocs(query(collection(db, 'statusJobs'), where('status', '==', 'failed'))),
    ]);

    return {
      pending: pendingSnapshot.size,
      processing: processingSnapshot.size,
      completed: completedSnapshot.size,
      failed: failedSnapshot.size,
    };
  }
} 