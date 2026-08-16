import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { entitasKalenderHijriah, type KalenderHijriah } from '@siakad/contracts';
import { dariSql, keSql } from './helper.js';

/**
 * Repository kalender_hijriah — rujukan statis untuk konversi Masehi ke Hijriah.
 *
 * Kunci primernya natural: (tahun_hijriah, bulan_hijriah). Tidak ada ULID
 * karena barisnya identik dengan kalender resmi, bukan entitas bisnis.
 */
export interface RepoKalenderHijriah {
  readonly sisip: (baris: KalenderHijriah) => void;
  readonly ambil: (tahun: number, bulan: number) => KalenderHijriah | undefined;
  readonly ambilSemua: () => KalenderHijriah[];
  readonly perbarui: (
    tahun: number,
    bulan: number,
    perubahan: Partial<KalenderHijriah>,
  ) => void;
  readonly cariProvisional: (tahun?: number) => KalenderHijriah[];
  readonly tandaiSetuju: (
    tahun: number,
    bulan: number,
    pengurusId: string,
    waktu: string,
  ) => void;
  /** Cari bulan Hijriah yang mencakup tanggal Masehi tertentu. */
  readonly hitungBulanPadaTanggal: (masehi: string) => KalenderHijriah | undefined;
  /** Upsert baris; selalu reset persetujuan karena sumber mungkin berubah. */
  readonly simpan: (baris: KalenderHijriah) => void;
  /**
   * Baris provisional yang belum diingatkan dan mulai dalam rentang tanggal
   * Masehi (RFC-012) — untuk reminder worker.
   */
  readonly cariPerluDiingatkan: (mulaiDari: string, sampai: string) => KalenderHijriah[];
  /** Tandai baris sudah diingatkan (RFC-012) — idempoten. */
  readonly tandaiDiingatkan: (tahun: number, bulan: number, waktu: string) => void;
}

export function repoKalenderHijriah(db: DatabaseSync): RepoKalenderHijriah {
  const kolom = entitasKalenderHijriah.kolom.join(', ');
  const tabel = entitasKalenderHijriah.nama;
  const ent = entitasKalenderHijriah;

  const placeholders = ent.kolom.map(() => '?').join(', ');
  const insertSql = 'INSERT INTO ' + tabel + ' (' + kolom + ') VALUES (' + placeholders + ')';
  const selectAllSql = 'SELECT ' + kolom + ' FROM ' + tabel + ' ORDER BY tahun_hijriah, bulan_hijriah';
  const selectOneSql =
    'SELECT ' + kolom + ' FROM ' + tabel + ' WHERE tahun_hijriah = ? AND bulan_hijriah = ?';
  const selectProvisionalSql = 'SELECT ' + kolom + ' FROM ' + tabel + ' WHERE provisional = 1';
  const selectProvisionalByTahunSql =
    selectProvisionalSql + ' AND tahun_hijriah = ? ORDER BY bulan_hijriah';
  const setujuSql =
    'UPDATE ' +
    tabel +
    ' SET provisional = 0, disetujui_oleh = ?, disetujui_pada = ? WHERE tahun_hijriah = ? AND bulan_hijriah = ?';
  const simpanSql =
    'INSERT INTO ' +
    tabel +
    ' (' +
    kolom +
    ') VALUES (' +
    placeholders +
    ') ' +
    'ON CONFLICT (tahun_hijriah, bulan_hijriah) DO UPDATE SET ' +
    'nama_bulan = excluded.nama_bulan, ' +
    'tanggal_mulai_masehi = excluded.tanggal_mulai_masehi, ' +
    'provisional = 1, ' +
    'disetujui_oleh = NULL, ' +
    'disetujui_pada = NULL, ' +
    'sumber = excluded.sumber, ' +
    'catatan = excluded.catatan';
  const cariBulanSql =
    'SELECT ' +
    kolom +
    ' FROM ' +
    tabel +
    " WHERE tanggal_mulai_masehi <= ? ORDER BY tanggal_mulai_masehi DESC LIMIT 1";

  const idValues = (tahun: number, bulan: number): SQLInputValue[] => [tahun, bulan];

  const buildUpdate = (keys: string[]) =>
    'UPDATE ' +
    tabel +
    ' SET ' +
    keys.map((k) => k + ' = ?').join(', ') +
    ' WHERE tahun_hijriah = ? AND bulan_hijriah = ?';

  return {
    sisip: (baris) => {
      const sqlValues = keSql(ent, baris);
      const values = ent.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },

    ambilSemua: () => {
      const rows = db.prepare(selectAllSql).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(ent, r));
    },

    ambil: (tahun, bulan) => {
      const row = db.prepare(selectOneSql).get(...idValues(tahun, bulan)) as
        | Record<string, unknown>
        | undefined;
      return row ? dariSql(ent, row) : undefined;
    },

    perbarui: (tahun, bulan, perubahan) => {
      const sqlValues = keSql(ent, perubahan);
      const keys = Object.keys(sqlValues);
      if (keys.length === 0) return;
      const values = [...keys.map((k) => sqlValues[k]), ...idValues(tahun, bulan)] as SQLInputValue[];
      db.prepare(buildUpdate(keys)).run(...values);
    },

    cariProvisional: (tahun) => {
      const sql = tahun === undefined ? selectProvisionalSql : selectProvisionalByTahunSql;
      const params = tahun === undefined ? [] : [tahun];
      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map((r) => dariSql(ent, r));
    },

    tandaiSetuju: (tahun, bulan, pengurusId, waktu) => {
      db.prepare(setujuSql).run(pengurusId, waktu, tahun, bulan);
    },

    hitungBulanPadaTanggal: (masehi) => {
      const row = db.prepare(cariBulanSql).get(masehi) as Record<string, unknown> | undefined;
      return row ? dariSql(ent, row) : undefined;
    },

    simpan: (baris) => {
      const sqlValues = keSql(ent, baris);
      const values = ent.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(simpanSql).run(...values);
    },

    cariPerluDiingatkan: (mulaiDari, sampai) => {
      const rows = db
        .prepare(
          `SELECT ${kolom} FROM ${tabel}
           WHERE provisional = 1 AND diingatkan_pada IS NULL
             AND tanggal_mulai_masehi BETWEEN ? AND ?
           ORDER BY tanggal_mulai_masehi`,
        )
        .all(mulaiDari, sampai) as Record<string, unknown>[];
      return rows.map((r) => dariSql(ent, r));
    },

    tandaiDiingatkan: (tahun, bulan, waktu) => {
      db.prepare(
        `UPDATE ${tabel} SET diingatkan_pada = ?
         WHERE tahun_hijriah = ? AND bulan_hijriah = ?`,
      ).run(waktu, tahun, bulan);
    },
  };
}
