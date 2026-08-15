# RFC-006: Bot Wali — Ringkasan Agregat Semua Anak

**Status:** Accepted (2026-08-15)
**Author:** Hani (keputusan UX) + Hermes (dokumentasi)
**Date:** 2026-08-15
**Relates to:** RFC-004 (bot wali), RFC-005 (kosakata tegas)

## Problem Statement

Menu bot wali punya dua tombol yang tumpang tindih — `📋 Tagihan anak` dan
`📊 Status bulan ini` — padahal keduanya bermuara pada tampilan tagihan per
santri. Wali dengan beberapa anak harus menekan beberapa kali untuk melihat
kondisi semua anaknya.

## Keputusan

1. **Agregat dulu, detail kemudian.** `/start` (dan `menu:utama`) langsung
   menampilkan **ringkasan status bulan berjalan untuk SEMUA anak** di bawah
   wali: per anak, per komponen — `SUDAH BAYAR` / `BAYAR SEBAGIAN (sisa …)` /
   `BELUM BAYAR (nominal)` / `DIBATALKAN`.
2. **Satu tombol detail.** `📋 Detail tagihan` → pilih anak → rincian lengkap
   (daftar tagihan + jatuh tempo + pembayaran + saldo lebih bayar).
3. **Dua menu lama dihapus** (`menu:tagihan`, `menu:bulan` dan callback
   `tagihan:`, `bulan:`) — digabung jadi satu alur ringkasan → detail.
4. Tombol `🔄 Perbarui` menyegarkan ringkasan (data berubah tanpa harus
   keluar-masuk menu).

## Out of scope

- Keringanan / jatuh tempo di baris ringkasan (ada di detail per anak).
- Pemilih santri dengan pagination (data dev hanya 2 santri; data asli ±150
  santri akan butuh halaman — sama dengan catatan RFC-002).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau.
- Uji live dari HP: `/start` → ringkasan kedua anak tampil sekaligus →
  `📋 Detail tagihan` → pilih anak → rincian lengkap.
