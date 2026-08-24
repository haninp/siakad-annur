/**
 * Silver — lapisan konformasi (ADR 0002). Membangun DuckDB `fact_*` + `dim_*`
 * dari Parquet bronze, dengan star schema dan SCD Type 2 pada dimensi berubah.
 *
 * Idempoten: `CREATE OR REPLACE` — bangun ulang penuh tiap pipeline (skala kecil,
 * ADR 0002: tanpa incremental state). Tabel tanpa data (mis. absensi masih kosong)
 * dibuat kosong dengan tipe eksplisit, bukan dihapus — menjaga mart gold tetap ada.
 */

import path from 'node:path';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { slugSnapshot } from './bronze.js';

export interface SkemaSilver {
  readonly akarParquet: string;
  readonly lokasiDuck: string; // file DuckDB gudang (mis. data/db/analitik.duckdb)
  readonly snapshot: string; // ISO snapshot (untuk memilih snapshot mutable terkini)
}

function globFakta(akar: string, tabel: string, snapshot: string): string {
  return path.join(akar, 'bronze', 'fakta', tabel, `snapshot=${slugSnapshot(snapshot)}`, '**', '*.parquet');
}
function globMutasi(akar: string, tabel: string, snapshot: string): string {
  return path.join(akar, 'bronze', 'mutasi', tabel, slugSnapshot(snapshot), 'data_0.parquet');
}

/** Benar bila ada file Parquet di bawah glob. */
async function adaParquet(conn: DuckDBConnection, glob: string): Promise<boolean> {
  const r = await conn.runAndReadAll(`SELECT count(*) AS n FROM glob('${glob}')`);
  const n = Number((r.getRowObjectsJson() as unknown as { n: string }[])[0]?.n ?? '0');
  return n > 0;
}

/** Bangun tabel dari parquet; bila kosong, ciptakan tabel kosong berkolom eksplisit. */
async function ciptaDariParquet(
  conn: DuckDBConnection,
  nama: string,
  glob: string,
  kolomKosong: string,
): Promise<void> {
  if (await adaParquet(conn, glob)) {
    await conn.run(`CREATE OR REPLACE TABLE ${nama} AS SELECT * FROM read_parquet('${glob}')`);
    return;
  }
  await conn.run(`CREATE OR REPLACE TABLE ${nama} AS SELECT ${kolomKosong} WHERE 1 = 0`);
}

export async function bangunSilver(s: SkemaSilver): Promise<{ tabel: string[] }> {
  const inst = await DuckDBInstance.create(s.lokasiDuck);
  const conn = await inst.connect();
  try {
    // ── Fakta ──
    await ciptaDariParquet(
      conn,
      'fact_tagihan',
      globFakta(s.akarParquet, 'tagihan', s.snapshot),
      `NULL::VARCHAR id, NULL::VARCHAR santri_id, NULL::VARCHAR tahun_ajaran_id,
       NULL::VARCHAR komponen_biaya_id, NULL::VARCHAR periode, NULL::VARCHAR skema_periode,
       NULL::VARCHAR jatuh_tempo, NULL::BIGINT nominal, NULL::VARCHAR prorata_mulai, NULL::VARCHAR status`,
    );

    await ciptaDariParquet(
      conn,
      'fact_pembayaran',
      globFakta(s.akarParquet, 'pembayaran', s.snapshot),
      `NULL::VARCHAR id, NULL::VARCHAR tagihan_id, NULL::VARCHAR tanggal, NULL::BIGINT nominal,
       NULL::VARCHAR metode, NULL::VARCHAR sumber, NULL::BIGINT cicilan_ke,
       NULL::VARCHAR dicatat_oleh, NULL::VARCHAR waktu, NULL::VARCHAR periode`,
    );

    await ciptaDariParquet(
      conn,
      'fact_absensi',
      globFakta(s.akarParquet, 'absensi', s.snapshot),
      `NULL::VARCHAR id, NULL::VARCHAR santri_id, NULL::VARCHAR tanggal, NULL::VARCHAR status,
       NULL::VARCHAR keterangan, NULL::VARCHAR dicatat_oleh, NULL::VARCHAR waktu`,
    );

    // ── Dimensi ──
    if (await adaParquet(conn, globMutasi(s.akarParquet, 'komponen_biaya', s.snapshot))) {
      await conn.run(`CREATE OR REPLACE TABLE dim_komponen_biaya AS
        SELECT id, kode, nama, akun_keuangan_kode, aktif
        FROM read_parquet('${globMutasi(s.akarParquet, 'komponen_biaya', s.snapshot)}')`);
    } else {
      await conn.run(`CREATE OR REPLACE TABLE dim_komponen_biaya AS
        SELECT NULL::VARCHAR id, NULL::VARCHAR kode, NULL::VARCHAR nama,
               NULL::BIGINT akun_keuangan_kode, NULL::BIGINT aktif WHERE 1 = 0`);
    }

    // dim_santri SCD2: satu baris per (santri, tahun_ajaran) dari pendaftaran —
    // merekam riwayat rombel tanpa menimpa (inti ADR 0002).
    const gS = globMutasi(s.akarParquet, 'santri', s.snapshot);
    const gP = globMutasi(s.akarParquet, 'pendaftaran', s.snapshot);
    const gT = globMutasi(s.akarParquet, 'tahun_ajaran', s.snapshot);
    const gR = globMutasi(s.akarParquet, 'rombel', s.snapshot);
    const punya = (await Promise.all([gS, gP, gT, gR].map((g) => adaParquet(conn, g)))).every(Boolean);
    if (punya) {
      await conn.run(`CREATE OR REPLACE TABLE dim_santri AS
        WITH s AS (SELECT id, nis, nama_lengkap, jenis_kelamin, tanggal_lahir, status
                   FROM read_parquet('${gS}')),
             p AS (SELECT santri_id, tahun_ajaran_id, rombel_id,
                          tanggal_masuk, tanggal_keluar, status
                   FROM read_parquet('${gP}')),
             ta AS (SELECT id, kode, mulai, selesai, aktif FROM read_parquet('${gT}')),
             r AS (SELECT id, nama FROM read_parquet('${gR}'))
        SELECT s.id AS santri_id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.tanggal_lahir, s.status,
               p.rombel_id, r.nama AS rombel_nama, ta.kode AS tahun_ajaran,
               COALESCE(p.tanggal_masuk, ta.mulai) AS valid_dari,
               COALESCE(p.tanggal_keluar, ta.selesai) AS valid_sampai,
               CASE WHEN p.tanggal_keluar IS NULL AND p.status = 'aktif' THEN 1 ELSE 0 END AS is_aktif
        FROM s
        LEFT JOIN p ON p.santri_id = s.id
        LEFT JOIN ta ON ta.id = p.tahun_ajaran_id
        LEFT JOIN r ON r.id = p.rombel_id`);
    } else {
      await conn.run(`CREATE OR REPLACE TABLE dim_santri AS
        SELECT NULL::VARCHAR santri_id, NULL::VARCHAR nis, NULL::VARCHAR nama_lengkap,
               NULL::VARCHAR jenis_kelamin, NULL::VARCHAR tanggal_lahir, NULL::VARCHAR status,
               NULL::VARCHAR rombel_id, NULL::VARCHAR rombel_nama, NULL::VARCHAR tahun_ajaran,
               NULL::VARCHAR valid_dari, NULL::VARCHAR valid_sampai, NULL::BIGINT is_aktif
        WHERE 1 = 0`);
    }

    return { tabel: ['fact_tagihan', 'fact_pembayaran', 'fact_absensi', 'dim_komponen_biaya', 'dim_santri'] };
  } finally {
    conn.closeSync();
    inst.closeSync();
  }
}