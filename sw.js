/* Pulse PWA service worker
 * v3 — app shell is NETWORK-FIRST so new deployments show up on next launch;
 * cache is only the offline fallback. Sheet CSVs network-first too.
 */
var VERSION = 'pulse-v3';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(e) {
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true })
        .then(function (hit) { return hit || caches.match('./index.html'); });
    })
  );
}

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Never touch API calls (OpenRouter etc.)
  if (url.hostname === 'openrouter.ai') return;

  // Sheet CSVs → network-first with offline fallback
  if (url.hostname === 'docs.google.com') { networkFirst(e); return; }

  if (url.origin === location.origin) {
    // HTML/navigations + sw-adjacent files → network-first so updates land
    if (e.request.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('manifest.webmanifest')) {
      networkFirst(e);
      return;
    }
    // static assets (icons) → cache-first
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
          return res;
        });
      })
    );
  }
});
