import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { entitasUsulanPembayaran, type UsulanPembayaran } from '@siakad/contracts';
import { dariSql, keSql } from './helper.js';

/**
 * Repository `usulan_pembayaran` (RFC-008) — klaim pembayaran dari wali,
 * diverifikasi bendahara.
 *
 * Transisi status dipaksakan di tingkat SQL (`WHERE status = 'diajukan'`),
 * pola yang sama dengan `usulan_izin` — dua proses tidak bisa sama-sama
 * memverifikasi/menolak usulan yang sama.
 */

const TABEL = entitasUsulanPembayaran.nama;
const KOLOM = entitasUsulanPembayaran.kolom.join(', ');

export interface RepoUsulanPembayaran {
  /** Membuat usulan baru. Status harus `diajukan`. */
  readonly ajukan: (baris: UsulanPembayaran) => void;

  /** Verifikasi oleh bendahara — hanya berhasil bila masih `diajukan`. */
  readonly verifikasi: (id: string, bendaharaId: string, waktu: string) => void;

  /** Tolak dengan alasan wajib — hanya berhasil bila masih `diajukan`. */
  readonly tolak: (id: string, bendaharaId: string, alasan: string, waktu: string) => void;

  /** Semua usulan yang masih menunggu verifikasi, terlama dulu. */
  readonly cariMenunggu: () => UsulanPembayaran[];

  /** Riwayat usulan satu santri, terbaru dulu. */
  readonly cariBySantri: (santriId: string) => UsulanPembayaran[];

  /** Satu usulan berdasarkan id. */
  readonly cariById: (id: string) => UsulanPembayaran | undefined;
}

export function repoUsulanPembayaran(db: DatabaseSync): RepoUsulanPembayaran {
  const insertSql = `INSERT INTO ${TABEL} (${KOLOM}) VALUES (${entitasUsulanPembayaran.kolom
    .map(() => '?')
    .join(', ')})`;
  const selectMenunggu = `SELECT ${KOLOM} FROM ${TABEL} WHERE status = 'diajukan' ORDER BY diajukan_pada`;
  const selectBySantri = `SELECT ${KOLOM} FROM ${TABEL} WHERE santri_id = ? ORDER BY diajukan_pada DESC`;
  const selectById = `SELECT ${KOLOM} FROM ${TABEL} WHERE id = ?`;

  return {
    ajukan: (baris) => {
      const sqlValues = keSql(entitasUsulanPembayaran, baris);
      const values = entitasUsulanPembayaran.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },

    verifikasi: (id, bendaharaId, waktu) => {
      const hasil = db
        .prepare(
          `UPDATE ${TABEL}
           SET status = 'terverifikasi',
               diverifikasi_oleh = ?,
               diverifikasi_waktu = ?
           WHERE id = ? AND status = 'diajukan'`,
        )
        .run(bendaharaId, waktu, id);
      if (hasil.changes === 0) {
        throw new Error('Usulan tidak ditemukan atau sudah diverifikasi/ditolak');
      }
    },

    tolak: (id, bendaharaId, alasan, waktu) => {
      const hasil = db
        .prepare(
          `UPDATE ${TABEL}
           SET status = 'ditolak',
               diverifikasi_oleh = ?,
               diverifikasi_waktu = ?,
               alasan_penolakan = ?
           WHERE id = ? AND status = 'diajukan'`,
        )
        .run(bendaharaId, waktu, alasan, id);
      if (hasil.changes === 0) {
        throw new Error('Usulan tidak ditemukan atau sudah diverifikasi/ditolak');
      }
    },

    cariMenunggu: () => {
      const rows = db.prepare(selectMenunggu).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasUsulanPembayaran, r));
    },

    cariBySantri: (santriId) => {
      const rows = db.prepare(selectBySantri).all(santriId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasUsulanPembayaran, r));
    },

    cariById: (id) => {
      const row = db.prepare(selectById).get(id) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasUsulanPembayaran, row) : undefined;
    },
  };
}
