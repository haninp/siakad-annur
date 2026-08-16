# Handoff — Bot reminder kalender_hijriah menunggu P1

## Latar belakang

Implementasi kalender_hijriah (ADR 0013) sudah selesai sampai core handler dan
script seed. Verifikasi bulanan oleh pengurus direncanakan sebagai:

1. Worker mengirim reminder ke grup pengurus saat sebuah bulan Hijriah akan
   dimulai.
2. Pengurus membalas perintah /setujui {tahun}-{bulan}.
3. Handler setujuiBulanHijriah di packages/core menandai baris
   kalender_hijriah.provisional = 0.

## Yang belum bisa dikerjakan

Bot reminder otomatis **belum diimplementasi** karena prasyarat P1
(token bot Telegram via @BotFather + username bot wali) belum tersedia.

> **Update 2026-08-16 (M3, RFC-011):** P1 sudah terpenuhi — kedua token bot
> ada dan aktif. `apps/worker` juga sudah menjadi daemon nyata (loop notifikasi
> tagihan terbit). Reminder kalender_hijriah tinggal menambahkan satu job di
> loop worker yang sama; pekerjaan ini menunggu giliran, tidak lagi diblokir.

Saat ini tersedia pengganti manual:

- npm run hijriah:isi      — seed/refresh dari myQuran API
- npm run hijriah:periksa  — cetak bulan yang masih provisional

## Jejak kode yang sudah siap

- packages/core/src/kalender-handler.ts :: setujuiBulanHijriah
- packages/db/src/repository/repo-kalender.ts :: tandaiSetuju
- apps/bot-internal/src/index.ts (aktif) dan apps/worker/src/index.ts (daemon aktif, RFC-011)

## Langkah lanjutan (setelah M3)

1. Tambahkan command /setujui di apps/bot-internal.
2. Tambahkan scheduled job di apps/worker untuk reminder awal bulan Hijriah
   (fondasi loop sudah ada sejak RFC-011).
3. Hapus handoff ini setelah bot reminder aktif.
