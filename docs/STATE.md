# STATE — kondisi terkini

> Diperbarui di akhir setiap sesi. Berkas ini yang dibaca lebih dulu oleh agent berikutnya,
> apa pun mereknya. STATE yang basi lebih berbahaya daripada tidak ada, karena ia dipercaya.

**Terakhir diperbarui:** 8 Agustus 2026

---

## Yang baru selesai

Fase 0 tugas **0.1 – 0.8**, seluruhnya sudah di-commit:

- **0.1–0.2** Struktur monorepo final (7 paket + 3 aplikasi), npm workspaces, TypeScript
  project references, eslint, prettier, vitest. `build`, `lint`, `test` hijau; **0 kerentanan**
- **0.3** `AGENTS.md` sebagai sumber instruksi tunggal; `CLAUDE.md` dan `.opencode/AGENTS.md`
  hanya penunjuk. Uji-hapus `.claude/` sudah dijalankan dan **lolos**
- **0.4** `docs/STATE.md`, `docs/TUGAS.md`, skrip `npm run mulai` + `npm run selesai`
- **0.5** `docs/00-overview` … `05-agent-boundary`
- **0.6** Tujuh ADR: SQLite+DuckDB, OLAP+SCD2, batas agent, kalender, dua bot, portabilitas,
  dua jenis Sheet
- **0.7** `skills/siakad-domain` dan `skills/agent-handoff` ditulis lengkap; sebelas skill
  lain diberi penanda `RANCANGAN`
- **0.8** File 03 dibaca dan dibandingkan dengan 04 → hasilnya di `docs/06-migrasi-legacy.md`

## Sedang dikerjakan

Tidak ada. Sesi berhenti di batas tugas yang bersih.

## Langkah berikutnya

**Ambil 0.10** — `packages/contracts`, bagian **identitas, wali, dan akademik**. Bagian
keuangan menunggu 0.9, tapi sisanya tidak perlu menunggu siapa pun.

Bentuk tabelnya sudah pasti dan tinggal diterjemahkan ke zod + DDL:

- Identitas & wali → `docs/01-domain-model.md` bagian "Identitas"
- Akademik → plan Bagian 12 "Kerangka tabel" (sudah lengkap sampai nama kolom)
- Rujukan statis `quran_surah` dan `quran_juz_batas` — data publik, bisa di-seed sekarang

Tugas `[berat]`. Kalau model yang tersedia terbatas, kerjakan bagian rujukan statis dulu.

## Keputusan yang menggantung

1. **P3 — sesi dengan pemegang pengetahuan keuangan.** Draf `docs/06-migrasi-legacy.md`
   sudah ditulis; yang tersisa **tujuh pertanyaan di ujung dokumen**. Ini memblokir bagian
   keuangan pada `contracts`, dan hanya itu.
2. **Perlindungan data**: bentuk persetujuan wali, retensi data alumni, akses wali setelah
   santri keluar, penanggung jawab data.
3. **Akademik**: daftar mapel per jalur & marhalah, skala nilai diniyah, aspek akhlak,
   hari & jam KBM. **Tidak memblokir** — keempatnya tabel seed, diisi lewat Sheet Pola.

## Temuan penting dari pembacaan data lama

- **Kerusakan bertambah antar generasi**: file 03 punya 4.775 sel rusak, file 04 punya
  5.269 (+10%). Setiap tahun ajaran mewarisi kerusakan lama lalu menambah yang baru.
- **Peralihan skema periode terkonfirmasi**: file 03 murni Hijriah (12 periode); file 04
  memuat keduanya, dengan skema Masehi 15 periode (April 2026 – Juni 2027). Peralihan
  terjadi pada generasi 04.
- **TAYSIR, Lebih Bayar, dan Biaya PKBM hanya ada di 04** — artinya aturannya masih
  terbentuk, bukan mapan. Justru itu yang perlu ditanyakan di sesi P3.
- **Yang bertahan lintas generasi** (PROTA, keringanan, cicilan, NISN, kontrol empat mata,
  dua jalur pengajar) aman dijadikan skema.

## Yang perlu diketahui

- **Rencana lengkap sekarang ada di dalam repo**: `docs/RENCANA.md`. Sebelumnya hanya hidup
  di `~/.claude/plans/`, yang melanggar ADR 0006 — pengetahuan tidak boleh tinggal di
  direktori khusus satu vendor. Bila RENCANA.md berbeda dengan `docs/00`–`06` atau
  `docs/adr/`, **yang terakhir yang berlaku**; RENCANA.md dokumen asal, bukan sumber kebenaran.
- **Akademik adalah lahan kosong** — tidak ada sistem akademik di Drive. Dirancang dari
  awal, bukan dimigrasikan.
- Prasyarat eksternal lain (token bot, service account, PDF kalender Kemenag, akun LLM)
  belum disiapkan, tapi **tidak ada yang menghambat Fase 0**.

## Jebakan yang ditemukan

- **Tiap generasi berkas keuangan mulai dari nol.** File 04 praktis tidak membawa data 2025
  (1 tanggal) sementara file 03 punya 422. Berhentinya sebuah berkas dipakai untuk entri
  baru **tidak** membuatnya usang sebagai sumber riwayat. Cakupan impor adalah **rantai
  berkas** (01, 02, 03, 04), bukan berkas terakhir — dan butuh deduplikasi lewat
  `No Transaksi`. Berkas 01 dan 02 belum diperiksa; itu tugas **0.8b**.

- `vitest` 2.x membawa 5 kerentanan (1 kritis) lewat vite/esbuild. Sudah dinaikkan ke 4.x.
  **Jangan turunkan kembali.**
- Ekspor Google Sheets lewat MCP **tidak membawa nama sheet** dan bersifat parsial pada
  berkas besar. Tabel harus dipetakan lewat header, dan angka hasil hitungan atasnya
  menunjukkan struktur — bukan agregat bisnis. Beberapa sheet (`MutasiBSI`, `HALAQOH`)
  terlihat di pencarian tapi tidak di isi ekspor.
- Node 26 menjalankan TypeScript tanpa flag; `--experimental-strip-types` tidak diperlukan.
