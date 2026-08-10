import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { entitasUsulanIzin, type UsulanIzin, type StatusUsulan } from '@siakad/contracts';
import { dariSql, keSql } from './helper.js';

/**
 * Repository `usulan_izin` — satu-satunya tabel yang boleh ditulis `apps/bot-wali`.
 *
 * Method di sini memaksa aturan transisi status di tingkat SQL, bukan hanya di
 * skema. Hal itu membuat race condition sulit terjadi: dua proses yang bersamaan
 * tidak bisa sama-sama mengubah usulan menjadi batal atau ditanggapi.
 */

const TABEL = entitasUsulanIzin.nama;
const KOLOM = entitasUsulanIzin.kolom.join(', ');

export interface RepoUsulanIzin {
  /** Membuat usulan baru. Status harus `menunggu`. */
  readonly ajukan: (baris: UsulanIzin) => void;

  /**
   * Membatalkan usulan oleh wali. Hanya berhasil bila status masih `menunggu`.
   * CHECK di DDL menegakkan `dibatalkan_oleh_wali_id` tidak boleh berisi bila
   * `ditanggapi_oleh_pengajar_id` sudah terisi.
   */
  readonly batalkan: (id: string, waliId: string, waktu: string) => void;

  /** Wali kelas menanggapi usulan yang masih `menunggu`. */
  readonly tanggap: (
    id: string,
    pengajarId: string,
    status: Extract<StatusUsulan, 'diterima' | 'ditolak'>,
    waktu: string,
  ) => void;

  /** Ambil semua usulan yang masih menunggu tanggapan, diurutkan tanggal. */
  readonly cariMenunggu: () => UsulanIzin[];

  /** Ambil seluruh riwayat usulan satu santri, terbaru dulu. */
  readonly cariBySantri: (santriId: string) => UsulanIzin[];
}

export function repoUsulanIzin(db: DatabaseSync): RepoUsulanIzin {
  const insertSql = `INSERT INTO ${TABEL} (${KOLOM}) VALUES (${entitasUsulanIzin.kolom
    .map(() => '?')
    .join(', ')})`;
  const selectMenunggu = `SELECT ${KOLOM} FROM ${TABEL} WHERE status = 'menunggu' ORDER BY tanggal, dibuat_pada`;
  const selectBySantri = `SELECT ${KOLOM} FROM ${TABEL} WHERE santri_id = ? ORDER BY dibuat_pada DESC`;

  return {
    ajukan: (baris) => {
      const sqlValues = keSql(entitasUsulanIzin, baris);
      const values = entitasUsulanIzin.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },

    batalkan: (id, waliId, waktu) => {
      const sql = `
        UPDATE ${TABEL}
        SET status = 'dibatalkan',
            dibatalkan_oleh_wali_id = ?,
            waktu_tanggap = ?
        WHERE id = ? AND status = 'menunggu'
      `;
      const hasil = db.prepare(sql).run(waliId, waktu, id);
      if (hasil.changes === 0) {
        throw new Error('Usulan tidak ditemukan atau sudah tidak bisa dibatalkan');
      }
    },

    tanggap: (id, pengajarId, status, waktu) => {
      const sql = `
        UPDATE ${TABEL}
        SET status = ?,
            ditanggapi_oleh_pengajar_id = ?,
            waktu_tanggap = ?
        WHERE id = ? AND status = 'menunggu'
      `;
      const hasil = db.prepare(sql).run(status, pengajarId, waktu, id);
      if (hasil.changes === 0) {
        throw new Error('Usulan tidak ditemukan atau sudah ditanggapi');
      }
    },

    cariMenunggu: () => {
      const rows = db.prepare(selectMenunggu).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasUsulanIzin, r));
    },

    cariBySantri: (santriId) => {
      const rows = db.prepare(selectBySantri).all(santriId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasUsulanIzin, r));
    },
  };
}
