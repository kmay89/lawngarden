/* Yard & Garden Console — offline service worker.
   Caches the single-page app shell so an installed/visited copy keeps
   working with no signal. Weather/ZIP API calls are left to the network
   (and only happen on demand). Bump CACHE to ship a new version. */
"use strict";
var CACHE = "yardgarden-v1";
var CORE = ["./", "./index.html"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(CORE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return (k === CACHE) ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  // Let cross-origin requests (Open-Meteo, Zippopotam) go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Navigations / the HTML document: network-first so updates land when online,
  // falling back to the cached shell when offline.
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) {
          return m || caches.match("./index.html") || caches.match("./");
        });
      })
    );
    return;
  }

  // Any other same-origin GET: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
