# Handoff 0015 — RFC-014 Peran Bendahara (SELESAI)

Tanggal: 2026-08-18
Status: **selesai** — seluruh item "Yang tersisa" di bawah sudah dikerjakan,
build + lint + 392 test hijau, ter-deploy & ter-push.

## Yang tersisa (urutan pengerjaan) — status

1. `packages/core/src/index.ts` — tambah `export * from './laporan.js';` ✅
2. `packages/core/src/laporan.test.ts` ✅ — 8 test: izin (wali ditolak,
   bendahara/pengurus/admin boleh), periode bukan `YYYY-MM` ditolak, periode
   kosong menampilkan komponen aktif dengan nol, angka agregat benar (2 komponen,
   3 tagihan + 2 pembayaran → per komponen & ringkasan 2026-08; isolasi periode
   2026-07).
3. `apps/bot-internal/src/index.ts` ✅
   - `peranUntuk(id)` → 'admin' | 'bendahara' | undefined (env); `adminAktif`
     memakainya; `aktorBot(ctx)` = peran AKTUAL (bukan hardcoded).
   - Gate menu: `menuUtama(peran)` menyembunyikan ✉️ Undangan untuk bendahara;
     menu keuangan memuat `📊 Laporan keuangan` (callback `keu:laporan`, periode
     berjalan) untuk kedua peran.
   - Perintah `/laporan [YYYY-MM]` (tanpa arg = bulan berjalan); tampilan
     substantif rupiah bertitik, sisa negatif dijelaskan sebagai lebih bayar.
   - Guard perintah admin-only: `/terbitkan /undang /bayar /setujui` →
     bendahara ditolak di bot; semua panggilan core (undangan, kalender,
     verifikasi/tolak usulan, catat pembayaran) memakai `aktorBot` sehingga core
     menegakkan peran aktual.
4. `docs/02-roles-matrix.md` ✅ — kolom bendahara + baris baru (baca laporan,
   verifikasi usulan, pantau status; minus hak admin) + catatan bahwa "catat
   pembayaran" bendahara hanya lewat alur verifikasi (RFC-008).
5. Ritual ✅ — STATE.md 1.19, commit `feat(core): peran bendahara — laporan
   keuangan (RFC-014)`, deploy (restart bot-internal), push ke GitHub.

## Yang menunggu

- **Uji live RFC-014 via Telegram** — lihat "Sedang dikerjakan" di STATE.md:
  coba dengan ID bendahara dummy di `BENDAHARA_TELEGRAM_IDS`, bandingkan
  `/laporan` dengan `/rekap`+`/piutang`.
- **Smoke test RFC-013** via Telegram (reconfirmation `/start <kode>`) masih
  terbuka.
- **Catatan pengerjaan**: bot `keu:santri`/`/status` tetap terbuka untuk
  bendahara (baca piutang per individu — bagian dari pantau status). Core
  `catatPembayaran` memang mengizinkan peran bendahara (dipakai alur verifikasi
  RFC-008); jalur MANUAL (`/bayar`) di-gate khusus admin di bot — keputusan
  RFC-014 butir 1 dipertahankan di lapisan kanal, penegak peran tetap core.