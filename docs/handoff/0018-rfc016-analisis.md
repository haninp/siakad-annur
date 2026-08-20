# Handoff 0018 — RFC-016: Analisis Data Terpagar (lapisan deterministik)

Tanggal: 2026-08-20
Status: sebagian selesai (deterministik); LLM menyusul

## Yang dilakukan
1. **Tool analisis** (deterministik, tanpa LLM):
   - `ringkasan_laporan(periode)` — reuse `repoLaporan` (RFC-014).
   - `tren_pembayaran_spp(nis/santri, rentang)` — SQL `repoLaporan.trenSpp` baru.
   - `tren_absen_santri` **ditunda** — tabel absensi belum ada (Fase 2 akademik).
2. **Core** `analisis-chat.ts` → `buatHandlerAnalisis.analisisTool`: scope peran
   superadmin/admin/bendahara; validasi parameter zod; eksekusi → JSON (angka dari SQL).
3. **Audit**: tabel `analisis_log` (migrasi 10) + `repoAnalisisLog` — tiap permintaan
   tercatat (aktor, tool, parameter, hasil, waktu).
4. **Bot** `/analisis` (mode B): pilih tool via tombol → isi parameter → eksekusi → tampil.

## Menunggu
- **Lapisan LLM (rangkai kalimat)** — butuh `ZEN_BASE_URL` + `ZEN_API_KEY` (prasyarat P5 /
  ADR 0006) yang masih dikomentari di `.env`. Setelah key tersedia: hubungkan penyedia,
  sambungkan ke `analisisTool`, pasang **pemeriksa angka** (tolak jawaban berisi angka di
  luar JSON tool).
- Tool `tren_absen_santri` menyusul setelah skema absensi (Fase 2).

## Catatan
- Semua angka dari SQL; LLM (nanti) hanya merangkai; tulis DB dari LLM tetap dilarang.
- Changelog: commit berikut (fase deterministik RFC-016) + migrasi 10 diterapkan saat deploy.
