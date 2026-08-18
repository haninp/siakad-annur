# Handoff 0014 — Deploy RFC-013 (perlindungan data tampilan)

Tanggal: 2026-08-18
Status: selesai

## Yang dilakukan

1. Backup DB dev sebelum intervensi: `data/cadangan/siakad-20260818T015708.db`
2. Menghentikan ketiga bot (bot-wali, bot-internal, worker) — mereka memegang
   berkas SQLite dengan mode WAL.
3. Bangun ulang DB dev dari nol: `npm run db:ulang` + `node data/simulasi-ulang.ts`
   — kini memuat alias kunyah/panggilan untuk 4 wali dummy (RFC-013) dan 8 santri.
   Catatan: state uji sebelumnya (undangan bekas, registrasi tele) ter-reset —
   wajar untuk DB pengembangan, bukan data sungguhan.
4. Nyalakan kembali ketiga bot dengan dist baru (memuat alur reconfirmation
   RFC-013 dan formatNamaTampil).

## Alasan

RFC-013 butuh data alias di dev agar uji live daftar wali (`/undang`) menampilkan
kunyah + pembeda NIS anak, dan alur reconfirmation aktif di `/start <kode>`.

## Yang perlu diketahui agent berikutnya

- Bot berjalan di luar Docker (daemon python di `/opt/data/scripts/`), bukan
  container — Docker belum diuji untuk produksi.
- DB dev sekarang bersih; undangan apa pun yang dibuat setelah ini adalah yang
  berlaku.