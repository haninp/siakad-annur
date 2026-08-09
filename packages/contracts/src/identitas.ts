import { z } from 'zod';
import {
  HubunganWali,
  JenisAlias,
  JenisKelamin,
  StatusHidup,
  StatusSantri,
  SumberAlias,
  Ulid,
} from './enum.js';
import type { Entitas, PetaKlasifikasi } from './klasifikasi.js';

/**
 * Identitas: santri, wali, pengajar, dan alias nama masing-masing.
 * Bentuknya diturunkan dari isi nyata berkas 04 — lihat docs/07-master-data.md.
 */

/** 16 digit. Data pribadi — klasifikasi `terlarang`. */
const Nik = z.string().regex(/^\d{16}$/, 'NIK harus 16 digit');

/** Tanggal ISO `YYYY-MM-DD`. Waktu disimpan Masehi (AGENTS.md). */
const TanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD');

const NamaOrang = z.string().trim().min(1, 'nama tidak boleh kosong');

// ── santri ──────────────────────────────────────────────────────────────────

export const Santri = z.object({
  id: Ulid,
  /**
   * Bermakna: 4 digit tahun ajaran masuk + 3 digit urut (`2627001`).
   * Unik, tapi **boleh berubah** — kolom `NIS CLONING` dan `No Induk (Baru)` di
   * berkas 04 membuktikan penomoran ulang pernah terjadi. Lihat ADR 0008.
   */
  nis: z.string().trim().min(1),
  /** Kosong seluruhnya di data nyata; ditandai `update NISN 2026` sejak berkas 03. */
  nisn: z.string().trim().min(1).nullable(),
  nik: Nik.nullable(),
  /** Nama kanonik. Varian lain masuk `santri_alias`. */
  nama_lengkap: NamaOrang,
  jenis_kelamin: JenisKelamin,
  tempat_lahir: z.string().trim().min(1),
  tanggal_lahir: TanggalIso,
  alamat: z.string().trim().min(1).nullable(),
  desa_kelurahan: z.string().trim().min(1).nullable(),
  kecamatan: z.string().trim().min(1).nullable(),
  kabupaten: z.string().trim().min(1).nullable(),
  provinsi: z.string().trim().min(1).nullable(),
  kode_pos: z.string().trim().min(1).nullable(),
  status: StatusSantri,
  anak_ke: z.number().int().positive().nullable(),
  jumlah_saudara: z.number().int().nonnegative().nullable(),
});
export type Santri = z.infer<typeof Santri>;

const klasifikasiSantri: PetaKlasifikasi<Santri> = {
  id: 'internal',
  nis: 'internal',
  nisn: 'internal',
  nik: 'terlarang',
  nama_lengkap: 'internal',
  jenis_kelamin: 'internal',
  tempat_lahir: 'sensitif',
  tanggal_lahir: 'sensitif',
  alamat: 'sensitif',
  desa_kelurahan: 'sensitif',
  kecamatan: 'sensitif',
  kabupaten: 'sensitif',
  provinsi: 'sensitif',
  kode_pos: 'sensitif',
  status: 'internal',
  anak_ke: 'sensitif',
  jumlah_saudara: 'sensitif',
};

export const entitasSantri: Entitas<Santri> = {
  nama: 'santri',
  skema: Santri,
  kolom: Object.keys(Santri.shape) as (keyof Santri & string)[],
  klasifikasi: klasifikasiSantri,
};

// ── wali ────────────────────────────────────────────────────────────────────

export const Wali = z.object({
  id: Ulid,
  /** Nullable: belum didata di sheet mana pun. Pengumpulannya butuh persetujuan. */
  nik: Nik.nullable(),
  /** Kunyah dipisahkan ke `wali_alias`, tidak disimpan dalam kurung. */
  nama_lengkap: NamaOrang,
  no_hp: z.string().trim().min(1).nullable(),
  /** Bisa berbeda dari alamat santri — orang tua yang berpisah, atau wali di kota lain. */
  alamat: z.string().trim().min(1).nullable(),
  status_hidup: StatusHidup,
});
export type Wali = z.infer<typeof Wali>;

const klasifikasiWali: PetaKlasifikasi<Wali> = {
  id: 'internal',
  nik: 'terlarang',
  nama_lengkap: 'internal',
  no_hp: 'sensitif',
  alamat: 'sensitif',
  status_hidup: 'sensitif',
};

export const entitasWali: Entitas<Wali> = {
  nama: 'wali',
  skema: Wali,
  kolom: Object.keys(Wali.shape) as (keyof Wali & string)[],
  klasifikasi: klasifikasiWali,
};

// ── santri_wali ─────────────────────────────────────────────────────────────

export const SantriWali = z.object({
  santri_id: Ulid,
  wali_id: Ulid,
  hubungan: HubunganWali,
  /**
   * Boolean, dan sengaja tidak lebih dari itu. `yg_membiayai_sekolah` di berkas 04
   * berisi `Orang Tua` untuk seluruh baris; pembiayaan pihak lain berbentuk PROTA
   * dan keringanan, dan keduanya **transaksi**, bukan sifat hubungan santri–wali.
   */
  penanggung_biaya: z.boolean(),
  /**
   * Boolean per baris — sehingga ayah dan ibu bisa sama-sama menerima notifikasi.
   * `core` menegakkan: tiap santri wajib punya sekurangnya satu baris bernilai true.
   */
  penerima_notifikasi: z.boolean(),
  /**
   * Hubungan bisa berakhir — wali meninggal, perwalian berpindah, orang tua asuh
   * berhenti menanggung. Dinonaktifkan, **tidak dihapus**: transaksi lama yang
   * menyebut wali itu harus tetap punya rujukan.
   */
  aktif: z.boolean(),
});
export type SantriWali = z.infer<typeof SantriWali>;

const klasifikasiSantriWali: PetaKlasifikasi<SantriWali> = {
  santri_id: 'internal',
  wali_id: 'internal',
  hubungan: 'sensitif',
  penanggung_biaya: 'sensitif',
  penerima_notifikasi: 'internal',
  aktif: 'internal',
};

export const entitasSantriWali: Entitas<SantriWali> = {
  nama: 'santri_wali',
  skema: SantriWali,
  kolom: Object.keys(SantriWali.shape) as (keyof SantriWali & string)[],
  klasifikasi: klasifikasiSantriWali,
};

// ── pengajar ────────────────────────────────────────────────────────────────

export const Pengajar = z.object({
  id: Ulid,
  /** Berpola tahun + urut (`2301001`, `2302004`). */
  no_induk: z.string().trim().min(1),
  nik: Nik.nullable(),
  /**
   * Boleh berisi kunyah bila itu satu-satunya nama yang diketahui — sebagian
   * pengajar tercatat hanya begitu (`ABU AUFA UKASAH`, `UMMU ZAHRO`).
   */
  nama_lengkap: NamaOrang,
  jalur_kurikulum: z.enum(['diniyah', 'umum']),
  jalur: z.enum(['banin', 'banat', 'ra_paud']),
  /** Pengajar yang berhenti dinonaktifkan, bukan dihapus — mukafaah lama merujuknya. */
  aktif: z.boolean(),
});
export type Pengajar = z.infer<typeof Pengajar>;

const klasifikasiPengajar: PetaKlasifikasi<Pengajar> = {
  id: 'internal',
  no_induk: 'internal',
  nik: 'terlarang',
  nama_lengkap: 'internal',
  jalur_kurikulum: 'internal',
  jalur: 'internal',
  aktif: 'internal',
};

export const entitasPengajar: Entitas<Pengajar> = {
  nama: 'pengajar',
  skema: Pengajar,
  kolom: Object.keys(Pengajar.shape) as (keyof Pengajar & string)[],
  klasifikasi: klasifikasiPengajar,
};

// ── alias nama ──────────────────────────────────────────────────────────────

/**
 * Tiga tabel berbentuk sama, satu untuk tiap entitas orang. Bentuknya identik
 * sehingga lahir dari satu pembentuk yang sama, tetapi **kunci asingnya terpisah**
 * supaya integritas rujukan tetap ditegakkan basis data — bukan oleh kolom
 * `jenis_entitas` yang tidak bisa diperiksa siapa pun.
 *
 * Tidak disatukan jadi satu tabel `orang` karena sudah diperiksa di data: dari
 * 100 nama wali dan 24 nama pengajar, **irisannya nol**.
 */
const isiAlias = {
  nama: NamaOrang,
  jenis: JenisAlias,
  sumber: SumberAlias,
};

export const SantriAlias = z.object({ santri_id: Ulid, ...isiAlias });
export type SantriAlias = z.infer<typeof SantriAlias>;

export const WaliAlias = z.object({ wali_id: Ulid, ...isiAlias });
export type WaliAlias = z.infer<typeof WaliAlias>;

export const PengajarAlias = z.object({ pengajar_id: Ulid, ...isiAlias });
export type PengajarAlias = z.infer<typeof PengajarAlias>;

export const entitasSantriAlias: Entitas<SantriAlias> = {
  nama: 'santri_alias',
  skema: SantriAlias,
  kolom: ['santri_id', 'nama', 'jenis', 'sumber'],
  klasifikasi: { santri_id: 'internal', nama: 'internal', jenis: 'internal', sumber: 'internal' },
};

export const entitasWaliAlias: Entitas<WaliAlias> = {
  nama: 'wali_alias',
  skema: WaliAlias,
  kolom: ['wali_id', 'nama', 'jenis', 'sumber'],
  klasifikasi: { wali_id: 'internal', nama: 'internal', jenis: 'internal', sumber: 'internal' },
};

export const entitasPengajarAlias: Entitas<PengajarAlias> = {
  nama: 'pengajar_alias',
  skema: PengajarAlias,
  kolom: ['pengajar_id', 'nama', 'jenis', 'sumber'],
  klasifikasi: {
    pengajar_id: 'internal',
    nama: 'internal',
    jenis: 'internal',
    sumber: 'internal',
  },
};
