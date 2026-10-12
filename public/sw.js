// VYBE service worker: lets the installed app open (and play My Files)
// offline, without ever serving a stale copy of the app when online.
//
// Pages are network-first: answering them from a cache first would keep
// installed users on old HTML that points at build files a newer deploy no
// longer has. Paths are worked out from this worker's own scope, so it runs
// the same at "/" locally and under "/vybe/" on GitHub Pages.

const VERSION = 'v4';
const BASE = new URL(self.registration.scope).pathname; // '/vybe/' on GitHub Pages, '/' locally
const PAGES = `vybe-pages-${VERSION}`;
// Hashed build files never change content, so this cache outlives version
// bumps — an offline launch can still find the files an older cached page
// asks for. Trimmed to the newest entries on activate.
const STATIC = 'vybe-static';
const STATIC_LIMIT = 300;
// Fully client-rendered pages that work offline with My Files.
const PRECACHE = ['library/', 'liked/'].map((p) => BASE + p);
const OFFLINE_FALLBACK = BASE + 'library/';
const CACHEABLE_PAGES = ['', 'library/', 'liked/', 'radio/', 'search/', 'playlist/'].map((p) => BASE + p);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k)));
      await trimStatic();
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Only our own pages and files. YouTube, the YouTube API, thumbnails and
  // radio streams (which never "finish") go straight to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  // Media and byte-range requests are left to the browser: Safari refuses
  // audio a service worker answered without proper range support.
  if (request.headers.has('range') || request.destination === 'audio' || request.destination === 'video') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request, url));
    return;
  }
  if (url.pathname.startsWith(BASE + '_next/static/')) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (including the data Next fetches for in-app navigation)
  // just goes to the network. Offline, Next falls back to a full page load,
  // which networkFirstPage then answers from the cache.
});

async function networkFirstPage(request, url) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Redirected responses can't be replayed for a navigation (Safari errors out).
    if (CACHEABLE_PAGES.includes(url.pathname) && response.ok && !response.redirected) {
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(url.pathname)) || (await cache.match(OFFLINE_FALLBACK)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function trimStatic() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  // Oldest entries come first.
  for (const key of keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT))) {
    await cache.delete(key);
  }
}
