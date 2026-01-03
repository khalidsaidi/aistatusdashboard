# Launch Blockers Verification (Production)

Run ID: 2026-01-01T18-49-51-624Z
Base URL: https://ai-status-dashboard.web.app
Browsers: chromium, firefox, webkit (desktop + mobile)

External checks
- SMTP (mail.tm): confirmation/resend/status emails captured in .ai/human/2026-01-01T18-49-51-624Z/smtp/
  - confirm: .ai/human/2026-01-01T18-49-51-624Z/smtp/email-0031.eml
  - resend:  .ai/human/2026-01-01T18-49-51-624Z/smtp/email-0032.eml
  - status:  .ai/human/2026-01-01T18-49-51-624Z/smtp/email-0033.eml
- Webhook (PTSV3): https://ptsv3.com/t/843d2759-008c-4553-97df-4d1d92be43a9/post
  - payload: .ai/human/2026-01-01T18-49-51-624Z/webhooks/external.json
- RSS: verified via API and RSS link (see chromium-desktop-03b-navbar-rss.xml)

Artifacts
- Screenshots and JSON artifacts live under .ai/human/2026-01-01T18-49-51-624Z/
- Run summary: .ai/human/2026-01-01T18-49-51-624Z/RUN_SUMMARY.json
