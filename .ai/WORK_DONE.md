## Work completed (2025-12-30)

- Removed Vercel Web Analytics + Speed Insights code paths (no more `/_vercel/*` script loads in new builds).
- Fixed dashboard tab routing:
  - Tabs now stay in sync with `?tab=` (navbar links, back/forward).
  - Wrapped `DashboardTabs` in `Suspense` to satisfy Next.js `useSearchParams()` prerender requirements.
- Improved status checks:
  - `lib/services/status.ts` now parses JSON/HTML/RSS instead of treating any `200` as “operational”.
  - Updated `lib/data/providers.json` to use real JSON endpoints where available (OpenAI, Anthropic, Cohere, Google incidents, Groq, DeepSeek, Replicate).
- Repaired analytics pipeline:
  - `/api/analytics/track` accepts both `event` and `action` payloads.
  - `getTopProviders()` always returns a stable provider list (so Analytics tab + tests don’t appear empty).
- Repaired notification pipeline:
  - Subscriptions now set `active` on confirm.
  - Email queue processing renders `{template,data}` into `{subject,html}` at send time.
- Fixed webhook URL normalization:
  - Store root webhooks as `https://example.com` (not `https://example.com/`) to avoid subtle equality mismatches.
- Fixed subscription confirmation expiry handling:
  - Confirmation now correctly handles Firestore `Timestamp` vs JS `Date` so tokens don’t appear “expired” immediately.
- Made the dashboard truly real-time in production builds:
  - `app/page.tsx` is now `dynamic` to avoid build-time status fetching / stale HTML.
  - Provider fetches use `cache: 'no-store'` so Next’s fetch cache can’t freeze results.
- Hardened endpoints:
  - Added optional shared-secret auth (`CRON_SECRET` / `APP_CRON_SECRET`) to `/api/cron/status` and `/api/cron/notifications`.
  - Added basic webhook URL validation to reduce abuse/SSRF risk.
- Test/quality:
  - `npm test`, `npm run lint`, and `npm run build` pass locally.
  - Playwright config aligned to the repo’s `scripts/start-dev.js` (`http://localhost:3001`).
- Added/ran a “human QA” walkthrough:
  - `node scripts/human-verify.js` now exercises the UI in real Chromium for desktop + mobile and writes artifacts under `.ai/human/<timestamp>/`.

## Work completed (2025-12-31)

- RSS:
  - Added dynamic RSS feed at `/rss.xml` (`app/rss.xml/route.ts`) and updated `/api/rss` to use the request origin.
  - Improved RSS generation (`lib/utils/rss.ts`) to generate correct item links + `atom:link`.
- Email (real sending + testability):
  - Introduced `APP_ENABLE_EMAIL` as the explicit flag for enabling SMTP delivery (`lib/config/index.ts`).
  - Made disabled email return `503` from `/api/cron/notifications` instead of silently “succeeding”.
  - Made local SMTP sinks reliable by forcing nodemailer to `ignoreTLS` for loopback hosts (`lib/utils/email.ts`).
  - Added `scripts/smtp-sink.js` to capture real SMTP deliveries under `.ai/`.
- Webhooks (real delivery + testability):
  - Allowed loopback `http://` webhooks only when `ALLOW_LOCAL_WEBHOOKS=true` (`app/api/webhooks/route.ts`).
  - Added `scripts/webhook-receiver.js` output modes (`requests.jsonl` + `last.json`) for deterministic verification.
- Deterministic launch-blocker verification:
  - Added debug trigger route guarded by secret + env (`app/api/debug/trigger-notification/route.ts`).
  - Added `scripts/launch-blockers-verify.js` which spins up Next + SMTP sink + webhook receiver and runs the human walkthrough with real deliveries.
  - Enhanced `scripts/human-verify.js` to verify: confirmation email delivery, status-change email delivery, webhook delivery, and RSS validity (with artifacts under `.ai/human/<runId>/`).
- Dev ergonomics:
  - Updated `scripts/start-dev.js` to respect externally-provided env vars (so verification scripts can override `.env.local` safely).
- Fixed Next.js 15 “sync dynamic APIs” warnings by awaiting `params` in route handlers (`app/api/comments/[commentId]/route.ts`, `app/api/status/history/[provider]/route.ts`).

## Work completed (2026-01-02)

- Deployment hardening:
  - Updated Firebase Hosting ignore rules so `.env.production.local` is included for the framework build.
  - Deployed production build with Next.js 15.5.9 (webpack) to avoid the Next 16/Turbopack + `firebase-admin` runtime failure.
  - Verified `/api/analytics/overview` returns `200` on production.

## Work completed (2026-01-02, App Hosting migration)

- Created Firebase App Hosting backend `aistatusdashboard` in `us-central1`.
- Added `apphosting.yaml` with production env + Secret Manager references.
- Created Secret Manager entries for `CRON_SECRET`, `WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, and `FIREBASE_SERVICE_ACCOUNT_KEY`.
- Granted App Hosting backend access to the secrets.
- Added `apphosting` target to `firebase.json` and deployed with `firebase deploy --only apphosting`.
- Verified App Hosting endpoints (`/api/health`, `/api/analytics/overview`, `/rss.xml`) return `200`.

## Work completed (2026-01-03, App Hosting launch prep)

- Added custom domain `aistatusdashboard.com` to App Hosting backend and pushed DNS updates via GoDaddy API.
- Updated `apphosting.yaml` to use `https://aistatusdashboard.com` and redeployed.
- Disabled legacy Firebase Hosting site (`ai-status-dashboard.web.app`).
- Ran App Hosting launch‑blockers suite (chromium + firefox + webkit, desktop + mobile) with external SMTP + PTSV3 webhook.
- Re-ran launch‑blockers against the custom domain (`https://aistatusdashboard.com`) with external SMTP + PTSV3 webhook.
- Re-disabled debug endpoints after verification and redeployed App Hosting.
- Cleaned 14 pending human‑test comments from production Firestore via `scripts/cleanup-pending-test-comments.js`.
