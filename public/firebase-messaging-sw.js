// Firebase Cloud Messaging Service Worker
// This will be dynamically configured by the main app

// Service worker will receive config from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    // Initialize Firebase with the config passed from main thread
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

    firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Received background message:', payload);

      const notificationTitle = payload.notification?.title || 'AI Status Dashboard';
      const notificationOptions = {
        body: payload.notification?.body || 'Service status update',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: payload.data,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Dashboard',
            icon: '/icon-192x192.png',
          },
        ],
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(clients.openWindow('/'));
  }
});
