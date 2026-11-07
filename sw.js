// Service worker: хранит файлы приложения на телефоне, чтобы оно открывалось без интернета.
// При изменении файлов приложения увеличьте номер версии.
const CACHE = 'finance-app-v2';
const ASSETS = [
  './',
  'index.html',
  'icons.js',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала отдаём из кэша (мгновенно и офлайн), параллельно обновляем кэш из сети.
// Запросы к Google (синхронизация) не трогаем.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    return new Response('Нет соединения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
