# Next-Level AI Status Features - Scope and Data Plan

Goal: Implement an AI-first, production-grade status dashboard with advanced diagnostics,
telemetry, and routing guidance while keeping UI sleek and accurate.

## Feature Set (All Requested)

1) Canary Copilot (3 lenses)
   - Synthetic probes: clean-room checks we run.
   - Crowd telemetry: opt-in anonymized client metrics via SDK.
   - Your account lens: filter metrics for a provided client token.
   - AI splits: model, region, endpoint, tier, streaming.

2) Live Model Matrix heatmap + one-click fallback recipe
   - Grid: Models x Regions x Endpoints.
   - Tiles show p50/p95/p99 latency, 5xx/429, stream disconnect rate, tokens/sec.
   - Click any degraded tile -> auto-generate fallback plan and export JSON policy.

3) Incident Replay (time-travel)
   - Scrubbable timeline to replay historical status, latency, and 429s.
   - Run a what-if simulation using current routing rules.

4) Reliability Weather Forecast
   - Predictive panel: degradation risk, error-budget burn, leading signals.
   - Based on rolling trends (tail latency drift, error spikes).

5) Rate-Limit Transparency
   - Dedicated section: 429 volume by model/region/tier, retry-after distribution,
     effective throughput, reason codes (if available).

6) Pricing + Capacity Change Radar
   - First-class events for pricing changes, quota/limit changes, model deprecations,
     and planned migrations.
   - Optional budget guardrails and alerts.

7) Behavioral Stability (quality health)
   - Operational signals: refusal/blocked rate change, tool-call success rate,
     JSON/schema validity rate, completion length drift.

8) Ask Status (assistant with receipts)
   - Query box that answers only from dashboard data, with attached chart snapshot
     + time window + thresholds used.

## Data Model (Firestore collections)

New collections are additive; no breaking schema changes to existing collections.

1) synthetic_probes
   - providerId, model, endpoint, region, tier, streaming (bool)
   - timestamp (server)
   - latency_ms, latency_p50, latency_p95, latency_p99
   - http_5xx_rate, http_429_rate
   - tokens_per_sec (optional)
   - stream_disconnect_rate (optional)
   - error_code (optional)

2) telemetry_events
   - source (crowd|account), clientIdHash, accountIdHash
   - providerId, model, endpoint, region, tier, streaming
   - timestamp
   - latency_ms, http_5xx_rate, http_429_rate
   - tokens_per_sec (optional)
   - stream_disconnect_rate (optional)
   - refusal_rate, tool_success_rate, schema_valid_rate, completion_len

3) change_radar_events
   - providerId, type (pricing|quota|deprecation|migration|maintenance)
   - title, summary, effectiveDate, url, severity

## API Endpoints (new)

- GET /api/insights/canary?providerId=&windowDays=&clientId=
- GET /api/insights/model-matrix?windowMinutes=&providerId=
- POST /api/insights/fallback (returns a plan + JSON policy)
- GET /api/insights/replay?providerId=&at=
- GET /api/insights/forecast?providerId=&windowDays=
- GET /api/insights/rate-limits?providerId=&windowHours=
- GET /api/insights/rate-limit-incidents?windowMinutes=
- GET /api/insights/change-radar?providerId=
- GET /api/insights/behavioral?providerId=&windowDays=
- POST /api/insights/ask (answer + receipts)
- POST /api/telemetry/ingest (SDK endpoint)
- POST /api/synthetic/ingest (probe endpoint)

## UI Placement

- New top-level tab: "Reliability Lab" (adjacent to Analytics).
- Inside: sub-tabs for Canary Copilot, Model Detail, Model Matrix, Incident Replay,
  Forecast, Rate Limits, Change Radar, Behavioral Stability, Ask Status.

## Implementation Status

Implemented (initial pass)
- Reliability Lab UI with all panes + data fetch calls.
- Early warning cards on dashboard + rate-limit incidents panel.
- Change Radar admin UI (create + delete) with secret.
- Probe runner that can call real provider APIs when keys are available.
- Telemetry ingest endpoint and synthetic probe ingest endpoint.

Pending
- Real probe keys for OpenAI/Anthropic/Gemini/Cohere/Mistral/Azure OpenAI.
- Expand models/regions catalog for complete model-matrix coverage.
- Incident replay should join intel incidents + synthetic probes for richer timelines.
- Forecast panel should incorporate trend deltas, not static heuristics.
- Ask Status receipts should include chart snapshots (currently text-only).

## Env/Config

- TELEMETRY_SALT (hash clientId)
- PROBE_ENABLED=true
- PROBE_REAL_ENABLED=true (to use provider APIs)
- Provider API keys + model overrides per env (.env.example)
- CHANGE_RADAR_SECRET for admin UI

## Risks / Follow-ups

- Without real probe keys, model-level metrics stay empty.
- Forecasting is heuristic until more telemetry accumulates.
