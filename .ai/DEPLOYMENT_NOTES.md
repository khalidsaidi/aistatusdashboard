# Deployment Notes (what’s actually deployed)

## Provider

Primary production is now on **Firebase App Hosting** (Google Cloud). The legacy **Firebase Hosting
frameworks backend** configuration remains in the repo but should be treated as deprecated.

Evidence: see `deployment-curl.txt`.

## Current behavior (live)

- App Hosting URL: `https://aistatusdashboard--ai-status-dashboard.us-central1.hosted.app` returns `200`.
- App Hosting health: `https://aistatusdashboard--ai-status-dashboard.us-central1.hosted.app/api/health` returns `200`.
- App Hosting analytics: `https://aistatusdashboard--ai-status-dashboard.us-central1.hosted.app/api/analytics/overview?windowDays=7` returns `200`.
- Legacy hosting: `https://ai-status-dashboard.web.app` disabled (returns `404`).

## Config alignment (fixed)

- `apphosting.yaml` defines production environment variables and secret references.
- `firebase.json` now includes an `apphosting` target for App Hosting deploys.
- `hosting` remains configured for the legacy framework backend.

## Practical implications

- Production deploys should use `firebase deploy --only apphosting`.

## 2026-01-02 update

- App Hosting backend created: `aistatusdashboard` in `us-central1`.
- App Hosting deployed via source upload (`firebase deploy --only apphosting`).
- Secrets moved to Secret Manager and wired via `apphosting.yaml`.
- Next.js upgraded to 16.1.1 for CVE coverage.
- Custom domain `aistatusdashboard.com` requested; DNS updates applied and awaiting propagation/activation (hostState: `HOST_NON_FAH`, ownershipState: `OWNERSHIP_MISSING` as of 2026-01-03).
