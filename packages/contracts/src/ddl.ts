/**
 * DDL SQLite untuk master data identitas dan akademik.
 *
 * Bagian keuangan (`akun_keuangan`, `komponen_biaya`) **sengaja belum ada** —
 * menunggu sesi P3. Lihat docs/06-migrasi-legacy.md.
 *
 * Konvensi: nama tabel dan kolom Bahasa Indonesia (AGENTS.md). Tanggal disimpan
 * TEXT ber-format ISO `YYYY-MM-DD`; boolean disimpan INTEGER 0/1, sebagaimana
 * lazimnya SQLite.
 */

const identitas = `
CREATE TABLE santri (
  id              TEXT PRIMARY KEY,
  nis             TEXT NOT NULL UNIQUE,
  nisn            TEXT UNIQUE,
  nik             TEXT UNIQUE,
  nama_lengkap    TEXT NOT NULL,
  jenis_kelamin   TEXT NOT NULL CHECK (jenis_kelamin IN ('laki_laki','perempuan')),
  tempat_lahir    TEXT NOT NULL,
  tanggal_lahir   TEXT NOT NULL,
  alamat          TEXT,
  desa_kelurahan  TEXT,
  kecamatan       TEXT,
  kabupaten       TEXT,
  provinsi        TEXT,
  kode_pos        TEXT,
  status          TEXT NOT NULL CHECK (status IN ('aktif','lulus','keluar','pindah')),
  anak_ke         INTEGER,
  jumlah_saudara  INTEGER
) STRICT;

CREATE TABLE wali (
  id            TEXT PRIMARY KEY,
  nik           TEXT UNIQUE,
  nama_lengkap  TEXT NOT NULL,
  no_hp         TEXT,
  alamat        TEXT,
  status_hidup  TEXT NOT NULL CHECK (status_hidup IN ('hidup','wafat','tidak_diketahui'))
) STRICT;

CREATE TABLE pengajar (
  id               TEXT PRIMARY KEY,
  no_induk         TEXT NOT NULL UNIQUE,
  nik              TEXT UNIQUE,
  nama_lengkap     TEXT NOT NULL,
  jalur_kurikulum  TEXT NOT NULL CHECK (jalur_kurikulum IN ('diniyah','umum')),
  jalur            TEXT NOT NULL CHECK (jalur IN ('banin','banat','ra_paud')),
  aktif            INTEGER NOT NULL CHECK (aktif IN (0,1))
) STRICT;

CREATE TABLE santri_wali (
  santri_id            TEXT NOT NULL REFERENCES santri(id),
  wali_id              TEXT NOT NULL REFERENCES wali(id),
  hubungan             TEXT NOT NULL CHECK (hubungan IN ('ayah','ibu','wali','asuh')),
  penanggung_biaya     INTEGER NOT NULL CHECK (penanggung_biaya IN (0,1)),
  penerima_notifikasi  INTEGER NOT NULL CHECK (penerima_notifikasi IN (0,1)),
  aktif                INTEGER NOT NULL CHECK (aktif IN (0,1)),
  PRIMARY KEY (santri_id, wali_id, hubungan)
) STRICT;
`;

/**
 * Tiga tabel alias berbentuk sama dengan kunci asing terpisah — supaya integritas
 * rujukan ditegakkan basis data, bukan oleh kolom `jenis_entitas` yang tidak bisa
 * diperiksa siapa pun. Lihat ADR 0008.
 */
const alias = (['santri', 'wali', 'pengajar'] as const)
  .map(
    (e) => `
CREATE TABLE ${e}_alias (
  ${e}_id  TEXT NOT NULL REFERENCES ${e}(id),
  nama     TEXT NOT NULL,
  jenis    TEXT NOT NULL CHECK (jenis IN ('ktp','kunyah','keuangan','panggilan','ejaan_lama')),
  sumber   TEXT NOT NULL
    CHECK (sumber IN ('berkas_01','berkas_02','berkas_03','berkas_04','manual')),
  PRIMARY KEY (${e}_id, nama, jenis)
) STRICT;

CREATE INDEX idx_${e}_alias_nama ON ${e}_alias(nama);`,
  )
  .join('\n');

const akademik = `
CREATE TABLE tahun_ajaran (
  id       TEXT PRIMARY KEY,
  kode     TEXT NOT NULL UNIQUE,
  mulai    TEXT NOT NULL,
  selesai  TEXT NOT NULL,
  aktif    INTEGER NOT NULL CHECK (aktif IN (0,1))
) STRICT;

CREATE TABLE rombel (
  id                      TEXT PRIMARY KEY,
  tahun_ajaran_id         TEXT NOT NULL REFERENCES tahun_ajaran(id),
  jalur                   TEXT NOT NULL CHECK (jalur IN ('banin','banat','ra_paud')),
  marhalah                TEXT NOT NULL
    CHECK (marhalah IN ('paud','ra','ibtidaiyyah','mutawashitoh')),
  nama                    TEXT NOT NULL,
  tingkat                 INTEGER CHECK (tingkat BETWEEN 1 AND 12),
  wali_kelas_pengajar_id  TEXT REFERENCES pengajar(id),
  UNIQUE (tahun_ajaran_id, jalur, marhalah, nama)
) STRICT;

CREATE TABLE pendaftaran (
  santri_id        TEXT NOT NULL REFERENCES santri(id),
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id),
  rombel_id        TEXT NOT NULL REFERENCES rombel(id),
  tanggal_masuk    TEXT NOT NULL,
  tanggal_keluar   TEXT,
  status           TEXT NOT NULL
    CHECK (status IN ('aktif','naik','tinggal','keluar','lulus')),
  PRIMARY KEY (santri_id, tahun_ajaran_id)
) STRICT;

CREATE TABLE skala_nilai (
  id         TEXT PRIMARY KEY,
  nama       TEXT NOT NULL,
  jenis      TEXT NOT NULL CHECK (jenis IN ('angka','predikat')),
  nilai_min  REAL,
  nilai_max  REAL
) STRICT;

CREATE TABLE skala_nilai_butir (
  skala_nilai_id  TEXT NOT NULL REFERENCES skala_nilai(id),
  kode            TEXT NOT NULL,
  label           TEXT NOT NULL,
  label_arab      TEXT,
  urutan          INTEGER NOT NULL,
  batas_bawah     REAL,
  batas_atas      REAL,
  PRIMARY KEY (skala_nilai_id, kode)
) STRICT;

CREATE TABLE mapel (
  id               TEXT PRIMARY KEY,
  kode             TEXT NOT NULL UNIQUE,
  nama             TEXT NOT NULL,
  nama_arab        TEXT,
  jalur_kurikulum  TEXT NOT NULL CHECK (jalur_kurikulum IN ('diniyah','umum')),
  jenis_penilaian  TEXT NOT NULL
    CHECK (jenis_penilaian IN ('angka','predikat','hafalan','deskriptif')),
  skala_nilai_id   TEXT REFERENCES skala_nilai(id),
  aktif            INTEGER NOT NULL CHECK (aktif IN (0,1))
) STRICT;

CREATE TABLE kurikulum (
  tahun_ajaran_id  TEXT NOT NULL REFERENCES tahun_ajaran(id),
  marhalah         TEXT NOT NULL
    CHECK (marhalah IN ('paud','ra','ibtidaiyyah','mutawashitoh')),
  mapel_id         TEXT NOT NULL REFERENCES mapel(id),
  tingkat          INTEGER CHECK (tingkat BETWEEN 1 AND 12),
  urutan           INTEGER NOT NULL,
  jam_per_pekan    INTEGER,
  kkm              INTEGER CHECK (kkm BETWEEN 0 AND 100),
  PRIMARY KEY (tahun_ajaran_id, marhalah, mapel_id, tingkat)
) STRICT;
`;

/**
 * DDL lengkap, berurutan — tidak ada rujukan melingkar.
 *
 * Penugasan wali kelas hidup **hanya** di `rombel.wali_kelas_pengajar_id`.
 * docs/07 menaruhnya di `pengajar.wali_kelas_rombel_id`; itu keliru dua kali —
 * fakta yang sama di dua tempat pasti menyimpang, dan penugasan itu berganti tiap
 * tahun sehingga tempatnya memang di `rombel`, yang sudah terikat tahun ajaran.
 */
export const DDL_MASTER_DATA: string = [identitas, alias, akademik].join('\n');

/** Nama tabel yang dibuat DDL di atas, berurutan sebagaimana didefinisikan. */
export const TABEL_MASTER_DATA: readonly string[] = [
  'santri',
  'wali',
  'pengajar',
  'santri_wali',
  'santri_alias',
  'wali_alias',
  'pengajar_alias',
  'tahun_ajaran',
  'rombel',
  'pendaftaran',
  'skala_nilai',
  'skala_nilai_butir',
  'mapel',
  'kurikulum',
];

// Skema keuangan didefinisikan di keuangan.ts agar file ini tidak terlalu besar.
export { DDL_KEUANGAN, TABEL_KEUANGAN } from './keuangan.js';
