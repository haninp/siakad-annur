# RFC-012: Reminder Worker — Kalender Hijriah & Jatuh Tempo Tagihan

**Status:** Accepted (2026-08-16)
**Author:** Hani (kebutuhan) + Hermes (dokumentasi)
**Date:** 2026-08-16
**Relates to:** RFC-011 (loop worker), handoff 0013 (reminder kalender hijriah), ADR 0013

## Problem Statement

Dua pengingat proaktif belum ada, padahal keduanya mencegah masalah yang
berbeda:

1. **Kalender Hijriah** — baris kalender hasil myQuran berstatus `provisional`
   dan wajib diverifikasi pengurus (ADR 0013), terutama 3 bulan isbat. Tanpa
   pengingat, bulan baru bisa terlewat tanpa persetujuan. Handoff 0013
   menggantung karena P1 (token) belum ada — sekarang sudah terpenuhi dan
   `apps/worker` sudah menjadi daemon (RFC-011).
2. **Jatuh tempo tagihan** — wali hanya tahu tagihan saat terbit (RFC-011);
   tidak ada pengingat mendekati batas bayar. Wali yang lupa bisa melewati
   jatuh tempo.

## Alur

```
Worker (tiap 60 dtk, satu loop menjalankan 3 job):

A. Kalender hijriah (handoff 0013):
   1. Cari baris provisional yang BELUM diingatkan dan akan dimulai
      dalam 3 hari ke depan
   2. Kirim ke pengurus (ADMIN_TELEGRAM_IDS):
      "🕌 Bulan {nama} {tahun} H dimulai {tanggal}. Data masih provisional —
       verifikasi: /setujui {tahun}-{bulan}"
   3. Tandai diingatkan_pada (migrasi 9) — tidak berulang tiap putaran
   4. Pengurus membalas /setujui {tahun}-{bulan} di bot internal
      → setujuiBulanHijriah (core, sudah ada) → provisional=0

B. Jatuh tempo tagihan:
   1. Cari tagihan 'terbit' yang jatuh temponya H-3 atau H-1 dari hari ini
   2. Kirim ke wali TERDAFTAR anak tsb:
      "⏰ Jatuh tempo {H-3|H-1}: Tagihan {komponen} {periode} untuk {nama}
       Rp X. Batas bayar {tanggal}. Bayar via @rtq_annur_bot"
   3. Tandai di tabel notifikasi_jatuh_tempo (tahap h3 / h1) — masing-masing
      sekali, tidak berulang
```

## Keputusan

1. **Satu loop worker, tiga job** (RFC-011 + A + B). Interval tetap 60 dtk;
   masing-masing job idempoten lewat jejaknya sendiri.
2. **Jejak reminder hijriah**: kolom `diingatkan_pada` di `kalender_hijriah`
   (migrasi 9, ALTER). Baris yang sudah diingatkan tidak diingatkan lagi
   sampai disetujui/diubah sumbernya (reset persetujuan = reset juga
   `diingatkan_pada`, dilakukan `simpan`/`perbarui`).
3. **Jejak reminder jatuh tempo**: tabel `notifikasi_jatuh_tempo`
   (tagihan_id, tahap 'h3'|'h1', dikirim_pada), PK gabungan — tahap h3 dan h1
   masing-masing dikirim tepat sekali.
4. **Hanya wali terdaftar yang menerima** (pengguna_telegram, pola RFC-011).
   Tagihan tanpa wali terdaftar TIDAK ditandai — terkirim begitu wali daftar
   (asal masih dalam jendela H-3/H-1).
5. **`/setujui {tahun}-{bulan}` di bot internal** (admin) memakai
   `setujuiBulanHijriah` yang SUDAH ada di core — tidak ada logika izin baru.
6. **Pesan substantif** (konvensi repo): sebut nama bulan/tahun atau komponen/
   periode/nominal/batas, dan arahkan ke bot wali atau perintah /setujui.

## Skema (migrasi 9)

```sql
ALTER TABLE kalender_hijriah ADD COLUMN diingatkan_pada TEXT;

CREATE TABLE notifikasi_jatuh_tempo (
  tagihan_id   TEXT NOT NULL REFERENCES tagihan(id),
  tahap        TEXT NOT NULL CHECK (tahap IN ('h3','h1')),
  dikirim_pada TEXT NOT NULL,
  PRIMARY KEY (tagihan_id, tahap)
) STRICT;
```

## Out of scope

- Persetujuan otomatis kalender (tetap manual — ADR 0013: keputusan manusia).
- Reminder H-7 / jam-jam terakhir — jendela H-3/H-1 cukup untuk tahap ini.
- Grup Telegram pengurus (P6) — reminder dikirim ke ADMIN_TELEGRAM_IDS.

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (repo + core reminder).
- Uji live: worker berjalan; `/hijriah:periksa` melihat bulan provisional;
  reminder muncul ≤60 dtk setelah jendela 3 hari; `/setujui` menghilangkan
  baris dari daftar provisional; tagihan jatuh tempo H-3/H-1 mengirim ke wali
  terdaftar dan tidak mengirim dua kali.
