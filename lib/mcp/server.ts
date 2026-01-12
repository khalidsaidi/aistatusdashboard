import { NextRequest, NextResponse } from 'next/server';
import {
  listProviders,
  listProviderRegions,
  listProviderSurfaces,
  listProviderModels,
  getStatusSummary,
  getHealthMatrix,
  searchIncidents,
  getIncidentById,
  queryMetrics,
  buildFallbackPlan,
  generatePolicy,
} from '@/lib/services/public-data';
import { buildResponseMeta } from '@/lib/utils/public-api';
import { requireOrgScope } from '@/lib/utils/oauth';

const MCP_PROTOCOL_VERSION = '2024-11-05';

const MCP_TOOLS = [
  {
    name: 'status.get_summary',
    description: 'Summarize provider status across official and observed signals.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        lens: { type: 'string', enum: ['official', 'observed', 'synthetic', 'crowd', 'my_org'] },
        surface: { type: 'string' },
        region: { type: 'string' },
        model: { type: 'string' },
        window_seconds: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'status.get_health_matrix',
    description: 'Return health matrix tiles for provider models/endpoints/regions.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        lens: { type: 'string', enum: ['observed', 'synthetic', 'crowd', 'my_org'] },
        window_seconds: { type: 'number' },
      },
      required: ['provider'],
      additionalProperties: false,
    },
  },
  {
    name: 'incidents.search',
    description: 'Search incidents with filters and pagination cursor.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        severity: { type: 'string' },
        active_only: { type: 'boolean' },
        since: { type: 'string' },
        until: { type: 'string' },
        region: { type: 'string' },
        model: { type: 'string' },
        q: { type: 'string' },
        cursor: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'incidents.get',
    description: 'Fetch a single incident by stable ID.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
      },
      required: ['incident_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'metrics.query',
    description: 'Query metric time series over a window.',
    inputSchema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: [
            'latency_p50_ms',
            'latency_p95_ms',
            'latency_p99_ms',
            'first_token_latency_ms',
            'http_429_rate',
            'http_5xx_rate',
            'tokens_per_sec',
            'stream_disconnect_rate',
          ],
        },
        provider: { type: 'string' },
        surface: { type: 'string' },
        model: { type: 'string' },
        region: { type: 'string' },
        since: { type: 'string' },
        until: { type: 'string' },
        granularity_seconds: { type: 'number' },
      },
      required: ['metric'],
      additionalProperties: false,
    },
  },
  {
    name: 'recommendations.get_fallback_plan',
    description: 'Generate a fallback plan for a model/region/endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        endpoint: { type: 'string' },
        region: { type: 'string' },
        tier: { type: 'string' },
        streaming: { type: 'boolean' },
        signal: { type: 'string' },
        latency_p50_ms: { type: 'number' },
        latency_p95_ms: { type: 'number' },
        latency_p99_ms: { type: 'number' },
        http_5xx_rate: { type: 'number' },
        http_429_rate: { type: 'number' },
        tokens_per_sec: { type: 'number' },
        stream_disconnect_rate: { type: 'number' },
      },
      required: ['model', 'endpoint', 'region'],
      additionalProperties: false,
    },
  },
  {
    name: 'policy.generate',
    description: 'Generate routing policy JSON for a model/region/endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' },
        endpoint: { type: 'string' },
        region: { type: 'string' },
        tier: { type: 'string' },
        streaming: { type: 'boolean' },
        objective: { type: 'string' },
      },
      required: ['model', 'endpoint', 'region'],
      additionalProperties: false,
    },
  },
];

const MCP_RESOURCES = [
  {
    uri: 'resource://providers',
    name: 'Providers',
    description: 'List of providers monitored by AIStatusDashboard.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'resource://providers/{provider}/surfaces',
    name: 'Provider surfaces',
    description: 'List supported surfaces/endpoints for a provider.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'resource://providers/{provider}/regions',
    name: 'Provider regions',
    description: 'List supported regions for a provider.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'resource://providers/{provider}/models',
    name: 'Provider models',
    description: 'List supported models for a provider.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'resource://incidents/{incident_id}',
    name: 'Incident',
    description: 'Incident detail by stable ID.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'resource://metrics/{provider}/{metric}?since=...&until=...',
    name: 'Metric series',
    description: 'Metric time series for a provider.',
    mimeType: 'application/json',
  },
  {
    uri: 'resource://docs/agent/quickstart',
    name: 'MCP Quickstart',
    description: 'Quickstart for MCP usage.',
    mimeType: 'text/markdown',
  },
];

const MCP_PROMPTS = [
  {
    name: 'prompt://diagnose_outage',
    description: 'Diagnose an outage and summarize blast radius.',
  },
  {
    name: 'prompt://choose_fallback_plan',
    description: 'Select a fallback plan based on current metrics.',
  },
  {
    name: 'prompt://draft_customer_update',
    description: 'Draft a customer update based on incident timeline.',
  },
  {
    name: 'prompt://generate_postmortem_outline',
    description: 'Create a postmortem outline with action items.',
  },
];

function toolResult(payload: { data: any; evidence?: any; confidence?: number }) {
  const meta = buildResponseMeta({ evidence: payload.evidence, confidence: payload.confidence });
  return {
    content: [
      {
        type: 'json',
        json: {
          ...meta,
          data: payload.data,
        },
      },
    ],
    isError: false,
  };
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: any) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

function jsonRpcResult(id: string | number | null, result: any) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function getLensParam(params: any): string | undefined {
  if (!params) return undefined;
  return typeof params.lens === 'string' ? params.lens : undefined;
}

function requiresOrgLens(params: any): boolean {
  const lens = getLensParam(params);
  return lens === 'my_org';
}

async function handleToolCall(request: NextRequest, tool: string, params: any) {
  if (requiresOrgLens(params)) {
    const auth = requireOrgScope(request);
    if (!auth.ok) {
      return toolResult({
        data: {
          error: 'unauthorized',
          message: 'OAuth scope org.read is required for lens=my_org.',
        },
        evidence: [],
        confidence: 0,
      });
    }
  }

  switch (tool) {
    case 'status.get_summary': {
      const payload = await getStatusSummary({
        providerId: typeof params?.provider === 'string' ? params.provider : undefined,
        windowSeconds: typeof params?.window_seconds === 'number' ? params.window_seconds : undefined,
        lens: getLensParam(params),
      });
      return toolResult(payload);
    }
    case 'status.get_health_matrix': {
      if (!params?.provider || typeof params.provider !== 'string') {
        return toolResult({ data: { error: 'provider is required' }, evidence: [], confidence: 0 });
      }
      const payload = await getHealthMatrix({
        providerId: params.provider,
        windowSeconds: typeof params?.window_seconds === 'number' ? params.window_seconds : undefined,
        lens: getLensParam(params),
      });
      return toolResult(payload);
    }
    case 'incidents.search': {
      const payload = await searchIncidents({
        providerId: typeof params?.provider === 'string' ? params.provider : undefined,
        severity: typeof params?.severity === 'string' ? params.severity : undefined,
        activeOnly: Boolean(params?.active_only),
        since: typeof params?.since === 'string' ? params.since : undefined,
        until: typeof params?.until === 'string' ? params.until : undefined,
        region: typeof params?.region === 'string' ? params.region : undefined,
        model: typeof params?.model === 'string' ? params.model : undefined,
        query: typeof params?.q === 'string' ? params.q : undefined,
        cursor: typeof params?.cursor === 'string' ? params.cursor : undefined,
        limit: typeof params?.limit === 'number' ? params.limit : undefined,
      });
      return toolResult(payload);
    }
    case 'incidents.get': {
      const id = params?.incident_id;
      if (typeof id !== 'string') {
        return toolResult({ data: { error: 'incident_id is required' }, evidence: [], confidence: 0 });
      }
      const incident = await getIncidentById(id);
      if (!incident) {
        return toolResult({ data: { error: 'incident not found' }, evidence: [], confidence: 0 });
      }
      return toolResult({
        data: incident,
        evidence: [
          {
            source_url: incident.rawUrl,
            ids: [id],
            metric_window: {
              since: incident.startedAt,
              until: incident.updatedAt,
            },
          },
        ],
        confidence: 0.8,
      });
    }
    case 'metrics.query': {
      if (!params?.metric) {
        return toolResult({ data: { error: 'metric is required' }, evidence: [], confidence: 0 });
      }
      const payload = await queryMetrics({
        metric: params.metric,
        providerId: typeof params?.provider === 'string' ? params.provider : undefined,
        surface: typeof params?.surface === 'string' ? params.surface : undefined,
        model: typeof params?.model === 'string' ? params.model : undefined,
        region: typeof params?.region === 'string' ? params.region : undefined,
        since: typeof params?.since === 'string' ? params.since : undefined,
        until: typeof params?.until === 'string' ? params.until : undefined,
        granularitySeconds:
          typeof params?.granularity_seconds === 'number' ? params.granularity_seconds : undefined,
      });
      return toolResult(payload);
    }
    case 'recommendations.get_fallback_plan': {
      if (!params?.model || !params?.endpoint || !params?.region) {
        return toolResult({
          data: { error: 'model, endpoint, and region are required' },
          evidence: [],
          confidence: 0,
        });
      }
      const payload = await buildFallbackPlan({
        providerId: typeof params?.provider === 'string' ? params.provider : undefined,
        model: params.model,
        endpoint: params.endpoint,
        region: params.region,
        tier: params.tier,
        streaming: params.streaming,
        signal: params.signal,
        latencyP50: params.latency_p50_ms,
        latencyP95: params.latency_p95_ms,
        latencyP99: params.latency_p99_ms,
        http5xxRate: params.http_5xx_rate,
        http429Rate: params.http_429_rate,
        tokensPerSec: params.tokens_per_sec,
        streamDisconnectRate: params.stream_disconnect_rate,
      });
      return toolResult(payload);
    }
    case 'policy.generate': {
      if (!params?.model || !params?.endpoint || !params?.region) {
        return toolResult({
          data: { error: 'model, endpoint, and region are required' },
          evidence: [],
          confidence: 0,
        });
      }
      const payload = await generatePolicy({
        providerId: typeof params?.provider === 'string' ? params.provider : undefined,
        model: params.model,
        endpoint: params.endpoint,
        region: params.region,
        tier: params.tier,
        streaming: params.streaming,
        objective: params.objective,
      });
      return toolResult(payload);
    }
    default:
      return toolResult({
        data: { error: `unknown tool: ${tool}` },
        evidence: [],
        confidence: 0,
      });
  }
}

function formatSseEvent(event: string, id: string, data: any) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return `id: ${id}\nevent: ${event}\ndata: ${payload}\n\n`;
}

export function buildMcpDiscovery(origin: string) {
  return {
    mcp_endpoint: `${origin}/mcp`,
    auth: {
      public_tools: true,
      org_scope_required: 'org.read',
      oauth_discovery: `${origin}/.well-known/oauth-authorization-server`,
    },
    tools: MCP_TOOLS.map((tool) => ({ name: tool.name, description: tool.description })),
    docs: {
      quickstart: `${origin}/docs/agent/mcp-quickstart`,
      tools: `${origin}/docs/agent/mcp-tools`,
    },
  };
}

export async function handleMcpRequest(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const calls = Array.isArray(payload) ? payload : [payload];
  const responses = [] as any[];

  for (const call of calls) {
    if (!call || call.jsonrpc !== '2.0' || typeof call.method !== 'string') {
      responses.push(jsonRpcError(call?.id ?? null, -32600, 'Invalid Request'));
      continue;
    }

    if (call.method === 'initialize') {
      responses.push(
        jsonRpcResult(call.id ?? null, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { list: true, call: true },
            resources: { list: true, read: true },
            prompts: { list: true, get: true },
            streaming: { sse: true },
          },
          serverInfo: {
            name: 'AIStatusDashboard MCP',
            version: '1.0.0',
          },
        })
      );
      continue;
    }

    if (call.method === 'tools/list') {
      responses.push(jsonRpcResult(call.id ?? null, { tools: MCP_TOOLS }));
      continue;
    }

    if (call.method === 'tools/call') {
      const toolName = call.params?.name;
      if (typeof toolName !== 'string') {
        responses.push(jsonRpcError(call.id ?? null, -32602, 'Tool name is required'));
        continue;
      }
      const result = await handleToolCall(request, toolName, call.params?.arguments || {});
      responses.push(jsonRpcResult(call.id ?? null, result));
      continue;
    }

    if (call.method === 'resources/list') {
      responses.push(jsonRpcResult(call.id ?? null, { resources: MCP_RESOURCES }));
      continue;
    }

    if (call.method === 'resources/read') {
      const uri = call.params?.uri;
      if (typeof uri !== 'string') {
        responses.push(jsonRpcError(call.id ?? null, -32602, 'uri is required'));
        continue;
      }
      const resource = await readResource(uri, request);
      responses.push(jsonRpcResult(call.id ?? null, resource));
      continue;
    }

    if (call.method === 'prompts/list') {
      responses.push(jsonRpcResult(call.id ?? null, { prompts: MCP_PROMPTS }));
      continue;
    }

    if (call.method === 'prompts/get') {
      const name = call.params?.name;
      if (typeof name !== 'string') {
        responses.push(jsonRpcError(call.id ?? null, -32602, 'name is required'));
        continue;
      }
      const prompt = getPrompt(name);
      if (!prompt) {
        responses.push(jsonRpcError(call.id ?? null, -32602, 'unknown prompt'));
        continue;
      }
      responses.push(jsonRpcResult(call.id ?? null, prompt));
      continue;
    }

    responses.push(jsonRpcError(call.id ?? null, -32601, 'Method not found'));
  }

  if (!Array.isArray(payload)) {
    return NextResponse.json(responses[0] || jsonRpcError(null, -32603, 'Internal error'));
  }

  return NextResponse.json(responses);
}

export function handleMcpStream(request: NextRequest) {
  const lastEventId = request.headers.get('last-event-id');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const nowId = `${Date.now()}`;
      if (lastEventId) {
        controller.enqueue(encoder.encode(formatSseEvent('resume', nowId, { last_event_id: lastEventId })));
      }
      controller.enqueue(
        encoder.encode(
          formatSseEvent('message', nowId, {
            jsonrpc: '2.0',
            method: 'notifications/ready',
            params: {
              server: 'AIStatusDashboard MCP',
              protocolVersion: MCP_PROTOCOL_VERSION,
              generated_at: new Date().toISOString(),
            },
          })
        )
      );
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function readResource(uri: string, request: NextRequest) {
  if (uri === 'resource://providers') {
    return {
      contents: [{ type: 'json', json: listProviders() }],
    };
  }

  if (uri.startsWith('resource://providers/')) {
    const parts = uri.replace('resource://providers/', '').split('/');
    const provider = parts[0];
    const resource = parts[1];

    if (resource === 'surfaces') {
      return { contents: [{ type: 'json', json: listProviderSurfaces(provider) }] };
    }
    if (resource === 'regions') {
      return { contents: [{ type: 'json', json: listProviderRegions(provider) }] };
    }
    if (resource === 'models') {
      return { contents: [{ type: 'json', json: listProviderModels(provider) }] };
    }
  }

  if (uri.startsWith('resource://incidents/')) {
    const incidentId = uri.replace('resource://incidents/', '');
    const incident = await getIncidentById(incidentId);
    return {
      contents: [
        {
          type: 'json',
          json: incident || { error: 'incident not found' },
        },
      ],
    };
  }

  if (uri.startsWith('resource://metrics/')) {
    const trimmed = uri.replace('resource://metrics/', '');
    const [provider, rest] = trimmed.split('/');
    if (!rest) {
      return {
        contents: [{ type: 'json', json: { error: 'metric is required' } }],
      };
    }
    const [metricPart, queryString] = rest.split('?');
    const searchParams = new URLSearchParams(queryString || '');

    const payload = await queryMetrics({
      metric: metricPart as any,
      providerId: provider,
      since: searchParams.get('since') || undefined,
      until: searchParams.get('until') || undefined,
    });

    return { contents: [{ type: 'json', json: payload.data }] };
  }

  if (uri === 'resource://docs/agent/quickstart') {
    return {
      contents: [
        {
          type: 'text',
          text: '# AIStatusDashboard MCP Quickstart\n\nUse https://aistatusdashboard.com/mcp to call tools like status.get_summary or incidents.search.\n',
        },
      ],
    };
  }

  return {
    contents: [
      {
        type: 'json',
        json: { error: 'resource not found' },
      },
    ],
  };
}

function getPrompt(name: string) {
  switch (name) {
    case 'prompt://diagnose_outage':
      return {
        name,
        description: 'Diagnose an outage and summarize blast radius.',
        messages: [
          {
            role: 'system',
            content: 'You are an SRE assistant. Diagnose the outage using provided incident + metrics evidence.',
          },
          {
            role: 'user',
            content: 'Analyze the latest incidents and metrics, identify impacted surfaces, and summarize root causes.',
          },
        ],
      };
    case 'prompt://choose_fallback_plan':
      return {
        name,
        description: 'Select a fallback plan based on metrics.',
        messages: [
          {
            role: 'system',
            content: 'You are a reliability assistant. Select the safest fallback action with minimal user impact.',
          },
          {
            role: 'user',
            content: 'Pick a fallback plan given current health matrix tiles and metrics query results.',
          },
        ],
      };
    case 'prompt://draft_customer_update':
      return {
        name,
        description: 'Draft a customer update from incidents.',
        messages: [
          {
            role: 'system',
            content: 'You are a comms lead. Draft a concise customer update with timelines and next steps.',
          },
          {
            role: 'user',
            content: 'Write an update referencing incident timelines and mitigations.',
          },
        ],
      };
    case 'prompt://generate_postmortem_outline':
      return {
        name,
        description: 'Create a postmortem outline.',
        messages: [
          {
            role: 'system',
            content: 'You are an incident manager. Produce a postmortem outline with action items.',
          },
          {
            role: 'user',
            content: 'Generate a postmortem outline based on incident logs and metrics.',
          },
        ],
      };
    default:
      return null;
  }
}
