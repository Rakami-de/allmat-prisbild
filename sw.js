// App-shell cache. Bump VERSION on every deploy so installed phones pick up the new files.
const VERSION = 'v1';
const CACHE = `allmat-prisbild-${VERSION}`;

// Relative URLs: the app lives under /<repo>/ on GitHub Pages.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/app.css',
  './js/config/store.js',
  './js/core/price.js',
  './js/core/batch.js',
  './js/core/layout.js',
  './js/core/photo.js',
  './js/core/render.js',
  './js/core/storage.js',
  './js/core/export.js',
  './js/i18n/index.js',
  './js/i18n/sv.js',
  './js/i18n/ar.js',
  './js/ui/app.js',
  './js/ui/dom.js',
  './js/ui/views/home.js',
  './js/ui/views/batch.js',
  './js/ui/views/editor.js',
  './js/ui/views/output.js',
  './assets/brand/logo-full.png',
  './assets/brand/logo-mark.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The page asks for this after the user taps "Uppdatera".
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
