# RFC-015: Perombakan Peran & Pengelolaan User oleh Superadmin

**Status:** Draft — keputusan pemilik domain (2026-08-18); menunggu konfirmasi sebelum
implementasi.
**Author:** Hani (keputusan) + Hermes (dokumentasi)
**Date:** 2026-08-18
**Relates to:** RFC-014 (bendahara), RFC-009 (undangan wali, `pengguna_telegram`), docs/02
(matriks peran), `pengguna_telegram.peran` (contracts)

---

## Problem Statement

1. **Peran tidak mencerminkan kebutuhan rill.** Nama `pengurus` ambigu (harusnya
   **admin**); peran pengendali tertinggi tidak tegas (harusnya **superadmin**);
   **penerbitan tagihan** (urusan keuangan) berada di admin/pengurus padahal
   seharusnya **bendahara**; peran **wali santri** tidak eksplisit.
2. **Tidak ada pengelolaan user.** User internal (bendahara, pengajar, admin) saat ini
   didaftarkan manual via env (`*_TELEGRAM_IDS`). Tidak ada alur bagi superadmin untuk
   mengundang/memindahkan peran user — padahal sudah ada pola yang terbukti: **undangan
   wali** (RFC-009).

## Keputusan

### A. Rombak peran (5 peran)

| Peran | Keterangan | Sumber penetapan |
|---|---|---|
| `superadmin` | Pengelola sistem & data master; **tertinggi** (pengganti `admin` lama) | `.env` (`SUPERADMIN_TELEGRAM_IDS`) |
| `admin` | Eks `pengurus`; pantau, arahkan, keputusan, kelola master | undangan user |
| `bendahara` | Keuangan: **terbitkan tagihan**, laporan, verifikasi pembayaran | undangan user |
| `pengajar` | Isi data akademik santri | undangan user |
| `wali` | Pantau data & tagihan anaknya sendiri | alur undangan wali (RFC-009) |

- `superadmin` **selalu lolos** semua gate (`peranCukup` pada `aktor.ts`).
- **Terbitkan tagihan** (`/terbitkan` & `terbitkanTagihan`) → **bendahara**
  (superadmin tetap bisa).
- **Catat pembayaran manual** (`/bayar`) → superadmin/admin (TIDAK bendahara).
- Pemetaan env: `ADMIN_TELEGRAM_IDS` → `SUPERADMIN_TELEGRAM_IDS` (bootstrap 2 ID);
  peran lain via undangan user, bukan env.

### B. Mekanisme superadmin (2 orang)

**Rekomendasi: tetap via `.env`** (`SUPERADMIN_TELEGRAM_IDS`, dipisah koma). Alasan:
- Superadmin = **trust root / control plane**. Ia satu-satunya yang berhak mengangkat
  superadmin. Menetapkannya di luar mekanisme sistem menghapus seluruh risiko
  **privilege-escalation lewat kode** (kode undangan short-lived yang bocor tidak akan
  pernah bisa mengangkat jadi superadmin).
- 2 orang saja → `footprint minimal`, transparan (terlihat di `.env`), mudah di-audit.
- Menambah superadmin = edit `.env` + restart bot. Ritual sederhana, tercatat di handoff.
- **Opsional (P2, di luar scope awal):** migrasi ke `pengguna_telegram` dengan guard
  "hanya superadmin yang menambah superadmin" bila suatu saat butuh pengelolaan dinamis.
  Sampai saat itu, `.env` adalah sumber kebenaran superadmin.

### C. Fitur pengelolaan user superadmin (undangan berbasis role)

Konsep menyalin alur undangan wali (RFC-009), bedanya tertaut **role**, bukan `wali_id`.

**Alur superadmin:**
1. `📋 Kelola user` (menu superadmin) → pilih *undang user*.
2. Pilih **role**: admin · bendahara · pengajar.
3. Sistem membuat **kode sekali pakai** + **deep link** `https://t.me/pengurus_rtq_annur_bot?start=<kode>`.
4. Superadmin kirim link ke calon user (WA/chat).
5. Calon user buka link → Telegram → `/start <kode>` di **bot internal** → sistem
   minta konfirmasi (peran yang akan didapat) → **terdaftar di `pengguna_telegram`**
   dengan role tsb + `telegram_id` → langsung dapat akses menu sesuai peran.

**Manajemen:** daftar undangan user yang menunggu, tombol cabut (revoke), anti-hijack
(satu kode = satu `telegram_id`; kode bekas/cabut memberi pesan berbeda).

**Pengamanan:**
- Kode **sekali pakai**, ada masa berlaku (sesuai `undangan` eksis).
- **Role `superadmin` TIDAK bisa diundang** — hanya via `.env`.
- Konfirmasi sebelum claim agar user tahu peran yang didaftarkan.

## Skema (migrasi)

Baru: tabel **`undangan_user`** (meniru `undangan`, tanpa relasi `wali`, ada kolom role):

```
undangan_user(
  id, role TEXT CHECK(role IN ('admin','bendahara','pengajar')),
  kode TEXT UNIQUE NOT NULL, dibuat_oleh TEXT, dibuat_pada,
  dipakai_oleh TEXT NULL, dipakai_pada TEXT NULL,
  dicabut_pada TEXT NULL
)
```

Pakai `pengguna_telegram` yang sudah ada (kolom `peran` enum diperbarui ke 5 peran).
Tidak ada perubahan pada `undangan` (wali).

## Peta implementasi

### Persiapan (rombak peran)
1. `packages/core/src/aktor.ts` — `Peran` = `'superadmin'|'admin'|'bendahara'|'pengajar'|'wali'`;
   `peranCukup`: superadmin selalu cukup.
2. `packages/contracts` — enum `PeranPenggunaTelegram` disesuaikan ke 5 peran.
3. Semua handler core: `'admin'`→`'superadmin'`, `'pengurus'`→`'admin'`,
   terbitkan tagihan → `bendahara`; catat manual → superadmin/admin.
4. `env` — rename + `.env` (2 superadmin); deploy script & `peranUntuk` di bot.
5. `docs/02` matriks + menu/gate bot ikut 5 peran.
6. Perbarui seluruh test yang menyentuh nama peran.

### Development (pengelolaan user superadmin)
7. `packages/db` — `repoUndanganUser` + migrasi tabel `undangan_user` + test.
8. `packages/core` — `undangan-user.ts`: `buatUndanganUser` (superadmin),
   `daftarUndanganUser` (superadmin), `cabutUndanganUser` (superadmin),
   `gunakanUndanganUser` (mandiri, anti-hijack, konfirmasi role) + test.
9. `apps/bot-internal` — menu `📋 Kelola user` (superadmin): pilih role → buat kode →
   daftar menunggu → cabut; alur `/start <kode>` claim (role) untuk calon user.
10. `docs/02`, handoff, STATE.

## Verifikasi
- `npm run build && npm run lint && npm test` hijau (jumlah test bertambah).
- Smoke test: superadmin undang bendahara → kode → orang itu daftar ber-peran
  bendahara & dapat menu bendahara (termasuk `/terbitkan`); admin (eks pengurus)
  dapat pantau+master; wali tetap via RFC-009; non-superadmin TIDAK bisa mengundang.

## Out of scope
- Pengelolaan **ganda** peran per orang (satu `pengguna_telegram` = satu peran) — bisa
  menyusul; kini satu user satu peran utama.
- Migrasi superadmin dari `.env` ke tabel (P2, opsional).
- Fitur akademik (Fase 2).

## Catatan untuk konfirmasi
- Konfirmasi perombakan peran di inti core (banyak test berubah).
- Konfirmasi `catat pembayaran manual` tetap superadmin/admin (bukan bendahara).
- Konfirmasi mekanisme superadmin via `.env` (rekomendasi di atas).
- Konfirmasi cakupan role undangan user: admin · bendahara · pengajar (superadmin tidak).
