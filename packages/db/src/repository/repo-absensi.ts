import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import type { Absensi, StatusAbsensi } from '@siakad/contracts';

/** Ringkasan kehadiran per bulan (mendukung tren absen santri, RFC-016). */
export interface BarisRingkasanAbsensi {
  readonly bulan: string; // YYYY-MM
  readonly hadir: number;
  readonly izin: number;
  readonly sakit: number;
  readonly alpa: number;
  readonly total: number;
}

export interface RepoAbsensi {
  /** Sisip/ubah status kehadiran satu santri pada satu tanggal (upsert per UNIQUE). */
  readonly catat: (b: {
    santriId: string;
    tanggal: string;
    status: StatusAbsensi;
    keterangan: string | null;
    dicatatOleh: string;
    waktu: string;
  }) => void;
  readonly cariBySantriRentang: (santriId: string, mulai: string, selesai: string) => Absensi[];
  /** Ringkasan hadir/izin/sakit/alpa per bulan pada rentang periode. */
  readonly ringkasanPerBulan: (santriId: string, mulai: string, selesai: string) => BarisRingkasanAbsensi[];
}

export function repoAbsensi(db: DatabaseSync): RepoAbsensi {
  return {
    catat: (b) => {
      db.prepare(
        `INSERT INTO absensi (id, santri_id, tanggal, status, keterangan, dicatat_oleh, waktu)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (santri_id, tanggal) DO UPDATE SET
           status = excluded.status, keterangan = excluded.keterangan,
           dicatat_oleh = excluded.dicatat_oleh, waktu = excluded.waktu`,
      ).run(buatUlid(), b.santriId, b.tanggal, b.status, b.keterangan, b.dicatatOleh, b.waktu);
    },
    cariBySantriRentang: (santriId, mulai, selesai) => {
      return db
        .prepare(
          `SELECT id, santri_id, tanggal, status, keterangan, dicatat_oleh, waktu
           FROM absensi WHERE santri_id = ? AND tanggal >= ? AND tanggal <= ?
           ORDER BY tanggal`,
        )
        .all(santriId, mulai, selesai) as unknown as Absensi[];
    },
    ringkasanPerBulan: (santriId, mulai, selesai) => {
      const rows = db
        .prepare(
          `SELECT substr(tanggal, 1, 7) AS bulan,
                  COALESCE(SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END), 0) AS hadir,
                  COALESCE(SUM(CASE WHEN status = 'izin' THEN 1 ELSE 0 END), 0) AS izin,
                  COALESCE(SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END), 0) AS sakit,
                  COALESCE(SUM(CASE WHEN status = 'alpa' THEN 1 ELSE 0 END), 0) AS alpa,
                  COUNT(*) AS total
           FROM absensi WHERE santri_id = ? AND tanggal >= ? AND tanggal <= ?
           GROUP BY substr(tanggal, 1, 7)
           ORDER BY bulan`,
        )
        .all(santriId, mulai, selesai) as unknown as BarisRingkasanAbsensi[];
      return rows;
    },
  };
}
