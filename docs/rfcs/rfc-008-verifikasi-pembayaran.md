# RFC-008: Verifikasi Pembayaran — Usulan Wali, Konfirmasi Bendahara

**Status:** Accepted (2026-08-15)
**Author:** Hani (alur & keputusan) + Hermes (dokumentasi)
**Date:** 2026-08-15
**Relates to:** RFC-005 (kosakata), RFC-007 (tampilan tagihan), docs/02 (matriks peran)

## Problem Statement

Alur pembayaran saat ini: pengurus/back office langsung mencatat pembayaran —
tidak ada keterlibatan wali, tidak ada bukti, tidak ada verifikasi. Untuk
pembayaran sungguhan, pesantren butuh jejak: wali mengklaim membayar, bendahara
memastikan uang benar-benar masuk (bank/cash), baru uang dicatat dan status
wali berubah.

## Alur (keputusan Hani, 2026-08-15)

```
1. Wali melihat tagihan (jumlah + batas waktu)                    [sudah ada]
2. Wali KONFIRMASI pembayaran + lampirkan BUKTI (foto, via bot)
   - Pilih metode: transfer | cash | qris
   - Jika CASH → WAJIB menyebut nama penerima uang
3. Bot meneruskan bukti ke BENDARAHA (pengurus spesifik)
4. Bendahara cek ke akun bank / pastikan cash diterima   (offline)
5. Bendahara VERIFIKASI / TOLAK lewat bot (tolak wajib alasan)
6. Terverifikasi → uang masuk (akuntansi) + status wali BERUBAH
   Ditolak      → status kembali BELUM BAYAR + alasan wajib ke wali
```

## Keputusan

1. **Bendahara** = penerima & pemeriksa bukti (ID Telegram menyusul →
   `BENDAHARA_TELEGRAM_IDS` di `.env`, pola sama dengan admin). Peran
   `bendahara` ditambahkan ke `Aktor` di core.
2. **State usulan**: `diajukan` → `terverifikasi` | `ditolak`. Transisi
   dipaksakan di SQL (pola `usulan_izin`). `pembayaran` (kas) hanya terisi
   saat **terverifikasi** (accrual: tahapan tercatat, piutang turun saat kas
   masuk).
3. **Cash wajib nama penerima** — validasi di core, bukan di bot.
4. **Tolak wajib alasan** — `CHECK (status='ditolak') = (alasan_penolakan IS NOT NULL)`.
5. **Bukti TIDAK disimpan di disk** (keputusan Hani: mesin tidak terbebani).
   Cukup referensi `bukti_file_id` (Telegram) — bukti hidup di chat wali &
   forward ke bendahara.
6. **Google Drive ditunda.** Konvensi nama (saat Drive menyusul, file diunduh
   dari Telegram lalu di-upload): `BUKTI-PEMBAYARAN/{periode}/{NIS}-{tanggal_bayar}-{nominal}-{metode}.{ext}`
   → contoh `BUKTI-PEMBAYARAN/2026-08/2627001-2026-08-15-450000-transfer.jpg`.
   Builder `namaFileBukti` ada di core (dipakai nanti).
7. **`pengguna_telegram` dibangun sekarang** (prasyarat notifikasi push &
   pemetaan peran): telegram_id ↔ peran ↔ wali_id. Binding dev
   (`DEV_WALI_TELEGRAM_IDS`) tetap sebagai fallback sampai undangan dipakai.

## Skema

```sql
CREATE TABLE usulan_pembayaran (
  id                 TEXT PRIMARY KEY,
  tagihan_id         TEXT NOT NULL REFERENCES tagihan(id),
  wali_id            TEXT NOT NULL REFERENCES wali(id),
  santri_id          TEXT NOT NULL REFERENCES santri(id),
  nominal            INTEGER NOT NULL CHECK (nominal > 0),
  metode             TEXT NOT NULL CHECK (metode IN ('tunai','transfer','qris')),
  nama_penerima      TEXT,
  bukti_file_id      TEXT NOT NULL,
  bukti_tipe         TEXT NOT NULL,
  catatan            TEXT,
  status             TEXT NOT NULL CHECK (status IN ('diajukan','terverifikasi','ditolak')),
  diverifikasi_oleh  TEXT,
  diverifikasi_waktu TEXT,
  alasan_penolakan   TEXT,
  diajukan_pada      TEXT NOT NULL,
  CHECK ((status = 'ditolak') = (alasan_penolakan IS NOT NULL)),
  CHECK ((status = 'diajukan') = (diverifikasi_oleh IS NULL))
) STRICT;

CREATE TABLE pengguna_telegram (
  id             TEXT PRIMARY KEY,
  telegram_id    INTEGER UNIQUE,
  peran          TEXT NOT NULL CHECK (peran IN ('wali','bendahara','pengurus','pengajar','admin')),
  wali_id        TEXT REFERENCES wali(id),
  undangan_kode  TEXT UNIQUE,
  aktif          INTEGER NOT NULL CHECK (aktif IN (0,1)),
  dibuat_pada    TEXT NOT NULL
) STRICT;
```

## Akuntansi (accrual)

- Tagihan terbit → piutang diakui (sudah ada).
- Usulan `diajukan` → tercatat sebagai klaim; **belum** menyentuh kas/saldo.
- `terverifikasi` → `catatPembayaran` dijalankan: kas masuk, piutang turun,
  status wali berubah. Saldo/lebih bayar hanya dari pembayaran terverifikasi.

## Out of scope

- Simpanan bukti di disk/Drive (ditunda; hanya file_id Telegram).
- Notifikasi push terjadwal (apps/worker) — menyusul; notifikasi transaksional
  (verifikasi/tolak) sudah dikirim bot langsung.
- Undangan penuh (generate kode + binding) — tabel & kolom siap; alur `/start
  <kode>` menyusul bersama worker.

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (termasuk test
  pembayaran-verifikasi).
- Uji live: wali submit bukti → bendahara terima forward + tombol → verifikasi
  → status wali berubah; tolak → alasan sampai ke wali, status kembali BELUM BAYAR.
