# Ingestion Blueprint (Auto-Detect + Normalized Schema)

## Objective
Build a multi-provider ingestion pipeline that auto-detects status platform types, normalizes to a shared schema, and stores provider/components/incidents/maintenances plus telemetry overlays.

## Requirements Snapshot
- Auto-detect platforms: Statuspage, Instatus, Better Stack, Status.io, Cachet, RSS/HTML.
- Provider-specific sources: OpenAI, Anthropic, Mistral, Cohere, Google Cloud, AWS, Azure.
- Polling cadence: 60–120s for status APIs, 5m for slower feeds.
- HTTP caching: ETag/If-Modified-Since.
- Dedupe: stable incident IDs.
- Normalize severity to: operational | degraded | partial_outage | major_outage | maintenance | unknown.
- Store incidents with updates + affected components/regions/models.

## Implemented (current)
- Normalized types: `lib/types/ingestion.ts`.
- Sources registry + payload recording: `lib/services/source-registry.ts`.
- Platform detection: `lib/utils/platform-detect.ts`.
- Platform parsers: `lib/utils/platform-parsers.ts`.
- Source ingestion engine: `lib/services/source-ingestion.ts`.
- Default sources list: `lib/data/sources.json`.
- Cron endpoint: `app/api/cron/ingest/route.ts`.
- Intel APIs (read model): `app/api/intel/providers`, `app/api/intel/provider/[id]`, `app/api/intel/incidents`, `app/api/intel/maintenances`.
- External ingest endpoints: `app/api/ingest/aws-health`, `app/api/ingest/gcp-health`, `app/api/ingest/betterstack`.
- Provider detail UI: `app/components/ProviderDetailPanel.tsx`.

## Pending / gaps
- Better Stack JSON parsing for components/incidents beyond `index.json` (if available).
- HTML fallback parsers for any remaining providers without JSON endpoints.
- EventBridge (AWS Health) / GCP Health export wiring (endpoints exist, but no automatic push configured).
- Status aggregator ingestion (StatusGator or similar) as a secondary signal layer.
- Expand Status.io detection for any edge cases beyond simple pageId extraction.
- Broaden provider model/region catalogs for Model Matrix and probes.

## Notes
- Provider status summary is stored in `provider_status`; components/incidents/maintenances stored per provider.
- Raw payloads are saved per source with ETag/If-Modified-Since support for replay/debug.
- Legacy status history remains for fallback until UI migration completes.
