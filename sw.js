// 多城巴士即時到站 - Service Worker
// 只快取 app shell (HTML/manifest/icons)；KMB 同 TfL 嘅即時查詢
// 一律直接放行,唔做快取,保證睇到嘅永遠係最新資料。

const CACHE_NAME = "multicitybus-shell-v3";
const SHELL_FILES = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 跨網域嘅 API（data.etabus.gov.hk / api.tfl.gov.uk）永遠直接去
  // 網絡攞，唔經 service worker 快取
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
