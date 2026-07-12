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

function renderCarousel() {
  const track = document.getElementById("carouselTrack");
  track.innerHTML = "";
  const list = state.quotes || [];
  list.forEach((q, i) => {
    const [c1, c2] = CARD_COLORS[i % CARD_COLORS.length];
    const card = document.createElement("div");
    card.className = "mem-card";
    const w = 220 + (i % 3) * 40;
    const h = 150 + (i % 2) * 60;
    card.style.width = w + "px";
    card.style.height = h + "px";
    card.style.background = `linear-gradient(160deg, ${c1}, ${c2})`;

    // Tiap kartu jalan di "lane" vertikal beda-beda, kecepatan & delay acak-ish,
    // biar orbitnya kerasa organik gak baris rapi/sinkron.
    const lanes = 4;
    const lane = i % lanes;
    card.style.top = (8 + lane * (78 / (lanes - 1))) + "%";
    const dur = 26 + ((i * 7) % 20); // 26–45s, tiap kartu beda kecepatan
    const delay = -((i * dur) / 6); // negatif = mulai di tengah animasi, biar langsung rame gak nunggu satu putaran
    const bob = (i % 2 === 0 ? -1 : 1) * (18 + (i % 3) * 10);
    card.style.setProperty("--dur", `${dur}s`);
    card.style.setProperty("--delay", `${delay}s`);
    card.style.setProperty("--bob", `${bob}px`);
    card.innerHTML = `
      <div class="cap">${q.text.length > 28 ? q.text.slice(0, 26) + "…" : q.text}</div>
      <div class="big-date">${pad(q.day)} ${BULAN_SINGKAT[q.monthIdx]}</div>
    `;
    track.appendChild(card);
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
}

tickClock();
setInterval(tickClock, 1000);

loadData();
setInterval(loadData, 5 * 60 * 1000); // refresh tiap 5 menit

renderRotatingQuote();
setInterval(renderRotatingQuote, 8000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
