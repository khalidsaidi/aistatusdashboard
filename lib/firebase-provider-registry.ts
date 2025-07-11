import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { UnifiedProvider } from './types';

const db = getFirestore();

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  statusUrl: string;
  statusPageUrl: string;
  category: 'llm' | 'vision' | 'audio' | 'multimodal' | 'general';
  tier: 'enterprise' | 'startup' | 'research' | 'experimental';
  region: string;
  confidence: number; // 0-1 discovery confidence score
  discoveredAt: Date;
  lastValidated: Date;
  isActive: boolean;
  rateLimitPerMinute?: number;
  priority: number; // 1-10, higher = more important
}

export class FirebaseProviderRegistry {
  private static instance: FirebaseProviderRegistry;
  
  static getInstance(): FirebaseProviderRegistry {
    if (!this.instance) {
      this.instance = new FirebaseProviderRegistry();
    }
    return this.instance;
  }

  async registerProvider(provider: Omit<ProviderRegistryEntry, 'discoveredAt' | 'lastValidated'>): Promise<void> {
    const now = new Date();
    const providerDoc = doc(db, 'providers', provider.id);
    
    await setDoc(providerDoc, {
      ...provider,
      discoveredAt: now,
      lastValidated: now,
    });
  }

  async getActiveProviders(category?: string, tier?: string): Promise<UnifiedProvider[]> {
    let q = query(
      collection(db, 'providers'),
      where('isActive', '==', true),
      orderBy('priority', 'desc'),
      orderBy('confidence', 'desc')
    );

    if (category) {
      q = query(q, where('category', '==', category));
    }
    if (tier) {
      q = query(q, where('tier', '==', tier));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as ProviderRegistryEntry;
      return {
        id: data.id,
        name: data.name,
        category: data.category as any,
        statusUrl: data.statusUrl,
        statusPageUrl: data.statusPageUrl,
        format: 'statuspage_v2' as const,
        timeout: 10000,
        enabled: data.isActive,
        priority: data.priority,
      };
    });
  }

  async getProvidersByPriority(maxCount: number = 100): Promise<UnifiedProvider[]> {
    const q = query(
      collection(db, 'providers'),
      where('isActive', '==', true),
      orderBy('priority', 'desc'),
      limit(maxCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data() as ProviderRegistryEntry;
      return {
        id: data.id,
        name: data.name,
        category: data.category as any,
        statusUrl: data.statusUrl,
        statusPageUrl: data.statusPageUrl,
        format: 'statuspage_v2' as const,
        timeout: 10000,
        enabled: data.isActive,
        priority: data.priority,
      };
    });
  }

  async updateProviderStatus(providerId: string, isActive: boolean, confidence?: number): Promise<void> {
    const providerDoc = doc(db, 'providers', providerId);
    const updateData: any = {
      isActive,
      lastValidated: new Date(),
    };
    
    if (confidence !== undefined) {
      updateData.confidence = confidence;
    }
    
    await setDoc(providerDoc, updateData, { merge: true });
  }
} 