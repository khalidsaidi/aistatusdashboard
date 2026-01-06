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
- App Hosting rollout failed due to TS error in `lib/utils/google-cloud.ts` (string | undefined). Fixed by coercing optional fields to string.
- After first successful deploy, google-ai status moved to `unknown` because computeProviderStatus had no active incidents or components; updated logic to return `operational` when only historical incidents exist.
- Deployed App Hosting after fixes; re-ran `/api/cron/ingest`. Google AI now shows `operational` with 0 active incidents (5 historical). Description reflects AI-only scope.
- Added strict status accuracy test script and docs: `scripts/status-accuracy-check.js` + `.ai/STATUS_TESTING.md`.
