const CACHE = 'vybe-shell-v2';
const SHELL = ['/', '/search', '/library', '/liked'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Never cache API calls — search and new releases must always be live.
  if (request.url.includes('/api/')) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
