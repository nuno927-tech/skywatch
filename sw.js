/* SkyWatch service worker — app-shell caching + offline fallback */
const VERSION = 'skywatch-v76';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Focus (or open) the app when a pass-alert notification is clicked.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const sel = (data.type && data.id) ? (data.type + ':' + data.id) : '';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      if ('focus' in c) { await c.focus(); if (sel) c.postMessage({ satmapSelect: data }); return; }
    }
    if (self.clients.openWindow) return self.clients.openWindow(sel ? ('./#sel=' + encodeURIComponent(sel)) : './');
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Live satellite data: always go to the network (never serve stale orbits).
  if (url.hostname.includes('celestrak')) return;

  // 3D engine from CDNs: stale-while-revalidate so the shell works offline.
  if (url.hostname.includes('esm.sh') || url.hostname.includes('jsdelivr')) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Same-origin navigations: always revalidate against the server (so a new deploy shows
  // immediately instead of waiting on the HTTP cache), falling back to the cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .catch(() => fetch(req))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else same-origin: cache-first.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }))
    );
  }
});
