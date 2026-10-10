const PREFIX = 'strumlab-';
const CACHE = PREFIX + 'v8';
const FILES = ['./', './index.html', './styles.css', './app.js', './theory.js', './synth.js', './library.js', './lab.js', './scalelab.js', './settings.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// Only remove StrumLab's own old caches. Other apps on this github.io address keep theirs.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE)
      .then(c => c.match(e.request, { ignoreSearch: true }))
      .then(hit => hit || fetch(e.request).catch(() => caches.open(CACHE).then(c => c.match('./index.html'))))
  );
});
