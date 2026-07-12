// Service worker minimal — cukup buat bikin halaman ini "installable" di HP.
// Gak nge-cache data /api/entries (biar selalu fresh), cuma cache file statis.
// Naikin angka versi ini tiap kali style.css / app.js / index.html berubah,
// biar service worker buang cache lama dan ambil file baru.
const CACHE = "life-story-standby-v2";
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // selalu live, jangan di-cache
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
