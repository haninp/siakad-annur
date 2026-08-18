# RFC-014: Peran Bendahara — Laporan Keuangan & Verifikasi Pembayaran

**Status:** Accepted (2026-08-18)
**Author:** Hani (keputusan) + Hermes (dokumentasi)
**Date:** 2026-08-18
**Relates to:** RFC-008 (verifikasi pembayaran), docs/02 (matriks peran), `pengguna_telegram` (RFC-009)

## Problem Statement

Peran `bendahara` sudah ada di tipe `Peran` dan dipakai alur verifikasi
(RFC-008), tetapi di bot internal ia diperlakukan sebagai **admin kedua**
(`adminAktif` = admin ∪ bendahara): akses ke semua menu tanpa pembedaan.
Bendahara belum punya peran mandiri — dan tidak ada **laporan keuangan**
terstruktur yang bisa dibacanya (yang ada baru rekap/piutang per komponen
yang dihitung ad hoc di bot).

## Keputusan

1. **Bendahara = peran mandiri**, bukan admin. Hak:
   - **Baca laporan keuangan** (laporan penerimaan per periode + piutang).
   - **Verifikasi / tolak usulan pembayaran** wali (alur RFC-008, dipertahankan).
   - TIDAK boleh: menerbitkan tagihan, membuat/mencabut undangan wali,
     menyetujui kalender hijriah, mencatat pembayaran manual.
2. **Penetapan peran**: `BENDAHARA_TELEGRAM_IDS` (env, eksisting) → peran
   `bendahara`; `ADMIN_TELEGRAM_IDS` → `admin`. `pengguna_telegram` (kolom
   `peran`) tetap sumber kebenaran masa depan untuk semua peran — dicatat,
   tidak dibangun sekarang.
3. **Laporan keuangan = handler di core.** `bacaLaporanKeuangan({ aktor,
   periode })`: agregat **dihitung di SQL** (AGENTS.md: angka dari SQL) lewat
   `repoLaporan` baru di `packages/db` — per komponen biaya aktif: tagihan
   terbit, uang masuk terverifikasi, sisa (= terbit − masuk, boleh negatif
   bila lebih bayar); plus ringkasan total. Izin: `bendahara`/`pengurus`
   (admin selalu cukup).
4. **Bot internal**: pemetaan `peranUntuk(telegramId)` dari env; menu & tombol
   digate per peran (menu Undangan/tool admin khusus admin+pengurus; Laporan
   keuangan + Usulan pembayaran untuk bendahara+pengurus). Handler core tetap
   penegak izin terakhir — gate bot hanya menyembunyikan tombol.
5. **Format tampil laporan**: substantif (AGENTS.md) — nama komponen terbaca,
   rupiah dengan titik, tanpa nama tabel/kode galat.

## Skema

**Tidak ada migrasi baru.** Laporan dibaca dari tabel eksisting
(`komponen_biaya`, `tagihan`, `pembayaran`). `pembayaran` hanya berisi uang
yang sudah terverifikasi — jadi "masuk" = `SUM(pembayaran.nominal)` per
periode sudah benar secara akrual.

## Peta implementasi

- `packages/db` — `repoLaporan(db)`: `laporanPerKomponen(periode)` +
  `ringkasan(periode)` (SQL agregat) + test.
- `packages/core` — `laporan.ts`: `buatHandlerLaporan` →
  `bacaLaporanKeuangan` (izin + validasi periode + merangkai) + test.
- `apps/bot-internal` — `peranUntuk(id)`; gate menu per peran; menu
  `📊 Laporan keuangan` (callback `keu:laporan`) + perintah `/laporan
  [YYYY-MM]`; aktor memakai peran aktual saat memanggil core.
- `docs/02-roles-matrix.md` — baris bendahara (baca laporan, verifikasi;
  minus hak admin).
- Test: izin (wali ditolak, bendahara/pengurus boleh), periode tidak valid,
  angka agregat benar (seed tagihan + pembayaran → per komponen & ringkasan).

## Out of scope

- Penetapan peran via `pengguna_telegram` (migrasi dari env ke tabel) —
  menyusul bersama pengelolaan pengguna.
- Laporan lintas periode / laporan kas keluar / laporan per wali —
  kebutuhan domain menyusul.
- Ekspor laporan ke Google Sheets (P2).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau.
- Uji live: ID bendahara di `.env` → menu bot internal menampilkan
  `📊 Laporan keuangan` + `💳 Usulan pembayaran`, tanpa menu Undangan;
  `/laporan` menampilkan angka yang cocok dengan `/rekap`+`/piutang`;
  admin tetap bisa semua menu.

## Amendemen (2026-08-18)

Keputusan butir 1 ("Bendahara TIDAK boleh menerbitkan tagihan") diamendemen
oleh pemilik domain: **`/terbitkan` (penerbitan tagihan SPP bulanan, back
office) adalah urusan keuangan → tersedia bagi bendahara**, di samping admin.
Ketentuan lain butir 1 (undangan, kalender hijriah, catat pembayaran manual
tetap tidak boleh) tidak berubah. Matriks di `docs/02` diperbarui; ini
mengembalikan kendali penerbitan ke finansial tanpa memberi hak admin lain.
