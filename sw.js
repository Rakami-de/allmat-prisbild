// App-shell cache. Bump VERSION on every deploy so installed phones pick up the new files.
const VERSION = 'v7';
const PREFIX = 'allmat-prisbild-';
const CACHE = `${PREFIX}${VERSION}`;

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
  './js/core/collage.js',
  './js/core/photo.js',
  './js/core/render.js',
  './js/core/storage.js',
  './js/core/export.js',
  './js/i18n/index.js',
  './js/i18n/sv.js',
  './js/i18n/ar.js',
  './js/ui/app.js',
  './js/ui/dom.js',
  './js/ui/components/viewer.js',
  './js/ui/views/home.js',
  './js/ui/views/batch.js',
  './js/ui/views/editor.js',
  './js/ui/views/output.js',
  './assets/fonts/barlow-condensed-600-latin.woff2',
  './assets/fonts/barlow-condensed-700-latin.woff2',
  './assets/fonts/barlow-condensed-900-latin.woff2',
  './assets/fonts/noto-sans-arabic-var-latin.woff2',
  './assets/fonts/noto-sans-arabic-var-arabic.woff2',
  './assets/brand/logo-mark.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // 'reload' bypasses the HTTP cache so a new version never precaches stale files.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // github.io is one origin for every repository: only touch this app's caches.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
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

  const refresh = () => fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
  const cached = () => caches.open(CACHE).then((cache) => cache.match(request, { ignoreSearch: true }));

  // The page itself is network-first so a deploy is picked up on the next online launch.
  // Everything else is served from cache at once and refreshed in the background.
  if (request.mode === 'navigate') {
    event.respondWith(refresh().catch(() => cached().then((hit) => hit ?? caches.match('./index.html'))));
    return;
  }
  event.respondWith(cached().then((hit) => {
    const network = refresh().catch(() => hit);
    if (hit) { event.waitUntil(network); return hit; }
    return network;
  }));
});
