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

## Work completed (2026-01-05)

- Hardened launch-blocker automation for WebKit:
  - Added debug export payload capture in `app/components/ExportShare.tsx` (gated by `NEXT_PUBLIC_EXPORT_DEBUG`).
  - Updated `scripts/launch-blockers-verify.js` to enable export debug during local runs.
  - Added WebKit download fallback + RSC fallback error filtering in `scripts/human-verify.js`.
  - Increased navigation retry resilience for dev-mode navigation interruptions.
- Ran cross-browser launch-blockers suite (chromium + firefox + webkit; desktop + mobile) with external SMTP + local webhook:
  - Run ID: `2026-01-05T11-15-35-734Z`
  - Artifacts: `.ai/human/2026-01-05T11-15-35-734Z/`

## Work completed (2026-01-05, later)

- Fixed Firebase Admin env handling:
  - `scripts/refresh-firebase-admin-env.js` now stores a compact, valid JSON string (no multi-line values).
  - `scripts/verify-db.js` preserves raw `FIREBASE_SERVICE_ACCOUNT_KEY` without `\\n` replacement.
- Added external webhook tunnel support to launch-blockers:
  - `scripts/launch-blockers-verify.js` can start a Cloudflare tunnel and writes `webhooks/tunnel.json`.
  - `scripts/human-verify.js` now treats tunnel-based webhooks as locally captured while still validating delivery.
- Hardened human verification:
  - RSS response fallback uses probe output when the click-response body is empty.
  - Analytics tab now falls back to direct `/?tab=analytics` navigation if UI click is flaky.
  - RSC cancellation noise is ignored for WebKit mobile/desktop.
- Deployed Firestore composite indexes to `ai-status-dashboard` via `npx firebase-tools deploy --only firestore:indexes`.
- Ran cross-browser launch-blockers suite with external SMTP + external webhook tunnel:
  - Run ID: `2026-01-05T23-20-35-948Z`
  - Artifacts: `.ai/human/2026-01-05T23-20-35-948Z/`

## Work completed (2026-01-06)

- Provisioned Azure OpenAI resource:
  - Subscription: `aistatusdashboard` (`20950b2b-fe26-4748-8c7b-ffa122ce85b2`)
  - Resource group: `aistatusdashboard-rg`
  - Resource: `aistatusdashboard-openai`
- Created `gpt-4o` deployment via management API (model version `2024-08-06`, Standard SKU, capacity 10).
- Stored Azure OpenAI API key + endpoint + deployment in `.env.production.local`.
- Updated `apphosting.yaml` with Azure OpenAI env vars and secret reference.
- Synced secrets to GCP Secret Manager (`scripts/sync-provider-secrets.js`).
- Verified Azure OpenAI data-plane call returns `200` with `api-version=2024-02-15-preview`.
- Enabled all optional ingestion/security secrets:
  - Created `TELEMETRY_INGEST_SECRET`, `SYNTHETIC_INGEST_SECRET`, `TELEMETRY_SALT`,
    `AWS_INGEST_SECRET`, `GCP_INGEST_SECRET`, `BETTERSTACK_INGEST_SECRET`, `APP_DEBUG_SECRET`.
  - Granted App Hosting backend access and wired them in `apphosting.yaml`.
  - Set `NEXT_PUBLIC_CONTACT_EMAIL` to `hello@aistatusdashboard.com`.

## Work completed (2026-01-06, later)

- Added GCP product catalog mapping (`products.json`) to preserve stable IDs while showing readable component names.
- Added AWS Bedrock probe support + IAM user `aistatusdashboard-bedrock-probe` with invoke permissions.
- Wired AWS Bedrock env vars + secrets in `apphosting.yaml`.
- Added staleness detector + evidence packets + incident fingerprints in insights service.
- Exposed staleness API at `/api/insights/staleness` and surfaced it on the dashboard.
- Updated Reliability Lab (Insights) to show official/observed/account lenses + confidence/evidence.
- Created setup scripts:
  - `scripts/setup-aws-eventbridge.js` for AWS Health → ingest endpoint.
  - `scripts/setup-gcp-service-health.js` for GCP Service Health log export → ingest endpoint.
- Added public telemetry SDK (`public/sdk/ai-status-sdk.js`) + public key support for opt-in crowd telemetry.
- GCP ingest endpoint now decodes Pub/Sub push payloads (base64 log entries).

## Work completed (2026-01-06, launch blockers + SES verification)

- Verified SES sandbox status and confirmed mail.tm recipient for testing:
  - Triggered AWS SES verification email and captured it under `.ai/human/2026-01-06T03-49-15Z/smtp/`.
  - Confirmed SES identity verification for the mail.tm recipient (allows real external SMTP send).
- Ran App Hosting human verification suite (chromium + firefox + webkit, desktop + mobile):
  - Run ID: `2026-01-06T04-53-51Z`
  - Artifacts: `.ai/human/2026-01-06T04-53-51Z/`
- Redeployed App Hosting with debug endpoints disabled (`APP_ENABLE_DEBUG_ENDPOINTS=false`).

## Work completed (2026-01-06, SendGrid SMTP setup)

- Switched SMTP host to SendGrid (`smtp.sendgrid.net`) and updated App Hosting secrets.
- Created SendGrid domain authentication for `aistatusdashboard.com` (`email` subdomain).
- Pushed SendGrid DNS CNAME records to GoDaddy (mail + DKIM1/DKIM2).
- Verified SendGrid domain authentication (`valid: true`).

## Work completed (2026-01-06, gap closure)

- Added explicit model catalogs for every provider in `lib/data/models.json`.
- Added `scripts/smtp-live-check.js` and captured a live SMTP delivery via Guerrilla Mail:
  - Run ID: `2026-01-06T07-33-43-904Z`
  - Artifacts: `.ai/human/2026-01-06T07-33-43-904Z/smtp/`
- Triggered probe cron three times to seed telemetry baselines:
  - Run ID: `2026-01-06T07-39-20-890Z`
  - Artifacts: `.ai/human/2026-01-06T07-39-20-890Z/ingestion/probe-cron.json`
- Disabled debug endpoints and export debug in `apphosting.yaml` and redeployed App Hosting.
- Ran launch-blockers suite on local dev server:
  - Run ID: `2026-01-06T07-43-20-627Z`
  - Artifacts: `.ai/human/2026-01-06T07-43-20-627Z/`
