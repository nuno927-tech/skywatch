/* SkyWatch service worker — app-shell caching + offline fallback */
const VERSION = 'skywatch-v259';
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

// Dev panel "Apply pending update": take control immediately instead of waiting for all tabs to close.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting' || (e.data && e.data.type === 'skipWaiting')) self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ---------- Web Push ----------
   Fires with the app fully closed. Wearables (Wear OS, Apple Watch) mirror whatever
   the phone shows, so there's no separate watch API — the job is to keep the payload
   short and give it a title, body, icon and actions that render on a small screen. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {
    try { d = { title: 'SkyWatch', body: e.data.text() }; } catch (__) {}
  }
  const title = d.title || 'SkyWatch';
  const opts = {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',          // monochrome silhouette used in the status bar + watch
    tag: d.tag || 'skywatch',
    renotify: !!d.renotify,
    requireInteraction: false,      // a pass is time-critical; don't leave it stuck on screen
    silent: false,
    vibrate: d.vibrate || [16, 55, 16, 55, 130],
    timestamp: d.at || Date.now(),
    data: d.data || {},
    actions: (d.actions || []).slice(0, 2)   // watches surface at most two
  };
  e.waitUntil((async () => {
    // Admin login pings are also shown as an in-app card; if a window is focused, skip the
    // OS notification so the admin isn't double-pinged.
    if (d.data && d.data.type === 'login') {
      const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (cs.some((c) => c.visibilityState === 'visible' || c.focused)) return;
    }
    return self.registration.showNotification(title, opts);
  })());
});

// Focus (or open) the app when a pass-alert notification is clicked.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;                 // watch/notification action button
  const data = e.notification.data || {};
  const mute = e.action === 'mute';                    // "Not watching tonight" — silence the rest of the night
  const sel = (!mute && data.type && data.id) ? (data.type + ':' + data.id) : '';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      if ('focus' in c) { await c.focus(); if (mute) c.postMessage({ satmapMute: true }); else if (sel) c.postMessage({ satmapSelect: data }); return; }
    }
    if (self.clients.openWindow) return self.clients.openWindow(mute ? './#mute' : (sel ? ('./#sel=' + encodeURIComponent(sel)) : './'));
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

  // Shared TLE snapshots refresh a few times a day: prefer the network so clients pick up new
  // elements, but fall back to the last cached copy when offline.
  if (url.origin === self.location.origin && url.pathname.includes('/data/tle/')) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req))
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
