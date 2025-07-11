import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { FirebaseProviderRegistry, ProviderRegistryEntry } from './firebase-provider-registry';

const db = getFirestore();

export interface DiscoveryCandidate {
  id: string;
  name: string;
  statusUrl: string;
  statusPageUrl: string;
  category: 'llm' | 'vision' | 'audio' | 'multimodal' | 'general';
  confidence: number; // 0-1 confidence score
  discoveryMethod: 'manual' | 'crawl' | 'api' | 'community';
  validationStatus: 'pending' | 'validating' | 'validated' | 'rejected';
  discoveredAt: Date;
  lastValidated?: Date;
  validationResults?: {
    statusUrlWorks: boolean;
    statusPageWorks: boolean;
    hasValidFormat: boolean;
    responseTime: number;
    errorCount: number;
  };
}

export class FirebaseProviderDiscovery {
  private static instance: FirebaseProviderDiscovery;
  private registry: FirebaseProviderRegistry;

  static getInstance(): FirebaseProviderDiscovery {
    if (!this.instance) {
      this.instance = new FirebaseProviderDiscovery();
    }
    return this.instance;
  }

  constructor() {
    this.registry = FirebaseProviderRegistry.getInstance();
  }

  async addDiscoveryCandidate(
    candidate: Omit<DiscoveryCandidate, 'discoveredAt' | 'validationStatus'>
  ): Promise<void> {
    const candidateDoc = doc(db, 'discoveryQueue', candidate.id);

    await setDoc(candidateDoc, {
      ...candidate,
      discoveredAt: new Date(),
      validationStatus: 'pending',
    });
  }

  async getPendingCandidates(maxCount: number = 50): Promise<DiscoveryCandidate[]> {
    const q = query(
      collection(db, 'discoveryQueue'),
      where('validationStatus', '==', 'pending'),
      orderBy('confidence', 'desc'),
      orderBy('discoveredAt', 'asc'),
      limit(maxCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as DiscoveryCandidate);
  }

  async validateCandidate(candidateId: string): Promise<{
    isValid: boolean;
    confidence: number;
    results: any;
  }> {
    const candidateDoc = doc(db, 'discoveryQueue', candidateId);

    // Mark as validating
    await setDoc(
      candidateDoc,
      {
        validationStatus: 'validating',
        lastValidated: new Date(),
      },
      { merge: true }
    );

    try {
      const candidate = await this.getCandidateById(candidateId);
      if (!candidate) throw new Error('Candidate not found');

      const results = await this.performValidation(candidate);
      const confidence = this.calculateConfidence(results);
      const isValid = confidence >= 0.7; // 70% confidence threshold

      // Update validation results
      await setDoc(
        candidateDoc,
        {
          validationStatus: isValid ? 'validated' : 'rejected',
          confidence: confidence,
          validationResults: results,
          lastValidated: new Date(),
        },
        { merge: true }
      );

      // If valid, promote to provider registry
      if (isValid) {
        await this.promoteToRegistry(candidate, confidence);
      }

      return { isValid, confidence, results };
    } catch (error) {
      await setDoc(
        candidateDoc,
        {
          validationStatus: 'rejected',
          validationResults: {
            error: (error as Error).message,
          },
          lastValidated: new Date(),
        },
        { merge: true }
      );

      return {
        isValid: false,
        confidence: 0,
        results: { error: (error as Error).message },
      };
    }
  }

  private async getCandidateById(candidateId: string): Promise<DiscoveryCandidate | null> {
    const candidateDoc = doc(db, 'discoveryQueue', candidateId);
    const snapshot = await getDocs(
      query(collection(db, 'discoveryQueue'), where('__name__', '==', candidateId))
    );
    return snapshot.empty ? null : (snapshot.docs[0].data() as DiscoveryCandidate);
  }

  private async performValidation(candidate: DiscoveryCandidate): Promise<any> {
    const results = {
      statusUrlWorks: false,
      statusPageWorks: false,
      hasValidFormat: false,
      responseTime: 0,
      errorCount: 0,
    };

    // Test status URL
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(candidate.statusUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AI-Status-Dashboard-Discovery/1.0',
        },
      });

      clearTimeout(timeoutId);

      results.responseTime = Date.now() - startTime;
      results.statusUrlWorks = response.ok;

      if (response.ok) {
        const data = await response.json();
        results.hasValidFormat = this.validateStatusFormat(data);
      }
    } catch (error) {
      results.errorCount++;
    }

    // Test status page URL
    try {
      const pageController = new AbortController();
      const pageTimeoutId = setTimeout(() => pageController.abort(), 5000);

      const pageResponse = await fetch(candidate.statusPageUrl, {
        method: 'HEAD',
        signal: pageController.signal,
      });

      clearTimeout(pageTimeoutId);
      results.statusPageWorks = pageResponse.ok;
    } catch (error) {
      results.errorCount++;
    }

    return results;
  }

  private validateStatusFormat(data: any): boolean {
    // Check for common status page formats
    if (data?.status?.indicator) return true; // StatusPage v2
    if (data?.page?.id) return true; // StatusPage v1
    if (Array.isArray(data) && data.length >= 0) return true; // Google Cloud format
    return false;
  }

  private calculateConfidence(results: any): number {
    let score = 0;

    if (results.statusUrlWorks) score += 0.4;
    if (results.statusPageWorks) score += 0.2;
    if (results.hasValidFormat) score += 0.3;
    if (results.responseTime < 5000) score += 0.1;
    if (results.errorCount === 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  private async promoteToRegistry(
    candidate: DiscoveryCandidate,
    confidence: number
  ): Promise<void> {
    const providerEntry: Omit<ProviderRegistryEntry, 'discoveredAt' | 'lastValidated'> = {
      id: candidate.id,
      name: candidate.name,
      statusUrl: candidate.statusUrl,
      statusPageUrl: candidate.statusPageUrl,
      category: candidate.category,
      tier: this.determineTier(confidence),
      region: 'global', // Default region
      confidence: confidence,
      isActive: true,
      priority: Math.floor(confidence * 10), // Convert to 1-10 scale
    };

    await this.registry.registerProvider(providerEntry);
  }

  private determineTier(
    confidence: number
  ): 'enterprise' | 'startup' | 'research' | 'experimental' {
    if (confidence >= 0.9) return 'enterprise';
    if (confidence >= 0.8) return 'startup';
    if (confidence >= 0.7) return 'research';
    return 'experimental';
  }

  async getDiscoveryMetrics(): Promise<{
    pending: number;
    validating: number;
    validated: number;
    rejected: number;
    totalCandidates: number;
  }> {
    const [pendingSnapshot, validatingSnapshot, validatedSnapshot, rejectedSnapshot] =
      await Promise.all([
        getDocs(
          query(collection(db, 'discoveryQueue'), where('validationStatus', '==', 'pending'))
        ),
        getDocs(
          query(collection(db, 'discoveryQueue'), where('validationStatus', '==', 'validating'))
        ),
        getDocs(
          query(collection(db, 'discoveryQueue'), where('validationStatus', '==', 'validated'))
        ),
        getDocs(
          query(collection(db, 'discoveryQueue'), where('validationStatus', '==', 'rejected'))
        ),
      ]);

    const totalCandidates =
      pendingSnapshot.size +
      validatingSnapshot.size +
      validatedSnapshot.size +
      rejectedSnapshot.size;

    return {
      pending: pendingSnapshot.size,
      validating: validatingSnapshot.size,
      validated: validatedSnapshot.size,
      rejected: rejectedSnapshot.size,
      totalCandidates,
    };
  }

  // Bulk add common AI providers for discovery
  async seedDiscoveryQueue(): Promise<void> {
    const commonProviders = [
      {
        id: 'together-ai',
        name: 'Together AI',
        statusUrl: 'https://status.together.ai/api/v2/status.json',
        statusPageUrl: 'https://status.together.ai',
        category: 'llm' as const,
        confidence: 0.8,
        discoveryMethod: 'manual' as const,
      },
      {
        id: 'stability-ai',
        name: 'Stability AI',
        statusUrl: 'https://status.stability.ai/api/v2/status.json',
        statusPageUrl: 'https://status.stability.ai',
        category: 'vision' as const,
        confidence: 0.8,
        discoveryMethod: 'manual' as const,
      },
      // Add more providers as needed
    ];

    for (const provider of commonProviders) {
      await this.addDiscoveryCandidate(provider);
    }
  }
}
