import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { entitasPenggunaTelegram, type PenggunaTelegram } from '@siakad/contracts';
import { dariSql, keSql } from './helper.js';

/**
 * Repository `pengguna_telegram` (RFC-008/009) — pemetaan telegram_id ↔ peran ↔ wali
 * + alur undangan.
 *
 * Status undangan (migrasi 7): `dipakai_pada` terisi saat link dipakai,
 * `dicabut_pada` saat pengurus mencabut (revoke). Kode undangan TIDAK dihapus
 * saat dipakai/dicabut — link bekas tetap bisa dikenali statusnya. Guard
 * "sekali pakai" dipaksakan di SQL (pola `usulan_izin`/`usulan_pembayaran`).
 */

const TABEL = entitasPenggunaTelegram.nama;
const KOLOM = entitasPenggunaTelegram.kolom.join(', ');

export interface RepoPenggunaTelegram {
  readonly sisip: (baris: PenggunaTelegram) => void;

  /** Cari pengguna aktif berdasarkan telegram_id. */
  readonly cariByTelegramId: (telegramId: number) => PenggunaTelegram | undefined;

  /** Cari pengguna wali aktif berdasarkan wali_id. */
  readonly cariByWaliId: (waliId: string) => PenggunaTelegram | undefined;

  /** Kode yang MASIH BISA dipakai (aktif, belum dipakai, belum dicabut). */
  readonly cariByUndanganKode: (kode: string) => PenggunaTelegram | undefined;

  /** Kode apa pun — termasuk bekas/dicabut — untuk membedakan status link. */
  readonly cariStatusByKode: (kode: string) => PenggunaTelegram | undefined;

  /** Daftar undangan yang masih menunggu dipakai (list pengurus). */
  readonly cariMenunggu: () => PenggunaTelegram[];

  /**
   * Hubungkan telegram_id ke baris undangan — SEKALI PAKAI, dipaksakan di SQL:
   * hanya berhasil bila kode masih terpasang, baris aktif, telegram_id belum
   * terisi, dan belum dipakai/dicabut. Kode tetap tersimpan (jejak status).
   */
  readonly hubungkan: (id: string, undanganKode: string, telegramId: number, waktu: string) => void;

  /** Cabut undangan — hanya berhasil bila masih menunggu dipakai. */
  readonly cabut: (id: string, waktu: string) => void;
}

export function repoPenggunaTelegram(db: DatabaseSync): RepoPenggunaTelegram {
  const insertSql = `INSERT INTO ${TABEL} (${KOLOM}) VALUES (${entitasPenggunaTelegram.kolom
    .map(() => '?')
    .join(', ')})`;
  const selectMenunggu = `SELECT ${KOLOM} FROM ${TABEL}
    WHERE peran = 'wali' AND telegram_id IS NULL AND undangan_kode IS NOT NULL
      AND aktif = 1 AND dipakai_pada IS NULL AND dicabut_pada IS NULL
    ORDER BY dibuat_pada`;

  return {
    sisip: (baris) => {
      const sqlValues = keSql(entitasPenggunaTelegram, baris);
      const values = entitasPenggunaTelegram.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },

    cariByTelegramId: (telegramId) => {
      const row = db
        .prepare(`SELECT ${KOLOM} FROM ${TABEL} WHERE telegram_id = ? AND aktif = 1`)
        .get(telegramId) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasPenggunaTelegram, row) : undefined;
    },

    cariByWaliId: (waliId) => {
      const row = db
        .prepare(`SELECT ${KOLOM} FROM ${TABEL} WHERE wali_id = ? AND aktif = 1`)
        .get(waliId) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasPenggunaTelegram, row) : undefined;
    },

    cariByUndanganKode: (kode) => {
      const row = db
        .prepare(
          `SELECT ${KOLOM} FROM ${TABEL}
           WHERE undangan_kode = ? AND aktif = 1 AND telegram_id IS NULL
             AND dipakai_pada IS NULL AND dicabut_pada IS NULL`,
        )
        .get(kode) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasPenggunaTelegram, row) : undefined;
    },

    cariStatusByKode: (kode) => {
      const row = db
        .prepare(`SELECT ${KOLOM} FROM ${TABEL} WHERE undangan_kode = ?`)
        .get(kode) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasPenggunaTelegram, row) : undefined;
    },

    cariMenunggu: () => {
      const rows = db.prepare(selectMenunggu).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasPenggunaTelegram, r));
    },

    hubungkan: (id, undanganKode, telegramId, waktu) => {
      const hasil = db
        .prepare(
          `UPDATE ${TABEL}
           SET telegram_id = ?, dipakai_pada = ?
           WHERE id = ? AND undangan_kode = ? AND aktif = 1 AND telegram_id IS NULL
             AND dipakai_pada IS NULL AND dicabut_pada IS NULL`,
        )
        .run(telegramId, waktu, id, undanganKode);
      if (hasil.changes === 0) {
        throw new Error('Kode undangan tidak ditemukan atau sudah dipakai');
      }
    },

    cabut: (id, waktu) => {
      const hasil = db
        .prepare(
          `UPDATE ${TABEL}
           SET aktif = 0, dicabut_pada = ?
           WHERE id = ? AND aktif = 1 AND telegram_id IS NULL
             AND dipakai_pada IS NULL AND dicabut_pada IS NULL`,
        )
        .run(waktu, id);
      if (hasil.changes === 0) {
        throw new Error('Undangan tidak ditemukan atau sudah dipakai/dicabut');
      }
    },
  };
}
