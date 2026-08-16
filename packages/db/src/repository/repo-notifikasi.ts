import type { DatabaseSync } from 'node:sqlite';
import { entitasNotifikasiTerbit } from '@siakad/contracts';

/**
 * Repository notifikasi worker (RFC-011): menemukan tagihan yang baru terbit
 * dan belum dinotifikasi, menentukan wali penerima (yang SUDAH terdaftar di
 * pengguna_telegram), dan menandai tagihan yang sudah dinotifikasi.
 *
 * Jejak di tabel terpisah `notifikasi_terbit` — tagihan tidak diubah bentuknya.
 */

export interface TagihanPerluNotifikasi {
  tagihan_id: string;
  periode: string;
  nominal: number;
  jatuh_tempo: string;
  komponen_nama: string;
  santri_id: string;
  santri_nama: string;
}

export interface RepoNotifikasi {
  /** Tagihan status 'terbit' yang belum pernah dinotifikasi, urut jatuh tempo. */
  readonly cariTagihanPerluNotifikasi: (limit?: number) => TagihanPerluNotifikasi[];

  /** Wali TERDAFTAR (pengguna_telegram, peran wali, aktif) dari satu santri. */
  readonly cariWaliTerdaftar: (santriId: string) => { telegram_id: number; wali_nama: string }[];

  /** Tandai tagihan sudah dinotifikasi — idempoten (INSERT OR IGNORE). */
  readonly tandaiNotifikasiTerbit: (tagihanId: string, waktu: string) => void;
}

const KOLOM = entitasNotifikasiTerbit.kolom.join(', ');

export function repoNotifikasi(db: DatabaseSync): RepoNotifikasi {
  return {
    cariTagihanPerluNotifikasi: (limit = 50) => {
      const rows = db
        .prepare(
          `SELECT t.id AS tagihan_id, t.periode, t.nominal, t.jatuh_tempo,
                  k.nama AS komponen_nama, s.id AS santri_id, s.nama_lengkap AS santri_nama
           FROM tagihan t
           JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
           JOIN santri s ON s.id = t.santri_id
           LEFT JOIN notifikasi_terbit n ON n.tagihan_id = t.id
           WHERE t.status = 'terbit' AND n.tagihan_id IS NULL
           ORDER BY t.jatuh_tempo
           LIMIT ?`,
        )
        .all(limit) as unknown as TagihanPerluNotifikasi[];
      return rows;
    },

    cariWaliTerdaftar: (santriId) => {
      const rows = db
        .prepare(
          `SELECT p.telegram_id, w.nama_lengkap AS wali_nama
           FROM santri_wali sw
           JOIN wali w ON w.id = sw.wali_id
           JOIN pengguna_telegram p ON p.wali_id = w.id
           WHERE sw.santri_id = ? AND sw.aktif = 1
             AND p.peran = 'wali' AND p.aktif = 1 AND p.telegram_id IS NOT NULL`,
        )
        .all(santriId) as unknown as { telegram_id: number; wali_nama: string }[];
      return rows;
    },

    tandaiNotifikasiTerbit: (tagihanId, waktu) => {
      db.prepare(
        `INSERT OR IGNORE INTO ${entitasNotifikasiTerbit.nama} (${KOLOM}) VALUES (?, ?)`,
      ).run(tagihanId, waktu);
    },
  };
}
