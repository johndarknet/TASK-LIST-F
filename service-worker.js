// service-worker.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `motion-cache-${CACHE_VERSION}`;
const FILES_TO_CACHE = [
  './',             // root
  './index.html',
  './manifest.json',
  // add any other static resources your app needs offline:
  // './icons/icon-192x192.png',
  // './icons/icon-512x512.png',
  // './styles.css',
  // './script.js',
];

self.addEventListener('install', event => {
  console.log('[SW] install');
  // Pre-cache important assets
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(FILES_TO_CACHE);
      })
      .catch(err => {
        console.error('[SW] Failed to cache on install:', err);
      })
  );
  // Activate worker immediately so it can control pages
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] activate');
  // remove old caches
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] removing old cache', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Ensure the service worker takes control immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch strategy:
 * - navigation requests (page loads): network-first -> fallback to cache (index.html)
 * - same-origin static assets: cache-first
 * - cross-origin or other requests: network-first (no caching)
 */
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // App shell / navigation: try network first (so user gets updates), fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(networkResponse => {
          // Optionally update the cache with the latest index.html
          caches.open(CACHE_NAME).then(cache => {
            cache.put('./index.html', networkResponse.clone()).catch(()=>{});
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html').then(cached => cached || Response.error());
        })
    );
    return;
  }

  // For same-origin static assets (JS/CSS/images), prefer cache first for speed
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(networkResponse => {
            // Put a copy in cache for future (best-effort)
            caches.open(CACHE_NAME).then(cache => {
              // Don't cache opaque responses (e.g., cross-origin images) unintentionally
              try { cache.put(req, networkResponse.clone()); } catch(e) {}
            });
            return networkResponse;
          })
          .catch(err => {
            // If fetch fails and no cache, return a generic fallback (optional)
            // e.g., return caches.match('./offline-placeholder.png')
            return Promise.reject(err);
          });
      })
    );
    return;
  }

  // Cross-origin or other: network-first but don't block on cache
  event.respondWith(
    fetch(req)
      .then(networkResponse => networkResponse)
      .catch(() => caches.match(req))
  );
});
