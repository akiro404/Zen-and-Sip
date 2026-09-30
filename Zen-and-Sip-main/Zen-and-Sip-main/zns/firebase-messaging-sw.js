// ─── Firebase Messaging Service Worker ───────────────────────────────────────
// Handles background push notifications (when app tab is closed/hidden)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCn6c_5YOl02mJoDE1M2-UP6ezGPVby2ew",
  authDomain: "recsu-business.firebaseapp.com",
  projectId: "recsu-business",
  storageBucket: "recsu-business.firebasestorage.app",
  messagingSenderId: "514460440924",
  appId: "1:514460440924:web:543c88e8330c2b0940c999",
});

const messaging = firebase.messaging();

// Show notification when app is in background / closed
messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'Zen & Sip', {
    body:    notification.body  || 'You have a new notification.',
    icon:    '/favicon.png',
    badge:   '/favicon.png',
    vibrate: [200, 100, 200],
    data:    payload.data || {},
    actions: [{ action: 'open', title: 'Open Dashboard' }],
  });
});

// Clicking the notification opens the dashboard
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var c of list) {
        if (c.url && c.focus) { c.focus(); return; }
      }
      if (clients.openWindow) clients.openWindow('/');
    })
  );
});
