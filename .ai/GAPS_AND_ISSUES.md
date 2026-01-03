# Gaps & Issues (current)

## P1 – Security / abuse hardening (config required)

1) Cron endpoints require explicit config in production
- `/api/cron/status` and `/api/cron/notifications` now require `CRON_SECRET` / `APP_CRON_SECRET` in production (or `APP_ALLOW_OPEN_CRON=true`).
  - App Hosting now provides these secrets via Secret Manager.

2) Webhook registration requires explicit config in production
- `/api/webhooks` now requires `WEBHOOK_SECRET` / `APP_WEBHOOK_SECRET` in production (or `APP_ALLOW_PUBLIC_WEBHOOKS=true`).
  - App Hosting now provides these secrets via Secret Manager and public access is enabled to support the UI.

3) “Real” external integrations exercised
- External SMTP (AWS SES) and external webhook (PTSV3) were validated in the latest launch-blocker run.

## Recently resolved (for history)

- Status monitoring now uses real JSON/RSS sources where available (instead of “any 200 == operational”).
- Email notification pipeline now supports double opt-in (`active: true`) and renders `{template,data}` at send time.
- Webhooks now filter by `providers`/`types` before delivery.
- Playwright is configured for deterministic E2E (`workers: 1`, `open: 'never'`, `http://localhost:3001`).
- App Hosting custom domain `aistatusdashboard.com` is live (served via App Hosting; DNS verified).
- Debug trigger was temporarily enabled for the custom-domain launch-blocker run and then disabled again.
