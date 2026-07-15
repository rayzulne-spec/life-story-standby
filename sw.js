// Service worker minimal — cukup buat bikin halaman ini "installable" di HP.
// Strategi: NETWORK-FIRST buat file statis (html/css/js). Jadi tiap deploy baru,
// reload biasa langsung ambil file terbaru dari server; cache cuma dipakai kalau
// offline. Ini bikin kamu gak perlu naikin versi manual tiap edit style.css/app.js.
// /api/entries gak pernah di-cache biar datanya selalu fresh.
const CACHE = "life-story-standby-v5";
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // selalu live, jangan disentuh

  // NETWORK-FIRST: coba ambil dari server dulu, simpan ke cache buat cadangan.
  // Kalau offline / server gagal, baru jatuh ke cache lama.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
