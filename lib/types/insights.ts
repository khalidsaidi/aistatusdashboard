export type MetricWindow = '15m' | '1h' | '6h' | '24h' | '7d';

export interface TelemetryEvent {
  source: 'crowd' | 'account';
  clientIdHash: string;
  accountIdHash?: string;
  providerId: string;
  model: string;
  endpoint: string;
  region: string;
  tier: 'free' | 'pro' | 'enterprise' | 'unknown';
  streaming: boolean;
  timestamp: string;
  latencyMs: number;
  http5xxRate?: number;
  http429Rate?: number;
  retryAfterMs?: number;
  throttleReason?: string;
  tokensPerSec?: number;
  streamDisconnectRate?: number;
  refusalRate?: number;
  toolSuccessRate?: number;
  schemaValidRate?: number;
  completionLength?: number;
}

export interface SyntheticProbeEvent {
  providerId: string;
  model: string;
  endpoint: string;
  region: string;
  tier: 'free' | 'pro' | 'enterprise' | 'unknown';
  streaming: boolean;
  timestamp: string;
  latencyMs: number;
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  http5xxRate?: number;
  http429Rate?: number;
  tokensPerSec?: number;
  streamDisconnectRate?: number;
  errorCode?: string;
}

export interface LensSummary {
  label: string;
  signal: 'healthy' | 'degraded' | 'down' | 'no-data';
  summary: string;
  metrics: {
    latencyP95?: number;
    errorRate?: number;
    throttleRate?: number;
    tokensPerSec?: number;
    streamDisconnectRate?: number;
  };
}

export interface CanaryCopilotResponse {
  windowMinutes: number;
  providerId: string;
  model: string;
  endpoint: string;
  region: string;
  tier: string;
  streaming: boolean;
  lenses: {
    official?: LensSummary;
    observed?: LensSummary;
    synthetic: LensSummary;
    crowd: LensSummary;
    account: LensSummary;
  };
}

export interface ModelMatrixTile {
  providerId?: string;
  model: string;
  endpoint: string;
  region: string;
  tier: string;
  streaming: boolean;
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  http5xxRate?: number;
  http429Rate?: number;
  tokensPerSec?: number;
  streamDisconnectRate?: number;
  signal: 'healthy' | 'degraded' | 'down' | 'no-data';
  confidence?: 'low' | 'medium' | 'high';
  evidence?: EvidencePacket;
}

export interface ModelMatrixResponse {
  providerId: string;
  windowMinutes: number;
  tiles: ModelMatrixTile[];
}

export interface FallbackPlan {
  summary: string;
  actions: string[];
  jsonPolicy: Record<string, unknown>;
  evidence?: EvidencePacket;
}

export interface IncidentReplayPoint {
  timestamp: string;
  status: string;
  latencyP95?: number;
  http429Rate?: number;
}

export interface IncidentReplayResponse {
  providerId: string;
  windowMinutes: number;
  timeline: IncidentReplayPoint[];
}

export interface ForecastResponse {
  providerId: string;
  risk: 'low' | 'elevated' | 'high' | 'unknown';
  rationale: string[];
}

export interface RateLimitSummary {
  providerId: string;
  windowMinutes: number;
  segments: Array<{
    model: string;
    region: string;
    tier: string;
    http429Rate: number;
    effectiveTokensPerSec?: number;
    retryAfterP50?: number;
    retryAfterP95?: number;
    topReasons?: string[];
  }>;
}

export interface RateLimitIncident {
  id: string;
  providerId: string;
  model: string;
  region: string;
  tier: string;
  http429Rate: number;
  windowMinutes: number;
  detectedAt: string;
}

export interface ThroughputBaseline {
  providerId: string;
  model: string;
  region: string;
  windowMinutes: number;
  baselineWindowMinutes: number;
  currentTokensPerSec?: number;
  baselineTokensPerSec?: number;
  delta?: number;
}

export interface ChangeRadarEvent {
  id: string;
  providerId: string;
  type: 'pricing' | 'quota' | 'deprecation' | 'migration' | 'maintenance';
  title: string;
  summary: string;
  effectiveDate?: string;
  url?: string;
  severity: 'info' | 'important' | 'critical';
}

export interface BehavioralMetricSummary {
  providerId: string;
  windowMinutes: number;
  segments: Array<{
    model: string;
    endpoint: string;
    region: string;
    refusalRate?: number;
    toolSuccessRate?: number;
    schemaValidRate?: number;
    completionLength?: number;
  }>;
}

export interface AskStatusResponse {
  answer: string;
  receipts: {
    windowMinutes: number;
    dataSources: string[];
    thresholds: Record<string, number>;
    snapshot: string;
  };
}

export interface EvidencePacket {
  windowMinutes: number;
  sampleCount: number;
  sources: string[];
  thresholds: {
    latencyP95Ms: number;
    http429Rate: number;
    http5xxRate: number;
  };
  snapshot?: string;
}

export interface IncidentFingerprint {
  tags: string[];
  signature: string;
}

export interface EarlyWarningSignal {
  id: string;
  providerId: string;
  risk: 'elevated' | 'high';
  summary: string;
  windowMinutes: number;
  affectedModels: string[];
  affectedRegions: string[];
  evidence: {
    latencyP95?: number;
    http429Rate?: number;
    http5xxRate?: number;
    sampleCount: number;
    sources: string[];
    thresholds?: EvidencePacket['thresholds'];
    snapshot?: string;
  };
  fingerprint?: IncidentFingerprint;
}

export interface StalenessSignal {
  providerId: string;
  officialStatus: string;
  observedSignal: 'healthy' | 'degraded' | 'down' | 'no-data';
  summary: string;
  windowMinutes: number;
  evidence: EvidencePacket;
}
