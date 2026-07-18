// Bump version whenever you want users to get a fresh cache.
// Changing this string causes the SW to be treated as a new file.
const CACHE_NAME = 'pendo-v3';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

// Install: pre-cache static assets.
// Do NOT call self.skipWaiting() here eagerly — doing so fires a
// 'controllerchange' event on the very first page load, which the old
// PWARegistration code was using to trigger window.location.reload().
// Instead, wait for an explicit SKIP_WAITING message from the client.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed (ok on first load):', err);
      });
    })
  );
});

// Activate: clear old caches and claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for explicit SKIP_WAITING message from the client (sent only
// when an update is ready and the user has no unsaved form data).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
//   - /api/*         → always network (never cache auth/data calls)
//   - Static assets  → cache-first
//   - Pages          → network-first, fall back to cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for images, fonts, and Next.js built assets
  if (
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For non-GET requests (e.g., POST/PUT/DELETE APIs), bypass cache entirely
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for all pages (fall back to cache if offline)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
