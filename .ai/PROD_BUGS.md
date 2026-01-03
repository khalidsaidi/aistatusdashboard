# Live Prod/Dev Bugs (observed externally)

This file captures issues observable on the currently deployed environments (not necessarily matching this working tree).

## Production: global redirect

- URL: `https://ai-status-dashboard.web.app`
- Behavior: returns `301` → `https://www.yourdomain.com/` (placeholder)
- Impact: production Hosting effectively unusable; even `/api/*` paths get redirected.

Likely cause:
- Firebase Hosting redirect rule pointing to a placeholder domain (or a misconfigured custom domain redirect).

## Production: `/api/health` 500

- URL: `https://us-central1-ai-status-dashboard.cloudfunctions.net/api/health`
- Behavior: `500`
- Control: `https://us-central1-ai-status-dashboard.cloudfunctions.net/api/health?force=true` returns `200`

Interpretation:
- The “cached/Firestore-read” path fails in prod, but the “live fetch” path works. That typically points to Firestore read/index/permissions issues or a code path that throws on Firestore reads.

## Dev: console spam for `/_vercel/*`

- URL: `https://ai-status-dashboard-dev.web.app`
- Behavior: browser console logs repeated script load errors for:
  - `/_vercel/insights/script.js`
  - `/_vercel/speed-insights/script.js`

Interpretation:
- These scripts exist only when deployed on Vercel. On Firebase Hosting they 404.
- If the app converts `console.error` into toasts (or other UI work), repeated errors can make the UI feel “stuck”.

Evidence:
- See `.ai/deployment-curl.txt` for a quick 404 check of the `/_vercel/*` path.

