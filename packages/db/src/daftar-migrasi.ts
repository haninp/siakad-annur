import {
  DDL_IZIN,
  DDL_KALENDER_HIJRIAH,
  DDL_KEUANGAN,
  DDL_MASTER_DATA,
  DDL_PEMAKAIAN_LEBIH_BAYAR,
} from '@siakad/contracts';
import type { Migrasi } from './migrasi.js';

/**
 * Daftar migrasi, berurutan dan hanya boleh bertambah.
 *
 * **Jangan pernah menyunting entri yang sudah diterapkan** — runner akan menolak
 * berjalan, dan itu memang disengaja. Perubahan skema selalu jadi entri baru.
 *
 * Satu pengecualian yang akan segera tertutup: **selama belum ada satu pun basis data
 * berisi data sungguhan**, menyunting migrasi lama masih sah — yang ada hanyalah basis
 * data pengembangan yang bisa dibangun ulang (`npm run db:ulang`). Jendela itu tertutup
 * pada penerapan pertama ke data nyata, dan setelah itu aturan di atas berlaku mutlak.
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
  {
    versi: 3,
    nama: 'keuangan',
    sql: DDL_KEUANGAN,
  },
  {
    versi: 4,
    nama: 'pemakaian_lebih_bayar',
    sql: DDL_PEMAKAIAN_LEBIH_BAYAR,
  },
  {
    versi: 5,
    nama: 'kalender_hijriah',
    sql: DDL_KALENDER_HIJRIAH,
  },
];
