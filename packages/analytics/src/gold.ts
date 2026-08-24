/**
 * Gold — mart pra-agregasi (ADR 0002). View atas silver fact/dim yang dibaca
 * laporan & agent. Semantik sql menyalin DEFINISI repoLaporan/repoAbsensi
 * (packages/db) persis, sehingga `/analisis` bisa dipindah baca ke gold tanpa
 * mengubah hasil — diverifikasi uji konsistensi.
 *
 * Perbedaan satu-satunya dari repo: periode adalah kolom (bukan parameter),
 * dikompilasi ke dalam mart dan dipilih saat baca.
 */

import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

export interface SkemaGold {
  readonly lokasiDuck: string; // file DuckDB gudang (silver)
}

/** Tipe hasil yang sama dengan repoLaporan/repoAbsensi. */
export interface BarisKomponen {
  readonly komponen: string;
  readonly terbit: number;
  readonly masuk: number;
}
export interface Ringkasan {
  readonly terbit: number;
  readonly masuk: number;
}
export interface BarisTrenSpp {
  readonly periode: string;
  readonly terbit: number;
  readonly masuk: number;
  readonly sisa: number;
}
export interface BarisTrenAbsen {
  readonly bulan: string;
  readonly hadir: number;
  readonly izin: number;
  readonly sakit: number;
  readonly alpa: number;
  readonly total: number;
}

/** Bangun (atau mem-buat ulang) view mart gold di atas silver. Idempoten. */
export async function bangunGold(s: SkemaGold): Promise<{ mart: string[] }> {
  const inst = await DuckDBInstance.create(s.lokasiDuck);
  const conn = await inst.connect();
  try {
    // ringkasan per komponen per periode (presisi mirip laporanPerKomponen).
    await conn.run(`
      CREATE OR REPLACE VIEW mart_ringkasan AS
      SELECT k.nama AS komponen, t.periode, COALESCE(t.terbit, 0) AS terbit, COALESCE(t.masuk_t, 0) AS masuk
      FROM dim_komponen_biaya k
      LEFT JOIN (
        SELECT tg.komponen_biaya_id, tg.periode,
               SUM(CASE WHEN tg.status IN ('terbit','lunas') THEN tg.nominal ELSE 0 END) AS terbit,
               COALESCE(SUM(p.nominal), 0) AS masuk_t
        FROM fact_tagihan tg
        LEFT JOIN fact_pembayaran p ON p.tagihan_id = tg.id
        GROUP BY tg.komponen_biaya_id, tg.periode
      ) t ON t.komponen_biaya_id = k.id
      WHERE k.aktif = 1`);

    await conn.run(`
      CREATE OR REPLACE VIEW mart_ringkasan_total AS
      SELECT tg.periode,
             COALESCE(SUM(CASE WHEN tg.status IN ('terbit','lunas') THEN tg.nominal ELSE 0 END), 0) AS terbit,
             COALESCE(SUM(p.nominal), 0) AS masuk
      FROM fact_tagihan tg
      LEFT JOIN fact_pembayaran p ON p.tagihan_id = tg.id
      GROUP BY tg.periode`);

    await conn.run(`
      CREATE OR REPLACE VIEW mart_tren_spp AS
      SELECT tg.santri_id, tg.periode,
             COALESCE(SUM(CASE WHEN tg.status IN ('terbit','lunas') THEN tg.nominal ELSE 0 END), 0) AS terbit,
             COALESCE(SUM(p.nominal), 0) AS masuk
      FROM fact_tagihan tg
      LEFT JOIN fact_pembayaran p ON p.tagihan_id = tg.id
      GROUP BY tg.santri_id, tg.periode`);

    await conn.run(`
      CREATE OR REPLACE VIEW mart_tren_absen AS
      SELECT santri_id, substr(tanggal, 1, 7) AS bulan,
             COALESCE(SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
             COALESCE(SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
             COALESCE(SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
             COALESCE(SUM(CASE WHEN status = 'alpa' THEN 1 ELSE 0 END), 0) AS alpa,
             COUNT(*) AS total
      FROM fact_absensi
      GROUP BY santri_id, substr(tanggal, 1, 7)`);

    return { mart: ['mart_ringkasan', 'mart_ringkasan_total', 'mart_tren_spp', 'mart_tren_absen'] };
  } finally {
    conn.closeSync();
    inst.closeSync();
  }
}

/** Buka koneksi baca (read-only) ke gudang gold. */
async function buka(lokasiDuck: string): Promise<DuckDBConnection> {
  const inst = await DuckDBInstance.create(lokasiDuck, { access_mode: 'read_only' });
  return inst.connect();
}

/** Query gold — ringkasan per komponen untuk satu periode (padan laporanPerKomponen). */
export async function goldPerKomponen(lokasiDuck: string, periode: string): Promise<BarisKomponen[]> {
  const c = await buka(lokasiDuck);
  try {
    const r = await c.runAndReadAll(
      `SELECT komponen, CAST(terbit AS BIGINT) AS terbit, CAST(masuk AS BIGINT) AS masuk
       FROM mart_ringkasan WHERE periode = ? OR periode IS NULL ORDER BY komponen`,
      [periode],
    );
    return (r.getRowObjectsJson() as unknown as { komponen: string; terbit: string; masuk: string }[]).map((x) => ({
      komponen: String(x.komponen),
      terbit: Number(x.terbit),
      masuk: Number(x.masuk),
    }));
  } finally {
    c.closeSync();
  }
}

/** Query gold — ringkasan total satu periode (padan ringkasan repo). */
export async function goldRingkasan(lokasiDuck: string, periode: string): Promise<Ringkasan> {
  const c = await buka(lokasiDuck);
  try {
    const r = await c.runAndReadAll(
      `SELECT CAST(COALESCE(terbit,0) AS BIGINT) AS terbit, CAST(COALESCE(masuk,0) AS BIGINT) AS masuk
       FROM mart_ringkasan_total WHERE periode = ?`,
      [periode],
    );
    const b = (r.getRowObjectsJson() as unknown as { terbit: string; masuk: string }[])[0];
    return { terbit: Number(b?.terbit ?? 0), masuk: Number(b?.masuk ?? 0) };
  } finally {
    c.closeSync();
  }
}

/** Query gold — tren SPP satu santri (padan trenSpp repo; sisa = terbit − masuk). */
export async function goldTrenSpp(
  lokasiDuck: string,
  santriId: string,
  mulai: string,
  selesai: string,
): Promise<BarisTrenSpp[]> {
  const c = await buka(lokasiDuck);
  try {
    const r = await c.runAndReadAll(
      `SELECT periode, CAST(terbit AS BIGINT) AS terbit, CAST(masuk AS BIGINT) AS masuk
       FROM mart_tren_spp WHERE santri_id = ? AND periode >= ? AND periode <= ?
       ORDER BY periode`,
      [santriId, mulai, selesai],
    );
    return (r.getRowObjectsJson() as unknown as { periode: string; terbit: string; masuk: string }[]).map((x) => ({
      periode: String(x.periode),
      terbit: Number(x.terbit),
      masuk: Number(x.masuk),
      sisa: Number(x.terbit) - Number(x.masuk),
    }));
  } finally {
    c.closeSync();
  }
}

/** Query gold — ringkasan absen per bulan (padan ringkasanPerBulan repo). */
export async function goldTrenAbsen(
  lokasiDuck: string,
  santriId: string,
  mulai: string,
  selesai: string,
): Promise<BarisTrenAbsen[]> {
  const c = await buka(lokasiDuck);
  try {
    const r = await c.runAndReadAll(
      `SELECT bulan, CAST(hadir AS BIGINT) AS hadir, CAST(izin AS BIGINT) AS izin,
              CAST(sakit AS BIGINT) AS sakit, CAST(alpa AS BIGINT) AS alpa, CAST(total AS BIGINT) AS total
       FROM mart_tren_absen WHERE santri_id = ? AND bulan >= substr(?,1,7) AND bulan <= substr(?,1,7)
       ORDER BY bulan`,
      [santriId, mulai, selesai],
    );
    return (r.getRowObjectsJson() as unknown as BarisTrenAbsen[]).map((x) => ({
      bulan: String(x.bulan),
      hadir: Number(x.hadir),
      izin: Number(x.izin),
      sakit: Number(x.sakit),
      alpa: Number(x.alpa),
      total: Number(x.total),
    }));
  } finally {
    c.closeSync();
  }
}