## Test status (last run)

Date (UTC): 2026-01-03

### What was run

- `npm test` ✅
- `npm run lint` ✅
- `npm run build` ✅
- `npx playwright test --project=chromium` ✅ (`7 passed`)
- `node scripts/launch-blockers-verify.js` ✅ (Run ID: `2025-12-31T19-15-01-587Z`, chromium+firefox+webkit, desktop+mobile, local SMTP + local webhook)
- `node scripts/launch-blockers-verify.js` ✅ (Run ID: `2025-12-31T22-27-10-030Z`, chromium, desktop-only, external SMTP + PTSV3 webhook)
- `node scripts/human-verify.js` ✅ (Run ID: `2026-01-03T01-08-09Z-apphosting-launch`, chromium+firefox+webkit, desktop+mobile, App Hosting URL, external SMTP + PTSV3 webhook)
- `node scripts/human-verify.js` ✅ (Run ID: `2026-01-03T02-51-23Z-apphosting-domain`, chromium+firefox+webkit, desktop+mobile, custom domain, external SMTP + PTSV3 webhook)

### Evidence

- Launch blockers (local): `.ai/human/2025-12-31T19-15-01-587Z/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop walkthrough (local): `.ai/human/2025-12-31T19-15-01-587Z/chromium-desktop-artifacts.json`
- Mobile walkthrough (local): `.ai/human/2025-12-31T19-15-01-587Z/chromium-mobile-artifacts.json`
- SMTP sink output (local): `.ai/human/2025-12-31T19-15-01-587Z/smtp/index.json`
- Webhook receiver output (local): `.ai/human/2025-12-31T19-15-01-587Z/webhooks/last.json`
- Launch blockers (external): `.ai/human/2025-12-31T22-27-10-030Z/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop walkthrough (external): `.ai/human/2025-12-31T22-27-10-030Z/chromium-desktop-artifacts.json`
- SMTP evidence (external): `.ai/human/2025-12-31T22-27-10-030Z/smtp/index.json`
- Webhook evidence (external): `.ai/human/2025-12-31T22-27-10-030Z/webhooks/external.json`
- Launch blockers (App Hosting): `.ai/human/2026-01-03T01-08-09Z-apphosting-launch/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop walkthrough (App Hosting): `.ai/human/2026-01-03T01-08-09Z-apphosting-launch/chromium-desktop-artifacts.json`
- SMTP evidence (App Hosting): `.ai/human/2026-01-03T01-08-09Z-apphosting-launch/smtp/index.json`
- Webhook evidence (App Hosting): `.ai/human/2026-01-03T01-08-09Z-apphosting-launch/webhooks/external.json`
- Launch blockers (App Hosting + custom domain): `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop walkthrough (custom domain): `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/chromium-desktop-artifacts.json`
- SMTP evidence (custom domain): `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/smtp/index.json`
- Webhook evidence (custom domain): `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/webhooks/external.json`

### Notes

- E2E tests use Firestore via `firebase-admin` and mutate shared collections (`emailSubscriptions`, `emailQueue`, `analytics_events`, `status_history`, `comments`, `webhooks`).
- Make sure `.env.local` points at a non-production Firebase project before running Playwright locally.
- Launch-blockers verification spins up:
  - a local SMTP sink (`scripts/smtp-sink.js`)
  - a local webhook receiver (`scripts/webhook-receiver.js`)
  - a Next dev server with `APP_ENABLE_EMAIL=true`, `ALLOW_LOCAL_WEBHOOKS=true`, and debug endpoints enabled for deterministic delivery triggering.
- App Hosting launch-blocker run used external SMTP + PTSV3 webhook with `HUMAN_VERIFY_SKIP_DB=true` to avoid destructive DB cleanup in prod.
