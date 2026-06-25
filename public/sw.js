var CACHE = "seekant-v1";

var PRECACHE_URLS = [
  "/",
  "/images/logo-mark.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  // Skip API routes and Supabase requests entirely
  if (url.pathname.startsWith("/api/") ||
      url.hostname.includes("supabase")) {
    return;
  }

  // Cache-first for static assets (JS/CSS bundles, images, fonts)
  if (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|woff2?|ttf|otf)$/)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        return fetch(e.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML navigation
  if (e.request.mode === "navigate" || e.request.headers.get("accept").indexOf("text/html") !== -1) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match("/offline.html");
        });
      })
    );
    return;
  }

  // Default: network with cache fallback
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(e.request);
    })
  );
});
