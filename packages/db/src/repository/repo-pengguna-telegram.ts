import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { entitasPenggunaTelegram, type PenggunaTelegram } from '@siakad/contracts';
import { dariSql, keSql } from './helper.js';

/**
 * Repository `pengguna_telegram` (RFC-008) — pemetaan telegram_id ↔ peran ↔ wali.
 *
 * Prasyarat notifikasi push & pemetaan peran; menggantikan binding dev
 * (`DEV_WALI_TELEGRAM_IDS`) saat undangan dipakai.
 */

const TABEL = entitasPenggunaTelegram.nama;
const KOLOM = entitasPenggunaTelegram.kolom.join(', ');

export interface RepoPenggunaTelegram {
  readonly sisip: (baris: PenggunaTelegram) => void;

  /** Cari pengguna aktif berdasarkan telegram_id. */
  readonly cariByTelegramId: (telegramId: number) => PenggunaTelegram | undefined;

  /** Cari pengguna wali aktif berdasarkan wali_id. */
  readonly cariByWaliId: (waliId: string) => PenggunaTelegram | undefined;

  /** Cari pengguna berdasarkan kode undangan. */
  readonly cariByUndanganKode: (kode: string) => PenggunaTelegram | undefined;

  /** Hubungkan telegram_id ke pengguna yang dibuat via undangan. */
  readonly hubungkan: (id: string, telegramId: number) => void;
}

export function repoPenggunaTelegram(db: DatabaseSync): RepoPenggunaTelegram {
  const insertSql = `INSERT INTO ${TABEL} (${KOLOM}) VALUES (${entitasPenggunaTelegram.kolom
    .map(() => '?')
    .join(', ')})`;

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
        .prepare(`SELECT ${KOLOM} FROM ${TABEL} WHERE undangan_kode = ? AND aktif = 1`)
        .get(kode) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasPenggunaTelegram, row) : undefined;
    },

    hubungkan: (id, telegramId) => {
      db.prepare(`UPDATE ${TABEL} SET telegram_id = ?, undangan_kode = NULL WHERE id = ?`).run(telegramId, id);
    },
  };
}
