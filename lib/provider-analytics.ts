/**
 * PROVIDER ANALYTICS & COST MONITORING
 * 
 * Tracks user engagement with providers and monitors Firebase costs
 * to make data-driven decisions about which providers to prioritize.
 */

import { log } from './logger';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';

export interface ProviderInteraction {
  providerId: string;
  action: 'view' | 'click' | 'subscribe' | 'share' | 'bookmark';
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata?: {
    source?: 'dashboard' | 'api' | 'notification';
    duration?: number;
    userAgent?: string;
  };
}

export interface ProviderAnalytics {
  providerId: string;
  providerName: string;
  totalInteractions: number;
  uniqueUsers: number;
  popularityScore: number;
  tier: 'high' | 'medium' | 'low';
  lastInteraction: Date;
  interactionsByType: {
    views: number;
    clicks: number;
    subscriptions: number;
    shares: number;
    bookmarks: number;
  };
  costMetrics: {
    monthlyChecks: number;
    estimatedMonthlyCost: number;
    costPerInteraction: number;
  };
}

export interface CostMetrics {
  currentMonth: {
    firestoreReads: number;
    firestoreWrites: number;
    functionInvocations: number;
    storageUsage: number;
    estimatedCost: number;
  };
  perProvider: Map<string, {
    operations: number;
    estimatedCost: number;
    lastUpdated: Date;
  }>;
  recommendations: string[];
}

export class ProviderAnalyticsManager {
  private db: ReturnType<typeof getFirestore> | null = null;
  private interactionBuffer: ProviderInteraction[] = [];
  private costMetrics: CostMetrics;
  private flushInterval: NodeJS.Timeout | null = null;

  // Firebase pricing (approximate, in USD)
  private readonly PRICING = {
    firestoreRead: 0.06 / 100000,    // $0.06 per 100k reads
    firestoreWrite: 0.18 / 100000,   // $0.18 per 100k writes
    functionInvocation: 0.40 / 1000000, // $0.40 per 1M invocations
    storageGB: 0.026,                // $0.026 per GB per month
  };

  constructor() {
    this.initializeFirestore();
    this.costMetrics = this.initializeCostMetrics();
    this.startPeriodicFlush();
  }

  private initializeFirestore(): void {
    try {
      this.db = getFirestore();
      log('info', 'Provider Analytics Manager initialized');
    } catch (error) {
      log('error', 'Failed to initialize Provider Analytics Manager', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private initializeCostMetrics(): CostMetrics {
    return {
      currentMonth: {
        firestoreReads: 0,
        firestoreWrites: 0,
        functionInvocations: 0,
        storageUsage: 0,
        estimatedCost: 0,
      },
      perProvider: new Map(),
      recommendations: [],
    };
  }

  /**
   * Track user interaction with a provider
   */
  async trackProviderInteraction(interaction: ProviderInteraction): Promise<void> {
    // Add to buffer for batch processing
    this.interactionBuffer.push(interaction);

    // Update cost metrics
    this.updateCostMetrics('interaction', interaction.providerId);

    // Immediate flush for high-priority actions
    if (interaction.action === 'subscribe' || interaction.action === 'bookmark') {
      await this.flushInteractions();
    }

    log('info', 'Provider interaction tracked', {
      providerId: interaction.providerId,
      action: interaction.action,
      source: interaction.metadata?.source
    });
  }

  /**
   * Track provider status check (for cost monitoring)
   */
  async trackProviderStatusCheck(providerId: string, operations: {
    reads?: number;
    writes?: number;
    functionCalls?: number;
  }): Promise<void> {
    const { reads = 1, writes = 1, functionCalls = 1 } = operations;

    // Update current month metrics
    this.costMetrics.currentMonth.firestoreReads += reads;
    this.costMetrics.currentMonth.firestoreWrites += writes;
    this.costMetrics.currentMonth.functionInvocations += functionCalls;

    // Update per-provider metrics
    const providerMetrics = this.costMetrics.perProvider.get(providerId) || {
      operations: 0,
      estimatedCost: 0,
      lastUpdated: new Date()
    };

    const operationCost = 
      (reads * this.PRICING.firestoreRead) +
      (writes * this.PRICING.firestoreWrite) +
      (functionCalls * this.PRICING.functionInvocation);

    providerMetrics.operations += (reads + writes + functionCalls);
    providerMetrics.estimatedCost += operationCost;
    providerMetrics.lastUpdated = new Date();

    this.costMetrics.perProvider.set(providerId, providerMetrics);
    this.costMetrics.currentMonth.estimatedCost += operationCost;

    // Generate recommendations
    this.updateCostRecommendations();
  }

  /**
   * Get provider analytics with cost data
   */
  async getProviderAnalytics(providerId: string): Promise<ProviderAnalytics | null> {
    if (!this.db) return null;

    try {
      const docRef = doc(this.db, 'provider_analytics', providerId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      const costData = this.costMetrics.perProvider.get(providerId);

      return {
        providerId: data.providerId,
        providerName: data.providerName,
        totalInteractions: data.totalInteractions || 0,
        uniqueUsers: data.uniqueUsers || 0,
        popularityScore: this.calculatePopularityScore(data),
        tier: this.calculateProviderTier(data),
        lastInteraction: data.lastInteraction?.toDate() || new Date(),
        interactionsByType: data.interactionsByType || {
          views: 0,
          clicks: 0,
          subscriptions: 0,
          shares: 0,
          bookmarks: 0
        },
        costMetrics: {
          monthlyChecks: costData?.operations || 0,
          estimatedMonthlyCost: costData?.estimatedCost || 0,
          costPerInteraction: data.totalInteractions > 0 
            ? (costData?.estimatedCost || 0) / data.totalInteractions 
            : 0
        }
      };
    } catch (error) {
      log('error', 'Failed to get provider analytics', {
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get top providers by user engagement
   */
  async getTopProviders(limit: number = 10): Promise<ProviderAnalytics[]> {
    if (!this.db) return [];

    try {
      // In a real implementation, you'd use Firestore queries
      // For now, we'll simulate with stored data
      const providers: ProviderAnalytics[] = [];
      
      // This would be replaced with actual Firestore query
      const mockProviders = ['openai', 'anthropic', 'google-ai', 'huggingface', 'cohere'];
      
      for (const providerId of mockProviders) {
        const analytics = await this.getProviderAnalytics(providerId);
        if (analytics) {
          providers.push(analytics);
        }
      }

      return providers
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, limit);
    } catch (error) {
      log('error', 'Failed to get top providers', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get cost monitoring dashboard data
   */
  getCostMetrics(): CostMetrics & {
    topCostProviders: Array<{
      providerId: string;
      cost: number;
      operations: number;
      costEfficiency: number;
    }>;
    projectedMonthlyCost: number;
    costTrends: {
      dailyAverage: number;
      weeklyTrend: 'increasing' | 'decreasing' | 'stable';
    };
  } {
    const topCostProviders = Array.from(this.costMetrics.perProvider.entries())
      .map(([providerId, metrics]) => ({
        providerId,
        cost: metrics.estimatedCost,
        operations: metrics.operations,
        costEfficiency: metrics.operations > 0 ? metrics.estimatedCost / metrics.operations : 0
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const dailyAverage = this.costMetrics.currentMonth.estimatedCost / new Date().getDate();
    const projectedMonthlyCost = dailyAverage * 30;

    return {
      ...this.costMetrics,
      topCostProviders,
      projectedMonthlyCost,
      costTrends: {
        dailyAverage,
        weeklyTrend: 'stable' // Would be calculated from historical data
      }
    };
  }

  /**
   * Get smart provider recommendations
   */
  async getProviderRecommendations(): Promise<{
    addProviders: string[];
    removeProviders: string[];
    optimizations: string[];
    reasoning: Record<string, string>;
  }> {
    const topProviders = await this.getTopProviders(20);
    const costMetrics = this.getCostMetrics();

    const addProviders: string[] = [];
    const removeProviders: string[] = [];
    const optimizations: string[] = [];
    const reasoning: Record<string, string> = {};

    // Analyze provider performance
    for (const provider of topProviders) {
      if (provider.tier === 'high' && provider.costMetrics.costPerInteraction < 0.001) {
        // High engagement, low cost - good provider
        reasoning[provider.providerId] = 'High user engagement with efficient costs';
      } else if (provider.tier === 'low' && provider.costMetrics.costPerInteraction > 0.01) {
        // Low engagement, high cost - consider removing
        removeProviders.push(provider.providerId);
        reasoning[provider.providerId] = 'Low user engagement with high operational costs';
      }
    }

    // Cost optimization recommendations
    if (costMetrics.projectedMonthlyCost > 100) {
      optimizations.push('Consider implementing more aggressive caching (6+ hour TTL)');
      optimizations.push('Reduce monitoring frequency for low-engagement providers');
    }

    if (costMetrics.topCostProviders.length > 0) {
      optimizations.push(`Focus optimization on top cost provider: ${costMetrics.topCostProviders[0].providerId}`);
    }

    return {
      addProviders,
      removeProviders,
      optimizations,
      reasoning
    };
  }

  /**
   * Flush interactions to database
   */
  private async flushInteractions(): Promise<void> {
    if (!this.db || this.interactionBuffer.length === 0) return;

    const interactions = [...this.interactionBuffer];
    this.interactionBuffer = [];

    try {
      // Group interactions by provider
      const providerGroups = new Map<string, ProviderInteraction[]>();
      for (const interaction of interactions) {
        const existing = providerGroups.get(interaction.providerId) || [];
        existing.push(interaction);
        providerGroups.set(interaction.providerId, existing);
      }

      // Update each provider's analytics
      for (const [providerId, providerInteractions] of providerGroups) {
        await this.updateProviderAnalytics(providerId, providerInteractions);
      }

      log('info', 'Flushed provider interactions', {
        totalInteractions: interactions.length,
        providers: providerGroups.size
      });
    } catch (error) {
      log('error', 'Failed to flush interactions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Put interactions back in buffer for retry
      this.interactionBuffer.unshift(...interactions);
    }
  }

  private async updateProviderAnalytics(providerId: string, interactions: ProviderInteraction[]): Promise<void> {
    if (!this.db) return;

    const docRef = doc(this.db, 'provider_analytics', providerId);
    
    try {
      // Count interactions by type
      const interactionCounts = {
        views: 0,
        clicks: 0,
        subscriptions: 0,
        shares: 0,
        bookmarks: 0
      };

      const uniqueUsers = new Set<string>();
      let latestInteraction = new Date(0);

             for (const interaction of interactions) {
         interactionCounts[interaction.action as keyof typeof interactionCounts]++;
         if (interaction.userId) {
           uniqueUsers.add(interaction.userId);
         }
         if (interaction.timestamp > latestInteraction) {
           latestInteraction = interaction.timestamp;
         }
       }

      // Update document
      await updateDoc(docRef, {
        totalInteractions: increment(interactions.length),
        uniqueUsers: increment(uniqueUsers.size),
        lastInteraction: Timestamp.fromDate(latestInteraction),
        'interactionsByType.views': increment(interactionCounts.views),
        'interactionsByType.clicks': increment(interactionCounts.clicks),
        'interactionsByType.subscriptions': increment(interactionCounts.subscriptions),
        'interactionsByType.shares': increment(interactionCounts.shares),
        'interactionsByType.bookmarks': increment(interactionCounts.bookmarks),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('No document to update')) {
                 // Create new document
         const uniqueUserIds = new Set(interactions.map(i => i.userId).filter(Boolean)).size;
         const latestTimestamp = interactions.reduce((latest, interaction) => 
           interaction.timestamp > latest ? interaction.timestamp : latest, new Date(0));
         
         // Recalculate interaction counts for new document
         const newInteractionCounts = {
           views: 0,
           clicks: 0,
           subscriptions: 0,
           shares: 0,
           bookmarks: 0
         };
         
         for (const interaction of interactions) {
           newInteractionCounts[interaction.action as keyof typeof newInteractionCounts]++;
         }
         
         await setDoc(docRef, {
           providerId,
           providerName: providerId, // Would be populated from provider config
           totalInteractions: interactions.length,
           uniqueUsers: uniqueUserIds,
           lastInteraction: Timestamp.fromDate(latestTimestamp),
           interactionsByType: newInteractionCounts,
           createdAt: Timestamp.now()
         });
      } else {
        throw error;
      }
    }
  }

  private calculatePopularityScore(data: any): number {
    const weights = {
      views: 1,
      clicks: 2,
      subscriptions: 5,
      shares: 3,
      bookmarks: 4
    };

    const interactions = data.interactionsByType || {};
    let score = 0;

    for (const [type, weight] of Object.entries(weights)) {
      score += (interactions[type] || 0) * weight;
    }

    // Factor in recency (interactions in last 7 days get bonus)
    const daysSinceLastInteraction = data.lastInteraction 
      ? (Date.now() - data.lastInteraction.toDate().getTime()) / (1000 * 60 * 60 * 24)
      : 30;
    
    const recencyMultiplier = daysSinceLastInteraction < 7 ? 1.5 : 1.0;

    return Math.round(score * recencyMultiplier);
  }

  private calculateProviderTier(data: any): 'high' | 'medium' | 'low' {
    const score = this.calculatePopularityScore(data);
    
    if (score >= 100) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  private updateCostMetrics(operation: string, providerId?: string): void {
    // Simple cost tracking
    this.costMetrics.currentMonth.functionInvocations += 1;
    
    if (providerId) {
      const existing = this.costMetrics.perProvider.get(providerId) || {
        operations: 0,
        estimatedCost: 0,
        lastUpdated: new Date()
      };
      existing.operations += 1;
      existing.estimatedCost += this.PRICING.functionInvocation;
      this.costMetrics.perProvider.set(providerId, existing);
    }
  }

  private updateCostRecommendations(): void {
    const recommendations: string[] = [];
    
    if (this.costMetrics.currentMonth.estimatedCost > 50) {
      recommendations.push('Monthly costs exceeding $50 - consider optimization');
    }
    
    if (this.costMetrics.perProvider.size > 50) {
      recommendations.push('Monitoring 50+ providers - implement tiered monitoring');
    }

    this.costMetrics.recommendations = recommendations;
  }

  private startPeriodicFlush(): void {
    // Flush interactions every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushInteractions();
    }, 30000);
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush any remaining interactions
    this.flushInteractions();
    
    log('info', 'Provider Analytics Manager destroyed');
  }
}

// Global instance
export const globalProviderAnalytics = new ProviderAnalyticsManager(); 