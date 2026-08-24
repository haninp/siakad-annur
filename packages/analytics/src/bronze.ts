/**
 * Bronze — lapisan mentah (ADR 0002). Snapshot dari OLTP (SQLite) ke Parquet:
 * - fakta (`tagihan`, `pembayaran`, `absensi`) → append-only per periode (`periode=YYYY-MM`).
 * - mutable (`santri`, `pengajar`, `komponen_biaya`, `tarif_komponen`, `rombel`,
 *   `pendaftaran`, `tahun_ajaran`, `kalender_hijriah`) → snapshot harian; tiap hari
 *   menambah berkas sehingga riwayat keadaan tersimpan.
 *
 * Bronze TIDAK PERNAH ditulis ulang — append-only. Sumber ekstraksi = SQLite di-attach
 * ke DuckDB secara read-only (bukan menyalin via kode TS).
 */

import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';

export const TABEL_FAKTA = ['tagihan', 'pembayaran', 'absensi'] as const;
export const TABEL_MUTABLE = [
  'santri',
  'pengajar',
  'komponen_biaya',
  'tarif_komponen',
  'rombel',
  'pendaftaran',
  'tahun_ajaran',
  'kalender_hijriah',
] as const;

export interface SkemaBronze {
  readonly bawaan?: string; // lokasi SQLite default jika tidak di-set ekplisit
  readonly lokasiDb: string;
  readonly akarParquet: string;
  readonly snapshot: string; // timestamp UTC `YYYY-MM-DDTHH:mm:ss.sssZ`
}

/** Nama direktori snapshot (aman jadi nama folder). */
function slugSnapshot(iso: string): string {
  return (iso.replace(/[-:]/g, '').split('.')[0] ?? ''); // 20260824T031122
}

/**
 * Salin semua tabel FAKTA + MUTABLE dari SQLite → Parquet di bawah `akarParquet/bronze`.
 * Idempoten per snapshot (folder snapshot unik); tidak menghapus snapshot lama.
 */
export async function bangunBronze(s: SkemaBronze): Promise<{ ditulis: string[] }> {
  const inst = await DuckDBInstance.create();
  const conn = await inst.connect();
  try {
    await conn.run(`ATTACH '${s.lokasiDb}' AS ol (TYPE sqlite, READ_ONLY)`);
    const diTulis: string[] = [];

    // Fakta: append-only per periode. Pastikan folder induk ada (DuckDB tidak membuatnya).
    for (const t of TABEL_FAKTA) {
      mkdirSync(path.join(s.akarParquet, 'bronze', 'fakta', t), { recursive: true });
      // pembayaran: periode dari tanggal; absensi: periode dari tanggal
      if (t === 'pembayaran') {
        await conn.run(`COPY (SELECT *, substr(tanggal,1,7) AS _periode FROM ol.pembayaran)
          TO '${path.join(s.akarParquet, 'bronze', 'fakta', 'pembayaran')}'
          (FORMAT PARQUET, PARTITION_BY (_periode))`);
      } else if (t === 'absensi') {
        await conn.run(`COPY (SELECT *, substr(tanggal,1,7) AS _periode FROM ol.absensi)
          TO '${path.join(s.akarParquet, 'bronze', 'fakta', 'absensi')}'
          (FORMAT PARQUET, PARTITION_BY (_periode))`);
      } else {
        await conn.run(`COPY (SELECT * FROM ol.${t}) TO '${path.join(s.akarParquet, 'bronze', 'fakta', t)}'
          (FORMAT PARQUET, PARTITION_BY (periode))`);
      }
      diTulis.push(t);
    }

    // Mutable: snapshot harian (folder snapshot unik).
    for (const t of TABEL_MUTABLE) {
      const dir = path.join(s.akarParquet, 'bronze', 'mutasi', t, slugSnapshot(s.snapshot));
      mkdirSync(path.join(s.akarParquet, 'bronze', 'mutasi', t), { recursive: true });
      await conn.run(`COPY (SELECT * FROM ol.${t}) TO '${dir}' (FORMAT PARQUET)`);
      diTulis.push(t);
    }

    return { ditulis: diTulis };
  } finally {
    conn.closeSync();
    inst.closeSync();
  }
}