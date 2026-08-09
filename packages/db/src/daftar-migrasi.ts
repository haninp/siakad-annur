import { DDL_IZIN, DDL_MASTER_DATA } from '@siakad/contracts';
import type { Migrasi } from './migrasi.js';

/**
 * Daftar migrasi, berurutan dan hanya boleh bertambah.
 *
 * **Jangan pernah menyunting entri yang sudah diterapkan** — runner akan menolak
 * berjalan, dan itu memang disengaja. Perubahan skema selalu jadi entri baru.
 */
export const DAFTAR_MIGRASI: readonly Migrasi[] = [
  {
    versi: 1,
    nama: 'master data identitas dan akademik',
    sql: DDL_MASTER_DATA,
  },
  {
    versi: 2,
    nama: 'usulan izin absen',
    sql: DDL_IZIN,
  },
];
