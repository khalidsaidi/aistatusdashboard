# AI Status Dashboard
A real-time status dashboard for AI service providers (OpenAI, Anthropic, Google Gemini, etc.).

## Features
- **Real-time Status Monitoring**: Active checks via `StatusService`.
- **Historical Data**: Firestore-backed history and incident logging.
- **Analytics**: Dashboard for uptime, response times, and costs.
- **Notifications**: Email alerts via SMTP (Nodemailer) and Webhooks.
- **Stack**: Next.js (App Router), Tailwind CSS, Firebase Firestore.

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase Project (Firestore enabled)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and configure your Firebase credentials.
   ```bash
   cp .env.example .env.local
   ```

### Running Locally
```bash
npm run dev
```

### Deployment (Firebase App Hosting)
1. Configure production environment variables in `apphosting.yaml`.
2. Store secrets in Secret Manager and grant App Hosting access.
3. Deploy:
   ```bash
   firebase deploy --only apphosting --project ai-status-dashboard
   ```

### Testing
- Unit Tests: `npm run test:unit`
- E2E Tests: `npm run test:e2e`

## Architecture
- **App Router**: APIs located in `app/api`.
- **Services**: Business logic in `lib/services`.
- **Database**: Firestore (collections: `status_history`, `emailSubscriptions`, `emailQueue`, `analytics_events`, `webhooks`, `comments`).
- **Cron**:
  - `/api/cron/status` runs a monitoring cycle and persists status changes.
  - `/api/cron/notifications` processes the email queue (set `CRON_SECRET` / `APP_CRON_SECRET` in prod; or explicitly set `APP_ALLOW_OPEN_CRON=true`).
- **Webhook registration**:
  - `/api/webhooks` accepts new webhook registrations. Set `WEBHOOK_SECRET` / `APP_WEBHOOK_SECRET` in prod (or explicitly set `APP_ALLOW_PUBLIC_WEBHOOKS=true`).

## License
MIT
