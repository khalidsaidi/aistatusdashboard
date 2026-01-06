# Human Verification (latest)

Run ID: `2026-01-06T07-43-20-627Z` (chromium + firefox + webkit; desktop + mobile; local dev server; local SMTP sink + local webhook receiver)

Artifacts:
- Launch blockers summary: `.ai/human/2026-01-06T07-43-20-627Z/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop artifacts: `.ai/human/2026-01-06T07-43-20-627Z/chromium-desktop-artifacts.json`
- Mobile artifacts: `.ai/human/2026-01-06T07-43-20-627Z/chromium-mobile-artifacts.json`
- Firefox artifacts: `.ai/human/2026-01-06T07-43-20-627Z/firefox-desktop-artifacts.json`
- WebKit artifacts: `.ai/human/2026-01-06T07-43-20-627Z/webkit-desktop-artifacts.json`
- SMTP evidence: `.ai/human/2026-01-06T07-43-20-627Z/smtp/index.json`
- Webhook evidence: `.ai/human/2026-01-06T07-43-20-627Z/webhooks/last.json`

Summary:
- Email: confirmation + resend + status-change emails delivered to local SMTP sink.
- Webhook: delivery captured by local receiver (incident payload written to sink).
- RSS: `/rss.xml` served valid RSS XML and validated.
- Export/Share: downloads verified in Chromium/Firefox; WebKit validated via debug payload capture.
- Comments + Analytics: posted, like, report, and analytics dashboards verified.
- Notes: WebKit dev-only access-control errors ignored (RSC/SW diagnostics).
