const CACHE_NAME = 'sports-operator-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Minimal network-first strategy. Keeps the app installable as a PWA
// without adding offline-data complexity, which is out of scope for V1.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((res) => res || caches.match('/'))
    )
  );
});
