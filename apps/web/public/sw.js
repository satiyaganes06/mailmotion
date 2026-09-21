/* MailMotion offline shell. Static assets are cached on first use; pages fall back to the cache when offline.
   Nothing user-specific is ever cached (drafts live in IndexedDB, tokens only in memory). */
const VERSION = 'mm-v1';
const SHELL = ['/studio/', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/fonts/') ||
  url.pathname.startsWith('/gallery/') ||
  url.pathname.startsWith('/icons/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch GitHub / storage / API calls

  if (isStatic(url)) {
    // content-hashed files: cache-first
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate') {
    // pages: network first, cached copy when offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !url.pathname.startsWith('/phone') && !url.pathname.startsWith('/publish'))
            caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/studio/'))),
    );
  }
});
