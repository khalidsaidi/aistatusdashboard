// Firebase messaging service worker for push notifications
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "your-api-key",
  authDomain: "ai-status-dashboard-dev.firebaseapp.com",
  projectId: "ai-status-dashboard-dev",
  storageBucket: "ai-status-dashboard-dev.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'AI Status Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'AI service status changed',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: payload.data,
    actions: [
      {
        action: 'view',
        title: 'View Dashboard',
        icon: '/icon-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-dismiss.png'
      }
    ],
    requireInteraction: true,
    tag: 'ai-status-notification'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'view') {
    // Open dashboard
    event.waitUntil(
      clients.openWindow(self.location.origin)
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open dashboard
    event.waitUntil(
      clients.openWindow(self.location.origin)
    );
  }
});

// Handle push events (fallback)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'AI Status Alert';
    const options = {
      body: data.body || 'AI service status changed',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data.data,
      tag: 'ai-status-notification'
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Cache management for offline functionality
const CACHE_NAME = 'ai-status-dashboard-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
}); 