# Real Provider Probes + Change Radar Admin

## Goals
- Enable real model-level probes via provider APIs (OpenAI, Anthropic, Gemini, Cohere, Groq, Mistral, DeepSeek, xAI, Azure OpenAI, AWS Bedrock).
- Store probe results as synthetic probe events for Model Matrix / Canary Copilot.
- Add admin UI + API to create/delete Change Radar events (with a shared secret).

## Current state
- Probe runner + cron endpoint already implemented (`/api/cron/probes`, `/api/cron/real-probes`).
- Change Radar admin API + UI implemented and gated by secret.
- Provider keys created + synced for OpenAI, Anthropic, Cohere, Groq, Mistral, DeepSeek, xAI (stored in Secret Manager + wired in `apphosting.yaml`).
- Gemini API key generated and stored in Secret Manager for `ai-status-dashboard`.
- Azure OpenAI resource `aistatusdashboard-openai` created in `aistatusdashboard-rg` with `gpt-4o` deployment.
- AWS Bedrock probe support added (model `anthropic.claude-3-haiku-20240307-v1:0` default) and IAM user `aistatusdashboard-bedrock-probe` created for invoke permissions.
- App Hosting env updated to inject `GOOGLE_GEMINI_API_KEY`, `PROBE_ENABLED`, `PROBE_REAL_ENABLED`, Change Radar secret, and Azure OpenAI vars.

## Still needed
- None currently.

## Pending runbook (2026-01-05)
- Use the logged-in WSL Chrome profile at `.ai/tmp-browser-profile/wsl-login` for any future key rotations.
- Store keys only in `.env.production.local` and GCP Secret Manager (never in repo docs).
- Re-run real probe cron after any key rotation and capture results in `.ai/human/<run>/`.

## Endpoints
- GET /api/cron/real-probes (requires CRON_SECRET unless APP_ALLOW_OPEN_CRON=true)
- GET /api/cron/probes (now runs real probes if PROBE_REAL_ENABLED=true)
- POST /api/insights/change-radar (requires CHANGE_RADAR_SECRET unless APP_ALLOW_CHANGE_RADAR=true)
- DELETE /api/insights/change-radar/:id (requires CHANGE_RADAR_SECRET unless APP_ALLOW_CHANGE_RADAR=true)

## Env vars (App Hosting)
- PROBE_ENABLED=true
- PROBE_REAL_ENABLED=true
- GOOGLE_GEMINI_API_KEY (secret)
- CHANGE_RADAR_SECRET (secret)
- AZURE_OPENAI_API_KEY (secret)
- AZURE_OPENAI_ENDPOINT
- AZURE_OPENAI_DEPLOYMENT
- AZURE_OPENAI_MODEL
- AWS_ACCESS_KEY_ID (secret)
- AWS_SECRET_ACCESS_KEY (secret)
- AWS_REGION
- AWS_BEDROCK_REGION
- AWS_BEDROCK_MODEL_ID

## Local env
- .env.production.local updated with Gemini + Change Radar secrets + Azure OpenAI envs.
