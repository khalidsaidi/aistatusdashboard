// PWA Service Worker (offline-safe, update-safe)
// IMPORTANT: Do NOT cache HTML (/) with cache-first. That causes stale pages that reference
// old hashed Next.js chunks, which breaks hydration (e.g. tabs stop working).

const CACHE_NAME = 'ai-status-dashboard-v2';
const PRECACHE_URLS = ['/manifest.json', '/icon-192x192.png', '/icon-512x512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always go to network for navigation requests to avoid stale HTML breaking the app.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first only for our small precache list; everything else is network-first.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
