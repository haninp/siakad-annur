# RFC-011: Worker Notifikasi Tagihan Terbit

**Status:** Accepted (2026-08-16)
**Author:** Hani (kebutuhan) + Hermes (dokumentasi)
**Date:** 2026-08-16
**Relates to:** RFC-009 (pengguna_telegram — wali terdaftar), RFC-003 (tagihan = back office), docs/02

## Problem Statement

Wali hanya melihat tagihan bila ia **membuka bot sendiri**. Padahal langkah
pertama alur pembayaran yang disepakati adalah wali DIBERITAHU tagihannya
(jumlah + batas waktu) — baru ia membayar. Tanpa notifikasi proaktif, wali
yang tidak membuka bot bisa melewatkan jatuh tempo, dan pengurus harus
mengingatkan manual satu per satu.

Prasyaratnya sudah ada sejak M2: `pengguna_telegram` memetakan wali →
`telegram_id` (daftar via link undangan). `apps/worker` masih skeleton.

## Alur

```
1. Back office menerbitkan tagihan (npm run tagihan:terbitkan / /terbitkan)
2. Worker (apps/worker) memeriksa berkala — tiap 60 detik:
   tagihan status 'terbit' yang belum pernah dinotifikasi
3. Untuk tiap tagihan: cari wali terdaftar anak tsb (pengguna_telegram)
4. Kirim pesan ke tiap wali via bot wali (@rtq_annur_bot):
   "📋 Tagihan SPP Bulanan — 2026-08 untuk {nama santri}
    Rp 450.000
    Batas bayar: 2026-09-10
    Bayar lewat bot: @rtq_annur_bot"
5. Tandai tagihan sudah dinotifikasi (tabel notifikasi_terbit)
```

## Keputusan

1. **Worker = proses terpisah `apps/worker`** (sesuai peta repo: snapshot,
   publikasi, backup, notifikasi), long-running dengan interval (default
   60 dtk), `--sekali` untuk satu putaran (uji). Nanti dinaikkan ke Docker
   bersama bot.
2. **Jejak notifikasi di tabel `notifikasi_terbit`** (migrasi 8): `tagihan_id`
   PK → `tagihan`, `dikirim_pada`. SENG AJA tidak menambah kolom ke `tagihan`
   — entitas tagihan dipakai banyak pihak; tabel jejak terpisah tidak mengubah
   bentuk data existing dan lebih mudah diaudit ("kapan notif ini dikirim").
3. **Idempoten & anti-spam**: tagihan yang sudah ada baris di
   `notifikasi_terbit` dilewati. INSERT OR IGNORE.
4. **Hanya wali TERDAFTAR yang menerima** (pengguna_telegram, peran wali,
   aktif, `telegram_id` terisi). Wali yang belum daftar TIDAK membuat tagihan
   ditandai — begitu wali mendaftar (M2), tagihan yang masih terbit langsung
   dinotifikasi pada putaran berikutnya. Ini juga memudahkan uji: daftar dulu,
   tagihan lama pun terkirim.
5. **Pesan substantif, kosakata tegas** (konvensi repo): sebut komponen,
   periode, nama santri, nominal, batas bayar, dan arahkan ke bot wali.
   Format disusun di `packages/core` (`teksNotifikasiTagihan`) — satu sumber,
   bisa diuji.
6. **Batch logic di `packages/core`** (`kirimNotifikasiTerbit`), pola sama
   dengan `terbitkanTagihanBulanan`: worker hanya menyediakan fungsi kirim
   (fetch Telegram) dan interval. Izin/aturan tidak menyebar ke worker.
7. **Kirim gagal tidak menggagalkan batch**: error per penerima dicatat di
   log; tagihan tetap ditandai setelah putaran (duplikat lebih buruk daripada
   notif yang terlewat satu penerima). Tagihan dengan **nol penerima** tidak
   ditandai (menunggu wali daftar).

## Skema (migrasi 8)

```sql
CREATE TABLE notifikasi_terbit (
  tagihan_id   TEXT PRIMARY KEY REFERENCES tagihan(id),
  dikirim_pada TEXT NOT NULL
) STRICT;
```

## Out of scope

- Reminder jatuh tempo (H-3/H-1) — menyusul di atas worker yang sama.
- Reminder kalender_hijriah ke pengurus (handoff 0013) — P1 sudah terpenuhi;
  menunggu giliran, worker jadi fondasinya.
- Notifikasi ke WhatsApp/email — Telegram saja (input harian lewat Telegram).
- Snapshot/publikasi/backup worker — tugas lain di `apps/worker` yang sama.

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (repo `notifikasi_terbit`
  + core `kirimNotifikasiTerbit`).
- Uji live: terbitkan tagihan → daftarkan wali dummy via undangan (M2) →
  dalam ≤60 dtk wali menerima notifikasi tagihan di @rtq_annur_bot; tagihan
  tidak dinotifikasi ulang.
