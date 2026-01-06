# New Requirements Merge (2025-03-XX)

## Source request summary
- Merge the full “north-star” spec into current app without breaking existing behavior.
- Wire all integrations (real probes + external senders) using available CLI access.
- Add missing telemetry-driven capabilities: staleness detection, incident fingerprints, evidence-first outputs, automation-safe IDs.
- Keep UI sleek/modern while adding new capability surfaces.

## Scope we will implement now
- Add official-vs-observed-vs-account lens summary in Reliability Lab.
- Add Status Staleness detector (official green but telemetry red) surfaced on Dashboard.
- Add Incident Fingerprint + Evidence objects to early warnings + model matrix tiles.
- Add GCP product catalog mapping (products.json) so component IDs stay stable and labels are readable.
- Add AWS Bedrock synthetic probe support (optional; skips if credentials missing).
- Add setup scripts for external senders (AWS EventBridge → /api/ingest/aws-health; GCP Service Health export placeholder).
- Update docs + .ai runbook for new integrations.

## Risks / dependencies
- AWS EventBridge health events require account support level; script will warn if unavailable.
- GCP Service Health export depends on available log source; may need log filter tweak post-run.
- Bedrock probe requires AWS credentials + allowed model in region.

## Files likely touched
- lib/types/insights.ts (new types for staleness + fingerprints + evidence)
- lib/services/insights.ts (staleness + fingerprints + evidence)
- lib/utils/platform-parsers.ts (GCP catalog mapping)
- lib/services/source-ingestion.ts (fetch GCP product catalog)
- lib/services/provider-probes.ts + lib/data/probe_providers.json (AWS Bedrock probe)
- app/api/insights/staleness/route.ts (new)
- app/components/DashboardTabs.tsx (staleness panel)
- app/components/InsightsLab.tsx (official lens + evidence)
- scripts/setup-aws-eventbridge.js (new)
- .ai/WORK_DONE.md + .ai/GAPS_AND_ISSUES.md (updates)
