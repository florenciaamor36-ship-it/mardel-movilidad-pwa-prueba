const CACHE = "mardel-movilidad-gtfs-pwa-v5";
const CORE = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./assets/icon-192.png", "./assets/icon-512.png", "./data/addresses.json", "./data/gtfs/routes.txt", "./data/gtfs/trips.txt", "./data/gtfs/stop_times.txt", "./data/gtfs/frequencies.txt", "./data/gtfs/stops.txt", "./data/gtfs/feed_info.txt"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    if (response.ok && event.request.method === "GET") { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match("./index.html"))));
});
