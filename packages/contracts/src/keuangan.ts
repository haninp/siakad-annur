import { z } from 'zod';
import { Jalur, Marhalah, Ulid } from './enum.js';
import type { Entitas, PetaKlasifikasi } from './klasifikasi.js';

/**
 * Skema keuangan — hasil sesi P3 dan pembacaan berkas 01–04.
 *
 * Prinsip: angka turunan (tunggakan, saldo, sisa tagihan) tidak disimpan.
 * Mereka dihitung dari transaksi di lapisan OLAP. Lihat docs/01-domain-model.md.
 */

const TanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD');
const WaktuIso = z.string().datetime({ offset: true });
const Teks = z.string().trim().min(1);
const Uang = z.number().int().nonnegative();

// ── akun_keuangan ───────────────────────────────────────────────────────────

export const ArahAkun = z.enum(['masuk', 'keluar']);
export type ArahAkun = z.infer<typeof ArahAkun>;

/**
 * Bagan akun dari sheet master berkas 03 dan 04.
 * Kode 1–12 pemasukan, 21–31 pengeluaran. Kode 7–10 sengaja dibiarkan kosong.
 */
export const AkunKeuangan = z.object({
  kode: z.number().int().positive(),
  nama: Teks,
  arah: ArahAkun,
  aktif: z.boolean(),
});
export type AkunKeuangan = z.infer<typeof AkunKeuangan>;

const klasifikasiAkunKeuangan: PetaKlasifikasi<AkunKeuangan> = {
  kode: 'publik',
  nama: 'publik',
  arah: 'publik',
  aktif: 'publik',
};

export const entitasAkunKeuangan: Entitas<AkunKeuangan> = {
  nama: 'akun_keuangan',
  skema: AkunKeuangan,
  kolom: ['kode', 'nama', 'arah', 'aktif'],
  klasifikasi: klasifikasiAkunKeuangan,
};

// ── komponen_biaya ─────────────────────────────────────────────────────────

/**
 * Jenis tagihan yang muncul di Kartu Kendali berkas 04.
 * Besarannya berbeda per tahun ajaran & marhalah, jadi tarif disimpan terpisah.
 */
export const KomponenBiaya = z.object({
  id: Ulid,
  /** Kode stabil untuk Sheet dan impor. */
  kode: z.enum(['spp', 'pendaftaran', 'uang_gedung', 'sarpras', 'raport', 'modul_buku_atk', 'pkbm']),
  nama: Teks,
  akun_keuangan_kode: z.number().int().positive(),
  aktif: z.boolean(),
});
export type KomponenBiaya = z.infer<typeof KomponenBiaya>;

const klasifikasiKomponenBiaya: PetaKlasifikasi<KomponenBiaya> = {
  id: 'publik',
  kode: 'publik',
  nama: 'publik',
  akun_keuangan_kode: 'publik',
  aktif: 'publik',
};

export const entitasKomponenBiaya: Entitas<KomponenBiaya> = {
  nama: 'komponen_biaya',
  skema: KomponenBiaya,
  kolom: ['id', 'kode', 'nama', 'akun_keuangan_kode', 'aktif'],
  klasifikasi: klasifikasiKomponenBiaya,
};

// ── tarif_komponen ─────────────────────────────────────────────────────────

/**
 * Tarif per komponen, per tahun ajaran, dengan penyempitan marhalah/jalur/tingkat.
 * Bila `jalur`, `marhalah`, dan `tingkat` NULL, tarif berlaku umum untuk tahun ajaran itu.
 */
export const TarifKomponen = z.object({
  id: Ulid,
  tahun_ajaran_id: Ulid,
  komponen_biaya_id: Ulid,
  jalur: Jalur.nullable(),
  marhalah: Marhalah.nullable(),
  tingkat: z.number().int().min(1).max(12).nullable(),
  nominal: Uang,
  aktif: z.boolean(),
});
export type TarifKomponen = z.infer<typeof TarifKomponen>;

const klasifikasiTarifKomponen: PetaKlasifikasi<TarifKomponen> = {
  id: 'publik',
  tahun_ajaran_id: 'publik',
  komponen_biaya_id: 'publik',
  jalur: 'publik',
  marhalah: 'publik',
  tingkat: 'publik',
  nominal: 'publik',
  aktif: 'publik',
};

export const entitasTarifKomponen: Entitas<TarifKomponen> = {
  nama: 'tarif_komponen',
  skema: TarifKomponen,
  kolom: ['id', 'tahun_ajaran_id', 'komponen_biaya_id', 'jalur', 'marhalah', 'tingkat', 'nominal', 'aktif'],
  klasifikasi: klasifikasiTarifKomponen,
};

// ── tagihan ────────────────────────────────────────────────────────────────

export const StatusTagihan = z.enum(['terbit', 'lunas', 'dibatalkan']);
export type StatusTagihan = z.infer<typeof StatusTagihan>;

export const SkemaPeriode = z.enum(['hijriah', 'masehi']);
export type SkemaPeriode = z.infer<typeof SkemaPeriode>;

/**
 * Tagihan per santri per komponen per periode.
 * `nominal` adalah nilai akhir setelah prorata, sebelum keringanan.
 */
export const Tagihan = z.object({
  id: Ulid,
  santri_id: Ulid,
  tahun_ajaran_id: Ulid,
  komponen_biaya_id: Ulid,
  /** Bulan Masehi `2026-08` atau kode periode lain sesuai skema. */
  periode: Teks,
  skema_periode: SkemaPeriode,
  jatuh_tempo: TanggalIso,
  /** Nilai setelah prorata, sebelum keringanan. */
  nominal: Uang,
  /** Tanggal mulai KBM untuk perhitungan prorata; NULL berarti penuh. */
  prorata_mulai: TanggalIso.nullable(),
  status: StatusTagihan,
});
export type Tagihan = z.infer<typeof Tagihan>;

const klasifikasiTagihan: PetaKlasifikasi<Tagihan> = {
  id: 'internal',
  santri_id: 'internal',
  tahun_ajaran_id: 'publik',
  komponen_biaya_id: 'publik',
  periode: 'publik',
  skema_periode: 'publik',
  jatuh_tempo: 'publik',
  nominal: 'internal',
  prorata_mulai: 'publik',
  status: 'publik',
};

export const entitasTagihan: Entitas<Tagihan> = {
  nama: 'tagihan',
  skema: Tagihan,
  kolom: ['id', 'santri_id', 'tahun_ajaran_id', 'komponen_biaya_id', 'periode', 'skema_periode', 'jatuh_tempo', 'nominal', 'prorata_mulai', 'status'],
  klasifikasi: klasifikasiTagihan,
};

// ── keringanan ─────────────────────────────────────────────────────────────

/**
 * Pengurangan tagihan atas kebijakan pengurus atau permintaan resmi wali.
 * Besaran bisa nominal tetap atau persentase; salah satu yang terisi.
 */
export const Keringanan = z
  .object({
    id: Ulid,
    tagihan_id: Ulid,
    /** Nilai pengurangan dalam rupiah. */
    nominal: Uang.nullable(),
    /** Nilai pengurangan dalam persen 0–100. */
    persentase: z.number().int().min(0).max(100).nullable(),
    alasan: Teks,
    disetujui_oleh: Ulid,
    waktu: WaktuIso,
  })
  .refine(
    (k) => k.nominal !== null || k.persentase !== null,
    'nominal atau persentase keringanan harus diisi',
  );
export type Keringanan = z.infer<typeof Keringanan>;

const klasifikasiKeringanan: PetaKlasifikasi<Keringanan> = {
  id: 'internal',
  tagihan_id: 'internal',
  nominal: 'internal',
  persentase: 'internal',
  alasan: 'internal',
  disetujui_oleh: 'internal',
  waktu: 'internal',
};

export const entitasKeringanan: Entitas<Keringanan> = {
  nama: 'keringanan',
  skema: Keringanan,
  kolom: ['id', 'tagihan_id', 'nominal', 'persentase', 'alasan', 'disetujui_oleh', 'waktu'],
  klasifikasi: klasifikasiKeringanan,
};

// ── pembayaran ─────────────────────────────────────────────────────────────

export const MetodePembayaran = z.enum(['tunai', 'transfer', 'qris']);
export type MetodePembayaran = z.infer<typeof MetodePembayaran>;

export const SumberPembayaran = z.enum(['wali', 'orang_tua_asuh', 'prota', 'lainnya']);
export type SumberPembayaran = z.infer<typeof SumberPembayaran>;

/**
 * Satu pembayaran untuk satu tagihan. Banyak pembayaran bisa menutup satu tagihan
 * (cicilan sampai 6 kali).
 */
export const Pembayaran = z.object({
  id: Ulid,
  tagihan_id: Ulid,
  tanggal: TanggalIso,
  nominal: Uang,
  metode: MetodePembayaran,
  sumber: SumberPembayaran,
  /** Cicilan ke-1 sampai ke-6; NULL untuk pembayaran tunggal non-cicilan. */
  cicilan_ke: z.number().int().min(1).max(6).nullable(),
  /** Pengurus atau pengajar yang mencatat. */
  dicatat_oleh: Ulid,
  waktu: WaktuIso,
});
export type Pembayaran = z.infer<typeof Pembayaran>;

const klasifikasiPembayaran: PetaKlasifikasi<Pembayaran> = {
  id: 'internal',
  tagihan_id: 'internal',
  tanggal: 'internal',
  nominal: 'internal',
  metode: 'internal',
  sumber: 'internal',
  cicilan_ke: 'internal',
  dicatat_oleh: 'internal',
  waktu: 'internal',
};

export const entitasPembayaran: Entitas<Pembayaran> = {
  nama: 'pembayaran',
  skema: Pembayaran,
  kolom: ['id', 'tagihan_id', 'tanggal', 'nominal', 'metode', 'sumber', 'cicilan_ke', 'dicatat_oleh', 'waktu'],
  klasifikasi: klasifikasiPembayaran,
};

// ── prota ──────────────────────────────────────────────────────────────────

/**
 * Dana dari donatur yang dialokasikan menutup SPP santri asuhnya.
 * Sisa dana yang belum teralokasi digulirkan ke periode berikutnya (ADR 0012).
 */
export const Prota = z
  .object({
    id: Ulid,
    /** Donatur yang terdaftar sebagai wali; NULL bila donatur eksternal. */
    donatur_wali_id: Ulid.nullable(),
    /** Nama donatur bila tidak terdaftar sebagai wali. */
    nama_donatur: Teks.nullable(),
    santri_id: Ulid,
    tahun_ajaran_id: Ulid,
    periode: Teks,
    nominal: Uang,
    /** Sisa dana yang belum dialokasikan ke tagihan. */
    sisa: Uang,
  })
  .refine(
    (p) => p.donatur_wali_id !== null || p.nama_donatur !== null,
    'donatur_wali_id atau nama_donatur harus diisi',
  );
export type Prota = z.infer<typeof Prota>;

const klasifikasiProta: PetaKlasifikasi<Prota> = {
  id: 'internal',
  donatur_wali_id: 'internal',
  nama_donatur: 'internal',
  santri_id: 'internal',
  tahun_ajaran_id: 'publik',
  periode: 'publik',
  nominal: 'internal',
  sisa: 'internal',
};

export const entitasProta: Entitas<Prota> = {
  nama: 'prota',
  skema: Prota,
  kolom: ['id', 'donatur_wali_id', 'nama_donatur', 'santri_id', 'tahun_ajaran_id', 'periode', 'nominal', 'sisa'],
  klasifikasi: klasifikasiProta,
};

// ── alokasi_prota ──────────────────────────────────────────────────────────

/**
 * Satu setoran PROTA dapat dialokasikan ke banyak tagihan dan banyak bulan.
 * Tabel ini mencatat alokasinya.
 */
export const AlokasiProta = z.object({
  id: Ulid,
  prota_id: Ulid,
  tagihan_id: Ulid,
  nominal: Uang,
  waktu: WaktuIso,
});
export type AlokasiProta = z.infer<typeof AlokasiProta>;

const klasifikasiAlokasiProta: PetaKlasifikasi<AlokasiProta> = {
  id: 'internal',
  prota_id: 'internal',
  tagihan_id: 'internal',
  nominal: 'internal',
  waktu: 'internal',
};

export const entitasAlokasiProta: Entitas<AlokasiProta> = {
  nama: 'alokasi_prota',
  skema: AlokasiProta,
  kolom: ['id', 'prota_id', 'tagihan_id', 'nominal', 'waktu'],
  klasifikasi: klasifikasiAlokasiProta,
};

// ── lebih_bayar ────────────────────────────────────────────────────────────

/**
 * Saldo kredit santri karena pembayaran melebihi tagihan.
 * Dipotong ke tagihan berikutnya, tidak dikembalikan tunai (ADR 0012).
 */
export const LebihBayar = z.object({
  id: Ulid,
  santri_id: Ulid,
  nominal: Uang,
  /** Pembayaran yang menjadi asal lebih bayar; NULL untuk penyesuaian manual. */
  asal_pembayaran_id: Ulid.nullable(),
  waktu: WaktuIso,
});
export type LebihBayar = z.infer<typeof LebihBayar>;

const klasifikasiLebihBayar: PetaKlasifikasi<LebihBayar> = {
  id: 'internal',
  santri_id: 'internal',
  nominal: 'internal',
  asal_pembayaran_id: 'internal',
  waktu: 'internal',
};

export const entitasLebihBayar: Entitas<LebihBayar> = {
  nama: 'lebih_bayar',
  skema: LebihBayar,
  kolom: ['id', 'santri_id', 'nominal', 'asal_pembayaran_id', 'waktu'],
  klasifikasi: klasifikasiLebihBayar,
};

// ── pemakaian_lebih_bayar ──────────────────────────────────────────────────

/**
 * Pengurangan saldo lebih bayar saat dipotong ke tagihan berikutnya.
 * Tanpa tabel ini, saldo lebih bayar hanya bisa tumbuh (SUM nominal positif).
 */
export const PemakaianLebihBayar = z.object({
  id: Ulid,
  santri_id: Ulid,
  tagihan_id: Ulid,
  nominal: Uang,
  waktu: WaktuIso,
});
export type PemakaianLebihBayar = z.infer<typeof PemakaianLebihBayar>;

const klasifikasiPemakaianLebihBayar: PetaKlasifikasi<PemakaianLebihBayar> = {
  id: 'internal',
  santri_id: 'internal',
  tagihan_id: 'internal',
  nominal: 'internal',
  waktu: 'internal',
};

export const entitasPemakaianLebihBayar: Entitas<PemakaianLebihBayar> = {
  nama: 'pemakaian_lebih_bayar',
  skema: PemakaianLebihBayar,
  kolom: ['id', 'santri_id', 'tagihan_id', 'nominal', 'waktu'],
  klasifikasi: klasifikasiPemakaianLebihBayar,
};

// ── DDL ────────────────────────────────────────────────────────────────────

export const DDL_KEUANGAN = `
CREATE TABLE akun_keuangan (
  kode   INTEGER PRIMARY KEY,
  nama   TEXT NOT NULL,
  arah   TEXT NOT NULL CHECK (arah IN ('masuk','keluar')),
  aktif  INTEGER NOT NULL CHECK (aktif IN (0,1))
) STRICT;

CREATE TABLE komponen_biaya (
  id                  TEXT PRIMARY KEY,
  kode                TEXT NOT NULL UNIQUE
    CHECK (kode IN ('spp','pendaftaran','uang_gedung','sarpras','raport','modul_buku_atk','pkbm')),
  nama                TEXT NOT NULL,
  akun_keuangan_kode  INTEGER NOT NULL REFERENCES akun_keuangan(kode),
  aktif               INTEGER NOT NULL CHECK (aktif IN (0,1))
) STRICT;

CREATE TABLE tarif_komponen (
  id                  TEXT PRIMARY KEY,
  tahun_ajaran_id     TEXT NOT NULL REFERENCES tahun_ajaran(id),
  komponen_biaya_id   TEXT NOT NULL REFERENCES komponen_biaya(id),
  jalur               TEXT CHECK (jalur IN ('banin','banat','ra_paud')),
  marhalah            TEXT CHECK (marhalah IN ('paud','ra','ibtidaiyyah','mutawashitoh')),
  tingkat             INTEGER CHECK (tingkat BETWEEN 1 AND 12),
  nominal             INTEGER NOT NULL CHECK (nominal >= 0),
  aktif               INTEGER NOT NULL CHECK (aktif IN (0,1)),
  UNIQUE (tahun_ajaran_id, komponen_biaya_id, jalur, marhalah, tingkat)
) STRICT;

CREATE TABLE tagihan (
  id                   TEXT PRIMARY KEY,
  santri_id            TEXT NOT NULL REFERENCES santri(id),
  tahun_ajaran_id      TEXT NOT NULL REFERENCES tahun_ajaran(id),
  komponen_biaya_id    TEXT NOT NULL REFERENCES komponen_biaya(id),
  periode              TEXT NOT NULL,
  skema_periode        TEXT NOT NULL CHECK (skema_periode IN ('hijriah','masehi')),
  jatuh_tempo          TEXT NOT NULL,
  nominal              INTEGER NOT NULL CHECK (nominal >= 0),
  prorata_mulai        TEXT,
  status               TEXT NOT NULL CHECK (status IN ('terbit','lunas','dibatalkan')),
  UNIQUE (santri_id, tahun_ajaran_id, komponen_biaya_id, periode)
) STRICT;

CREATE TABLE keringanan (
  id              TEXT PRIMARY KEY,
  tagihan_id      TEXT NOT NULL REFERENCES tagihan(id),
  nominal         INTEGER CHECK (nominal >= 0),
  persentase      INTEGER CHECK (persentase BETWEEN 0 AND 100),
  alasan          TEXT NOT NULL,
  disetujui_oleh  TEXT NOT NULL,
  waktu           TEXT NOT NULL,
  CHECK (nominal IS NOT NULL OR persentase IS NOT NULL)
) STRICT;

CREATE TABLE pembayaran (
  id             TEXT PRIMARY KEY,
  tagihan_id     TEXT NOT NULL REFERENCES tagihan(id),
  tanggal        TEXT NOT NULL,
  nominal        INTEGER NOT NULL CHECK (nominal >= 0),
  metode         TEXT NOT NULL CHECK (metode IN ('tunai','transfer','qris')),
  sumber         TEXT NOT NULL CHECK (sumber IN ('wali','orang_tua_asuh','prota','lainnya')),
  cicilan_ke     INTEGER CHECK (cicilan_ke BETWEEN 1 AND 6),
  dicatat_oleh   TEXT NOT NULL,
  waktu          TEXT NOT NULL
) STRICT;

CREATE TABLE prota (
  id               TEXT PRIMARY KEY,
  donatur_wali_id  TEXT REFERENCES wali(id),
  nama_donatur     TEXT,
  santri_id        TEXT NOT NULL REFERENCES santri(id),
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id),
  periode          TEXT NOT NULL,
  nominal          INTEGER NOT NULL CHECK (nominal >= 0),
  sisa             INTEGER NOT NULL CHECK (sisa >= 0),
  CHECK (donatur_wali_id IS NOT NULL OR nama_donatur IS NOT NULL)
) STRICT;

CREATE TABLE alokasi_prota (
  id          TEXT PRIMARY KEY,
  prota_id    TEXT NOT NULL REFERENCES prota(id),
  tagihan_id  TEXT NOT NULL REFERENCES tagihan(id),
  nominal     INTEGER NOT NULL CHECK (nominal >= 0),
  waktu       TEXT NOT NULL
) STRICT;

CREATE TABLE lebih_bayar (
  id                   TEXT PRIMARY KEY,
  santri_id            TEXT NOT NULL REFERENCES santri(id),
  nominal              INTEGER NOT NULL CHECK (nominal >= 0),
  asal_pembayaran_id   TEXT REFERENCES pembayaran(id),
  waktu                TEXT NOT NULL
) STRICT;
`;

/** DDL tabel pemakaian_lebih_bayar — migrasi v4. */
export const DDL_PEMAKAIAN_LEBIH_BAYAR = `
CREATE TABLE pemakaian_lebih_bayar (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id),
  tagihan_id  TEXT NOT NULL REFERENCES tagihan(id),
  nominal     INTEGER NOT NULL CHECK (nominal >= 0),
  waktu       TEXT NOT NULL
) STRICT;
`;

/** Daftar tabel yang dibuat DDL di atas. */
export const TABEL_KEUANGAN: readonly string[] = [
  'akun_keuangan',
  'komponen_biaya',
  'tarif_komponen',
  'tagihan',
  'keringanan',
  'pembayaran',
  'prota',
  'alokasi_prota',
  'lebih_bayar',
];

/** Tabel yang dibuat oleh DDL_PEMAKAIAN_LEBIH_BAYAR. */
export const TABEL_PEMAKAIAN_LEBIH_BAYAR: readonly string[] = ['pemakaian_lebih_bayar'];
