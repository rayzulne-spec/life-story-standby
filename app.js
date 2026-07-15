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

    // Pivot = titik pusat orbit buat kartu ini. Tiap kartu boleh punya pusat
    // sedikit beda (--cx/--cy) biar orbitnya gak semua muter di titik yang
    // persis sama — kesannya lebih kayak medan kartu yang saling tumpang tindih.
    const pivot = document.createElement("div");
    pivot.className = "orbit-pivot";
    const cx = 40 + (i % 3) * 15; // 40–70%
    const cy = 25 + (i % 4) * 18; // 25–79%
    const radius = 260 + (i % 4) * 110; // 260–590px, tiap "lane" beda jarak dari pusat
    const dur = 28 + ((i * 9) % 26); // 28–54s, tiap kartu beda kecepatan
    const dir = i % 2 === 0 ? "normal" : "reverse"; // separo muter searah jarum jam, separo kebalik
    const delay = -((i * dur) / 5); // biar langsung rame gak nunggu satu putaran penuh
    const tilt = (i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 4);

    pivot.style.setProperty("--cx", cx + "%");
    pivot.style.setProperty("--cy", cy + "%");
    pivot.style.setProperty("--dur", `${dur}s`);
    pivot.style.setProperty("--delay", `${delay}s`);
    pivot.style.setProperty("--dir", dir);

    const card = document.createElement("div");
    card.className = "mem-card";
    const w = 220 + (i % 3) * 40;
    const h = 150 + (i % 2) * 60;
    card.style.width = w + "px";
    card.style.height = h + "px";
    card.style.background = `linear-gradient(160deg, ${c1}, ${c2})`;
    card.style.setProperty("--radius", radius + "px");
    card.style.setProperty("--dur", `${dur}s`);
    card.style.setProperty("--delay", `${delay}s`);
    card.style.setProperty("--dir", dir);
    card.style.setProperty("--tilt", `${tilt}deg`);
    card.innerHTML = `
      <div class="cap">${q.text.length > 28 ? q.text.slice(0, 26) + "…" : q.text}</div>
      <div class="big-date">${pad(q.day)} ${BULAN_SINGKAT[q.monthIdx]}</div>
    `;
    pivot.appendChild(card);
    track.appendChild(pivot);
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
