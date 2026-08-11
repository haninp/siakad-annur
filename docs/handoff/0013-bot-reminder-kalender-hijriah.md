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

Saat ini tersedia pengganti manual:

- npm run hijriah:isi      — seed/refresh dari myQuran API
- npm run hijriah:periksa  — cetak bulan yang masih provisional

## Jejak kode yang sudah siap

- packages/core/src/kalender-handler.ts :: setujuiBulanHijriah
- packages/db/src/repository/repo-kalender.ts :: tandaiSetuju
- apps/bot-internal/src/index.ts dan apps/worker/src/index.ts masih stub

## Langkah lanjutan setelah P1

1. Tambahkan command /setujui di apps/bot-internal.
2. Tambahkan scheduled job di apps/worker untuk reminder awal bulan Hijriah.
3. Hapus handoff ini setelah bot reminder aktif.
