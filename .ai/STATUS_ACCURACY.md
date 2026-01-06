# Status Accuracy - Google/Gemini

## Symptom
- Gemini (google-ai) shows major outage while the official Google Cloud status page shows no broad incidents.

## Root causes
- Synthetic `gcp-health-test*` incidents persisted in Firestore.
- Provider status derived from resolved incidents (previously counted as active).
- Google Cloud incidents were not filtered to AI-only products during ingestion/display.

## Fixes (code)
- Ignore resolved/cancelled incidents + maintenances when computing provider status.
- Filter Google Cloud incidents to AI-only keywords and prune impacted component lists.
- Provide a safe cleanup script to remove synthetic GCP test incidents.

## Operational steps
- Run cleanup script (dry-run + apply) against prod Firestore.
- Trigger `/api/cron/ingest` to refresh `provider_status`.
- Re-verify provider summary/detail for `google-ai`.

## Progress (2026-01-06)
- Cleanup dry-run found 2 synthetic `gcp-health-test*` incidents; removed with `--apply --confirm`.
- Re-ran cleanup dry-run: 0 matches.
- Triggered `/api/cron/ingest` (prod) to refresh provider status.
- Provider summary still shows `google-ai` as `major_outage` because prod has not yet been redeployed with filtering fixes.
