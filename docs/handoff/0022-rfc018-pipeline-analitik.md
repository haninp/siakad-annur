# Handoff 0022 — RFC-018: Pipeline Analitik (bronze/silver/gold)

Tanggal: 2026-08-24 · Status: **Fase 1 & Fase 2 (verifikasi konsistensi) SELESAI**; Fase 3 (cutover) menunggu.

## Fase 1 — SELESAI (implementasi & teruji)
`packages/analytics` (sebelumnya stub) kini nyata:
- `bronze.ts` — snapshot OLTP(SQLite)→Parquet. Fakta (`tagihan`,`pembayaran`,`absensi`)
  ditulis per `snapshot=<..>` (append lintas run, tak menimpa), partisi `periode`/`_periode`.
  Mutable (`santri`,`pengajar`,`komponen_biaya`,`tarif_komponen`,`rombel`,`pendaftaran`,
  `tahun_ajaran`,`kalender_hijriah`) → snapshot harian `mutasi/<t>/<snap>/data_0.parquet`.
- `silver.ts` — DuckDB file `data/db/analitik.duckdb`: `fact_tagihan`, `fact_pembayaran`,
  `fact_absensi`, `dim_komponen_biaya`, `dim_santri` (SCD2 dari `pendaftaran` vs `tahun_ajaran`).
  Tabel kosong dibuat dengan tipe eksplisit (bukan dihapus).
- `gold.ts` — mart view: `mart_ringkasan`, `mart_ringkasan_total`, `mart_tren_spp`,
  `mart_tren_absen` (padan definisi `repoLaporan`/`repoAbsensi`), + fungsi query gold.
- `pipeline.ts` — orkestrator `jalankanPipelineAnalitik`. npm `analisis:pipa` (runner
  `scripts/pipeline-analitik.ts`).
- Dep: **`@duckdb/node-api`** (paket `duckdb` v1.4.4 gagal install di Node 26/ABI147; node-gyp
  compile gagal). Produksi via Docker (Node LTS punya prebuild). API: `run()` / `runAndReadAll()`
  + `getRowObjectsJson()`, `closeSync()`, `create(path,{access_mode:'read_only'})`.
- Test: `analytics.test.ts` (4) + total hijau **426**. Build & lint hijau.

## Catatan pengerjaan (gotcha)
- DuckDB `COPY`: folder target harus sudah ada (mkdir) dan, untuk non-partisi, tulis nama file
  eksplisit (`data_0.parquet`) — COPY ke direktori yg ada menolak.
- `dim_santri` SCD2 dibangun dari `pendaftaran` (riwayat rombel) — bukan hanya snapshot kini.
- Bronze fakta append per run; silver/gold baca snapshot **terkini** (`snapshot=` dir).

## Fase 2 — SELESAI (verifikasi konsistensi dual-run)
- Test dual-run: **gold ≡ repoLaporan/repoAbsensi** pada data sama (teribit/masuk/sisa/absen).
  Memenuhi RFC §11 kriteria #2 (uji konsistensi) sebagai prasyarat cutover.
- Test total hijau **427** (analytics: 5).

## Fase 3 — BELUM (menunggu)
- **Cutover**: `/analisis` baca gold saja; matikan jalur baca repo dari lapisan analitik.
- **Jadwal snapshot harian malam** (keputusan RFC-018): pasang di worker/container (production),
  atau cron lokal — belum dipasang.
- Backfill SCD2 dari **2024** (keputusan RFC-018) — belum dieksekusi (butuh data OLTP historis).

## Owner
Operasional pipeline = **Superadmin** (keputusan RFC-018).

## Catatan tambahan (Hani, 24 Agu 2026) — BELUM dikerjakan
- **Master data perlu kolom `email_aktif`** untuk **wali**, **pengurus/operator**, dan **pengajar**.
  Terpisah dari RFC-018 (bukan bagian pipeline analitik) — kandidat perubahan kontrak/skema
  (packages/contracts) + migrasi + form/input. Catat sebagai tugas baru bila diminta.

## Keputusan terbuka (Hani, 24 Agu 2026)
- **Letak Parquet di Google Drive?** Pertanyaan Hani. Analisis: cocok untuk **backup/portabilitas/
  publikasi gold**, TIDAK untuk query langsung (DuckDB tak ada konektor GDrive; lambat).
  Pola usulan: DuckDB/Parquet lokal = sumber query; worker sinkronisasi harian malam → upload
  bronze (baru) + ekspor gold/Sheets ke GDrive. Catatan: `packages/drive` MASIH STUB 
  (`export const PAKET='drive'`) — butuh bangun jalur upload (Drive API). **Belum diputus.**

## Handoff — lanjut develop di mesin lain (24 Agu 2026)
- Semua kerja ter-push ke `main` (HEAD lihat `git log -1`); repo hijau (`npm run build/lint/test`,
  **427 test**). Orientasi sesi: `npm run mulai`.
- Kondisi terkini: `docs/STATE.md` (1.24 LLM Go, 1.25 RFC-018 Fase 1+2).
- RFC-018: Fase 1 (bronze/silver/gold) & Fase 2 (konsistensi gold≡repo) SELESAI; tersisa Fase 3
  (cutover /analisis ke gold), jadwal snapshot harian malam, backfill SCD2 2024 (RFC-018).
- `packages/drive` stub; `packages/analytics` kini nyata. Dep native `@duckdb/node-api`.
- Bot `@pengurus_rtq_annur_bot` (bot-internal) di-**stop** utk pindah mesin. Start: `/opt/data/scripts/start-bot-internal.py`; restart: `/opt/data/scripts/restart-bot-internal.sh`.