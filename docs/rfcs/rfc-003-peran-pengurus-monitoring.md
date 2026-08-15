# RFC-003: Peran Pengurus = Monitoring; Penerbitan Tagihan = Back Office

**Status:** Accepted (2026-08-12)
**Author:** Hani (keputusan domain) + Hermes (dokumentasi)
**Date:** 2026-08-12
**Relates to:** RFC-001/002 (bot internal), docs/02-roles-matrix.md, TUGAS P3

---

## Konteks

Klarifikasi langsung dari pemilik domain (Hani), 12 Agustus 2026:

> "Untuk pengeluaran invoice santri itu dilakukan back office, bukan pengurus triggernya.
> Pengurus hanya bantu cek dan monitoring status pembayaran santri, baik secara individual
> maupun kolektif. Pengurus dapat melihat status piutang pembayaran bulanan dan kontrol
> siapa yang sudah dan belum bayar."

RFC-001/002 menaruh `terbitkanTagihan` di menu bot pengurus — itu keliru menurut domain.

## Keputusan

1. **Penerbitan tagihan (invoice) = pekerjaan back office.** Jalurnya: script bulanan
   `npm run tagihan:terbitkan` (nanti menjadi cron di `apps/worker`). Tidak ada tombol
   "Terbitkan SPP" di menu pengurus.
2. **Peran pengurus = monitoring keuangan:**
   - Status pembayaran **individual** (per santri)
   - Rekap **kolektif**: siapa sudah / belum bayar pada bulan berjalan
   - **Piutang bulanan** + total outstanding
3. **Pencatatan pembayaran = back office** (admin / worker). Selaras dengan kalimat
   "pengurus hanya cek dan monitoring". Selama uji coba, `/bayar` tetap ada sebagai
   perintah admin-only.
4. **Keringanan & PROTA tetap wewenang pengurus** (sesi P3: "keringanan murni kebijakan
   pengurus") — tidak berubah.
5. `docs/02-roles-matrix.md` diperbarui: baris "Terbitkan tagihan, catat pembayaran"
   menjadi admin-only; ditambah baris "Pantau status pembayaran & piutang" untuk pengurus.

## Scope

### In scope
- `packages/core`: `terbitkanTagihanBulanan` (batch, idempoten) + test
- `scripts/terbitkan-tagihan-bulanan.ts` + `npm run tagihan:terbitkan` — jalur back office
- Bot internal: menu berubah → `📋 Status santri` · `📊 Rekap bulan ini` · `💰 Piutang`;
  perintah `/terbitkan` (admin-only) untuk trigger back office dari HP; `/tagihan` dihapus

### Out of scope — keputusan eksplisit
| Hal | Alasan | Kapan dievaluasi |
|---|---|---|
| Cron otomatis di worker | Worker belum dibangun; script manual = bentuk back office sekarang | Saat worker dibangun |
| Rekap lintas periode / filter | Cukup bulan berjalan untuk uji coba | Iterasi berikutnya |
| Peran `pengguna_telegram` (admin vs pengurus nyata) | Tabel belum ada; whitelist ID sementara | RFC tersendiri |

## Verifikasi

- `npm run build && npm run lint && npm test` hijau (termasuk test baru `keuangan-batch`)
- Bot: menu tidak lagi memuat "Terbitkan SPP"; rekap & piutang tampil benar
- `npm run tagihan:terbitkan` idempoten — dua kali jalan, baris tagihan tidak dobel

---

## Decision Log

| Tanggal | Keputusan | Pemicu | Oleh |
|---|---|---|---|
| 2026-08-12 | Accepted. Penerbitan tagihan → back office; pengurus = monitoring (individual, kolektif, piutang); catat pembayaran admin-only sementara | Klarifikasi domain dari Hani | Hani |
