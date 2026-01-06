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

## Strictness
- Default is strict: any mismatch exits non-zero.
- To allow mismatches during investigation:

```bash
node scripts/status-accuracy-check.js --base https://aistatusdashboard.com --allow-mismatch
```
