import { getDb } from '@/lib/db/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type {
  NormalizedIncident,
  NormalizedMaintenance,
  NormalizedComponent,
} from '@/lib/types/ingestion';
import { ProviderStatus } from '@/lib/types';
import { log } from '@/lib/utils/logger';
import { filterGoogleCloudIncidentsForAi, GOOGLE_AI_KEYWORDS } from '@/lib/utils/google-cloud';

export type ProviderStatusSummary = {
  providerId: string;
  status: ProviderStatus | string;
  description?: string | null;
  lastUpdated?: string;
  componentCount?: number;
  incidentCount?: number;
  maintenanceCount?: number;
  activeIncidentCount?: number;
  activeMaintenanceCount?: number;
  degradedComponentCount?: number;
};

class IntelligenceService {
  private toIsoString(value?: string | { toDate?: () => Date; seconds?: number; _seconds?: number } | Date | null) {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
    if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
    const parsed = new Date(value as any);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return undefined;
  }

  private normalizeIncidentDates(incident: NormalizedIncident): NormalizedIncident {
    const startedAt = this.toIsoString(incident.startedAt) || new Date().toISOString();
    const updatedAt = this.toIsoString(incident.updatedAt) || startedAt;
    const resolvedAt = this.toIsoString(incident.resolvedAt);
    const updates = Array.isArray(incident.updates)
      ? incident.updates.map((update) => ({
          ...update,
          createdAt: this.toIsoString(update.createdAt) || updatedAt,
        }))
      : [];

    return {
      ...incident,
      startedAt,
      updatedAt,
      resolvedAt,
      updates,
    };
  }

  private normalizeMaintenanceDates(maintenance: NormalizedMaintenance): NormalizedMaintenance {
    const scheduledFor = this.toIsoString(maintenance.scheduledFor) || new Date().toISOString();
    const updatedAt = this.toIsoString(maintenance.updatedAt) || scheduledFor;
    const completedAt = this.toIsoString(maintenance.completedAt);
    const updates = Array.isArray(maintenance.updates)
      ? maintenance.updates.map((update) => ({
          ...update,
          createdAt: this.toIsoString(update.createdAt) || updatedAt,
        }))
      : [];

    return {
      ...maintenance,
      scheduledFor,
      updatedAt,
      completedAt,
      updates,
    };
  }

  async getProviderSummaries(): Promise<ProviderStatusSummary[]> {
    const db = getDb();
    try {
      const snapshot = await db.collection('provider_status').get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const lastUpdated = data.lastUpdated?.toDate?.()?.toISOString?.() || null;
        return {
          providerId: doc.id,
          status: data.status,
          description: data.description || null,
          lastUpdated,
          componentCount: data.componentCount || null,
          incidentCount: data.incidentCount || null,
          maintenanceCount: data.maintenanceCount || null,
          activeIncidentCount: data.activeIncidentCount || 0,
          activeMaintenanceCount: data.activeMaintenanceCount || 0,
          degradedComponentCount: data.degradedComponentCount || 0,
        } as ProviderStatusSummary;
      });
    } catch (error) {
      log('error', 'Failed to load provider summaries', { error });
      return [];
    }
  }

  async getProviderDetail(providerId: string): Promise<{
    components: NormalizedComponent[];
    incidents: NormalizedIncident[];
    maintenances: NormalizedMaintenance[];
  }> {
    if (!providerId) {
      return { components: [], incidents: [], maintenances: [] };
    }
    const db = getDb();
    let componentsSnap: FirebaseFirestore.QuerySnapshot | null = null;
    try {
      componentsSnap = await db.collection('components').where('providerId', '==', providerId).get();
    } catch (error) {
      log('warn', 'Components query failed, returning empty set', { error, providerId });
      componentsSnap = null;
    }

    let incidentsSnap;
    try {
      incidentsSnap = await db
        .collection('incidents')
        .where('providerId', '==', providerId)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
    } catch (error) {
      log('warn', 'Incidents query failed, falling back to unordered query', { error, providerId });
      incidentsSnap = await db
        .collection('incidents')
        .where('providerId', '==', providerId)
        .limit(50)
        .get();
    }

    let maintSnap;
    try {
      maintSnap = await db
        .collection('maintenances')
        .where('providerId', '==', providerId)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
    } catch (error) {
      log('warn', 'Maintenances query failed, falling back to unordered query', { error, providerId });
      maintSnap = await db
        .collection('maintenances')
        .where('providerId', '==', providerId)
        .limit(50)
        .get();
    }

    const components = componentsSnap ? componentsSnap.docs.map((doc) => doc.data() as NormalizedComponent) : [];
    let incidents = incidentsSnap.docs.map((doc) => this.normalizeIncidentDates(doc.data() as NormalizedIncident));
    const maintenances = maintSnap.docs.map((doc) =>
      this.normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
    );

    if (providerId === 'google-ai') {
      incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
    }

    return { components, incidents, maintenances };
  }

  async getIncidents(options: { providerId?: string; startDate?: string; limit?: number } = {}) {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('incidents').orderBy('updatedAt', 'desc');
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    if (options.startDate) {
      const start = new Date(options.startDate);
      if (!Number.isNaN(start.getTime())) {
        query = query.where('updatedAt', '>=', Timestamp.fromDate(start));
      }
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    try {
      const snapshot = await query.get();
      let incidents = snapshot.docs.map((doc) => this.normalizeIncidentDates(doc.data() as NormalizedIncident));
      if (options.providerId === 'google-ai') {
        incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
      }
      return incidents;
    } catch (error) {
      log('warn', 'Incidents query failed, falling back to basic query', { error, options });
      let fallback: FirebaseFirestore.Query = db.collection('incidents');
      if (options.providerId) {
        fallback = fallback.where('providerId', '==', options.providerId);
      }
      if (options.limit) {
        fallback = fallback.limit(options.limit);
      } else {
        fallback = fallback.limit(50);
      }
      const snapshot = await fallback.get();
      let incidents = snapshot.docs.map((doc) => this.normalizeIncidentDates(doc.data() as NormalizedIncident));
      if (options.providerId === 'google-ai') {
        incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
      }
      return incidents;
    }
  }

  async getMaintenances(options: { providerId?: string; limit?: number } = {}) {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('maintenances').orderBy('updatedAt', 'desc');
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    try {
      const snapshot = await query.get();
      return snapshot.docs.map((doc) =>
        this.normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
      );
    } catch (error) {
      log('warn', 'Maintenances query failed, falling back to basic query', { error, options });
      let fallback: FirebaseFirestore.Query = db.collection('maintenances');
      if (options.providerId) {
        fallback = fallback.where('providerId', '==', options.providerId);
      }
      if (options.limit) {
        fallback = fallback.limit(options.limit);
      } else {
        fallback = fallback.limit(50);
      }
      const snapshot = await fallback.get();
      return snapshot.docs.map((doc) =>
        this.normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
      );
    }
  }
}

export const intelligenceService = new IntelligenceService();
