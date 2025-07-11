/**
 * LAYERED ARCHITECTURE
 *
 * Implements proper separation of concerns with:
 * - Repository Layer (Data Access)
 * - Service Layer (Business Logic)
 * - Controller Layer (API/Interface)
 * - Domain Layer (Core Models)
 */

import { log } from './logger';
import { withErrorHandling, ErrorContext } from './unified-error-handler';
import { UnifiedFirebaseInstance } from './unified-firebase-adapter';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';

// =============================================================================
// DOMAIN MODELS
// =============================================================================

export interface Provider {
  id: string;
  name: string;
  url: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'unknown';
  lastChecked: Date;
  responseTime: number;
  priority: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusCheck {
  id: string;
  providerId: string;
  status: Provider['status'];
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProviderMetrics {
  providerId: string;
  uptime: number;
  averageResponseTime: number;
  errorRate: number;
  lastIncident?: Date;
  checksCount: number;
  period: {
    start: Date;
    end: Date;
  };
}

// =============================================================================
// REPOSITORY INTERFACES
// =============================================================================

export interface ProviderRepository {
  findAll(): Promise<Provider[]>;
  findById(id: string): Promise<Provider | null>;
  findByStatus(status: Provider['status']): Promise<Provider[]>;
  findByPriority(priority: Provider['priority']): Promise<Provider[]>;
  create(provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Promise<Provider>;
  update(id: string, updates: Partial<Provider>): Promise<Provider>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface StatusCheckRepository {
  findByProviderId(providerId: string, limit?: number): Promise<StatusCheck[]>;
  findByTimeRange(start: Date, end: Date): Promise<StatusCheck[]>;
  findByProviderAndTimeRange(providerId: string, start: Date, end: Date): Promise<StatusCheck[]>;
  create(statusCheck: Omit<StatusCheck, 'id'>): Promise<StatusCheck>;
  createBatch(statusChecks: Array<Omit<StatusCheck, 'id'>>): Promise<StatusCheck[]>;
  deleteOlderThan(date: Date): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATIONS
// =============================================================================

export class FirestoreProviderRepository implements ProviderRepository {
  private collectionName = 'providers';

  constructor(private firebase: UnifiedFirebaseInstance) {}

  async findAll(): Promise<Provider[]> {
    return withErrorHandling(
      async () => {
        const snapshot = await getDocs(collection(this.firebase.db, this.collectionName));
        return this.mapSnapshotToProviders(snapshot);
      },
      {
        component: 'ProviderRepository',
        operation: 'findAll',
      }
    );
  }

  async findById(id: string): Promise<Provider | null> {
    return withErrorHandling(
      async () => {
        const docRef = doc(this.firebase.db, this.collectionName, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          return null;
        }

        return this.mapDocToProvider(id, snapshot.data());
      },
      {
        component: 'ProviderRepository',
        operation: 'findById',
        metadata: { providerId: id },
      }
    );
  }

  async findByStatus(status: Provider['status']): Promise<Provider[]> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('status', '==', status),
          orderBy('priority', 'desc'),
          orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        return this.mapSnapshotToProviders(snapshot);
      },
      {
        component: 'ProviderRepository',
        operation: 'findByStatus',
        metadata: { status },
      }
    );
  }

  async findByPriority(priority: Provider['priority']): Promise<Provider[]> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('priority', '==', priority),
          orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        return this.mapSnapshotToProviders(snapshot);
      },
      {
        component: 'ProviderRepository',
        operation: 'findByPriority',
        metadata: { priority },
      }
    );
  }

  async create(providerData: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Promise<Provider> {
    return withErrorHandling(
      async () => {
        const now = new Date();
        const data = {
          ...providerData,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now),
        };

        const docRef = await addDoc(collection(this.firebase.db, this.collectionName), data);

        return {
          id: docRef.id,
          ...providerData,
          createdAt: now,
          updatedAt: now,
        };
      },
      {
        component: 'ProviderRepository',
        operation: 'create',
        metadata: { providerName: providerData.name },
      }
    );
  }

  async update(id: string, updates: Partial<Provider>): Promise<Provider> {
    return withErrorHandling(
      async () => {
        const docRef = doc(this.firebase.db, this.collectionName, id);
        const updateData = {
          ...updates,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        await updateDoc(docRef, updateData);

        const updated = await this.findById(id);
        if (!updated) {
          throw new Error(`Provider ${id} not found after update`);
        }

        return updated;
      },
      {
        component: 'ProviderRepository',
        operation: 'update',
        metadata: { providerId: id },
      }
    );
  }

  async delete(id: string): Promise<boolean> {
    return withErrorHandling(
      async () => {
        const docRef = doc(this.firebase.db, this.collectionName, id);
        await deleteDoc(docRef);
        return true;
      },
      {
        component: 'ProviderRepository',
        operation: 'delete',
        metadata: { providerId: id },
      }
    );
  }

  async count(): Promise<number> {
    return withErrorHandling(
      async () => {
        const snapshot = await getDocs(collection(this.firebase.db, this.collectionName));
        return snapshot.size;
      },
      {
        component: 'ProviderRepository',
        operation: 'count',
      }
    );
  }

  // Private helper methods
  private mapSnapshotToProviders(snapshot: QuerySnapshot<DocumentData>): Provider[] {
    return snapshot.docs.map((doc) => this.mapDocToProvider(doc.id, doc.data()));
  }

  private mapDocToProvider(id: string, data: DocumentData): Provider {
    return {
      id,
      name: data.name,
      url: data.url,
      status: data.status,
      lastChecked: data.lastChecked?.toDate() || new Date(),
      responseTime: data.responseTime || 0,
      priority: data.priority || 'medium',
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}

export class FirestoreStatusCheckRepository implements StatusCheckRepository {
  private collectionName = 'status_checks';

  constructor(private firebase: UnifiedFirebaseInstance) {}

  async findByProviderId(providerId: string, limitCount = 100): Promise<StatusCheck[]> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('providerId', '==', providerId),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return this.mapSnapshotToStatusChecks(snapshot);
      },
      {
        component: 'StatusCheckRepository',
        operation: 'findByProviderId',
        metadata: { providerId, limit: limitCount },
      }
    );
  }

  async findByTimeRange(start: Date, end: Date): Promise<StatusCheck[]> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('timestamp', '>=', Timestamp.fromDate(start)),
          where('timestamp', '<=', Timestamp.fromDate(end)),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(q);
        return this.mapSnapshotToStatusChecks(snapshot);
      },
      {
        component: 'StatusCheckRepository',
        operation: 'findByTimeRange',
        metadata: { start: start.toISOString(), end: end.toISOString() },
      }
    );
  }

  async findByProviderAndTimeRange(
    providerId: string,
    start: Date,
    end: Date
  ): Promise<StatusCheck[]> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('providerId', '==', providerId),
          where('timestamp', '>=', Timestamp.fromDate(start)),
          where('timestamp', '<=', Timestamp.fromDate(end)),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(q);
        return this.mapSnapshotToStatusChecks(snapshot);
      },
      {
        component: 'StatusCheckRepository',
        operation: 'findByProviderAndTimeRange',
        metadata: {
          providerId,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }
    );
  }

  async create(statusCheckData: Omit<StatusCheck, 'id'>): Promise<StatusCheck> {
    return withErrorHandling(
      async () => {
        const data = {
          ...statusCheckData,
          timestamp: Timestamp.fromDate(statusCheckData.timestamp),
        };

        const docRef = await addDoc(collection(this.firebase.db, this.collectionName), data);

        return {
          id: docRef.id,
          ...statusCheckData,
        };
      },
      {
        component: 'StatusCheckRepository',
        operation: 'create',
        metadata: { providerId: statusCheckData.providerId },
      }
    );
  }

  async createBatch(statusChecks: Array<Omit<StatusCheck, 'id'>>): Promise<StatusCheck[]> {
    return withErrorHandling(
      async () => {
        const results: StatusCheck[] = [];

        // Process in batches of 500 (Firestore batch limit)
        const batchSize = 500;
        for (let i = 0; i < statusChecks.length; i += batchSize) {
          const batch = statusChecks.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((statusCheck) => this.create(statusCheck))
          );
          results.push(...batchResults);
        }

        return results;
      },
      {
        component: 'StatusCheckRepository',
        operation: 'createBatch',
        metadata: { count: statusChecks.length },
      }
    );
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return withErrorHandling(
      async () => {
        const q = query(
          collection(this.firebase.db, this.collectionName),
          where('timestamp', '<', Timestamp.fromDate(date))
        );

        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));

        await Promise.all(deletePromises);
        return snapshot.size;
      },
      {
        component: 'StatusCheckRepository',
        operation: 'deleteOlderThan',
        metadata: { cutoffDate: date.toISOString() },
      }
    );
  }

  // Private helper methods
  private mapSnapshotToStatusChecks(snapshot: QuerySnapshot<DocumentData>): StatusCheck[] {
    return snapshot.docs.map((doc) => this.mapDocToStatusCheck(doc.id, doc.data()));
  }

  private mapDocToStatusCheck(id: string, data: DocumentData): StatusCheck {
    return {
      id,
      providerId: data.providerId,
      status: data.status,
      responseTime: data.responseTime || 0,
      timestamp: data.timestamp?.toDate() || new Date(),
      error: data.error,
      metadata: data.metadata,
    };
  }
}

// =============================================================================
// SERVICE LAYER
// =============================================================================

export interface ProviderService {
  getAllProviders(): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
  getProvidersByStatus(status: Provider['status']): Promise<Provider[]>;
  getProvidersByPriority(priority: Provider['priority']): Promise<Provider[]>;
  createProvider(provider: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>): Promise<Provider>;
  updateProvider(id: string, updates: Partial<Provider>): Promise<Provider>;
  deleteProvider(id: string): Promise<boolean>;
  getProviderMetrics(providerId: string, days?: number): Promise<ProviderMetrics>;
  updateProviderStatus(
    id: string,
    status: Provider['status'],
    responseTime: number
  ): Promise<Provider>;
}

export interface StatusService {
  recordStatusCheck(
    providerId: string,
    status: Provider['status'],
    responseTime: number,
    error?: string
  ): Promise<StatusCheck>;
  recordBatchStatusChecks(
    checks: Array<{
      providerId: string;
      status: Provider['status'];
      responseTime: number;
      error?: string;
    }>
  ): Promise<StatusCheck[]>;
  getProviderHistory(providerId: string, limit?: number): Promise<StatusCheck[]>;
  getSystemOverview(): Promise<{
    totalProviders: number;
    operationalProviders: number;
    degradedProviders: number;
    outageProviders: number;
    averageResponseTime: number;
  }>;
  cleanupOldChecks(daysToKeep?: number): Promise<number>;
}

export class ProviderServiceImpl implements ProviderService {
  constructor(
    private providerRepo: ProviderRepository,
    private statusCheckRepo: StatusCheckRepository
  ) {}

  async getAllProviders(): Promise<Provider[]> {
    return this.providerRepo.findAll();
  }

  async getProvider(id: string): Promise<Provider | null> {
    return this.providerRepo.findById(id);
  }

  async getProvidersByStatus(status: Provider['status']): Promise<Provider[]> {
    return this.providerRepo.findByStatus(status);
  }

  async getProvidersByPriority(priority: Provider['priority']): Promise<Provider[]> {
    return this.providerRepo.findByPriority(priority);
  }

  async createProvider(
    providerData: Omit<Provider, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Provider> {
    // Validate required fields
    if (!providerData.name || !providerData.url) {
      throw new Error('Provider name and URL are required');
    }

    // Set defaults
    const provider = {
      ...providerData,
      status: providerData.status || ('unknown' as Provider['status']),
      lastChecked: providerData.lastChecked || new Date(),
      responseTime: providerData.responseTime || 0,
      priority: providerData.priority || ('medium' as Provider['priority']),
    };

    return this.providerRepo.create(provider);
  }

  async updateProvider(id: string, updates: Partial<Provider>): Promise<Provider> {
    const existing = await this.providerRepo.findById(id);
    if (!existing) {
      throw new Error(`Provider ${id} not found`);
    }

    return this.providerRepo.update(id, updates);
  }

  async deleteProvider(id: string): Promise<boolean> {
    const existing = await this.providerRepo.findById(id);
    if (!existing) {
      throw new Error(`Provider ${id} not found`);
    }

    return this.providerRepo.delete(id);
  }

  async getProviderMetrics(providerId: string, days = 7): Promise<ProviderMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const checks = await this.statusCheckRepo.findByProviderAndTimeRange(
      providerId,
      startDate,
      endDate
    );

    if (checks.length === 0) {
      return {
        providerId,
        uptime: 0,
        averageResponseTime: 0,
        errorRate: 0,
        checksCount: 0,
        period: { start: startDate, end: endDate },
      };
    }

    const operationalChecks = checks.filter((c) => c.status === 'operational');
    const uptime = (operationalChecks.length / checks.length) * 100;

    const totalResponseTime = checks.reduce((sum, c) => sum + c.responseTime, 0);
    const averageResponseTime = totalResponseTime / checks.length;

    const errorChecks = checks.filter((c) => c.error);
    const errorRate = (errorChecks.length / checks.length) * 100;

    const lastIncident = checks
      .filter((c) => c.status !== 'operational')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;

    return {
      providerId,
      uptime,
      averageResponseTime,
      errorRate,
      lastIncident,
      checksCount: checks.length,
      period: { start: startDate, end: endDate },
    };
  }

  async updateProviderStatus(
    id: string,
    status: Provider['status'],
    responseTime: number
  ): Promise<Provider> {
    return this.providerRepo.update(id, {
      status,
      responseTime,
      lastChecked: new Date(),
    });
  }
}

export class StatusServiceImpl implements StatusService {
  constructor(
    private providerRepo: ProviderRepository,
    private statusCheckRepo: StatusCheckRepository
  ) {}

  async recordStatusCheck(
    providerId: string,
    status: Provider['status'],
    responseTime: number,
    error?: string
  ): Promise<StatusCheck> {
    // Update provider status
    await this.providerRepo.update(providerId, {
      status,
      responseTime,
      lastChecked: new Date(),
    });

    // Record status check
    return this.statusCheckRepo.create({
      providerId,
      status,
      responseTime,
      timestamp: new Date(),
      error,
    });
  }

  async recordBatchStatusChecks(
    checks: Array<{
      providerId: string;
      status: Provider['status'];
      responseTime: number;
      error?: string;
    }>
  ): Promise<StatusCheck[]> {
    // Update all providers
    const providerUpdates = checks.map((check) =>
      this.providerRepo.update(check.providerId, {
        status: check.status,
        responseTime: check.responseTime,
        lastChecked: new Date(),
      })
    );

    await Promise.all(providerUpdates);

    // Record all status checks
    const statusChecks = checks.map((check) => ({
      providerId: check.providerId,
      status: check.status,
      responseTime: check.responseTime,
      timestamp: new Date(),
      error: check.error,
    }));

    return this.statusCheckRepo.createBatch(statusChecks);
  }

  async getProviderHistory(providerId: string, limit = 100): Promise<StatusCheck[]> {
    return this.statusCheckRepo.findByProviderId(providerId, limit);
  }

  async getSystemOverview(): Promise<{
    totalProviders: number;
    operationalProviders: number;
    degradedProviders: number;
    outageProviders: number;
    averageResponseTime: number;
  }> {
    const allProviders = await this.providerRepo.findAll();

    const totalProviders = allProviders.length;
    const operationalProviders = allProviders.filter((p) => p.status === 'operational').length;
    const degradedProviders = allProviders.filter((p) => p.status === 'degraded').length;
    const outageProviders = allProviders.filter(
      (p) => p.status === 'partial_outage' || p.status === 'major_outage'
    ).length;

    const totalResponseTime = allProviders.reduce((sum, p) => sum + p.responseTime, 0);
    const averageResponseTime = totalProviders > 0 ? totalResponseTime / totalProviders : 0;

    return {
      totalProviders,
      operationalProviders,
      degradedProviders,
      outageProviders,
      averageResponseTime,
    };
  }

  async cleanupOldChecks(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return this.statusCheckRepo.deleteOlderThan(cutoffDate);
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create repository layer
 */
export function createRepositories(firebase: UnifiedFirebaseInstance): {
  providerRepo: ProviderRepository;
  statusCheckRepo: StatusCheckRepository;
} {
  return {
    providerRepo: new FirestoreProviderRepository(firebase),
    statusCheckRepo: new FirestoreStatusCheckRepository(firebase),
  };
}

/**
 * Create service layer
 */
export function createServices(
  providerRepo: ProviderRepository,
  statusCheckRepo: StatusCheckRepository
): {
  providerService: ProviderService;
  statusService: StatusService;
} {
  return {
    providerService: new ProviderServiceImpl(providerRepo, statusCheckRepo),
    statusService: new StatusServiceImpl(providerRepo, statusCheckRepo),
  };
}

/**
 * Create complete layered architecture
 */
export function createLayeredArchitecture(firebase: UnifiedFirebaseInstance): {
  repositories: ReturnType<typeof createRepositories>;
  services: ReturnType<typeof createServices>;
} {
  const repositories = createRepositories(firebase);
  const services = createServices(repositories.providerRepo, repositories.statusCheckRepo);

  return {
    repositories,
    services,
  };
}
