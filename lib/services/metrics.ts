import { getDb } from '@/lib/db/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { SyntheticProbeEvent, TelemetryEvent } from '@/lib/types/insights';
import { log } from '@/lib/utils/logger';

export type MetricName =
  | 'latency_p50_ms'
  | 'latency_p95_ms'
  | 'latency_p99_ms'
  | 'first_token_latency_ms'
  | 'http_429_rate'
  | 'http_5xx_rate'
  | 'tokens_per_sec'
  | 'stream_disconnect_rate';

export type MetricPoint = {
  timestamp: string;
  value: number | null;
  sample_count: number;
  sources: string[];
};

export type MetricSeries = {
  metric: MetricName;
  provider_id?: string;
  surface?: string;
  model?: string;
  region?: string;
  tier?: string;
  streaming?: boolean;
  since: string;
  until: string;
  granularity_seconds: number;
  series: MetricPoint[];
};

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

function mapTelemetry(data: any): TelemetryEvent {
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

function mapSynthetic(data: any): SyntheticProbeEvent {
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

async function loadTelemetry(options: {
  since: Date;
  until: Date;
  providerId?: string;
  source?: 'crowd' | 'account';
  accountIdHash?: string;
}) {
  const db = getDb();
  try {
    let query: FirebaseFirestore.Query = db
      .collection('telemetry_events')
      .where('timestamp', '>=', Timestamp.fromDate(options.since));

    if (options.until) {
      query = query.where('timestamp', '<=', Timestamp.fromDate(options.until));
    }
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    if (options.source) {
      query = query.where('source', '==', options.source);
    }
    if (options.accountIdHash) {
      query = query.where('accountIdHash', '==', options.accountIdHash);
    }

    const snapshot = await query.limit(1000).get();
    return snapshot.docs.map((doc) => mapTelemetry(doc.data()));
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      log('warn', 'Telemetry query requires index, falling back to recent records', { error });
      const fallback = await db.collection('telemetry_events').limit(300).get();
      const mapped = fallback.docs.map((doc) => mapTelemetry(doc.data()));
      return mapped.filter((event) => {
        const ts = new Date(event.timestamp).getTime();
        return ts >= options.since.getTime() && ts <= options.until.getTime();
      });
    }
    throw error;
  }
}

async function loadSynthetic(options: { since: Date; until: Date; providerId?: string }) {
  const db = getDb();
  try {
    let query: FirebaseFirestore.Query = db
      .collection('synthetic_probes')
      .where('timestamp', '>=', Timestamp.fromDate(options.since));

    if (options.until) {
      query = query.where('timestamp', '<=', Timestamp.fromDate(options.until));
    }
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }

    const snapshot = await query.limit(1000).get();
    return snapshot.docs.map((doc) => mapSynthetic(doc.data()));
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      log('warn', 'Synthetic query requires index, falling back to recent records', { error });
      const fallback = await db.collection('synthetic_probes').limit(300).get();
      const mapped = fallback.docs.map((doc) => mapSynthetic(doc.data()));
      return mapped.filter((event) => {
        const ts = new Date(event.timestamp).getTime();
        return ts >= options.since.getTime() && ts <= options.until.getTime();
      });
    }
    throw error;
  }
}

function matchesScope(
  record: { model?: string; endpoint?: string; region?: string; tier?: string; streaming?: boolean },
  scope: { model?: string; endpoint?: string; region?: string; tier?: string; streaming?: boolean }
) {
  if (scope.model && record.model !== scope.model && record.model !== 'status') return false;
  if (scope.endpoint && record.endpoint !== scope.endpoint && record.endpoint !== 'status') return false;
  if (scope.region && record.region !== scope.region && record.region !== 'global') return false;
  if (scope.tier && String(record.tier || 'unknown') !== String(scope.tier)) return false;
  if (typeof scope.streaming === 'boolean' && Boolean(record.streaming) !== scope.streaming) return false;
  return true;
}

function resolveMetricValue(metric: MetricName, events: Array<TelemetryEvent | SyntheticProbeEvent>) {
  if (!events.length) return undefined;
  const extractLatency = (event: TelemetryEvent | SyntheticProbeEvent, field: 'latencyP50' | 'latencyP95' | 'latencyP99') => {
    if (field in event && typeof (event as any)[field] === 'number') {
      return (event as any)[field] as number;
    }
    return event.latencyMs;
  };
  switch (metric) {
    case 'latency_p50_ms':
      return percentile(events.map((e) => extractLatency(e, 'latencyP50') || 0).filter(Boolean), 50);
    case 'latency_p95_ms':
      return percentile(events.map((e) => extractLatency(e, 'latencyP95') || 0).filter(Boolean), 95);
    case 'latency_p99_ms':
      return percentile(events.map((e) => extractLatency(e, 'latencyP99') || 0).filter(Boolean), 99);
    case 'first_token_latency_ms':
      return percentile(events.map((e) => e.latencyMs || extractLatency(e, 'latencyP50') || 0).filter(Boolean), 50);
    case 'http_429_rate':
      return average(events.map((e) => e.http429Rate));
    case 'http_5xx_rate':
      return average(events.map((e) => e.http5xxRate));
    case 'tokens_per_sec':
      return average(events.map((e) => e.tokensPerSec));
    case 'stream_disconnect_rate':
      return average(events.map((e) => e.streamDisconnectRate));
    default:
      return undefined;
  }
}

export async function queryMetricSeries(options: {
  metric: MetricName;
  providerId?: string;
  surface?: string;
  model?: string;
  region?: string;
  tier?: string;
  streaming?: boolean;
  since: Date;
  until: Date;
  granularitySeconds: number;
  includeSynthetic?: boolean;
  includeCrowd?: boolean;
  includeAccount?: boolean;
  accountIdHash?: string;
}): Promise<MetricSeries> {
  const includeSynthetic = options.includeSynthetic ?? true;
  const includeCrowd = options.includeCrowd ?? true;
  const includeAccount = options.includeAccount ?? false;

  const [synthetic, crowd, account] = await Promise.all([
    includeSynthetic
      ? loadSynthetic({
          since: options.since,
          until: options.until,
          providerId: options.providerId,
        })
      : Promise.resolve([]),
    includeCrowd
      ? loadTelemetry({
          since: options.since,
          until: options.until,
          providerId: options.providerId,
          source: 'crowd',
        })
      : Promise.resolve([]),
    includeAccount && options.accountIdHash
      ? loadTelemetry({
          since: options.since,
          until: options.until,
          providerId: options.providerId,
          source: 'account',
          accountIdHash: options.accountIdHash,
        })
      : Promise.resolve([]),
  ]);

  const scope = {
    model: options.model,
    endpoint: options.surface,
    region: options.region,
    tier: options.tier,
    streaming: options.streaming,
  };

  const events = [...synthetic, ...crowd, ...account].filter((event) => matchesScope(event, scope));
  const totalMs = options.until.getTime() - options.since.getTime();
  const bucketMs = Math.max(options.granularitySeconds * 1000, 60 * 1000);
  const bucketCount = Math.max(1, Math.ceil(totalMs / bucketMs));

  const buckets: Array<Array<TelemetryEvent | SyntheticProbeEvent>> = Array.from({ length: bucketCount }, () => []);

  events.forEach((event) => {
    const ts = new Date(event.timestamp).getTime();
    if (!Number.isFinite(ts)) return;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ts - options.since.getTime()) / bucketMs)));
    buckets[idx].push(event);
  });

  const series: MetricPoint[] = buckets.map((bucket, idx) => {
    const value = resolveMetricValue(options.metric, bucket);
    const timestamp = new Date(options.since.getTime() + idx * bucketMs).toISOString();
    const sources = [] as string[];
    if (bucket.some((event) => 'errorCode' in event)) sources.push('synthetic');
    if (bucket.some((event) => 'source' in event && event.source === 'crowd')) sources.push('crowd');
    if (bucket.some((event) => 'source' in event && event.source === 'account')) sources.push('account');
    return {
      timestamp,
      value: typeof value === 'number' ? Number(value.toFixed(4)) : null,
      sample_count: bucket.length,
      sources,
    };
  });

  return {
    metric: options.metric,
    provider_id: options.providerId,
    surface: options.surface,
    model: options.model,
    region: options.region,
    tier: options.tier,
    streaming: options.streaming,
    since: options.since.toISOString(),
    until: options.until.toISOString(),
    granularity_seconds: options.granularitySeconds,
    series,
  };
}
