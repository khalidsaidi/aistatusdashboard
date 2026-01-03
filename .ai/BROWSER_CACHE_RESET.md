# Browser Cache / Service Worker Reset

If the UI behaves like it’s unresponsive (e.g. tabs don’t respond) and you suspect a stale Service Worker or cached HTML:

## One-shot reset snippet (paste in DevTools console)

```js
navigator.serviceWorker.getRegistrations()
  .then(rs => Promise.all(rs.map(r => r.unregister())))
  .then(() => caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))))
  .then(() => location.reload());
```

## What this addresses

- A service worker caching `"/"` (HTML) can serve an old page referencing old hashed Next.js chunks.
- When those chunks 404, React hydration can fail and the UI can appear “dead”.

