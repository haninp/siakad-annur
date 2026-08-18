import type { DatabaseSync } from 'node:sqlite';

/**
 * Repository laporan keuangan (RFC-014) — agregat SELURUHNYA di SQL.
 *
 * AGENTS.md: "angka dari SQL" — model/bot tidak boleh menghitung sendiri.
 * `pembayaran` hanya berisi uang yang sudah terverifikasi (RFC-008), jadi
 * "masuk" = SUM pembayaran per periode sudah benar secara akrual.
 *
 * `sisa` sengaja TIDAK dihitung di sini (terbit − masuk boleh negatif saat
 * lebih bayar) — komposisinya di core agar satu definisi.
 */

export interface BarisLaporanKomponen {
  readonly komponen: string;
  readonly terbit: number;
  readonly masuk: number;
}

export interface RingkasanLaporan {
  readonly terbit: number;
  readonly masuk: number;
}

export interface RepoLaporan {
  /** Per komponen biaya aktif: total tagihan terbit/lunas + uang masuk terverifikasi. */
  readonly laporanPerKomponen: (periode: string) => BarisLaporanKomponen[];
  /** Ringkasan total satu periode (semua komponen). */
  readonly ringkasan: (periode: string) => RingkasanLaporan;
}

const STATUS_TERBIT = "t.status IN ('terbit','lunas')";

export function repoLaporan(db: DatabaseSync): RepoLaporan {
  return {
    laporanPerKomponen: (periode) => {
      const rows = db
        .prepare(
          `SELECT k.nama AS komponen,
                  COALESCE(SUM(CASE WHEN ${STATUS_TERBIT} THEN t.nominal ELSE 0 END), 0) AS terbit,
                  COALESCE(SUM(p.nominal), 0) AS masuk
           FROM komponen_biaya k
           LEFT JOIN tagihan t ON t.komponen_biaya_id = k.id AND t.periode = ?
           LEFT JOIN pembayaran p ON p.tagihan_id = t.id
           WHERE k.aktif = 1
           GROUP BY k.id, k.nama
           ORDER BY k.nama`,
        )
        .all(periode) as unknown as BarisLaporanKomponen[];
      return rows.map((r) => ({ komponen: r.komponen, terbit: r.terbit, masuk: r.masuk }));
    },

    ringkasan: (periode) => {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN ${STATUS_TERBIT} THEN t.nominal ELSE 0 END), 0) AS terbit,
                  COALESCE(SUM(p.nominal), 0) AS masuk
           FROM tagihan t
           LEFT JOIN pembayaran p ON p.tagihan_id = t.id
           WHERE t.periode = ?`,
        )
        .get(periode) as unknown as RingkasanLaporan;
      return { terbit: row.terbit, masuk: row.masuk };
    },
  };
}
