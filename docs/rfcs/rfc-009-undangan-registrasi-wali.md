# RFC-009: Undangan & Registrasi Wali (pengguna_telegram)

**Status:** Accepted (2026-08-16)
**Author:** Hani (alur) + Hermes (dokumentasi)
**Date:** 2026-08-16
**Relates to:** RFC-008 (pengguna_telegram dibuat), ADR 0005 (izin di core), docs/02 (matriks peran)

## Problem Statement

Wali asli belum bisa mendaftar ke bot wali — satu-satunya cara terikat adalah
menyunting `DEV_WALI_BINDING` di `.env`, yang berarti campur tangan developer
untuk tiap wali. Uji coba lapangan nyata butuh alur mandiri: pengurus membuat
undangan, wali memakainya sendiri, tanpa menyentuh kode atau konfigurasi.

Tabel `pengguna_telegram` (RFC-008, migrasi 6) sudah ada beserta repository
dasarnya — yang belum ada adalah alur undangan itu sendiri.

## Alur

```
1. Pengurus (bot internal)  /undang → pilih wali dari daftar
2. Core membuat kode sekali pakai:  undang-XXXXXX
   → baris pengguna_telegram baru: peran='wali', wali_id, undangan_kode, aktif=1
3. Bot menampilkan LINK UNDANGAN penuh:
   https://t.me/rtq_annur_bot?start=undang-XXXXXX
4. Pengurus meneruskan link ke wali (WhatsApp/chat apa pun)
5. Wali MENGETUK link → Telegram terbuka → bot menerima /start undang-XXXXXX
   (deep link otomatis; tidak ada yang perlu diketik)
6. Core menghubungkan telegram_id ke baris undangan → kode hangus (NULL)
7. Wali langsung melihat ringkasan tagihan anaknya
```

## Keputusan

1. **`pengguna_telegram` menjadi sumber kebenaran binding wali.** `waliUntuk()`
   di bot wali membaca tabel ini lebih dulu. `DEV_WALI_BINDING` tetap sebagai
   fallback pengembangan — berguna sampai seluruh wali nyata terdaftar, dan
   tidak memblokir siapa pun yang sudah terdaftar lewat undangan.
2. **Izin & validasi hidup di `packages/core`** (AGENTS.md: izin hanya di core):
   - `buatUndangan` — aktor admin/pengurus; wali tujuan harus ada, belum
     terdaftar (telegram_id terisi), dan belum punya undangan yang masih berlaku.
   - `gunakanUndangan` — alur mandiri wali (tidak butuh peran): kode harus ada,
     aktif, belum dipakai; **telegram_id pengirim tidak boleh sudah terdaftar**
     di akun aktif lain (anti-hijack).
3. **Kode sekali pakai dipaksakan di SQL** (pola `usulan_izin`/`usulan_pembayaran`):
   `UPDATE pengguna_telegram SET telegram_id=?, undangan_kode=NULL
    WHERE id=? AND undangan_kode=? AND aktif=1 AND telegram_id IS NULL`.
   Dua proses tidak bisa memakai kode yang sama; kode bekas otomatis tidak cocok.
4. **Format kode**: `undang-` + 6 karakter alfanumerik (mis. `undang-K7Q2M9`),
   dihasilkan `crypto.randomBytes` — cukup untuk puluhan wali, mudah diketik
   dari HP.
5. **Peran lain tidak masuk alur ini.** Admin/bendahara/pengurus tetap lewat
   whitelist env (`ADMIN_TELEGRAM_IDS`, `BENDAHARA_TELEGRAM_IDS`) sampai ada
   kebutuhan nyata.
6. **Deep link Telegram (amandemen 2026-08-16).** Bot internal menampilkan
   link penuh `https://t.me/<bot-wali>?start=<kode>` — wali tidak perlu
   mengetik apa pun, cukup mengetuk link dari WhatsApp/chat apa pun; Telegram
   terbuka dan otomatis mengirim `/start <kode>` ke bot wali. Payload `start`
   hanya berisi kode (alfanumerik + `-`, aman di bawah batas 64 karakter);
   handler `/start <kode>` di bot wali tidak berubah sama sekali.

## Skema

Tidak ada migrasi baru — memakai `pengguna_telegram` dari RFC-008:

```sql
CREATE TABLE pengguna_telegram (
  id             TEXT PRIMARY KEY,
  telegram_id    INTEGER UNIQUE,          -- NULL sampai wali memakai kode
  peran          TEXT NOT NULL CHECK (peran IN ('wali','bendahara','pengurus','pengajar','admin')),
  wali_id        TEXT REFERENCES wali(id),
  undangan_kode  TEXT UNIQUE,             -- NULL setelah dipakai
  aktif          INTEGER NOT NULL CHECK (aktif IN (0,1)),
  dibuat_pada    TEXT NOT NULL
) STRICT;
```

## Pesan ke pengguna (substantif, bukan teknis)

- Wali belum terdaftar tanpa kode: *"Akun Anda belum terdaftar sebagai wali.
  Minta kode undangan ke pengurus, lalu kirim /start <kode>."*
- Kode salah/bekas: *"Kode undangan tidak dikenal atau sudah dipakai. Minta kode
  baru ke pengurus."*
- Telegram sudah terdaftar: *"Nomor Telegram ini sudah terdaftar untuk wali
  lain. Hubungi pengurus bila ini keliru."*

## Out of scope

- Undangan untuk peran selain wali (bendahara/pengurus tetap env whitelist).
- Membatalkan undangan, daftar undangan yang belum dipakai, ekspira kode.
- Notifikasi push terjadwal (apps/worker) — tetap M3; undangan adalah
  prasyaratnya (wali terdaftar = punya telegram_id untuk dikirimi pesan).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (test repo pengguna_telegram
  + test handler undangan di core).
- Uji live: pengurus `/undang` → pilih wali dummy → dapat kode; dari HP kirim
  `/start <kode>` ke @rtq_annur_bot → terdaftar dan langsung melihat ringkasan;
  kode yang sama ditolak saat dipakai kedua kali.
