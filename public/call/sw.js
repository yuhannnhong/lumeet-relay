const CACHE_NAME = 'lumeet-shell-v5';
const SHELL = [
  './',
  './index.html',
  './tailwind.css',
  './video.js',
  './vad.js',
  './vendor/trtc.js',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// 只快取固定的介面檔案（網路優先，斷網才用快取）。
// 其他請求（例如 /app/replies 長輪詢、/portrait、/vivix）一律不經過快取，
// 不然網頁跟橋接器同網址時，會一直拿到舊的空回覆。
const SHELL_PATHS = new Set(SHELL.map((p) => new URL(p, self.location).pathname));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isNavigate = request.mode === 'navigate';
  if (!isNavigate && !SHELL_PATHS.has(url.pathname)) return;

  const key = isNavigate ? './index.html' : request;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        }
        return response;
      })
      .catch(() => caches.match(key))
  );
});
