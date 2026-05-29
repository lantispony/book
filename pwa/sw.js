const CACHE = 'acct-v20145';
const FILES = [
  '/',
  '/index.html',
  '/index_mobile.html',
  '/index_pc.html',
  '/core.js',
  '/app.js',
  '/desktop.js',
  '/style.css',
  '/style_pc.css',
  '/firebase-config.js',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if (k !== CACHE) return caches.delete(k); })))
  );
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
