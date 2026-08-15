# RFC-004: Bot Wali — Status Tagihan Baca-Saja

**Status:** Accepted (2026-08-12)
**Author:** Hermes (atas permintaan Hani)
**Date:** 2026-08-12
**Relates to:** ADR 0005/0009/0010 (isolasi bot-wali), docs/04-onboarding.md, RFC-001/002 (pola menu tombol), RFC-003 (monitoring)

---

## Konteks

Hani ingin mencoba bot wali (`@rtq_annur_bot`, token P1 sudah valid). Kebutuhan pertama
yang cocok: **wali melihat status tagihan anaknya** — daftar tagihan, sisa, dan saldo
lebih bayar. Persis permukaan baca yang selama ini hanya bisa dilihat lewat spreadsheet.

`ADR 0009`/`0010` menetapkan: `apps/bot-wali` baca-saja, kecuali pengecualian sempit
`usulan_izin` (`ajukanIzin`/`batalkanIzin`). Uji coba ini **tidak membangun jalur izin**
sama sekali → bot-wali meng-import **nol handler tulis** (lebih ketat dari minimum ADR).

## Keputusan desain

1. **Baca-saja penuh.** Tidak ada satu pun handler tulis `core` yang di-import. Yang
   dipakai hanya: query baca + aturan murni `hitungKeringananEffektif`.
2. **Menu tombol** (pola RFC-002): `/start` → `📋 Tagihan anak` · `📊 Status bulan ini`
   → pemilih santri → rincian.
3. **Binding sementara (dev bootstrap):** `DEV_WALI_TELEGRAM_IDS` di `.env` memetakan ID
   Telegram ke wali **dengan tautan aktif terbanyak** di `wali_santri`. Penggantinya:
   tabel `pengguna_telegram` + deep link undangan (`docs/04`). Ini satu-satunya bagian
   yang "menebak" — ditandai jelas di kode.
4. **Data pribadi:** hanya nama santri + angka tagihan yang ditampilkan. Tidak ada NIK,
   NISN, alamat, nomor rekening (AGENTS.md).
5. **Duplikasi tampilan sementara:** logika status tagihan di bot-wali menyalin pola
   bot-internal. Catatan refactor: saat `pengguna_telegram` + repo views dibangun, pindah
   ke `packages/core` agar tidak ada dua sumber format.

## Scope

### In scope
- `apps/bot-wali/src/index.ts`: `/start`, menu `📋 Tagihan anak` & `📊 Status bulan ini`,
  pemilih santri, rincian per anak (daftar tagihan + sisa + saldo lebih bayar)
- `npm run bot:wali` + `DEV_WALI_TELEGRAM_IDS` di `.env`

### Out of scope — keputusan eksplisit
| Hal | Alasan | Kapan dievaluasi |
|---|---|---|
| Alur izin absen wali (`usulan_izin`) | Butuh ADR 0009 handler + layar tombol docs/08 | RFC tersendiri |
| Undangan deep link `/start <kode>` | Butuh tabel `pengguna_telegram` | Bersama tabel tersebut |
| Notifikasi wali (tagihan terbit, H-5) | Terpisah; butuh worker | Saat worker dibangun |

## Verifikasi

- `npm run build && npm run lint && npm test` hijau
- Uji live dari HP: buka `@rtq_annur_bot` → `/start` → menu → `📋 Tagihan anak` → pilih
  anak → daftar tagihan + sisa; `📊 Status bulan ini` → status anak bulan berjalan
- Bot menolak ID Telegram di luar `DEV_WALI_TELEGRAM_IDS`

---

## Decision Log

| Tanggal | Keputusan | Pemicu | Oleh |
|---|---|---|---|
| 2026-08-12 | Accepted. Baca-saja penuh; menu tombol; binding dev via `DEV_WALI_TELEGRAM_IDS` | Hani ingin mencoba bot wali untuk status tagihan | Hani |
