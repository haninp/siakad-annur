# RFC-005: Kosakata Status Tegas & Hirarki Menu Pengurus

**Status:** Accepted (2026-08-12)
**Author:** Hani (keputusan UX) + Hermes (dokumentasi)
**Date:** 2026-08-12
**Relates to:** RFC-001/002/003/004 (bot), docs/02-roles-matrix.md

---

## Konteks

Dua masukan UX dari Hani setelah uji coba pertama:

1. **Bot wali — kata-kata kurang tegas.** Label lama (`lunas`, `sisa Rp X`) diganti
   kosakata tegas: `SUDAH BAYAR` / `BELUM BAYAR` / `BAYAR SEBAGIAN` / `DIBATALKAN`,
   lengkap dengan detail:
   - Sudah bayar → **berapa** total dan **kapan** lunas
   - Belum bayar → **berapa** nominal dan **kapan batas waktu** (jatuh tempo)
2. **Bot internal — hirarki menu.** Fitur SPP/pembayaran jangan di menu utama;
   pengurus akan punya banyak fitur (pengelolaan dll). Struktur:
   `Keuangan → Santri → SPP / Uang Modul / Uang Gedung` (+ Rekap & Piutang di bawah
   Keuangan). Daftar komponen diambil dinamis dari `komponen_biaya`.

## Keputusan

1. **Kosakata status = aturan domain, hidup di `packages/core`** (`statusPembayaran`,
   pure function + test). Kedua bot memakainya — tidak ada dua sumber format.
   Dihitung dari transaksi (AGENTS.md: angka turunan tidak disimpan).
2. **"Proses verifikasi" tidak dibuat sekarang** — skema `pembayaran` belum punya
   kolom verifikasi; state itu muncul saat fitur verifikasi mutasi bank dibangun
   (matriks peran: "Verifikasi mutasi bank — pemeriksa kedua"). Tercatat, bukan dilupakan.
3. **Hirarki menu bot internal:**
   ```
   Menu Utama → 💰 Keuangan
     ├── 👤 Santri → (pilih komponen: SPP/Uang Modul/Uang Gedung) → pilih santri → rincian
     ├── 📊 Rekap bulan ini → (pilih komponen) → rekap kolektif
     └── 💰 Piutang → (pilih komponen) → piutang per santri
   ```
   Komponen di-generate dari `komponen_biaya` aktif — saat komponen baru ditambahkan,
   menu ikut tanpa ubah kode.
4. Perintah teks `/status <nis>` tetap ada (fallback), memakai kosakata yang sama.

## Scope

### In scope
- `packages/core`: `statusPembayaran` + `hitungPotongan` (reuse `hitungKeringananEffektif`) + test
- `apps/bot-wali`: label tegas + detail (total & tanggal bayar / jatuh tempo)
- `apps/bot-internal`: hirarki menu Keuangan → Santri → komponen → santri; rekap &
  piutang per komponen

### Out of scope — keputusan eksplisit
| Hal | Alasan | Kapan dievaluasi |
|---|---|---|
| State "proses verifikasi" | Skema belum punya kolom verifikasi | Bersama fitur verifikasi mutasi bank |
| Akademik / pengelolaan di menu utama | Belum dibangun; hirarki siap menampung | Fase 2 |

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (termasuk test `status-pembayaran`)
- Bot wali: tagihan menampilkan SUDAH BAYAR/BELUM BAYAR + detail nominal/tanggal/batas
- Bot internal: navigasi Menu Utama → Keuangan → Santri → SPP → santri → rincian

---

## Decision Log

| Tanggal | Keputusan | Pemicu | Oleh |
|---|---|---|---|
| 2026-08-12 | Accepted. Kosakata tegas di core; hirarki Keuangan→Santri→komponen; verifikasi ditunda | Uji coba bot wali & pengurus | Hani |
