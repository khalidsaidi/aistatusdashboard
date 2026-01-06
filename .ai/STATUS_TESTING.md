# Status Accuracy Testing

## Purpose
Strict, repeatable validation that our ingested provider status does not drift from the live official status signal or lack evidence. Any mismatch fails the run.

## What it checks
- Live status (`/api/status?provider=...`) vs ingested status (`/api/intel/providers`).
- Evidence: active incidents, active maintenances, degraded components (`/api/intel/provider/{id}`).
- Flags:
  - overreported: ingested severity worse than live status
  - underreported: ingested severity better than live status
  - no-evidence: ingested is degraded/down but no active evidence exists

## How to run

```bash
node scripts/status-accuracy-check.js --base https://aistatusdashboard.com
```

Artifacts are stored in `.ai/status-accuracy/<timestamp>/report.json` and `summary.md`.

## Fresh data before checking
If you want the script to trigger ingestion first (recommended for production runs), use:

```bash
node scripts/status-accuracy-check.js --base https://aistatusdashboard.com --refresh --env .env.production.local
```

This calls `/api/cron/ingest?force=1` to bypass polling windows so every provider is re-ingested before the check.

## Strictness
- Default is strict: any mismatch exits non-zero.
- To allow mismatches during investigation:

```bash
node scripts/status-accuracy-check.js --base https://aistatusdashboard.com --allow-mismatch
```

## Staleness guardrails
The script now flags stale provider summaries (older than 2x poll interval + 60s) as errors.

## Deployment gate
The App Hosting deployment workflow blocks unless the strict status audit is green.
Workflow: `.github/workflows/deploy-apphosting.yml`.
