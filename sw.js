// 多城巴士即時到站 - Service Worker
// 只快取 app shell (HTML/manifest/icons)；KMB 同 TfL 嘅即時查詢
// 一律直接放行,唔做快取,保證睇到嘅永遠係最新資料。

const CACHE_NAME = "multicitybus-shell-v8";
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
  // 只處理 GET；其他方法（POST 等）唔可以 cache.put，直接放行
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // 跨網域嘅 API（data.etabus.gov.hk / api.tfl.gov.uk）永遠直接去
  // 網絡攞，唔經 service worker 快取
  if (url.origin !== self.location.origin) {
    return;
  }

  // 獨立捷徑會用 index.html?d=xxx 或 index.html?watch=xxx 呢種帶 query
  // string 嘅網址，但同 index.html 其實係同一個檔案，快取嗰陣要忽略
  // query string，先至可以離線都開到
  const isHtmlShell = url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  const cacheKey = isHtmlShell ? new Request(url.origin + url.pathname) : event.request;

  // 網絡優先：一律先試網絡攞最新版本，攞到就即刻用、同時更新快取；
  // 淨係喺完全冇網絡（例如離線）先會落去用返快取低嘅版本頂住
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 只快取成功（2xx）而且同源嘅回應，避免將 404／錯誤頁寫入快取，
        // 令離線時用錯誤頁頂替真頁面
        if (res && res.ok && res.type === "basic") {
          // 一定要喺 return res 之前同步 clone：
          // 一旦 body 開始俾瀏覽器讀取，之後先 clone 會 throw
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(cacheKey, copy))
              .catch(() => {})
          );
        }
        return res;
      })
      .catch(() =>
        caches.match(cacheKey).then((cached) => {
          if (cached) return cached;
          // 開 "/" 但快取入面淨係有 precache 嘅 index.html，就用佢頂住
          if (isHtmlShell) {
            return caches.match("./index.html").then((shell) => shell || Response.error());
          }
          return Response.error();
        })
      )
  );
});
