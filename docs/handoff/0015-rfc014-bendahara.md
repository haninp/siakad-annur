# Handoff 0015 — RFC-014 Peran Bendahara (dalam pengerjaan)

Tanggal: 2026-08-18 (malam)
Status: **BELUM selesai** — sesi dihentikan atas permintaan Hani ("sudah malam").
WIP sudah di-commit & di-push: **`28aadbf`** di `main` (build + lint + 384 test
hijau).

## Yang sudah dikerjakan

1. `docs/rfcs/rfc-014-peran-bendahara.md` — spec disetujui: bendahara = peran
   mandiri (baca laporan keuangan + verifikasi/tolak usulan pembayaran; BUKAN
   admin). Penetapan via env (`BENDAHARA_TELEGRAM_IDS`), `pengguna_telegram`
   sebagai sumber kebenaran masa depan (catatan, bukan dibangun).
2. `packages/db/src/repository/repo-laporan.ts` — agregat SQL: per komponen
   (terbit, masuk) + ringkasan; sudah di-export via `repository/index.ts`.
3. `packages/core/src/laporan.ts` — `buatHandlerLaporan` → `bacaLaporanKeuangan`
   (izin bendahara/pengurus, validasi periode, merangkai `sisa`).
   **Belum di-export di `core/src/index.ts`.**
4. Build hijau (tsc) dengan ketiga berkas.

## Yang tersisa (urutan pengerjaan)

1. `packages/core/src/index.ts` — tambah `export * from './laporan.js';`
2. Test: `packages/core/src/laporan.test.ts` (izin: wali ditolak, bendahara/
   pengurus boleh; periode invalid; angka agregat benar — seed tagihan +
   pembayaran) — pola test core lain (`:memory:`, `jalankanMigrasi`).
3. `apps/bot-internal/src/index.ts`:
   - `peranUntuk(id)` → 'admin' | 'bendahara' | undefined dari env
   - gate menu per peran: Undangan + tool admin → admin/pengurus saja;
     `📊 Laporan keuangan` (callback `keu:laporan`) + perintah
     `/laporan [YYYY-MM]` → bendahara/pengurus/admin
   - aktor memakai peran aktual saat memanggil core
4. `docs/02-roles-matrix.md` — baris bendahara.
5. Ritual: `npm run selesai`, update `docs/STATE.md` (1.19), commit
   `feat(core): peran bendahara — laporan keuangan (RFC-014)`, deploy (restart
   bot-internal), push ke GitHub.

## Catatan

- Verifikasi pembayaran (RFC-008) SUDAH ada dan gate core-nya sudah
  `bendahara/pengurus` — bagian ini hanya perlu penyempurnaan menu/gate bot.
- WIP sengaja TIDAK di-commit (satu tugas = satu commit hijau; tugas belum
  tuntas). Berkas baru additive, build tetap hijau.