import { z } from 'zod';

/**
 * Kosakata terkendali. Data lama menulis hal yang sama dengan banyak cara
 * (`RA - Tingkat A` dan `RA - KELAS A`, `BANIN - Ibtidaiyyah` dan `BANIN - IBTIDAIYYAH`),
 * jadi setiap dimensi di sini punya daftar nilai tertutup.
 *
 * Lihat docs/07-master-data.md.
 */

/** Kunci primer seluruh entitas. Lihat ADR 0008. */
export const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID tidak sah');
export type Ulid = z.infer<typeof Ulid>;

export const JenisKelamin = z.enum(['laki_laki', 'perempuan']);
export type JenisKelamin = z.infer<typeof JenisKelamin>;

export const StatusSantri = z.enum(['aktif', 'lulus', 'keluar', 'pindah']);
export type StatusSantri = z.infer<typeof StatusSantri>;

/**
 * Pemisahan putra/putri yang di sistem lama diwujudkan sebagai tiga sheet master
 * terpisah dengan penomoran sendiri-sendiri.
 */
export const Jalur = z.enum(['banin', 'banat', 'ra_paud']);
export type Jalur = z.infer<typeof Jalur>;

/**
 * `mutawashitoh` ADA dan berisi santri — kelas 7 dan 8 terbaca di berkas 03 dan 04.
 * docs/06 sebelumnya hanya mencatat RA-PAUD, MI Banin, MI Banat; itu tidak lengkap.
 */
export const Marhalah = z.enum(['paud', 'ra', 'ibtidaiyyah', 'mutawashitoh']);
export type Marhalah = z.infer<typeof Marhalah>;

/**
 * Berkas lama sengaja memelihara beberapa varian nama per orang (ASLI,
 * "Nama Santri Khusus Database Keuangan", "Master Nama SESUAI KTP").
 * Kunyah termasuk di sini, bukan kolom tersendiri.
 */
export const JenisAlias = z.enum(['ktp', 'kunyah', 'keuangan', 'panggilan', 'ejaan_lama']);
export type JenisAlias = z.infer<typeof JenisAlias>;

/** Asal-usul tiap alias, supaya bisa ditelusuri saat rekonsiliasi. */
export const SumberAlias = z.enum(['berkas_01', 'berkas_02', 'berkas_03', 'berkas_04', 'manual']);
export type SumberAlias = z.infer<typeof SumberAlias>;

export const HubunganWali = z.enum(['ayah', 'ibu', 'wali']);
export type HubunganWali = z.infer<typeof HubunganWali>;

/**
 * `tidak_diketahui` sengaja dibedakan dari `hidup`. Di data nyata `status_ibu`
 * kosong seluruhnya sementara `status_ayah` terisi — memperlakukan kosong sebagai
 * "masih hidup" akan diam-diam menghapus status piatu seorang santri.
 */
export const StatusHidup = z.enum(['hidup', 'wafat', 'tidak_diketahui']);
export type StatusHidup = z.infer<typeof StatusHidup>;

export const StatusPendaftaran = z.enum(['aktif', 'naik', 'tinggal', 'keluar', 'lulus']);
export type StatusPendaftaran = z.infer<typeof StatusPendaftaran>;

/** Dua jalur kurikulum sudah ada sejak berkas 01. */
export const JalurKurikulum = z.enum(['diniyah', 'umum']);
export type JalurKurikulum = z.infer<typeof JalurKurikulum>;

/**
 * Keempatnya berbeda cara hidupnya: `angka` bernilai 0–100, `predikat` bernilai
 * simbolik, `hafalan` diukur sebagai capaian juz/halaman — bukan skor — dan
 * `deskriptif` untuk aspek akhlak yang dinilai dengan kalimat.
 */
export const JenisPenilaian = z.enum(['angka', 'predikat', 'hafalan', 'deskriptif']);
export type JenisPenilaian = z.infer<typeof JenisPenilaian>;

export const JenisSkala = z.enum(['angka', 'predikat']);
export type JenisSkala = z.infer<typeof JenisSkala>;

/**
 * Status keyatiman TIDAK disimpan — ia diturunkan dari `wali.status_hidup`.
 * Tipe ini hanya bentuk hasil hitungannya. Lihat `hitungStatusYatim`.
 */
export const StatusYatim = z.enum(['yatim', 'piatu', 'yatim_piatu']);
export type StatusYatim = z.infer<typeof StatusYatim>;
