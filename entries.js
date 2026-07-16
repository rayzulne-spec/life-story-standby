// /api/entries
// Vercel serverless function — narik data dari Notion DB LIFE STORY buat layar Standby.
//
// Butuh env var:
//   NOTION_TOKEN         -> integration token yang sama dipakai bot Telegram
//   NOTION_DATABASE_ID   -> (opsional) default ke DB LIFE STORY yang sudah diketahui
//
// Catatan penting (baca sebelum ubah-ubah):
// - Format entri tahun 2025 dan sebelumnya: satu blok besar berisi banyak hari,
//   dipisah soft line-break, tiap baris diawali "DD Bulan YYYY" tanpa bold.
// - Format entri 2026 ke depan (dari bot.py sekarang): tiap hari = paragraph block
//   TERSENDIRI yang seluruh teksnya di-bold, isinya "Hari, DD Bulan YYYY".
// - Highlight/quote personal = block bertipe "quote" di Notion (lihat obrolan sama
//   Raymon: gak wajib pakai simbol ◈, cukup tipe block Quote).
// - Ini scan pages secara langsung tiap request (gak ada cache) — cukup buat skala
//   personal (~24 halaman bulan). Kalau kedepannya kerasa lambat, bisa ditambah
//   cache + webhook invalidation dari bot.

const NOTION_VERSION = "2022-06-28";
const DEFAULT_DATABASE_ID = "7db7fb5dac994d96b28d528d2192e820";

const BULAN_ID = ["januari","februari","maret","april","mei","juni","juli","agustus","september","oktober","november","desember"];

function envDatabaseId() {
  return process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE_ID;
}

async function notionApi(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

// Ambil jam sekarang di WIB (UTC+7). Server Vercel jalan di UTC, jadi cukup tambah 7 jam.
function nowJakarta() {
  const utc = new Date();
  return new Date(utc.getTime() + 7 * 60 * 60 * 1000);
}

async function listMonthPages() {
  const pages = [];
  let cursor = undefined;
  do {
    const body = await notionApi(`databases/${envDatabaseId()}/query`, {
      method: "POST",
      body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
    });
    for (const page of body.results) {
      const props = page.properties;
      const bulan = props?.Bulan?.title?.map(t => t.plain_text).join("") || "";
      const urutan = props?.Urutan?.number;
      pages.push({ id: page.id, bulan, urutan });
    }
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  // buang duplikat/kosong (konvensi project: Urutan >= 999 = duplikat/marker "belum ada catatan")
  return pages.filter(p => p.urutan === undefined || p.urutan === null || p.urutan < 999);
}

async function getBlockChildren(blockId) {
  const blocks = [];
  let cursor = undefined;
  do {
    const body = await notionApi(`blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    blocks.push(...body.results);
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function richTextPlain(richTextArr) {
  return (richTextArr || []).map(t => t.plain_text).join("");
}

function richTextAllBold(richTextArr) {
  if (!richTextArr || !richTextArr.length) return false;
  return richTextArr.every(t => t.annotations?.bold);
}

// Flatten blocks jadi list segmen { type, text, bold }, resolve synced_block secara rekursif.
//
// PENTING: buat synced_block, JANGAN manual redirect ke synced_block.synced_from.block_id.
// Notion API otomatis nge-resolve isi synced block kalau kita minta children dari ID
// synced_block itu sendiri (baik dia "original" maupun "reference copy") — manual redirect
// ke synced_from malah sering 404 karena block sumber aslinya belum tentu ke-share ke
// integration, walau salinannya di halaman ini udah ke-share.
async function flattenPageBlocks(pageId) {
  const top = await getBlockChildren(pageId);
  const out = [];
  for (const b of top) {
    if (b.type === "synced_block") {
      try {
        const children = await getBlockChildren(b.id);
        for (const c of children) {
          pushFlattened(out, c);
        }
      } catch (e) {
        console.warn("Gagal baca synced_block", b.id, e.message);
      }
    } else {
      pushFlattened(out, b);
    }
  }
  return out;
}

function pushFlattened(out, block) {
  const rt = block[block.type]?.rich_text;
  if (!rt) return;
  const text = richTextPlain(rt);
  if (!text.trim()) return;
  // block lama kadang nyimpen banyak hari dalam satu block, dipisah soft line-break ("\n")
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    out.push({
      type: block.type, // "paragraph" | "quote" | ...
      bold: richTextAllBold(rt) && lines.length === 1,
      text: line.trim(),
    });
  }
}

// Coba cocokin baris sebagai header tanggal. Return {day, monthIdx, year} atau null.
function parseDateHeader(seg) {
  const text = seg.text;
  // Format baru (2026+): bold, "Hari, DD Bulan YYYY"
  if (seg.bold) {
    const m = text.match(/^[A-Za-z]+,\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (m) return matchToDate(m);
  }
  // Format lama (2025 & sebelumnya): "DD Bulan YYYY" polos, tanpa nama hari, tanpa bold
  const m2 = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m2) return matchToDate(m2);
  return null;
}

function matchToDate(m) {
  const day = parseInt(m[1], 10);
  const monthIdx = BULAN_ID.indexOf(m[2].toLowerCase());
  const year = parseInt(m[3], 10);
  if (monthIdx === -1) return null;
  return { day, monthIdx, year };
}

// Susun segmen jadi array per-hari: { day, monthIdx, year, narrative, quotes: [] }
function segmentDays(segments) {
  const days = [];
  let current = null;
  for (const seg of segments) {
    const date = parseDateHeader(seg);
    if (date) {
      current = { ...date, narrative: "", quotes: [] };
      days.push(current);
      continue;
    }
    if (!current) continue; // teks sebelum header pertama, skip
    if (seg.type === "quote") {
      current.quotes.push(seg.text.replace(/^◈\s*/, "").trim());
    } else {
      current.narrative += (current.narrative ? " " : "") + seg.text;
    }
  }
  return days;
}

async function findThrowback(targetDay, targetMonthIdx, targetYear) {
  const pages = await listMonthPages();
  const targetLabel = `${capitalize(monthName(targetMonthIdx))} ${targetYear}`;
  const page = pages.find(p => p.bulan.trim().toLowerCase() === targetLabel.toLowerCase());
  if (!page) return null;

  const segments = await flattenPageBlocks(page.id);
  const days = segmentDays(segments);
  const found = days.find(d => d.day === targetDay && d.monthIdx === targetMonthIdx && d.year === targetYear);
  if (!found || !found.narrative) return null;
  return { day: found.day, monthIdx: found.monthIdx, year: found.year, text: found.narrative };
}

async function collectQuotes(maxPages = 24) {
  const pages = await listMonthPages();
  const quotes = [];
  for (const page of pages.slice(0, maxPages)) {
    try {
      const segments = await flattenPageBlocks(page.id);
      const days = segmentDays(segments);
      for (const d of days) {
        for (const q of d.quotes) {
          // FITUR 1: lampirkan 'narrative' = catatan full hari itu, biar frontend
          // bisa nampilin pop-up catatan lengkap pas quote-nya di-tap.
          quotes.push({ day: d.day, monthIdx: d.monthIdx, year: d.year, text: q, narrative: d.narrative });
        }
      }
    } catch (e) {
      // satu halaman gagal (misal format aneh) jangan sampe gagalin semua
      console.warn("Gagal parse halaman", page.bulan, e.message);
    }
  }
  return quotes;
}

function monthName(idx) { return BULAN_ID[idx]; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

module.exports = async (req, res) => {
  try {
    const now = nowJakarta();
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);

    const [throwbackResult, quotesResult] = await Promise.allSettled([
      findThrowback(lastYear.getDate(), lastYear.getMonth(), lastYear.getFullYear()),
      collectQuotes(),
    ]);

    if (throwbackResult.status === "rejected") console.error("findThrowback gagal:", throwbackResult.reason);
    if (quotesResult.status === "rejected") console.error("collectQuotes gagal:", quotesResult.reason);

    const throwback = throwbackResult.status === "fulfilled" ? throwbackResult.value : null;
    const quotes = quotesResult.status === "fulfilled" ? quotesResult.value : [];

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json({ throwback, quotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
