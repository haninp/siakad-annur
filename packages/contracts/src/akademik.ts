import { z } from 'zod';
import {
  Jalur,
  JalurKurikulum,
  JenisPenilaian,
  JenisSkala,
  Marhalah,
  StatusPendaftaran,
  Ulid,
} from './enum.js';
import type { Entitas } from './klasifikasi.js';

/**
 * Akademik adalah lahan kosong — tidak ada sistem akademik di Drive untuk
 * dimigrasikan. Yang dirancang di sini adalah **wadahnya**, dibuat supaya daftar
 * mapel bisa diisi, diubah, dan berbeda antar jalur maupun antar tahun **tanpa
 * mengubah skema**. Tidak ada satu pun nama mapel yang hidup di dalam skema.
 */

const TanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD');
const Teks = z.string().trim().min(1);

// ── tahun_ajaran ────────────────────────────────────────────────────────────

export const TahunAjaran = z.object({
  id: Ulid,
  /** Misal `2026/2027`. */
  kode: z.string().regex(/^\d{4}\/\d{4}$/, 'kode tahun ajaran harus YYYY/YYYY'),
  mulai: TanggalIso,
  selesai: TanggalIso,
  aktif: z.boolean(),
});
export type TahunAjaran = z.infer<typeof TahunAjaran>;

export const entitasTahunAjaran: Entitas<TahunAjaran> = {
  nama: 'tahun_ajaran',
  skema: TahunAjaran,
  kolom: ['id', 'kode', 'mulai', 'selesai', 'aktif'],
  klasifikasi: {
    id: 'publik',
    kode: 'publik',
    mulai: 'publik',
    selesai: 'publik',
    aktif: 'publik',
  },
};

// ── rombel ──────────────────────────────────────────────────────────────────

/**
 * Kelas nyata tempat santri belajar, milik satu tahun ajaran.
 * Data lama mencampur jalur, marhalah, dan rombel dalam satu teks
 * (`BANIN - Mutawashitoh`, `RA - Tingkat A`); di sini ketiganya terpisah karena
 * berubah dengan irama berbeda.
 */
export const Rombel = z.object({
  id: Ulid,
  tahun_ajaran_id: Ulid,
  jalur: Jalur,
  marhalah: Marhalah,
  /** Nama tampil, misal `RA - Tingkat A` atau `1 (SATU)`. */
  nama: Teks,
  /** 1–6 untuk Ibtidaiyyah, 7–8 untuk Mutawashitoh. Kosong untuk PAUD/RA. */
  tingkat: z.number().int().min(1).max(12).nullable(),
  wali_kelas_pengajar_id: Ulid.nullable(),
});
export type Rombel = z.infer<typeof Rombel>;

export const entitasRombel: Entitas<Rombel> = {
  nama: 'rombel',
  skema: Rombel,
  kolom: [
    'id',
    'tahun_ajaran_id',
    'jalur',
    'marhalah',
    'nama',
    'tingkat',
    'wali_kelas_pengajar_id',
  ],
  klasifikasi: {
    id: 'publik',
    tahun_ajaran_id: 'publik',
    jalur: 'publik',
    marhalah: 'publik',
    nama: 'publik',
    tingkat: 'publik',
    wali_kelas_pengajar_id: 'internal',
  },
};

// ── pendaftaran ─────────────────────────────────────────────────────────────

/**
 * Menghubungkan santri ke rombel **per tahun ajaran**. Inilah yang membuat
 * pertanyaan "kelas berapa dia waktu itu" bisa dijawab — pada model lama kelas
 * ditimpa setiap kenaikan sehingga riwayatnya hilang.
 */
export const Pendaftaran = z.object({
  santri_id: Ulid,
  tahun_ajaran_id: Ulid,
  rombel_id: Ulid,
  /** Dasar prorata SPP. */
  tanggal_masuk: TanggalIso,
  /** Aturan tagihannya menunggu sesi P3. */
  tanggal_keluar: TanggalIso.nullable(),
  status: StatusPendaftaran,
});
export type Pendaftaran = z.infer<typeof Pendaftaran>;

export const entitasPendaftaran: Entitas<Pendaftaran> = {
  nama: 'pendaftaran',
  skema: Pendaftaran,
  kolom: ['santri_id', 'tahun_ajaran_id', 'rombel_id', 'tanggal_masuk', 'tanggal_keluar', 'status'],
  klasifikasi: {
    santri_id: 'internal',
    tahun_ajaran_id: 'internal',
    rombel_id: 'internal',
    tanggal_masuk: 'internal',
    tanggal_keluar: 'sensitif',
    status: 'internal',
  },
};

// ── kurikulum ───────────────────────────────────────────────────────────────

export const SkalaNilai = z.object({
  id: Ulid,
  nama: Teks,
  jenis: JenisSkala,
  nilai_min: z.number().nullable(),
  nilai_max: z.number().nullable(),
});
export type SkalaNilai = z.infer<typeof SkalaNilai>;

export const entitasSkalaNilai: Entitas<SkalaNilai> = {
  nama: 'skala_nilai',
  skema: SkalaNilai,
  kolom: ['id', 'nama', 'jenis', 'nilai_min', 'nilai_max'],
  klasifikasi: {
    id: 'publik',
    nama: 'publik',
    jenis: 'publik',
    nilai_min: 'publik',
    nilai_max: 'publik',
  },
};

/** Supaya skala nilai diniyah bisa ditetapkan sebagai data seed, bukan perubahan kode. */
export const SkalaNilaiButir = z.object({
  skala_nilai_id: Ulid,
  kode: Teks,
  label: Teks,
  label_arab: Teks.nullable(),
  urutan: z.number().int().nonnegative(),
  batas_bawah: z.number().nullable(),
  batas_atas: z.number().nullable(),
});
export type SkalaNilaiButir = z.infer<typeof SkalaNilaiButir>;

export const entitasSkalaNilaiButir: Entitas<SkalaNilaiButir> = {
  nama: 'skala_nilai_butir',
  skema: SkalaNilaiButir,
  kolom: ['skala_nilai_id', 'kode', 'label', 'label_arab', 'urutan', 'batas_bawah', 'batas_atas'],
  klasifikasi: {
    skala_nilai_id: 'publik',
    kode: 'publik',
    label: 'publik',
    label_arab: 'publik',
    urutan: 'publik',
    batas_bawah: 'publik',
    batas_atas: 'publik',
  },
};

/** Katalog datar. Mapel yang tidak lagi diajarkan **dinonaktifkan, tidak dihapus**. */
export const Mapel = z.object({
  id: Ulid,
  /** Dipakai di Sheet dan ekspor, stabil walau namanya diperbaiki. */
  kode: Teks,
  nama: Teks,
  nama_arab: Teks.nullable(),
  jalur_kurikulum: JalurKurikulum,
  jenis_penilaian: JenisPenilaian,
  /** Kosong bila `jenis_penilaian = hafalan`. */
  skala_nilai_id: Ulid.nullable(),
  aktif: z.boolean(),
});
export type Mapel = z.infer<typeof Mapel>;

export const entitasMapel: Entitas<Mapel> = {
  nama: 'mapel',
  skema: Mapel,
  kolom: [
    'id',
    'kode',
    'nama',
    'nama_arab',
    'jalur_kurikulum',
    'jenis_penilaian',
    'skala_nilai_id',
    'aktif',
  ],
  klasifikasi: {
    id: 'publik',
    kode: 'publik',
    nama: 'publik',
    nama_arab: 'publik',
    jalur_kurikulum: 'publik',
    jenis_penilaian: 'publik',
    skala_nilai_id: 'publik',
    aktif: 'publik',
  },
};

/**
 * Di sinilah fleksibilitasnya. Karena kuncinya memuat `tahun_ajaran_id`, mengubah
 * kurikulum tahun depan **tidak menyentuh kurikulum tahun ini** — dan rapor lama
 * tetap bisa dicetak ulang persis seperti aslinya.
 */
export const Kurikulum = z.object({
  tahun_ajaran_id: Ulid,
  marhalah: Marhalah,
  mapel_id: Ulid,
  /** Bila mapel hanya untuk tingkat tertentu. */
  tingkat: z.number().int().min(1).max(12).nullable(),
  urutan: z.number().int().nonnegative(),
  jam_per_pekan: z.number().int().positive().nullable(),
  /** Batas ketuntasan, bila `jenis_penilaian = angka`. */
  kkm: z.number().int().min(0).max(100).nullable(),
});
export type Kurikulum = z.infer<typeof Kurikulum>;

export const entitasKurikulum: Entitas<Kurikulum> = {
  nama: 'kurikulum',
  skema: Kurikulum,
  kolom: ['tahun_ajaran_id', 'marhalah', 'mapel_id', 'tingkat', 'urutan', 'jam_per_pekan', 'kkm'],
  klasifikasi: {
    tahun_ajaran_id: 'publik',
    marhalah: 'publik',
    mapel_id: 'publik',
    tingkat: 'publik',
    urutan: 'publik',
    jam_per_pekan: 'publik',
    kkm: 'publik',
  },
};
