# External Sender Wiring

## AWS Health → EventBridge
- Script: `scripts/setup-aws-eventbridge.js`
- Output report: `.ai/creds/aws-eventbridge.json`
- Target endpoint: `https://aistatusdashboard.com/api/ingest/aws-health`
- Auth: API destination sends `x-ingest-secret` from `AWS_INGEST_SECRET`.

## GCP Service Health → Pub/Sub → Push
- Script: `scripts/setup-gcp-service-health.js`
- Output report: `.ai/creds/gcp-service-health.json`
- Target endpoint: `https://aistatusdashboard.com/api/ingest/gcp-health?secret=<GCP_INGEST_SECRET>`
- Filter: `logName:"servicehealth.googleapis.com"` (adjust if logs surface under a different name).

## Notes
- Both scripts are idempotent and can be re-run after key rotation or domain changes.
- Live verification requires a real upstream event (AWS Health or GCP Service Health).
