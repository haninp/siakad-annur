# RFC-001: Bot Internal Minimal untuk Uji Coba Keuangan

**Status:** Accepted (2026-08-12)
**Author:** Hermes (atas permintaan Hani)
**Date:** 2026-08-12
**Relates to:** TUGAS P1 (token bot Telegram), Fase 1 (OLTP keuangan), ADR 0009/0010

---

## Keputusan yang diminta

Setujui scope bot-internal minimal (4 perintah, whitelist ID, long-polling) sebagai
prasyarat uji coba keuangan via Telegram. Kalau tidak disetujui, sebutkan apa yang
harus ditambah/dikurangi.

## Konteks singkat

- **P1 terpenuhi**: token valid — `@pengurus_rtq_annur_bot` (internal), `@rtq_annur_bot` (wali).
- **Fase 1 selesai**: keuangan OLTP teruji (280 test hijau; alur terbit tagihan → cicilan →
  keringanan → lunas → lebih bayar sudah didemo di atas basis data pengembangan).
- **Tapi belum ada bot**: `apps/bot-internal` & `apps/bot-wali` masih kerangka kosong,
  `packages/bot` cuma stub (`export const PAKET`), grammY belum terpasang.
- Tujuan RFC ini: buka gerbang **uji coba lapangan** — pengurus mencoba alur keuangan dari HP.

## Opsi

| # | Opsi | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|---|
| A | Bot minimal: grammY long-polling, 4 perintah, whitelist ID | Cepat (1 sesi), langsung uji coba, izin tetap di `core` | Bukan produk final; perintah akan berkembang | **Direkomendasikan** |
| B | Bot lengkap (semua fitur + bot-wali + worker) | Sekali jadi | Besar, menunda uji coba berbulan-bulan | Ditolak |
| C | Uji tanpa bot (script CLI) | Sudah terbukti jalan | Bukan uji coba lapangan; pengurus tidak bisa pegang | Ditolak |

## Scope

### In scope
- Pasang grammY; isi `packages/bot` dengan kerangka minimal (`buatBot` + muat env)
- `apps/bot-internal/src/index.ts` — long-polling, 4 perintah:
  - `/start` — sapa + cek whitelist
  - `/tagihan <nis|nama> <periode>` — terbitkan tagihan SPP (panggil `terbitkanTagihan`)
  - `/bayar <id-tagihan> <nominal>` — catat pembayaran (panggil `catatPembayaran`)
  - `/status [nis|nama]` — tagihan aktif + saldo lebih bayar (baca repo)
- **Whitelist admin**: `ADMIN_TELEGRAM_IDS` (comma-separated) di `.env` — semua perintah
  selain `/start` ditolak di luar whitelist
- Aktor peran `pengurus` (tabel `pengguna_telegram` belum ada — menyusul di RFC lain)
- Pesan substantif sesuai AGENTS.md (nama entitas, bukan ID; tanpa stack trace)

### Out of scope — keputusan eksplisit
| Hal | Alasan ditinggalkan | Kapan dievaluasi lagi |
|---|---|---|
| bot-wali, worker, Sheets publish | Bukan tujuan uji coba keuangan ini | Saat Fase 2 / P2 |
| Tabel `pengguna_telegram` + auth per-peran | Butuh desain tersendiri; whitelist cukup untuk uji coba | Sebelum dipakai pengurus lain |
| Notifikasi, reminder, irama pesan | Terpisah dari alur tulis | Saat bot-wali dibangun |
| Handler keuangan lain (keringanan, PROTA, lebih bayar via bot) | Bisa ditambah setelah 4 perintah dasar jalan | Iterasi berikutnya |

## Dampak jika salah

Bot publik tanpa whitelist = siapa pun bisa menerbitkan tagihan karangan atas nama
pesantren. Mitigasi: whitelist ketat sejak hari pertama, perintah tulis hanya 2
(`/tagihan`, `/bayar`), dan semua tetap lewat `buatHandlerKeuangan` (izin di `core`).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau
- Bot jalan (long-polling) di mesin ini; `/start` dari ID whitelist diterima, dari luar ditolak
- Satu siklus nyata dari HP: `/tagihan` → `/bayar` → `/status` menunjukkan sisa yang benar

## Deadline

Segera — RFC ini satu-satunya yang memblokir uji coba lapangan keuangan.

---

## Decision Log

| Tanggal | Keputusan | Pemicu | Oleh |
|---|---|---|---|
| 2026-08-12 | Accepted. Whitelist admin = ID Telegram Hani (144666620). `/bayar` diubah: alih-alih `id-tagihan`, memakai `<nis> <nominal>` terhadap tagihan `terbit` terbaru — id tagihan (ULID) tidak bisa diketik dari HP | Uji coba lapangan | Hani |
| 2026-08-12 | Implemented — build + lint + 280 test hijau; bot berjalan (long-polling) | — | Hermes |
