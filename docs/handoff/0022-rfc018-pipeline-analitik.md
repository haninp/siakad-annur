# Handoff 0022 — RFC-018: Pipeline Analitik (bronze/silver/gold)

Tanggal: 2026-08-24 · Status: **Fase 1 SELESAI**; Fase 2/3 menunggu.

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

## Fase 2 & 3 — BELUM (menunggu)
- Fase 2 (dual-run): `/analisis` jalankan agregat dari **gold** DAN repo, bandingkan konsistensi.
- Fase 3 (cutover): `/analisis` baca gold saja; matikan jalur baca repo dari lapisan analitik.
- **Jadwal snapshot harian malam** (keputusan RFC-018): pasang di worker/container (production),
  atau cron lokal — belum dipasang.
- Backfill SCD2 dari **2024** (keputusan RFC-018) — belum dieksekusi (butuh data OLTP historis).

## Owner
Operasional pipeline = **Superadmin** (keputusan RFC-018).