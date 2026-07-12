// Service Worker — 离线缓存
const CACHE_NAME = 'gacha-v5';
const BASE = self.location.pathname.replace(/\/[^/]*$/, '/');
const CACHE_FILES = [
  '.',
  './index.html',
  './styles/main.css',
  './js/gacha.js',
  './js/state.js',
  './js/render.js',
  './js/modals.js',
  './js/app.js',
  './manifest.json',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting(); // 立即激活新 SW，不等旧 SW 释放
});

// 激活：清除旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先，离线回退缓存
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 网络成功，更新缓存
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // 网络失败，回退缓存
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
