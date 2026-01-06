import sourcesConfig from '@/lib/data/sources.json';
import { getDb } from '@/lib/db/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  SourceDefinition,
  PlatformType,
  NormalizedProviderSummary,
  NormalizedComponent,
  NormalizedIncident,
  NormalizedMaintenance,
  SourceFetchResult,
} from '@/lib/types/ingestion';
import { detectPlatform } from '@/lib/utils/platform-detect';
import {
  normalizeSeverity,
  parseStatuspageComponents,
  parseStatuspageIncidents,
  parseStatuspageMaintenances,
  parseInstatusSummary,
  parseGoogleCloudIncidents,
  parseRssIncidents,
  parseCachetComponents,
  parseCachetIncidents,
  parseStatusIo,
  parseBetterstackIndex,
} from '@/lib/utils/platform-parsers';
import { sourceRegistryService } from '@/lib/services/source-registry';
import { getGcpProductCatalog } from '@/lib/services/gcp-product-catalog';

const DEFAULT_HEADERS = {
  'User-Agent': 'AI-Status-Dashboard/1.0',
};

function computeProviderStatus(
  components: NormalizedComponent[],
  incidents: NormalizedIncident[],
  maintenances: NormalizedMaintenance[]
) {
  const severities = [
    ...components.map((c) => c.status),
    ...incidents.map((i) => i.severity),
    ...maintenances.map((m) => m.severity),
  ];

  if (severities.includes('major_outage')) return 'major_outage';
  if (severities.includes('partial_outage')) return 'partial_outage';
  if (severities.includes('degraded')) return 'degraded';
  if (severities.includes('maintenance')) return 'maintenance';
  if (severities.includes('operational')) return 'operational';
  return 'unknown';
}

async function fetchWithCache(
  sourceId: string,
  url: string,
  providerId?: string,
  platform?: PlatformType
): Promise<SourceFetchResult> {
  const meta = await sourceRegistryService.getEntry(sourceId);
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (meta?.etag) headers['If-None-Match'] = meta.etag;
  if (meta?.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  try {
    const response = await fetch(url, {
      headers,
      cache: 'no-store',
    });
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    if (response.status === 304) {
      await sourceRegistryService.upsertEntry({
        sourceId,
        providerId: providerId || meta?.providerId || '',
        platform: platform || meta?.platform || 'unknown',
        etag: etag || meta?.etag || null,
        lastModified: lastModified || meta?.lastModified || null,
        lastStatusCode: response.status,
        lastFetchedAt: new Date().toISOString(),
      });
      return { ok: true, statusCode: 304 };
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    let json: any = null;
    if (contentType.includes('application/json') && body.trim()) {
      try {
        json = JSON.parse(body);
      } catch {
        json = null;
      }
    }

    await sourceRegistryService.recordPayload(sourceId, response.status, body, {
      'content-type': contentType,
    });

    await sourceRegistryService.upsertEntry({
      sourceId,
      providerId: providerId || meta?.providerId || '',
      platform: platform || meta?.platform || 'unknown',
      etag: etag || null,
      lastModified: lastModified || null,
      lastStatusCode: response.status,
      lastFetchedAt: new Date().toISOString(),
    });

    return {
      ok: response.ok,
      statusCode: response.status,
      etag,
      lastModified,
      body,
      json,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, statusCode: 0, error: message };
  }
}

async function storeNormalized(summary: NormalizedProviderSummary) {
  const db = getDb();
  const providerStatusRef = db.collection('provider_status').doc(summary.providerId);
  const batch = db.batch();

  batch.set(
    providerStatusRef,
    {
      providerId: summary.providerId,
      sourceId: summary.sourceId,
      status: summary.status,
      description: summary.description || null,
      lastUpdated: Timestamp.fromDate(new Date(summary.lastUpdated)),
      componentCount: summary.components.length,
      incidentCount: summary.incidents.length,
      maintenanceCount: summary.maintenances.length,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  summary.components.forEach((component) => {
    const docId = `${summary.providerId}:${component.id}`;
    const ref = db.collection('components').doc(docId);
    batch.set(
      ref,
      {
        ...component,
        updatedAt: component.updatedAt ? Timestamp.fromDate(new Date(component.updatedAt)) : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  if (summary.providerId === 'google-ai') {
    const componentMap = new Map<string, string>();
    summary.incidents.forEach((incident) => {
      if (!incident.impactedComponents) return;
      incident.impactedComponents.forEach((id, index) => {
        if (!id) return;
        const name = incident.impactedComponentNames?.[index] || id;
        if (!componentMap.has(id)) {
          componentMap.set(id, name);
        }
      });
    });

    componentMap.forEach((name, id) => {
      const docId = `${summary.providerId}:${id}`;
      const ref = db.collection('components').doc(docId);
      batch.set(
        ref,
        {
          id,
          providerId: summary.providerId,
          name,
          status: 'unknown',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  summary.incidents.forEach((incident) => {
    const docId = `${summary.providerId}:${incident.id}`;
    const ref = db.collection('incidents').doc(docId);
    batch.set(
      ref,
      {
        ...incident,
        startedAt: Timestamp.fromDate(new Date(incident.startedAt)),
        updatedAt: Timestamp.fromDate(new Date(incident.updatedAt)),
        resolvedAt: incident.resolvedAt ? Timestamp.fromDate(new Date(incident.resolvedAt)) : null,
        ingestedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  summary.maintenances.forEach((maintenance) => {
    const docId = `${summary.providerId}:${maintenance.id}`;
    const ref = db.collection('maintenances').doc(docId);
    batch.set(
      ref,
      {
        ...maintenance,
        scheduledFor: Timestamp.fromDate(new Date(maintenance.scheduledFor)),
        updatedAt: Timestamp.fromDate(new Date(maintenance.updatedAt)),
        completedAt: maintenance.completedAt ? Timestamp.fromDate(new Date(maintenance.completedAt)) : null,
        ingestedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

export class SourceIngestionService {
  private sources: SourceDefinition[];

  constructor() {
    this.sources = (sourcesConfig as { sources: SourceDefinition[] }).sources || [];
  }

  async ingestAll(): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;

    for (const source of this.sources) {
      const didRun = await this.ingestSource(source);
      if (didRun) {
        processed += 1;
      } else {
        skipped += 1;
      }
    }

    return { processed, skipped };
  }

  async ingestSource(source: SourceDefinition): Promise<boolean> {
    const now = new Date();
    const meta = await sourceRegistryService.getEntry(source.id);
    if (meta?.nextFetchAt) {
      const next = new Date(meta.nextFetchAt);
      if (next > now) return false;
    }

    let platformInfo =
      source.platform && source.platform !== 'auto'
        ? { platform: source.platform as PlatformType }
        : await detectPlatform(source.baseUrl);

    if (platformInfo.platform === 'statusio' && !platformInfo.statusIoPageId) {
      const detected = await detectPlatform(source.baseUrl);
      if (detected.statusIoPageId) {
        platformInfo = { ...platformInfo, statusIoPageId: detected.statusIoPageId };
      }
    }

    const platform = platformInfo.platform;
    const base = source.baseUrl.replace(/\/$/, '');

    await sourceRegistryService.upsertEntry({
      sourceId: source.id,
      providerId: source.providerId,
      platform,
      lastFetchedAt: now.toISOString(),
      nextFetchAt: new Date(now.getTime() + source.pollIntervalSeconds * 1000).toISOString(),
    });

    const summary = await this.fetchPlatform(source, platform, base, platformInfo.statusIoPageId || source.metadata?.statusIoPageId);
    if (!summary) return true;

    await storeNormalized(summary);
    return true;
  }

  private async fetchPlatform(
    source: SourceDefinition,
    platform: PlatformType,
    base: string,
    statusIoPageId?: string
  ): Promise<NormalizedProviderSummary | null> {
    switch (platform) {
      case 'statuspage':
        return this.fetchStatuspage(source, base);
      case 'instatus':
        return this.fetchInstatus(source, base);
      case 'google-cloud':
        return this.fetchGoogleCloud(source);
      case 'rss':
        return this.fetchRss(source);
      case 'cachet':
        return this.fetchCachet(source, base);
      case 'statusio':
        return this.fetchStatusIo(source, base, statusIoPageId);
      case 'betterstack':
        return this.fetchBetterstack(source, base);
      default:
        return this.fetchHtmlStatus(source, base);
    }
  }

  private async fetchStatuspage(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const summaryUrl = `${base}/api/v2/summary.json`;
    const incidentsUrl = `${base}/api/v2/incidents.json`;
    const maintUpcomingUrl = `${base}/api/v2/scheduled-maintenances/upcoming.json`;
    const maintActiveUrl = `${base}/api/v2/scheduled-maintenances/active.json`;

    const summaryResponse = await fetchWithCache(`${source.id}:summary`, summaryUrl, source.providerId, 'statuspage');
    if (!summaryResponse.ok || !summaryResponse.json) return null;

    const components = parseStatuspageComponents(source.providerId, summaryResponse.json);
    const incidents = parseStatuspageIncidents(source.providerId, source.id, summaryResponse.json);
    let fullIncidents = incidents;

    const incidentsResponse = await fetchWithCache(`${source.id}:incidents`, incidentsUrl, source.providerId, 'statuspage');
    if (incidentsResponse.ok && incidentsResponse.json) {
      fullIncidents = parseStatuspageIncidents(source.providerId, source.id, incidentsResponse.json);
    }

    const maintenances: NormalizedMaintenance[] = [];
    const upcomingResponse = await fetchWithCache(`${source.id}:maint-upcoming`, maintUpcomingUrl, source.providerId, 'statuspage');
    if (upcomingResponse.ok && upcomingResponse.json) {
      maintenances.push(...parseStatuspageMaintenances(source.providerId, source.id, upcomingResponse.json));
    }
    const activeResponse = await fetchWithCache(`${source.id}:maint-active`, maintActiveUrl, source.providerId, 'statuspage');
    if (activeResponse.ok && activeResponse.json) {
      maintenances.push(...parseStatuspageMaintenances(source.providerId, source.id, activeResponse.json));
    }

    const status = normalizeSeverity(summaryResponse.json?.status?.indicator || summaryResponse.json?.status?.description);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status: status === 'unknown' ? computeProviderStatus(components, fullIncidents, maintenances) : status,
      description: summaryResponse.json?.status?.description || undefined,
      lastUpdated: new Date().toISOString(),
      components,
      incidents: fullIncidents,
      maintenances,
    };
  }

  private async fetchInstatus(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const summaryUrl = `${base}/summary.json`;
    const summaryResponse = await fetchWithCache(`${source.id}:summary`, summaryUrl, source.providerId, 'instatus');
    if (!summaryResponse.ok || !summaryResponse.json) return null;

    const parsed = parseInstatusSummary(source.providerId, source.id, summaryResponse.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: parsed.statusDescription,
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchGoogleCloud(source: SourceDefinition): Promise<NormalizedProviderSummary | null> {
    const url = source.statusUrl || `${source.baseUrl.replace(/\/$/, '')}/incidents.json`;
    const response = await fetchWithCache(`${source.id}:incidents`, url, source.providerId, 'google-cloud');
    if (!response.ok || !response.json) return null;

    const catalog = await getGcpProductCatalog();
    const incidents = parseGoogleCloudIncidents(source.providerId, source.id, response.json, catalog);
    const status = computeProviderStatus([], incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Google Cloud Service Health',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents,
      maintenances: [],
    };
  }

  private async fetchRss(source: SourceDefinition): Promise<NormalizedProviderSummary | null> {
    const url = source.statusUrl || source.baseUrl;
    const response = await fetchWithCache(`${source.id}:rss`, url, source.providerId, 'rss');
    if (!response.ok || !response.body) return null;

    const filter = source.metadata?.filter;
    const incidents = parseRssIncidents(source.providerId, source.id, response.body, filter);
    const status = computeProviderStatus([], incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'RSS feed',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents,
      maintenances: [],
    };
  }

  private async fetchCachet(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const componentsUrl = `${base}/api/v1/components`;
    const incidentsUrl = `${base}/api/v1/incidents`;

    const componentsResponse = await fetchWithCache(`${source.id}:components`, componentsUrl, source.providerId, 'cachet');
    if (!componentsResponse.ok || !componentsResponse.json) return null;

    const incidentsResponse = await fetchWithCache(`${source.id}:incidents`, incidentsUrl, source.providerId, 'cachet');
    const components = parseCachetComponents(source.providerId, componentsResponse.json);
    const incidents = incidentsResponse.ok && incidentsResponse.json
      ? parseCachetIncidents(source.providerId, source.id, incidentsResponse.json)
      : [];

    const status = computeProviderStatus(components, incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Cachet status',
      lastUpdated: new Date().toISOString(),
      components,
      incidents,
      maintenances: [],
    };
  }

  private async fetchStatusIo(
    source: SourceDefinition,
    base: string,
    statusIoPageId?: string
  ): Promise<NormalizedProviderSummary | null> {
    const pageId = statusIoPageId || source.metadata?.statusIoPageId;
    if (!pageId) {
      return null;
    }
    const apiUrl = `https://api.status.io/1.0/status/${pageId}`;
    const response = await fetchWithCache(`${source.id}:statusio`, apiUrl, source.providerId, 'statusio');
    if (!response.ok || !response.json) return null;

    const parsed = parseStatusIo(source.providerId, source.id, response.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Status.io',
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchBetterstack(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const indexUrl = source.statusUrl || `${base}/index.json`;
    const indexResponse = await fetchWithCache(`${source.id}:index`, indexUrl, source.providerId, 'betterstack');
    if (!indexResponse.ok || !indexResponse.json) return null;

    const parsed = parseBetterstackIndex(source.providerId, source.id, indexResponse.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: parsed.statusDescription || 'Better Stack status',
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchHtmlStatus(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const response = await fetchWithCache(`${source.id}:html`, base, source.providerId, 'html');
    if (!response.ok || !response.body) return null;
    const status = normalizeSeverity(response.body);
    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'HTML status page',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents: [],
      maintenances: [],
    };
  }
}

export const sourceIngestionService = new SourceIngestionService();
