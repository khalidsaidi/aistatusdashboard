import { getDb } from '@/lib/db/firestore';
import { config } from '@/lib/config';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import type {
  TelemetryEvent,
  SyntheticProbeEvent,
  CanaryCopilotResponse,
  LensSummary,
  ModelMatrixResponse,
  ModelMatrixTile,
  FallbackPlan,
  IncidentReplayResponse,
  ForecastResponse,
  RateLimitSummary,
  RateLimitIncident,
  ThroughputBaseline,
  ChangeRadarEvent,
  BehavioralMetricSummary,
  AskStatusResponse,
  EarlyWarningSignal,
  EvidencePacket,
  IncidentFingerprint,
  StalenessSignal,
} from '@/lib/types/insights';
import modelsCatalog from '@/lib/data/models.json';
import changeRadarSeed from '@/lib/data/change_radar.json';
import { persistenceService } from '@/lib/services/persistence';

const DEFAULT_WINDOW_MINUTES = 30;
const LATENCY_DEGRADED_MS = 4000;
const LATENCY_WARNING_MS = 2000;
const ERROR_RATE_DEGRADED = 0.05;
const THROTTLE_RATE_DEGRADED = 0.08;

interface MetricSummary {
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  http5xxRate?: number;
  http429Rate?: number;
  tokensPerSec?: number;
  streamDisconnectRate?: number;
}

function percentile(values: number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function average(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((v): v is number => typeof v === 'number');
  if (!filtered.length) return undefined;
  return filtered.reduce((acc, v) => acc + v, 0) / filtered.length;
}

function summarizeMetrics(records: Array<TelemetryEvent | SyntheticProbeEvent>): MetricSummary {
  const latency = records.map((r) => r.latencyMs).filter((v) => typeof v === 'number');
  return {
    latencyP50: percentile(latency, 50),
    latencyP95: percentile(latency, 95),
    latencyP99: percentile(latency, 99),
    http5xxRate: average(records.map((r) => ('http5xxRate' in r ? r.http5xxRate : undefined))),
    http429Rate: average(records.map((r) => ('http429Rate' in r ? r.http429Rate : undefined))),
    tokensPerSec: average(records.map((r) => ('tokensPerSec' in r ? r.tokensPerSec : undefined))),
    streamDisconnectRate: average(
      records.map((r) => ('streamDisconnectRate' in r ? r.streamDisconnectRate : undefined))
    ),
  };
}

function scoreSignal(summary: MetricSummary): 'healthy' | 'degraded' | 'down' | 'no-data' {
  if (!summary.latencyP95 && summary.http429Rate === undefined && summary.http5xxRate === undefined) {
    return 'no-data';
  }
  if ((summary.http5xxRate || 0) >= ERROR_RATE_DEGRADED) return 'down';
  if ((summary.http429Rate || 0) >= THROTTLE_RATE_DEGRADED) return 'degraded';
  if ((summary.latencyP95 || 0) >= LATENCY_DEGRADED_MS) return 'degraded';
  return 'healthy';
}

function mapOfficialSignal(status?: string): 'healthy' | 'degraded' | 'down' | 'no-data' {
  if (!status) return 'no-data';
  switch (status) {
    case 'operational':
      return 'healthy';
    case 'degraded':
    case 'partial_outage':
    case 'maintenance':
      return 'degraded';
    case 'major_outage':
      return 'down';
    default:
      return 'no-data';
  }
}

function buildEvidence(
  summary: MetricSummary,
  windowMinutes: number,
  sampleCount: number,
  sources: string[]
): EvidencePacket {
  const snapshot = `p95=${summary.latencyP95 ? Math.round(summary.latencyP95) : 'n/a'}ms, ` +
    `429=${summary.http429Rate !== undefined ? (summary.http429Rate * 100).toFixed(1) : 'n/a'}%, ` +
    `5xx=${summary.http5xxRate !== undefined ? (summary.http5xxRate * 100).toFixed(1) : 'n/a'}%`;

  return {
    windowMinutes,
    sampleCount,
    sources,
    thresholds: {
      latencyP95Ms: LATENCY_DEGRADED_MS,
      http429Rate: THROTTLE_RATE_DEGRADED,
      http5xxRate: ERROR_RATE_DEGRADED,
    },
    snapshot,
  };
}

function buildFingerprint(summary: MetricSummary): IncidentFingerprint {
  const tags: string[] = [];
  if ((summary.http429Rate || 0) >= THROTTLE_RATE_DEGRADED) tags.push('throttling');
  if ((summary.http5xxRate || 0) >= ERROR_RATE_DEGRADED) tags.push('errors');
  if ((summary.latencyP95 || 0) >= LATENCY_DEGRADED_MS) tags.push('latency');
  if ((summary.streamDisconnectRate || 0) >= 0.03) tags.push('streaming');

  return {
    tags,
    signature: tags.length ? tags.join('+') : 'stable',
  };
}

function makeLens(label: string, summary: MetricSummary): LensSummary {
  const signal = scoreSignal(summary);
  const parts: string[] = [];
  if (summary.latencyP95) parts.push(`p95 ${Math.round(summary.latencyP95)}ms`);
  if (summary.http429Rate !== undefined) {
    parts.push(`429 ${(summary.http429Rate * 100).toFixed(1)}%`);
  }
  if (summary.http5xxRate !== undefined) {
    parts.push(`5xx ${(summary.http5xxRate * 100).toFixed(1)}%`);
  }
  const summaryText = parts.length ? parts.join(' | ') : 'No data collected yet.';
  return {
    label,
    signal,
    summary: summaryText,
    metrics: {
      latencyP95: summary.latencyP95,
      errorRate: summary.http5xxRate,
      throttleRate: summary.http429Rate,
      tokensPerSec: summary.tokensPerSec,
      streamDisconnectRate: summary.streamDisconnectRate,
    },
  };
}

function hashToken(value: string): string {
  const salt = config.insights.telemetrySalt || 'ai-status-dashboard';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function matchesScope(
  record: { model?: string; endpoint?: string; region?: string; tier?: string; streaming?: boolean },
  scope: { model: string; endpoint: string; region: string; tier: string; streaming: boolean }
) {
  const modelMatch = record.model === scope.model || record.model === 'status' || !record.model;
  const endpointMatch = record.endpoint === scope.endpoint || record.endpoint === 'status' || !record.endpoint;
  const regionMatch = record.region === scope.region || record.region === 'global' || !record.region;
  return (
    modelMatch &&
    endpointMatch &&
    regionMatch &&
    String(record.tier || 'unknown') === String(scope.tier || 'unknown') &&
    Boolean(record.streaming) === Boolean(scope.streaming)
  );
}

function resolveModelCatalog(providerId: string) {
  const catalog = (modelsCatalog as Record<string, any>)[providerId] || (modelsCatalog as any)._default;
  return catalog;
}

function nowMinus(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

const IGNORED_SYNTHETIC_CODES = new Set(['http-401', 'http-403', 'http-404']);

function isSyntheticSignalCandidate(event: SyntheticProbeEvent): boolean {
  if (event.model === 'status' || event.endpoint === 'status') return false;
  const code = String(event.errorCode || '').toLowerCase().trim();
  if (!code) return true;
  if (code === 'semantic_mismatch') return true;
  if (code.startsWith('http-')) return !IGNORED_SYNTHETIC_CODES.has(code);
  return false;
}

function filterSyntheticSignals(events: SyntheticProbeEvent[]): SyntheticProbeEvent[] {
  return events.filter(isSyntheticSignalCandidate);
}

export class InsightsService {
  async ingestTelemetry(payload: Omit<TelemetryEvent, 'clientIdHash' | 'timestamp' | 'source'> & {
    clientId: string;
    accountId?: string;
    source?: 'crowd' | 'account';
  }) {
    if (!config.insights.telemetryEnabled) return;
    const db = getDb();
    const source = payload.source || (payload.accountId ? 'account' : 'crowd');
    const clientIdHash = hashToken(payload.clientId);
    const accountIdHash = payload.accountId ? hashToken(payload.accountId) : undefined;

    await db.collection('telemetry_events').add({
      source,
      clientIdHash,
      accountIdHash,
      providerId: payload.providerId,
      model: payload.model,
      endpoint: payload.endpoint,
      region: payload.region,
      tier: payload.tier || 'unknown',
      streaming: Boolean(payload.streaming),
      timestamp: Timestamp.fromDate(new Date()),
      latencyMs: payload.latencyMs,
      http5xxRate: payload.http5xxRate,
      http429Rate: payload.http429Rate,
      retryAfterMs: payload.retryAfterMs,
      throttleReason: payload.throttleReason,
      tokensPerSec: payload.tokensPerSec,
      streamDisconnectRate: payload.streamDisconnectRate,
      refusalRate: payload.refusalRate,
      toolSuccessRate: payload.toolSuccessRate,
      schemaValidRate: payload.schemaValidRate,
      completionLength: payload.completionLength,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  async ingestSynthetic(payload: Omit<SyntheticProbeEvent, 'timestamp'>) {
    if (!config.insights.probeEnabled) return;
    const db = getDb();
    await db.collection('synthetic_probes').add({
      providerId: payload.providerId,
      model: payload.model,
      endpoint: payload.endpoint,
      region: payload.region,
      tier: payload.tier || 'unknown',
      streaming: Boolean(payload.streaming),
      timestamp: Timestamp.fromDate(new Date()),
      latencyMs: payload.latencyMs,
      latencyP50: payload.latencyP50,
      latencyP95: payload.latencyP95,
      latencyP99: payload.latencyP99,
      http5xxRate: payload.http5xxRate,
      http429Rate: payload.http429Rate,
      tokensPerSec: payload.tokensPerSec,
      streamDisconnectRate: payload.streamDisconnectRate,
      errorCode: payload.errorCode,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  private async getTelemetryEvents(options: {
    windowMinutes?: number;
    providerId?: string;
    source?: 'crowd' | 'account';
    accountIdHash?: string;
  }): Promise<TelemetryEvent[]> {
    const db = getDb();
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    try {
      let query: FirebaseFirestore.Query = db
        .collection('telemetry_events')
        .where('timestamp', '>=', Timestamp.fromDate(nowMinus(windowMinutes)));

      if (options.providerId) {
        query = query.where('providerId', '==', options.providerId);
      }
      if (options.source) {
        query = query.where('source', '==', options.source);
      }
      if (options.accountIdHash) {
        query = query.where('accountIdHash', '==', options.accountIdHash);
      }

      const snapshot = await query.limit(500).get();
      return snapshot.docs.map((doc) => this.mapTelemetry(doc.data()));
    } catch (error: any) {
      if (error?.code === 9 || error?.message?.includes('index')) {
        const fallback = await db.collection('telemetry_events').limit(200).get();
        return fallback.docs.map((doc) => this.mapTelemetry(doc.data()));
      }
      throw error;
    }
  }

  private async getSyntheticEvents(options: {
    windowMinutes?: number;
    providerId?: string;
  }): Promise<SyntheticProbeEvent[]> {
    const db = getDb();
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    try {
      let query: FirebaseFirestore.Query = db
        .collection('synthetic_probes')
        .where('timestamp', '>=', Timestamp.fromDate(nowMinus(windowMinutes)));

      if (options.providerId) {
        query = query.where('providerId', '==', options.providerId);
      }

      const snapshot = await query.limit(500).get();
      return snapshot.docs.map((doc) => this.mapSynthetic(doc.data()));
    } catch (error: any) {
      if (error?.code === 9 || error?.message?.includes('index')) {
        const fallback = await db.collection('synthetic_probes').limit(200).get();
        return fallback.docs.map((doc) => this.mapSynthetic(doc.data()));
      }
      throw error;
    }
  }

  private mapTelemetry(data: any): TelemetryEvent {
    return {
      source: data.source,
      clientIdHash: data.clientIdHash,
      accountIdHash: data.accountIdHash,
      providerId: data.providerId,
      model: data.model,
      endpoint: data.endpoint,
      region: data.region,
      tier: data.tier || 'unknown',
      streaming: Boolean(data.streaming),
      timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      latencyMs: data.latencyMs,
      http5xxRate: data.http5xxRate,
      http429Rate: data.http429Rate,
      retryAfterMs: data.retryAfterMs,
      throttleReason: data.throttleReason,
      tokensPerSec: data.tokensPerSec,
      streamDisconnectRate: data.streamDisconnectRate,
      refusalRate: data.refusalRate,
      toolSuccessRate: data.toolSuccessRate,
      schemaValidRate: data.schemaValidRate,
      completionLength: data.completionLength,
    };
  }

  private mapSynthetic(data: any): SyntheticProbeEvent {
    return {
      providerId: data.providerId,
      model: data.model,
      endpoint: data.endpoint,
      region: data.region,
      tier: data.tier || 'unknown',
      streaming: Boolean(data.streaming),
      timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      latencyMs: data.latencyMs,
      latencyP50: data.latencyP50,
      latencyP95: data.latencyP95,
      latencyP99: data.latencyP99,
      http5xxRate: data.http5xxRate,
      http429Rate: data.http429Rate,
      tokensPerSec: data.tokensPerSec,
      streamDisconnectRate: data.streamDisconnectRate,
      errorCode: data.errorCode,
    };
  }

  async getCanaryCopilot(options: {
    providerId: string;
    model: string;
    endpoint: string;
    region: string;
    tier: string;
    streaming: boolean;
    windowMinutes?: number;
    accountId?: string;
  }): Promise<CanaryCopilotResponse> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const syntheticRaw = await this.getSyntheticEvents({
      providerId: options.providerId,
      windowMinutes,
    });
    const synthetic = filterSyntheticSignals(syntheticRaw);

    const crowd = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });

    const accountIdHash = options.accountId ? hashToken(options.accountId) : undefined;
    const account = accountIdHash
      ? await this.getTelemetryEvents({
          providerId: options.providerId,
          windowMinutes,
          source: 'account',
          accountIdHash,
        })
      : [];

    const scope = {
      model: options.model,
      endpoint: options.endpoint,
      region: options.region,
      tier: options.tier,
      streaming: options.streaming,
    };

    const syntheticScoped = synthetic.filter((event) => matchesScope(event, scope));
    const crowdScoped = crowd.filter((event) => matchesScope(event, scope));
    const accountScoped = account.filter((event) => matchesScope(event, scope));

    const officialDoc = await getDb().collection('provider_status').doc(options.providerId).get();
    const officialData = officialDoc.exists ? officialDoc.data() : null;
    const officialStatus = typeof officialData?.status === 'string' ? officialData.status : undefined;
    const officialDescription =
      typeof officialData?.description === 'string' ? officialData.description : undefined;

    const syntheticSummary = makeLens('Synthetic probes', summarizeMetrics(syntheticScoped));
    const crowdSummary = makeLens('Crowd telemetry', summarizeMetrics(crowdScoped));
    const accountSummary = makeLens('Your account', summarizeMetrics(accountScoped));
    const observedSummary = makeLens(
      'Observed global',
      summarizeMetrics([...syntheticScoped, ...crowdScoped])
    );
    const officialSummary: LensSummary = {
      label: 'Official status',
      signal: mapOfficialSignal(officialStatus),
      summary: officialDescription
        ? `Official: ${officialDescription}`
        : `Official status: ${officialStatus || 'unknown'}`,
      metrics: {},
    };

    return {
      windowMinutes,
      providerId: options.providerId,
      model: options.model,
      endpoint: options.endpoint,
      region: options.region,
      tier: options.tier,
      streaming: options.streaming,
      lenses: {
        official: officialSummary,
        observed: observedSummary,
        synthetic: syntheticSummary,
        crowd: crowdSummary,
        account: accountSummary,
      },
    };
  }

  async getModelMatrix(options: {
    providerId: string;
    windowMinutes?: number;
  }): Promise<ModelMatrixResponse> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const syntheticRaw = await this.getSyntheticEvents({
      providerId: options.providerId,
      windowMinutes,
    });
    const synthetic = filterSyntheticSignals(syntheticRaw);
    const crowd = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });

    const catalog = resolveModelCatalog(options.providerId);
    const tiles: ModelMatrixTile[] = [];

    for (const model of catalog.models) {
      for (const endpoint of catalog.endpoints) {
        for (const region of catalog.regions) {
          const tier = model.tier || catalog.tiers?.[0] || 'unknown';
          const streaming = Boolean(model.streaming);
          const matchingSynthetic = synthetic.filter(
            (event) =>
              event.model === model.id &&
              event.endpoint === endpoint &&
              event.region === region
          );
          const matchingCrowd = crowd.filter(
            (event) =>
              event.model === model.id &&
              event.endpoint === endpoint &&
              event.region === region
          );

          const combined = [...matchingSynthetic, ...matchingCrowd];
          const summary = summarizeMetrics(combined);
          const sampleCount = combined.length;
          const sources = [
            matchingSynthetic.length ? 'synthetic' : '',
            matchingCrowd.length ? 'crowd' : '',
          ].filter(Boolean);
          const confidence =
            sampleCount >= 10 && sources.length > 1
              ? 'high'
              : sampleCount >= 4
                ? 'medium'
                : 'low';
          const evidence = buildEvidence(summary, windowMinutes, sampleCount, sources);
          tiles.push({
            providerId: options.providerId,
            model: model.id,
            endpoint,
            region,
            tier,
            streaming,
            latencyP50: summary.latencyP50,
            latencyP95: summary.latencyP95,
            latencyP99: summary.latencyP99,
            http5xxRate: summary.http5xxRate,
            http429Rate: summary.http429Rate,
            tokensPerSec: summary.tokensPerSec,
            streamDisconnectRate: summary.streamDisconnectRate,
            signal: scoreSignal(summary),
            confidence,
            evidence,
          });
        }
      }
    }

    return {
      providerId: options.providerId,
      windowMinutes,
      tiles,
    };
  }

  buildFallbackPlan(tile: ModelMatrixTile): FallbackPlan {
    const actions: string[] = [];
    const catalog = resolveModelCatalog(tile.providerId || '_default');
    const modelCandidates = catalog.models.map((item: any) => item.id);
    const regionCandidates = catalog.regions || [];
    const nextModel = modelCandidates.find((id: string) => id !== tile.model);
    const nextRegion = regionCandidates.find((id: string) => id !== tile.region);
    const needsFallback =
      tile.signal === 'degraded' ||
      tile.signal === 'down' ||
      (tile.latencyP95 || 0) >= LATENCY_WARNING_MS ||
      (tile.http429Rate || 0) >= THROTTLE_RATE_DEGRADED ||
      (tile.http5xxRate || 0) >= ERROR_RATE_DEGRADED;

    if (needsFallback) {
      if (nextModel) {
        actions.push(`Switch ${tile.model} to ${nextModel}.`);
      }
      if (nextRegion) {
        actions.push(`Move traffic from ${tile.region} to ${nextRegion}.`);
      }
      if (tile.streaming) {
        actions.push('Disable streaming for this route.');
      }
      actions.push('Reduce max tokens or enable caching to lower tail latency.');
    }
    if (tile.http429Rate && tile.http429Rate > THROTTLE_RATE_DEGRADED) {
      actions.push('Lower request rate or enable adaptive retry backoff.');
    }
    if (tile.latencyP95 && tile.latencyP95 > LATENCY_WARNING_MS) {
      actions.push('Fail over to a lower-latency model or region.');
    }
    if (tile.streamDisconnectRate && tile.streamDisconnectRate > 0.03) {
      actions.push('Disable streaming for this route.');
    }
    if (!actions.length) {
      actions.push('Traffic is stable. No fallback action required.');
    }

    return {
      summary: `Fallback plan for ${tile.model} in ${tile.region} (${tile.endpoint}).`,
      actions,
      jsonPolicy: {
        match: {
          providerId: tile.providerId,
          model: tile.model,
          region: tile.region,
          endpoint: tile.endpoint,
        },
        thresholds: {
          latencyP95Ms: LATENCY_WARNING_MS,
          http429Rate: THROTTLE_RATE_DEGRADED,
          http5xxRate: ERROR_RATE_DEGRADED,
        },
        cooldownMinutes: 5,
        hysteresisMinutes: 2,
        actions,
      },
      evidence: tile.evidence,
    };
  }

  async getIncidentReplay(options: {
    providerId: string;
    windowMinutes?: number;
    at?: string;
  }): Promise<IncidentReplayResponse> {
    const windowMinutes = options.windowMinutes || 180;
    const center = options.at ? new Date(options.at) : new Date();
    const startDate = new Date(center.getTime() - windowMinutes * 60 * 1000);
    const history = await persistenceService.getHistory({
      providerId: options.providerId,
      startDate,
      limit: 200,
    });

    const timeline = history
      .map((record) => ({
        timestamp: record.checkedAt,
        status: record.status,
        latencyP95: record.responseTime,
        http429Rate: undefined,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      providerId: options.providerId,
      windowMinutes,
      timeline,
    };
  }

  async getForecast(options: { providerId: string; windowMinutes?: number }): Promise<ForecastResponse> {
    const windowMinutes = options.windowMinutes || 60;
    const history = await persistenceService.getHistory({
      providerId: options.providerId,
      startDate: nowMinus(windowMinutes),
      limit: 200,
    });
    const telemetry = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });
    const throttleRate = average(telemetry.map((item) => item.http429Rate)) || 0;

    if (!history.length) {
      return {
        providerId: options.providerId,
        risk: 'unknown',
        rationale: ['Not enough recent data to estimate risk.'],
      };
    }

    const latencies = history.map((h) => h.responseTime).filter((v) => typeof v === 'number');
    const recentP95 = percentile(latencies, 95) || 0;
    const recentAvg = average(latencies) || 0;

    let risk: ForecastResponse['risk'] = 'low';
    const rationale: string[] = [];

    if (recentP95 > LATENCY_DEGRADED_MS) {
      risk = 'high';
      rationale.push('Tail latency is above 4s in the last hour.');
    } else if (recentP95 > LATENCY_WARNING_MS) {
      risk = 'elevated';
      rationale.push('Tail latency is trending above 2s.');
    }

    if (recentAvg > LATENCY_WARNING_MS && risk === 'low') {
      risk = 'elevated';
      rationale.push('Average latency drift detected.');
    }

    if (throttleRate >= THROTTLE_RATE_DEGRADED) {
      risk = 'high';
      rationale.push('Throttling spikes detected in crowd telemetry.');
    }

    if (!rationale.length) {
      rationale.push('No significant latency drift or error spikes detected.');
    }

    return {
      providerId: options.providerId,
      risk,
      rationale,
    };
  }

  async getRateLimits(options: { providerId: string; windowMinutes?: number }): Promise<RateLimitSummary> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const events = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });

    const grouped: Record<string, TelemetryEvent[]> = {};
    for (const event of events) {
      const key = `${event.model}|${event.region}|${event.tier}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(event);
    }

    const segments = Object.entries(grouped).map(([key, items]) => {
      const [model, region, tier] = key.split('|');
      const retryAfterValues = items
        .map((item) => item.retryAfterMs)
        .filter((value): value is number => typeof value === 'number');
      const reasons = items
        .map((item) => item.throttleReason)
        .filter((value): value is string => Boolean(value));
      const reasonCounts = reasons.reduce<Record<string, number>>((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});
      const topReasons = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason]) => reason);
      return {
        model,
        region,
        tier,
        http429Rate: average(items.map((i) => i.http429Rate)) || 0,
        effectiveTokensPerSec: average(items.map((i) => i.tokensPerSec)),
        retryAfterP50: percentile(retryAfterValues, 50),
        retryAfterP95: percentile(retryAfterValues, 95),
        topReasons: topReasons.length ? topReasons : undefined,
      };
    });

    return {
      providerId: options.providerId,
      windowMinutes,
      segments,
    };
  }

  async getRateLimitIncidents(options: { windowMinutes?: number } = {}): Promise<RateLimitIncident[]> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const telemetry = await this.getTelemetryEvents({ windowMinutes, source: 'crowd' });

    const grouped: Record<string, TelemetryEvent[]> = {};
    for (const event of telemetry) {
      if (typeof event.http429Rate !== 'number') continue;
      const key = `${event.providerId}|${event.model}|${event.region}|${event.tier}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(event);
    }

    const incidents: RateLimitIncident[] = [];
    for (const [key, items] of Object.entries(grouped)) {
      const [providerId, model, region, tier] = key.split('|');
      const http429Rate = average(items.map((item) => item.http429Rate)) || 0;
      if (http429Rate < THROTTLE_RATE_DEGRADED || items.length < 5) continue;

      incidents.push({
        id: `${providerId}-${model}-${region}-${tier}`,
        providerId,
        model,
        region,
        tier,
        http429Rate,
        windowMinutes,
        detectedAt: new Date().toISOString(),
      });
    }

    return incidents;
  }

  async getThroughputBaseline(options: {
    providerId: string;
    model: string;
    region: string;
    windowMinutes?: number;
    baselineWindowMinutes?: number;
  }): Promise<ThroughputBaseline> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const baselineWindowMinutes = options.baselineWindowMinutes || 60 * 24 * 7;

    const current = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });
    const baseline = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes: baselineWindowMinutes,
      source: 'crowd',
    });

    const filterFn = (event: TelemetryEvent) =>
      event.model === options.model && event.region === options.region && typeof event.tokensPerSec === 'number';

    const currentTokens = average(current.filter(filterFn).map((event) => event.tokensPerSec));
    const baselineTokens = average(baseline.filter(filterFn).map((event) => event.tokensPerSec));
    const delta = currentTokens !== undefined && baselineTokens !== undefined
      ? (currentTokens - baselineTokens) / baselineTokens
      : undefined;

    return {
      providerId: options.providerId,
      model: options.model,
      region: options.region,
      windowMinutes,
      baselineWindowMinutes,
      currentTokensPerSec: currentTokens,
      baselineTokensPerSec: baselineTokens,
      delta,
    };
  }

  async getBehavioral(options: { providerId: string; windowMinutes?: number }): Promise<BehavioralMetricSummary> {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const events = await this.getTelemetryEvents({
      providerId: options.providerId,
      windowMinutes,
      source: 'crowd',
    });

    const grouped: Record<string, TelemetryEvent[]> = {};
    for (const event of events) {
      const key = `${event.model}|${event.endpoint}|${event.region}`;
      grouped[key] = grouped[key] || [];
      grouped[key].push(event);
    }

    const segments = Object.entries(grouped).map(([key, items]) => {
      const [model, endpoint, region] = key.split('|');
      return {
        model,
        endpoint,
        region,
        refusalRate: average(items.map((i) => i.refusalRate)),
        toolSuccessRate: average(items.map((i) => i.toolSuccessRate)),
        schemaValidRate: average(items.map((i) => i.schemaValidRate)),
        completionLength: average(items.map((i) => i.completionLength)),
      };
    });

    return {
      providerId: options.providerId,
      windowMinutes,
      segments,
    };
  }

  async getEarlyWarnings(options: { windowMinutes?: number } = {}): Promise<EarlyWarningSignal[]> {
    const windowMinutes = options.windowMinutes || 30;
    const synthetic = filterSyntheticSignals(await this.getSyntheticEvents({ windowMinutes }));
    const crowd = await this.getTelemetryEvents({ windowMinutes, source: 'crowd' });

    const grouped: Record<string, { synthetic: SyntheticProbeEvent[]; crowd: TelemetryEvent[] }> = {};
    for (const event of synthetic) {
      grouped[event.providerId] = grouped[event.providerId] || { synthetic: [], crowd: [] };
      grouped[event.providerId].synthetic.push(event);
    }
    for (const event of crowd) {
      grouped[event.providerId] = grouped[event.providerId] || { synthetic: [], crowd: [] };
      grouped[event.providerId].crowd.push(event);
    }

    const warnings: EarlyWarningSignal[] = [];
    for (const [providerId, events] of Object.entries(grouped)) {
      const syntheticSummary = summarizeMetrics(events.synthetic);
      const crowdSummary = summarizeMetrics(events.crowd);

      const syntheticSignal = scoreSignal(syntheticSummary);
      const crowdSignal = scoreSignal(crowdSummary);

      const degradedSignals = [syntheticSignal, crowdSignal].filter((s) => s === 'degraded' || s === 'down');
      if (degradedSignals.length === 0) continue;

      const risk = degradedSignals.length > 1 ? 'high' : 'elevated';
      const latencyP95 = syntheticSummary.latencyP95 || crowdSummary.latencyP95;
      const http429Rate = syntheticSummary.http429Rate ?? crowdSummary.http429Rate;
      const http5xxRate = syntheticSummary.http5xxRate ?? crowdSummary.http5xxRate;
      const sampleCount = events.synthetic.length + events.crowd.length;
      const evidence = buildEvidence(
        summarizeMetrics([...events.synthetic, ...events.crowd]),
        windowMinutes,
        sampleCount,
        [
          events.synthetic.length ? 'synthetic' : '',
          events.crowd.length ? 'crowd' : '',
        ].filter(Boolean)
      );
      const fingerprint = buildFingerprint(summarizeMetrics([...events.synthetic, ...events.crowd]));

      const affectedModels = Array.from(
        new Set([...events.synthetic.map((e) => e.model), ...events.crowd.map((e) => e.model)])
      ).filter(Boolean);
      const affectedRegions = Array.from(
        new Set([...events.synthetic.map((e) => e.region), ...events.crowd.map((e) => e.region)])
      ).filter(Boolean);

      const summaryParts: string[] = [];
      if (latencyP95) summaryParts.push(`p95 latency ${Math.round(latencyP95)}ms`);
      if (http429Rate !== undefined) summaryParts.push(`429 ${(http429Rate * 100).toFixed(1)}%`);
      if (http5xxRate !== undefined) summaryParts.push(`5xx ${(http5xxRate * 100).toFixed(1)}%`);

      warnings.push({
        id: `${providerId}-${windowMinutes}`,
        providerId,
        risk,
        summary: summaryParts.length ? summaryParts.join(' | ') : 'Degradation detected in recent telemetry.',
        windowMinutes,
        affectedModels,
        affectedRegions,
        evidence: {
          latencyP95,
          http429Rate,
          http5xxRate,
          sampleCount,
          sources: evidence.sources,
          thresholds: evidence.thresholds,
          snapshot: evidence.snapshot,
        },
        fingerprint,
      });
    }

    return warnings;
  }

  async getStalenessSignals(options: { windowMinutes?: number } = {}): Promise<StalenessSignal[]> {
    const windowMinutes = options.windowMinutes || 30;
    const minSamples = 3;
    const db = getDb();
    const snapshot = await db.collection('provider_status').get();
    const signals: StalenessSignal[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const providerId = data.providerId || doc.id;
      const officialStatus = typeof data.status === 'string' ? data.status : 'unknown';

      const synthetic = filterSyntheticSignals(
        await this.getSyntheticEvents({ providerId, windowMinutes })
      );
      const crowd = await this.getTelemetryEvents({ providerId, windowMinutes, source: 'crowd' });
      const combined = [...synthetic, ...crowd];
      if (combined.length < minSamples) continue;
      const summary = summarizeMetrics(combined);
      const observedSignal = scoreSignal(summary);

      if (officialStatus !== 'operational') continue;
      if (observedSignal === 'healthy' || observedSignal === 'no-data') continue;

      const evidence = buildEvidence(summary, windowMinutes, combined.length, [
        synthetic.length ? 'synthetic' : '',
        crowd.length ? 'crowd' : '',
      ].filter(Boolean));

      const confidence =
        combined.length >= 10 && crowd.length > 0 ? 'high' : combined.length >= 5 ? 'medium' : 'low';
      const note =
        crowd.length === 0
          ? 'Signal based on synthetic probes only.'
          : combined.length < 5
            ? 'Low sample count; treat as an early warning.'
            : undefined;

      signals.push({
        providerId,
        officialStatus,
        observedSignal,
        summary: `Official status is ${officialStatus} but observed telemetry is ${observedSignal}.`,
        windowMinutes,
        evidence,
        confidence,
        note,
      });
    }

    return signals;
  }

  async getChangeRadar(options: { providerId?: string }): Promise<ChangeRadarEvent[]> {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('change_radar_events');
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    const snapshot = await query.limit(50).get();
    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        providerId: data.providerId,
        type: data.type,
        title: data.title,
        summary: data.summary,
        effectiveDate: data.effectiveDate,
        url: data.url,
        severity: data.severity || 'info',
      } as ChangeRadarEvent;
    });

    if (events.length) return events;

    return (changeRadarSeed as any).events || [];
  }

  async createChangeRadarEvent(event: Omit<ChangeRadarEvent, 'id'>): Promise<ChangeRadarEvent> {
    const db = getDb();
    const payload = {
      providerId: event.providerId,
      type: event.type,
      title: event.title,
      summary: event.summary,
      effectiveDate: event.effectiveDate || null,
      url: event.url || null,
      severity: event.severity || 'info',
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('change_radar_events').add(payload);
    return {
      id: docRef.id,
      providerId: event.providerId,
      type: event.type,
      title: event.title,
      summary: event.summary,
      effectiveDate: event.effectiveDate,
      url: event.url,
      severity: event.severity || 'info',
    };
  }

  async deleteChangeRadarEvent(eventId: string): Promise<void> {
    const db = getDb();
    await db.collection('change_radar_events').doc(eventId).delete();
  }

  async askStatus(question: string, providerId: string): Promise<AskStatusResponse> {
    const windowMinutes = 60;
    const telemetry = await this.getTelemetryEvents({
      providerId,
      windowMinutes,
      source: 'crowd',
    });
    const summary = summarizeMetrics(telemetry);
    const signal = scoreSignal(summary);
    const snapshot = `p95=${summary.latencyP95 ? Math.round(summary.latencyP95) : 'n/a'}ms, ` +
      `429=${summary.http429Rate !== undefined ? (summary.http429Rate * 100).toFixed(1) : 'n/a'}%, ` +
      `5xx=${summary.http5xxRate !== undefined ? (summary.http5xxRate * 100).toFixed(1) : 'n/a'}%`;

    const answerParts: string[] = [];
    if (question.toLowerCase().includes('latency')) {
      answerParts.push(
        summary.latencyP95
          ? `p95 latency is ${Math.round(summary.latencyP95)}ms in the last hour.`
          : 'Latency data is not available yet.'
      );
    }
    if (question.toLowerCase().includes('rate') || question.toLowerCase().includes('429')) {
      answerParts.push(
        summary.http429Rate !== undefined
          ? `429 throttling is ${(summary.http429Rate * 100).toFixed(1)}%.`
          : 'No rate-limit telemetry has been received.'
      );
    }
    if (!answerParts.length) {
      answerParts.push(`Current reliability signal is ${signal}.`);
    }

    return {
      answer: answerParts.join(' '),
      receipts: {
        windowMinutes,
        dataSources: ['telemetry_events'],
        thresholds: {
          latencyP95Ms: LATENCY_WARNING_MS,
          http429Rate: THROTTLE_RATE_DEGRADED,
        },
        snapshot,
      },
    };
  }
}

export const insightsService = new InsightsService();
