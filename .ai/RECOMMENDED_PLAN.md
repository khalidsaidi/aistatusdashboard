# Recommended Plan (to get “dev works 100%” + deployable)

You need to pick **one** primary deployment strategy and make the repo match it.

## Option A (keep Firebase Hosting + Cloud Functions) – align repo back to Firebase

1) Restore/keep the Firebase Functions source (`functions/`) in-repo.
2) Ensure Hosting build produces `out/` (or change Hosting strategy).
   - If you want a static frontend on Hosting, use Next static export (`output: 'export'`) and remove Next Route Handlers as the runtime backend.
   - Keep `/api/**` served by the Firebase `api` Function (Express).
3) Remove (or gate) Next Route Handlers under `app/api/*` that won’t run on Firebase static hosting.
4) Fix the production redirect + `/api/health` 500 by redeploying the corrected Firebase config/functions.

## Option B (deploy Next server + Route Handlers) – align repo to a server runtime

1) Stop treating Firebase Hosting as the primary runtime (or switch to a Firebase framework integration / Cloud Run).
2) Keep `app/api/*` as the backend and deploy the Next server to:
   - Cloud Run (Docker), or
   - another Node/serverless host.
3) Update `firebase.json` to either:
   - remove Functions/Hosting config (if Firebase is no longer used), or
   - adopt a supported SSR integration (not currently configured).
4) Lock down `/api/cron/*` endpoints (auth).

## Immediate “must-do” fixes regardless of option

- Fix the notification pipeline mismatch:
  - Make subscription docs match what notification sender queries (`active`, `confirmed`, provider IDs).
  - Add email template rendering so `emailQueue` items produce real `{ subject, html }`.
- Make provider IDs consistent (single source of truth; avoid hard-coded lists).
- Fix `.github/workflows/ci.yml` to match the scripts and repo contents.

