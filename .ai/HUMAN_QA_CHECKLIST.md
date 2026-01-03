# Human QA Checklist (pre-release)

This is a **manual** checklist to run in a real browser before making the site public.

## Setup

1) Start the app locally (port 3001):
- `node scripts/start-dev.js`

2) Open:
- `http://localhost:3001`

3) If the UI looks “dead” (tabs don’t respond), reset Service Worker + caches:
- See `.ai/BROWSER_CACHE_RESET.md`

## Dashboard tab

- Page loads with provider cards (no infinite spinners).
- Search:
  - Type `Gemini` in “Search providers” → results narrow down.
  - Clear search → full list returns.
- Filter:
  - Set status filter to `operational` → only operational cards remain.
  - Switch filters back and forth (no UI freeze).
- Provider links:
  - Click a provider’s status page link (opens and matches the provider).

## Notifications tab

### Email subscribe + confirm

- Enter a real-looking email (e.g. `qa-<timestamp>@example.com`).
- Select 1–2 providers and click **Subscribe to Alerts**.
- Confirm that subscription was created (Firestore):
  - `node scripts/verify-db.js subscription "<email>"`
- Confirm the subscription (double opt-in):
  - `node scripts/verify-db.js subscription-token "<email>"`
  - Open: `http://localhost:3001/api/email/confirm?token=<token>`

### Status-change notification queues

- Clear queue + seed a known transition:
  - `node scripts/verify-db.js clear emailQueue`
  - `node scripts/verify-db.js clear status_history`
  - `node scripts/verify-db.js inject openai operational`
  - `node scripts/verify-db.js inject openai down`
- Trigger orchestrator:
  - Open: `http://localhost:3001/api/cron/status`
- Verify queued email exists:
  - `node scripts/verify-db.js queue-check "<email>"` → expect `FOUND_1` (or higher)

### Webhooks

- Register a valid HTTPS webhook (example):
  - `https://example.com/webhook`
- Verify Firestore persistence:
  - `node scripts/verify-db.js webhook "https://example.com/webhook"`

Negative tests (should be rejected):
- `http://…` (non-HTTPS)
- `https://localhost/...` (blocked)
- `https://user:pass@example.com/...` (credentials in URL)

### Incidents view (DB → UI propagation)

- Inject an outage:
  - `node scripts/verify-db.js inject anthropic down`
- In the UI: Notifications → Incidents
  - Verify Anthropic shows a non-operational status.

## Analytics tab

- Tab loads without errors.
- Click “Track View” on any provider row a few times.
- Verify counts refresh and increase.

## Comments tab

- Post a comment (name + content).
- Verify it appears after posting (may take a second; refresh Comments tab if needed).
- Like / Report actions work (if present) without errors.

## API & Badges tab

- Use the API demo buttons to call:
  - `/api/health`
  - `/api/status`
  - `/api/status?provider=openai`
  - `/api/cron/status` (if `CRON_SECRET` is unset locally)
- Badge renders:
  - `http://localhost:3001/api/badge/openai` returns SVG.

## Evidence already generated in this repo

- Automated E2E: `test-results-all/html` (open with `npx playwright show-report test-results-all/html`)
- “Human-mimic” UI walkthrough screenshots: `.ai/human/<timestamp>/` (created by `node scripts/human-verify.js`)
