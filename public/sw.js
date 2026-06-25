const CACHE_NAME = "pfs-v3";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([
        OFFLINE_URL,
        "/favicon.ico",
        "/icons/icon-144.png",
        "/icons/icon-192.png",
        "/icons/icon-512.png"
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  var isNavigate = event.request.mode === "navigate";

  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        if (isNavigate) return caches.match(OFFLINE_URL);
        return new Response("", { status: 408 });
      });
    })
  );
});
