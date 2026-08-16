import { z } from 'zod';
import type { Entitas, PetaKlasifikasi } from './klasifikasi.js';

/**
 * Kalender Hijriah — rujukan statis untuk konversi tanggal.
 *
 * Sumber otoritatif adalah PDF tahunan Ditjen Bimas Islam (ADR 0004). ADR 0013
 * mengizinkan penggunaan myQuran (`method=islamic-umalqura`) sebagai input
 * sementara selama PDF Kemenag belum tersedia; baris dari API ditandai
 * `provisional=1` dan wajib disetujui pengurus, terutama untuk tiga bulan isbat.
 */

const TanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD');
const WaktuIso = z.string().datetime({ offset: true });

export const SumberKalender = z.enum(['myquran', 'kemenag', 'manual']);
export type SumberKalender = z.infer<typeof SumberKalender>;

export const KalenderHijriah = z.object({
  tahun_hijriah: z.number().int().min(1).max(9999),
  bulan_hijriah: z.number().int().min(1).max(12),
  nama_bulan: z.string().trim().min(1),
  tanggal_mulai_masehi: TanggalIso,
  provisional: z.boolean(),
  disetujui_oleh: z.string().nullable(),
  disetujui_pada: WaktuIso.nullable(),
  /** Terisi saat worker mengingatkan pengurus (RFC-012) — tidak berulang. */
  diingatkan_pada: WaktuIso.nullable(),
  sumber: SumberKalender,
  catatan: z.string().trim().min(1).nullable(),
});
export type KalenderHijriah = z.infer<typeof KalenderHijriah>;

const klasifikasiKalenderHijriah: PetaKlasifikasi<KalenderHijriah> = {
  tahun_hijriah: 'publik',
  bulan_hijriah: 'publik',
  nama_bulan: 'publik',
  tanggal_mulai_masehi: 'publik',
  provisional: 'publik',
  disetujui_oleh: 'publik',
  disetujui_pada: 'publik',
  diingatkan_pada: 'publik',
  sumber: 'publik',
  catatan: 'publik',
};

export const entitasKalenderHijriah: Entitas<KalenderHijriah> = {
  nama: 'kalender_hijriah',
  skema: KalenderHijriah,
  kolom: [
    'tahun_hijriah',
    'bulan_hijriah',
    'nama_bulan',
    'tanggal_mulai_masehi',
    'provisional',
    'disetujui_oleh',
    'disetujui_pada',
    'diingatkan_pada',
    'sumber',
    'catatan',
  ],
  klasifikasi: klasifikasiKalenderHijriah,
};

export const DDL_KALENDER_HIJRIAH = `
CREATE TABLE kalender_hijriah (
  tahun_hijriah         INTEGER NOT NULL,
  bulan_hijriah         INTEGER NOT NULL CHECK (bulan_hijriah BETWEEN 1 AND 12),
  nama_bulan            TEXT NOT NULL,
  tanggal_mulai_masehi  TEXT NOT NULL,
  provisional           INTEGER NOT NULL CHECK (provisional IN (0,1)),
  disetujui_oleh        TEXT,
  disetujui_pada        TEXT,
  sumber                TEXT NOT NULL
    CHECK (sumber IN ('myquran','kemenag','manual')),
  catatan               TEXT,
  PRIMARY KEY (tahun_hijriah, bulan_hijriah)
) STRICT;
`;

export const TABEL_KALENDER_HIJRIAH: readonly string[] = ['kalender_hijriah'];
