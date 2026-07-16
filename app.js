// LIFE STORY — Standby front-end
// Nyalain jam real-time, narik data dari /api/entries, dan muter quotes + carousel kartu.

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const BULAN_SINGKAT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const CARD_COLORS = [
  ["#4100F5", "#8A6BFF"],
  ["#EA6E4B", "#FF9A6E"],
  ["#F037A5", "#D653A9"],
  ["#4100F5", "#F037A5"],
];

// Fallback dummy data — dipakai kalau /api/entries belum ada / gagal (misal masih testing lokal).
const DUMMY = {
  throwback: {
    day: 12, monthIdx: 6, year: 2025,
    text: "akhirnya nyobain kedai kopi di ujung gang itu. hujan deras — kita malah duduk dua jam ngobrolin hal kecil yang hangat."
  },
  quotes: [
    { day: 12, monthIdx: 6, year: 2025, text: "Hari biasa yang pengen aku ingat lama-lama.", narrative: "Bangun agak siang, terus ngopi di teras sambil dengerin hujan. Nggak ngapa-ngapain yang penting, tapi entah kenapa pengen aku ingat lama-lama." },
    { day: 14, monthIdx: 2, year: 2025, text: "ulang tahun ibu", narrative: "Ulang tahun ibu. Masak bareng dari pagi, ketawa-ketawa di dapur. Malemnya potong kue kecil. Sederhana tapi hangat." },
    { day: 2, monthIdx: 1, year: 2025, text: "lari pagi pertama", narrative: "Lari pagi pertama setelah lama nggak. Napas ngos-ngosan di 1 km pertama, tapi sisanya enak. Langitnya oranye bagus banget." },
    { day: 30, monthIdx: 8, year: 2025, text: "pindah kosan", narrative: "Hari pindahan kosan. Capek angkat-angkat barang, tapi kamar baru kena sinar matahari pagi. Berasa mulai babak baru." },
    { day: 21, monthIdx: 0, year: 2025, text: "midnight movie", narrative: "Nonton midnight sendirian. Filmnya biasa aja, tapi jalan pulang jam 2 pagi yang sepi itu justru bagian favoritku." },
    { day: 3, monthIdx: 4, year: 2025, text: "senja di rooftop", narrative: "Naik ke rooftop pas senja. Kota keliatan tenang dari atas. Duduk lama sampai lampu-lampu nyala satu-satu." },
    { day: 28, monthIdx: 3, year: 2025, text: "kopi & hujan deras", narrative: "Kehujanan deras di jalan, akhirnya ngampus ke kedai kopi. Malah jadi ngobrol dua jam soal hal-hal kecil yang hangat." },
  ]
};

// Buat testing search lokal: bikin 'days' dari quotes dummy (di live, 'days' datang
// dari /api/entries). Sengaja aku selipin beberapa nama orang biar bisa dicoba cari.
DUMMY.days = DUMMY.quotes.map(q => ({
  day: q.day, monthIdx: q.monthIdx, year: q.year,
  narrative: q.narrative, quotes: [q.text],
}));
DUMMY.days[1].narrative += " Sheila bantu masak, Kukuh bawa balon.";
DUMMY.days[6].narrative += " Ngobrolnya sama Sheila soal rencana pindah.";

let state = DUMMY;
let quoteIdx = 0;

function pad(n) { return String(n).padStart(2, "0"); }

function tickClock() {
  const now = new Date();
  document.getElementById("clockTime").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById("clockSeconds").textContent = pad(now.getSeconds());
  document.getElementById("clockDate").textContent =
    `${HARI_ID[now.getDay()]}, ${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`;
}

let memoryFull = null; // simpan catatan full buat pop-up

function renderMemory() {
  const t = state.throwback;
  const card = document.getElementById("memoryCard");
  if (!t) {
    document.getElementById("memDay").textContent = "";
    document.getElementById("memMonth").textContent = "";
    document.getElementById("memYear").textContent = "";
    document.getElementById("memoryText").textContent = "Belum ada catatan setahun lalu di tanggal ini.";
    memoryFull = null;
    if (card) card.classList.remove("tappable");
    return;
  }
  document.getElementById("memDay").textContent = pad(t.day);
  document.getElementById("memMonth").textContent = BULAN_SINGKAT[t.monthIdx];
  document.getElementById("memYear").textContent = t.year;
  document.getElementById("memoryText").textContent = `"${t.text}"`;
  // simpan versi full buat modal, plus tandai kartunya bisa di-tap
  memoryFull = {
    date: `${pad(t.day)} ${BULAN_SINGKAT[t.monthIdx]} ${t.year}`,
    text: `"${t.text}"`,
  };
  if (card) card.classList.add("tappable");
}

// ---- Modal catatan (dipakai memory card; nanti bisa dipakai ulang buat quotes) ----
function ensureModal() {
  let overlay = document.getElementById("noteModal");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "noteModal";
  overlay.className = "note-modal";
  overlay.innerHTML = `
    <div class="note-modal__card" role="dialog" aria-modal="true">
      <button class="note-modal__close" aria-label="Tutup">&times;</button>
      <div class="note-modal__date" id="noteModalDate"></div>
      <div class="note-modal__body" id="noteModalBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  // tutup kalau klik area gelap di luar kartu, atau klik tombol close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest(".note-modal__close")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  return overlay;
}

function openModal(dateText, bodyText) {
  const overlay = ensureModal();
  overlay.querySelector("#noteModalDate").textContent = dateText || "";
  overlay.querySelector("#noteModalBody").textContent = bodyText || "";
  overlay.classList.add("open");
}

function closeModal() {
  const overlay = document.getElementById("noteModal");
  if (overlay) overlay.classList.remove("open");
}

// ---- FITUR 4: Spotlight search (cari nama orang di semua catatan) ----
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function ensureSpotlight() {
  let ov = document.getElementById("spotlight");
  if (ov) return ov;
  ov = document.createElement("div");
  ov.id = "spotlight";
  ov.className = "spotlight";
  ov.innerHTML = `
    <div class="spotlight__box" role="dialog" aria-modal="true">
      <input id="spotlightInput" class="spotlight__input" type="text"
             placeholder="Cari nama orang…" autocomplete="off" spellcheck="false" />
      <div class="spotlight__results" id="spotlightResults"></div>
    </div>`;
  document.body.appendChild(ov);
  // klik area gelap di luar kotak = tutup
  ov.addEventListener("click", (e) => { if (e.target === ov) closeSpotlight(); });
  const input = ov.querySelector("#spotlightInput");
  input.addEventListener("input", () => runSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSpotlight();
    if (e.key === "Enter") runSearch(input.value);
  });
  return ov;
}

function openSpotlight() {
  const ov = ensureSpotlight();
  ov.classList.add("open");
  const input = ov.querySelector("#spotlightInput");
  input.value = "";
  ov.querySelector("#spotlightResults").innerHTML = "";
  setTimeout(() => input.focus(), 50); // fokus biar keyboard langsung muncul
}

function closeSpotlight() {
  const ov = document.getElementById("spotlight");
  if (ov) ov.classList.remove("open");
}

function runSearch(query) {
  const box = document.getElementById("spotlightResults");
  if (!box) return;
  const q = (query || "").trim().toLowerCase();
  if (!q) { box.innerHTML = ""; return; }

  const days = state.days || [];
  const hits = days
    .filter(d => ((d.narrative || "") + " " + (d.quotes || []).join(" ")).toLowerCase().includes(q))
    .sort((a, b) => (b.year - a.year) || (b.monthIdx - a.monthIdx) || (b.day - a.day));

  if (!hits.length) {
    box.innerHTML = `<div class="spotlight__empty">Nggak ada catatan yang menyebut “${escapeHtml(query)}”.</div>`;
    return;
  }

  box.innerHTML = "";
  hits.forEach((d) => {
    const dateLabel = `${pad(d.day)} ${BULAN_SINGKAT[d.monthIdx]} ${d.year}`;
    const snippet = d.narrative || (d.quotes || []).join(" ");
    const item = document.createElement("div");
    item.className = "spotlight__item";
    item.innerHTML = `
      <div class="spotlight__item-date">${dateLabel}</div>
      <div class="spotlight__item-text">${escapeHtml(snippet)}</div>`;
    // klik hasil → buka catatan full-nya di modal
    item.addEventListener("click", () => {
      closeSpotlight();
      openModal(dateLabel, d.narrative || snippet);
    });
    box.appendChild(item);
  });
}

// Pasang listener tap di memory card (sekali aja pas load).
(function wireMemoryTap() {
  const card = document.getElementById("memoryCard");
  if (!card) return;
  card.addEventListener("click", () => {
    if (memoryFull) openModal(memoryFull.date, memoryFull.text);
  });
})();

let currentQuote = null; // quote yang lagi tampil (buat tap → buka catatan full)

function renderRotatingQuote() {
  const el = document.getElementById("rotatingQuote");
  const list = state.quotes || [];
  if (!list.length) { el.textContent = ""; el.classList.remove("tappable"); return; }
  el.classList.add("fade");
  setTimeout(() => {
    const q = list[quoteIdx % list.length];
    el.textContent = `"${q.text}"`;
    currentQuote = q;
    el.classList.add("tappable");
    quoteIdx++;
    el.classList.remove("fade");
  }, 400);
}

// Pasang listener tap di quote (sekali aja) → buka catatan full hari itu.
(function wireQuoteTap() {
  const el = document.getElementById("rotatingQuote");
  if (!el) return;
  el.addEventListener("click", () => {
    if (!currentQuote) return;
    const date = `${pad(currentQuote.day)} ${BULAN_SINGKAT[currentQuote.monthIdx]} ${currentQuote.year}`;
    // kalau ada narasi full hari itu (dari /api/entries), tampilin itu;
    // kalau nggak ada, ya tampilin quote-nya aja.
    const body = currentQuote.narrative && currentQuote.narrative.trim()
      ? currentQuote.narrative
      : `"${currentQuote.text}"`;
    openModal(date, body);
  });
})();

// Orbit dua cincin — niru "Life Story Standby":
// - cincin luar: kartu gede, muter searah jarum jam (80s)
// - cincin dalam: kartu lebih kecil, muter kebalik & lebih cepat (58s)
// Dua-duanya ngelilingin satu hub yang sama. Tiap kartu di-counter-rotate
// jadi POSISI-nya nyapu masuk-keluar frame tapi ORIENTASI-nya tetap tegak
// (teks kebaca terus).
function renderCarousel() {
  const track = document.getElementById("carouselTrack");
  track.innerHTML = "";
  const list = state.quotes || [];
  if (!list.length) return;

  const W = track.clientWidth || track.offsetWidth || 800;
  const H = track.clientHeight || track.offsetHeight || 600;
  const base = Math.min(W, H);

  // Hub ditaruh agak ke kanan biar kartu nyapu keluar-masuk sisi kanan frame.
  const hubX = W * 0.82;
  const hubY = H * 0.5;

  // Glow di tengah hub (sesuai referensi).
  const hub = document.createElement("div");
  hub.className = "orbit-hub";
  hub.style.left = hubX + "px";
  hub.style.top = hubY + "px";
  hub.style.width = base * 0.22 + "px";
  hub.style.height = base * 0.22 + "px";
  track.appendChild(hub);

  // Icon Sine.png di poros orbit — di-tap buat buka search Spotlight (Fitur 4).
  const hubIcon = document.createElement("img");
  hubIcon.className = "orbit-hub-icon";
  hubIcon.src = "Sine.png";
  hubIcon.alt = "Cari catatan";
  hubIcon.title = "Cari nama orang";
  hubIcon.style.left = hubX + "px";
  hubIcon.style.top = hubY + "px";
  hubIcon.style.width = base * 0.13 + "px";
  hubIcon.addEventListener("click", openSpotlight);
  track.appendChild(hubIcon);

  // Isi tiap cincin dari quotes; kalau datanya dikit, diulang biar cincin penuh.
  const fill = (n) => Array.from({ length: n }, (_, i) => list[i % list.length]);
  const outer = fill(Math.min(7, Math.max(5, list.length)));
  const innerCount = Math.min(5, Math.max(3, list.length - 1));
  const inner = fill(innerCount).map((_, i) => list[(i + 1) % list.length]);

  const rings = [
    { data: outer, radius: base * 0.42, cardW: base * 0.34, cardH: base * 0.24, dur: 80, dir: "normal",  colorOffset: 0 },
    { data: inner, radius: base * 0.26, cardW: base * 0.22, cardH: base * 0.20, dur: 58, dir: "reverse", colorOffset: 2 },
  ];

  rings.forEach((cfg) => {
    const ring = document.createElement("div");
    ring.className = "orbit-ring" + (cfg.dir === "reverse" ? " rev" : "");
    ring.style.left = hubX + "px";
    ring.style.top = hubY + "px";
    ring.style.setProperty("--dur", cfg.dur + "s");

    const n = cfg.data.length;
    cfg.data.forEach((q, i) => {
      const t = (360 / n) * i; // sudut slot kartu di lingkaran

      const [c1, c2] = CARD_COLORS[(cfg.colorOffset + i) % CARD_COLORS.length];

      // slot: naruh kartu di posisi sudut t, sejauh radius dari hub
      const slot = document.createElement("div");
      slot.className = "orbit-slot";
      slot.style.transform = `rotate(${t}deg) translateX(${cfg.radius}px)`;

      // spin-counter: muter balik sama cepat dgn cincin → hapus rotasi orbit
      const spinCounter = document.createElement("div");
      spinCounter.className = "orbit-spin-counter";
      spinCounter.style.setProperty("--dur", cfg.dur + "s");

      // counter: hapus offset sudut slot → kartu balik tegak
      const counter = document.createElement("div");
      counter.className = "orbit-counter";
      counter.style.transform = `rotate(${-t}deg)`;

      const card = document.createElement("div");
      card.className = "ocard";
      card.style.width = cfg.cardW + "px";
      card.style.height = cfg.cardH + "px";
      card.style.background = `linear-gradient(150deg, ${c1}, ${c2})`;
      card.innerHTML = `
        <div class="cap">${q.text.length > 28 ? q.text.slice(0, 26) + "…" : q.text}</div>
        <div class="big-date">${pad(q.day)} ${BULAN_SINGKAT[q.monthIdx]}</div>
      `;

      counter.appendChild(card);
      spinCounter.appendChild(counter);
      slot.appendChild(spinCounter);
      ring.appendChild(slot);
    });

    track.appendChild(ring);
  });
}

async function loadData() {
  try {
    const res = await fetch("/api/entries");
    if (!res.ok) throw new Error("bad response");
    const json = await res.json();
    state = json;
  } catch (e) {
    console.warn("Gagal ambil data live, pakai dummy.", e);
    state = DUMMY;
  }
  renderMemory();
  renderCarousel();
  quoteIdx = 0;
  renderRotatingQuote(); // langsung refresh quote begitu data asli kelar di-fetch, jangan nunggu interval 8 detik
}

tickClock();
setInterval(tickClock, 1000);

renderRotatingQuote(); // tampilin sesuatu duluan (dummy) sambil nunggu fetch pertama kelar
loadData();
setInterval(loadData, 5 * 60 * 1000); // refresh tiap 5 menit

setInterval(renderRotatingQuote, 8000);

// Ukur ulang orbit kalau jendela di-resize (radius & ukuran kartu ngikut layar).
let _resizeTO;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTO);
  _resizeTO = setTimeout(renderCarousel, 200);
});

// Auto-update buat PWA (biar yang ke-install di HP ikut ke-refresh sendiri
// tiap ada deploy baru di Vercel, tanpa perlu uninstall manual).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    // Cek versi baru tiap 15 menit (dan sekali pas halaman kebuka).
    reg.update();
    setInterval(() => reg.update(), 15 * 60 * 1000);
  }).catch(() => {});

  // Begitu service worker baru mengambil alih, muat ulang halaman sekali
  // biar langsung pakai file terbaru. Flag 'refreshing' cegah reload berulang.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
