// Service worker: хранит файлы приложения на телефоне, чтобы оно открывалось без интернета.
//
// Как выпустить новую версию: поменять VERSION здесь и такие же ?v=… в index.html.
// Новый service worker скачает все файлы версии сразу и целиком (минуя кэш браузера),
// после установки приложение само перезагрузится уже в новой версии.
const VERSION = '0.4.1';
const CACHE = 'finance-app-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'icons.js?v=' + VERSION,
  'app.js?v=' + VERSION,
  'styles.css?v=' + VERSION,
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Файлы приложения отдаём из кэша этой версии (мгновенно и без интернета).
// Запросы к Google (синхронизация) и к курсам валют не трогаем.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const shell = (await cache.match('./')) || (await cache.match('index.html'));
      if (shell) return shell;
    }
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('Нет соединения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
