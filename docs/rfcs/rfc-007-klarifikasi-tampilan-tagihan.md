# RFC-007: Klarifikasi Tampilan Tagihan — Berapa & Kapan + Saldo

**Status:** Accepted (2026-08-15)
**Author:** Hani (keputusan UX) + Hermes (dokumentasi)
**Date:** 2026-08-15
**Relates to:** RFC-005 (kosakata tegas), RFC-006 (ringkasan agregat)

## Problem Statement

Tampilan tagihan di bot wali & pengurus kurang tegas soal angka:

- Nominal tagihan tidak tampil jelas sebagai satu kesatuan.
- Kalau sudah bayar, wali tidak tahu **berapa** dan **kapan** dibayar.
- Kelebihan bayar ditampilkan sebagai "saldo lebih bayar" yang membingungkan.

## Keputusan

1. **Nominal jelas di kepala** setiap tagihan:
   `{Komponen} · {Periode} — Rp {nominal}`.
2. **SUDAH BAYAR** → `• Dibayar: Rp 150.000 (2026-09-01) + Rp 300.000 (2026-09-05)`
   (daftar tiap pembayaran: berapa + kapan).
3. **BAYAR SEBAGIAN** → `• Sudah dibayar: …` + `• Sisa: Rp … · Batas: …`.
4. **BELUM BAYAR** → `• Batas: …` (nominal sudah di kepala).
5. **Kelebihan bayar → "Saldo".** Dihitung dari tabel `lebih_bayar` (bukan kolom
   turunan — AGENTS.md), ditampilkan sebagai `Saldo: Rp …` di bagian bawah
   rincian santri. Istilah "saldo lebih bayar" dipakai di domain, label pengguna
   cukup "Saldo".

## Simulasi ulang

Basis data pengembangan di-reset (`npm run db:ulang`) lalu disimulasikan dari
nol: terbitkan tagihan SPP bulan berjalan → satu santri bayar penuh → satu santri
bayar lebih (kelebihan jadi Saldo) — untuk memverifikasi tampilan akhir sebelum
dipakai data nyata. Skrip: `data/simulasi-ulang.ts` (gitignored, pola
`data/uji-keuangan.ts`).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (termasuk test formatter baru).
- Uji live dari HP: `/start` di kedua bot → tagihan menampilkan nominal, dan
  untuk yang lunas menampilkan berapa & kapan; saldo tampil sebagai `Saldo: Rp …`.
