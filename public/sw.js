/* Fun Game — service worker.
 *
 * Its job is to make the app installable and to keep it usable when the wifi
 * drops at the back of the house. It is deliberately NOT a cache-first worker:
 * an earlier bug on this site came from a browser pairing a fresh index.html
 * with a day-old content.js, and a greedy service worker is the fastest way to
 * bring that back. Every request goes to the network first and only falls back
 * to the cache when the network cannot answer.
 */
const CACHE = 'kbw-v1';
const SHELL = [
  '/',
  '/index.html',
  '/content.js',
  '/worksheets.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})       // a missing file must not block installation
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Google fonts, GSI: leave alone
  // Registrations, progress and licence checks must never be served from a cache.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
