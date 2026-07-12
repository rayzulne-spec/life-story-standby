# LIFE STORY — Standby

Layar standby (landscape, buat HP yang didirikan di stand) untuk LIFE STORY. Front-end statis (`index.html` / `style.css` / `app.js`) + satu serverless function (`api/entries.js`) yang narik data asli dari Notion "DB LIFE STORY".

## Isi folder

- `index.html`, `style.css`, `app.js` — tampilan Standby (4 elemen: kenangan setahun lalu, quotes berputar, jam & tanggal, carousel kartu)
- `manifest.json`, `icon.svg`, `sw.js` — biar halaman ini bisa di-"Add to Home Screen" di HP kayak app beneran
- `api/entries.js` — serverless function yang ambil data dari Notion (API key aman, gak kebuka ke publik)
- `.env.example` — daftar environment variable yang perlu diisi di Vercel

## Cara deploy (pola sama kayak bot: push ke GitHub, auto-deploy)

1. **Bikin repo GitHub baru** (misal `life-story-standby`), upload semua file di folder ini ke repo itu.
2. **Buka [vercel.com](https://vercel.com)**, login pakai akun yang sama/baru, klik "Add New Project", pilih repo `life-story-standby` tadi.
3. Waktu setup project, **jangan ubah apa-apa** di build settings (Vercel otomatis detect: file statis di root + folder `api/` jadi serverless function).
4. Di step **Environment Variables**, isi:
   - `NOTION_TOKEN` = integration token Notion yang sama dipakai bot Telegram (yang di Railway env var)
   - `NOTION_DATABASE_ID` = `7db7fb5dac994d96b28d528d2192e820` (opsional, ini udah jadi default kalau gak diisi)
5. Klik **Deploy**. Tunggu sampai selesai, nanti dapet URL kayak `life-story-standby.vercel.app`.
6. **Penting:** integration Notion yang tokennya dipakai harus sudah "Connect" ke database "DB LIFE STORY" (biasanya kalau bot udah bisa baca/tulis ke situ, berarti udah connect — gak perlu setup ulang).

## Cara pajang di HP

1. Buka URL Vercel-nya di Chrome/Safari HP.
2. Menu browser > **Add to Home Screen** / **Install app**.
3. Buka dari ikon di home screen (bukan dari browser tab) — otomatis fullscreen tanpa address bar.
4. Puter HP ke landscape, taruh di stand/dock.

Catatan: web/PWA belum bisa jamin layar HP nyala terus-terusan (itu urusan pengaturan HP masing-masing, biasanya di-charge + disable "auto lock" atau pakai fitur "Always On Display" HP). Ini bisa dibahas belakangan kalau kerasa perlu.

## Yang masih perlu ditest & kemungkinan perlu diperbaiki

- **Parsing tanggal**: logic baca entri lama (2025, format polos tanpa bold) dan format baru (2026, bold "Hari, DD Bulan YYYY") sudah ditulis, tapi baru diuji dari 1-2 contoh, belum semua bulan. Kalau "kenangan setahun lalu" tampil kosong padahal seharusnya ada, kemungkinan ada variasi format yang belum ke-cover — kabarin aku contoh entrinya, aku sesuaikan regex-nya.
- **Quotes/carousel** narik dari semua block bertipe Quote di semua halaman bulan (gak wajib simbol ◈, sesuai kesepakatan). Kalau belum ada satupun entri yang dikurasi pakai block Quote, bagian ini bakal kosong — front-end otomatis fallback ke data dummy biar gak polos putih.
- **Belum ada webhook refresh** dari bot Telegram — untuk sekarang, halaman refresh data sendiri tiap 5 menit. Kalau mau instan refresh begitu nulis entri baru, itu langkah lanjutan (nambah endpoint kecil yang dipanggil bot.py setelah nyimpen ke Notion).
- **Ikon PWA** masih placeholder SVG sederhana, belum final — gampang diganti kapan aja.

## Webhook refresh (belum diimplementasi, rencana ke depan)

Idenya: bot.py, setelah berhasil nyimpen entri ke Notion, kirim request kecil ke endpoint di project ini (misal `/api/ping`) yang cuma nge-set flag "ada update baru". Front-end bisa polling flag itu tiap beberapa detik buat tau kapan harus fetch ulang lebih cepat dari 5 menit. Ini optional — kasih tau kalau mau langsung dikerjain sekarang atau nanti aja setelah versi dasar ini jalan dan dicoba dulu.
