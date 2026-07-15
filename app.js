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
    { day: 12, monthIdx: 6, year: 2025, text: "Hari biasa yang pengen aku ingat lama-lama." },
    { day: 14, monthIdx: 2, year: 2025, text: "ulang tahun ibu" },
    { day: 2, monthIdx: 1, year: 2025, text: "lari pagi pertama" },
    { day: 30, monthIdx: 8, year: 2025, text: "pindah kosan" },
    { day: 21, monthIdx: 0, year: 2025, text: "midnight movie" },
    { day: 3, monthIdx: 4, year: 2025, text: "senja di rooftop" },
    { day: 28, monthIdx: 3, year: 2025, text: "kopi & hujan deras" },
  ]
};

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

function renderMemory() {
  const t = state.throwback;
  if (!t) {
    document.getElementById("memDay").textContent = "";
    document.getElementById("memMonth").textContent = "";
    document.getElementById("memYear").textContent = "";
    document.getElementById("memoryText").textContent = "Belum ada catatan setahun lalu di tanggal ini.";
    return;
  }
  document.getElementById("memDay").textContent = pad(t.day);
  document.getElementById("memMonth").textContent = BULAN_SINGKAT[t.monthIdx];
  document.getElementById("memYear").textContent = t.year;
  document.getElementById("memoryText").textContent = `"${t.text}"`;
}

function renderRotatingQuote() {
  const el = document.getElementById("rotatingQuote");
  const list = state.quotes || [];
  if (!list.length) { el.textContent = ""; return; }
  el.classList.add("fade");
  setTimeout(() => {
    const q = list[quoteIdx % list.length];
    el.textContent = `"${q.text}"`;
    quoteIdx++;
    el.classList.remove("fade");
  }, 400);
}

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
