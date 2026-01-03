# Repo Overview (current working tree)

Date (UTC): 2025-12-30T20:01:37Z  
Git: branch `develop`, HEAD `b69b8550daaf4cbbbcca084ce51e61aaf353ccf7`

## What this is

A Next.js App Router project that renders an AI provider status dashboard and exposes API routes under `app/api/*`.

Key runtime expectations:
- A server runtime capable of executing Next.js Route Handlers (Node/serverless).
- Access to Firestore via `firebase-admin` (either default credentials on GCP, or env-provided service account creds).

## Code Map

### Frontend (Next.js App Router)

- `app/layout.tsx`
  - Global layout, metadata, and Service Worker registration (`/sw.js`).
  - Client error handling via `app/components/GlobalErrorHandler.tsx`.
- `app/page.tsx`
  - Server-rendered dashboard page.
  - Uses `providerService` + `statusService` to fetch statuses at request-time (requires server runtime).
- `app/components/*`
  - `DashboardTabs.tsx`: main tab UI (Dashboard / Analytics / Notifications / API / Comments).
  - `NotificationPanel.tsx`: email/webhook subscription UI; calls `/api/*` routes.
  - `AnalyticsDashboard.tsx`: loads analytics from `/api/analytics/*`.

### Backend (Next Route Handlers)

All live under `app/api/*`:

- Health/status:
  - `app/api/health/route.ts`
  - `app/api/status/route.ts`
  - `app/api/status/history/route.ts`
  - `app/api/status/summary/route.ts`
- Cron-like triggers (secret required in production):
  - `app/api/cron/status/route.ts` (runs orchestrator)
  - `app/api/cron/notifications/route.ts` (processes email queue)
- Notifications:
  - `app/api/email/*` (subscribe/confirm/resend/unsubscribe)
  - `app/api/webhooks/route.ts`
  - `app/api/incidents/history/route.ts`
  - `app/api/notifications/route.ts` (currently a proxy to Firebase Functions)
- Extras:
  - `app/api/badge/[provider]/route.ts` (SVG badges)
  - `app/api/rss/route.ts`
  - `app/api/comments/route.ts`
  - `app/api/analytics/*`

### “Service” layer (business logic)

- `lib/services/providers.ts`: provider list from `lib/data/providers.json`.
- `lib/services/status.ts`: does HTTP checks against provider `statusUrl`.
- `lib/services/persistence.ts`: writes/reads `status_history` in Firestore.
- `lib/services/orchestrator.ts`: runs a cycle (check → diff → notify → persist).
- `lib/services/notifications.ts`: queues emails + sends webhooks on status change.
- `lib/services/subscriptions.ts`: email subscription + confirmation flow.
- `lib/services/analytics.ts`: stores/aggregates simple interaction events.
- `lib/services/comments.ts`: Firestore-backed comments.

### Firestore integration

- `lib/db/firestore.ts`: initializes `firebase-admin` + returns `Firestore`.
- `lib/config/index.ts`: reads env for Firebase + email settings.

### PWA / caching

- `public/sw.js`: service worker (note: navigation is network-only to avoid stale HTML hydration failures).

### Tests

- Jest: `npm test` (unit tests in `__tests__/unit/*`).
- Playwright: `npm run test:e2e` (files in `__tests__/e2e/*`).
  - Default dev server for E2E is `http://localhost:3001` via `scripts/start-dev.js` and `playwright.config.ts`.
