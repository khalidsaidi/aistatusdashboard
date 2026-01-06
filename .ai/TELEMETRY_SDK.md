# Telemetry SDK

## Location
- `public/sdk/ai-status-sdk.js`

## Usage
```html
<script src="/sdk/ai-status-sdk.js"></script>
<script>
  AIStatusSDK.configure({
    telemetryKey: "TELEMETRY_PUBLIC_KEY",
    clientId: "your-client-id",
    providerId: "openai",
    model: "gpt-4o-mini",
    endpoint: "chat",
    region: "us-east",
    tier: "pro"
  });

  AIStatusSDK.report({ latencyMs: 120, http429Rate: 0.01 });
</script>
```

## Notes
- `TELEMETRY_PUBLIC_KEY` is stored in `.env.production.local` and synced to Secret Manager for App Hosting.
- The ingest endpoint accepts either `x-telemetry-secret` (private) or `x-telemetry-key` (public key).
