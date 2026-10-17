// 인터넷이 없어도 열리도록 앱 파일과 음식 데이터를 모두 저장해 둔다.
// 파일을 바꾸면 VERSION 을 올려야 폰에 새 버전이 받아진다.
const VERSION = 'mom-meal-v7';
const FILES = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/calc.js',
  './js/store.js',
  './js/foods.js',
  './js/chart.js',
  './js/look.js',
  './data/foods.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
