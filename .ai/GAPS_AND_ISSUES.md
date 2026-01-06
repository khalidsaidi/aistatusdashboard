# Gaps & Issues (current)

## P0 – Launch blockers (active)

- None.

## P1 – Functional gaps

1) None currently.

## P2 – UX polish

1) None currently.

## Recently resolved (for history)

- SendGrid domain authentication validated; DNS CNAMEs confirmed.
- External SMTP live check completed via Guerrilla Mail inbox (artifacts captured).
- Model catalog entries added for all listed providers.
- Seeded telemetry baseline via `/api/cron/probes` to populate early warning + forecast panels.
- Controlled AWS + GCP ingestion checks confirmed end-to-end delivery.
- Early warning panel, rate limit incidents, model detail view, and change radar admin UI added.
- Provider detail panel wired to intel APIs for incidents + maintenance.
- Gemini API key created + stored in Secret Manager; App Hosting env updated.
- Mistral API key created + stored; Azure OpenAI resource, key, endpoint, and gpt-4o deployment created and wired.
- Cross-browser launch-blocker suite rerun (chromium + firefox + webkit) with artifacts captured, including external webhook via cloudflared tunnel.
- Firestore indexes deployed to production.
- Provider API keys created + synced for OpenAI/Anthropic/Cohere/Groq/DeepSeek/xAI.
- Hydration mismatch mitigated by routing timestamp renders through `ClientTimestamp` + suppressHydrationWarning.
- Better Stack JSON parsing + Mistral Statuspage JSON support added to ingestion registry.
- Status staleness detector added (official vs observed drift).
- Incident fingerprint + evidence payloads surfaced in early warnings + model matrix.
- GCP product catalog mapping integrated for stable IDs.
- AWS Bedrock probe added + IAM user provisioning script created.
- AWS EventBridge + GCP Service Health push scripts added.
