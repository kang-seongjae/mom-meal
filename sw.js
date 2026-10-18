// 인터넷이 없어도 열리도록 앱 파일을 모두 저장해 둔다. (키우기 화면은 음식 영양 데이터를 쓰지 않는다)
// 파일을 바꾸면 VERSION 을 올려야 폰에 새 버전이 받아진다.
const VERSION = 'mom-meal-grow-v1';
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
  './js/grow.js',
  './js/pet.js',
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
