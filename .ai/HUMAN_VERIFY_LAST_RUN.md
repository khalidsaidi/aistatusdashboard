# Human Verification (latest)

Run ID: `2026-01-03T02-51-23Z-apphosting-domain` (chromium + firefox + webkit; desktop + mobile; external SMTP + PTSV3 webhook; custom domain)

Artifacts:
- Launch blockers summary: `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/LAUNCH_BLOCKERS_SUMMARY.md`
- Desktop artifacts: `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/chromium-desktop-artifacts.json`
- SMTP evidence: `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/smtp/index.json`
- Webhook evidence: `.ai/human/2026-01-03T02-51-23Z-apphosting-domain/webhooks/external.json`

Summary:
- Email: confirmation + resend + status-change emails delivered via AWS SES SMTP to mail.tm inbox (From `hello@aistatusdashboard.com`) and confirmed via emailed link
- Webhook: real POST delivered to external PTSV3 bin (`event: incident`, `provider.id: openai`) and captured in artifacts
- RSS: `/rss.xml` served valid RSS XML and validated via API for Firefox/WebKit
- Analytics tab + tracking verified
- Comments: posted + like + report actions succeeded
