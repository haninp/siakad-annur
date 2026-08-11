import { DatabaseSync } from 'node:sqlite';
import {
  TABEL_IZIN,
  TABEL_KEUANGAN,
  TABEL_MASTER_DATA,
  TABEL_PEMAKAIAN_LEBIH_BAYAR,
} from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from './daftar-migrasi.js';
import { jalankanMigrasi, sidikJari, versiTerpasang, type Migrasi } from './migrasi.js';

function basisDataBaru(): DatabaseSync {
  return new DatabaseSync(':memory:');
}

function daftarTabel(db: DatabaseSync): string[] {
  const baris = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return baris.map((b) => b.name);
}

describe('runner migrasi', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = basisDataBaru();
  });

  it('basis data kosong belum punya versi', () => {
    expect(versiTerpasang(db)).toBe(0);
  });

  it('menerapkan seluruh migrasi pada basis data kosong', () => {
    const hasil = jalankanMigrasi(db, DAFTAR_MIGRASI);
    expect(hasil.diterapkan).toEqual([1, 2, 3, 4]);
    expect(versiTerpasang(db)).toBe(4);
  });

  it('membuat setiap tabel yang dijanjikan contracts', () => {
    jalankanMigrasi(db, DAFTAR_MIGRASI);
    const ada = daftarTabel(db);
    for (const tabel of [
      ...TABEL_MASTER_DATA,
      ...TABEL_IZIN,
      ...TABEL_KEUANGAN,
      ...TABEL_PEMAKAIAN_LEBIH_BAYAR,
    ]) {
      expect(ada).toContain(tabel);
    }
  });

  it('idempoten — panggilan kedua tidak menerapkan apa pun', () => {
    jalankanMigrasi(db, DAFTAR_MIGRASI);
    const kedua = jalankanMigrasi(db, DAFTAR_MIGRASI);
    expect(kedua.diterapkan).toEqual([]);
    expect(kedua.sudahAda).toEqual([1, 2, 3, 4]);
  });

  /**
   * Properti inti runner ini. Migrasi yang sudah diterapkan lalu disunting berarti
   * isi basis data dan isi kode tidak lagi menggambarkan hal yang sama — dan itu
   * jenis penyimpangan yang paling sulit ditemukan belakangan.
   */
  it('menolak berjalan bila migrasi yang sudah diterapkan disunting', () => {
    jalankanMigrasi(db, DAFTAR_MIGRASI);

    const disunting = DAFTAR_MIGRASI.map((m) =>
      m.versi === 1 ? { ...m, sql: `${m.sql}\n-- satu komentar saja` } : m,
    );
    expect(() => jalankanMigrasi(db, disunting)).toThrow(/berubah setelah diterapkan/);
  });

  it('menolak berjalan bila migrasi yang sudah diterapkan dihapus dari daftar', () => {
    jalankanMigrasi(db, DAFTAR_MIGRASI);
    const dipotong = DAFTAR_MIGRASI.filter((m) => m.versi !== 2);
    expect(() => jalankanMigrasi(db, dipotong)).toThrow(/tidak ada di daftar/);
  });

  it('menolak daftar dengan versi ganda', () => {
    const ganda: Migrasi[] = [
      { versi: 1, nama: 'a', sql: 'CREATE TABLE a(x TEXT) STRICT;' },
      { versi: 1, nama: 'b', sql: 'CREATE TABLE b(x TEXT) STRICT;' },
    ];
    expect(() => jalankanMigrasi(db, ganda)).toThrow(/lebih dari sekali/);
  });

  it('menolak daftar yang tidak menaik', () => {
    const kacau: Migrasi[] = [
      { versi: 2, nama: 'b', sql: 'CREATE TABLE b(x TEXT) STRICT;' },
      { versi: 1, nama: 'a', sql: 'CREATE TABLE a(x TEXT) STRICT;' },
    ];
    expect(() => jalankanMigrasi(db, kacau)).toThrow(/harus menaik/);
  });

  it('migrasi yang gagal dibatalkan seluruhnya, tidak separuh jalan', () => {
    const rusak: Migrasi[] = [
      {
        versi: 1,
        nama: 'separuh sah',
        sql: 'CREATE TABLE sempat_dibuat(x TEXT) STRICT; INI BUKAN SQL;',
      },
    ];
    expect(() => jalankanMigrasi(db, rusak)).toThrow(/gagal/);
    expect(daftarTabel(db)).not.toContain('sempat_dibuat');
    expect(versiTerpasang(db)).toBe(0);
  });

  it('sidik jari berubah begitu isinya berubah', () => {
    expect(sidikJari('a')).toBe(sidikJari('a'));
    expect(sidikJari('a')).not.toBe(sidikJari('a '));
  });
});

/**
 * Uji berikut membuktikan janji DDL di `contracts` benar-benar ditegakkan mesin
 * SQLite — bukan hanya oleh zod di lapisan aplikasi. Aturan yang hanya dijaga
 * satu lapis akan dilewati begitu ada jalur tulis lain.
 */
describe('jaminan skema ditegakkan basis data', () => {
  const SANTRI = '01JRZ8QK7M4N2P5V9X3B6C8D01';
  const WALI = '01JRZ8QK7M4N2P5V9X3B6C8D02';
  const PENGAJAR = '01JRZ8QK7M4N2P5V9X3B6C8D03';

  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
    jalankanMigrasi(db, DAFTAR_MIGRASI);
    db.prepare(
      `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
        tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
        status, anak_ke, jumlah_saudara)
       VALUES (?, '2627001', NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
        NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
    ).run(SANTRI);
    db.prepare(
      `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
       VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
    ).run(WALI);
    db.prepare(
      `INSERT INTO pengajar (id, no_induk, nik, nama_lengkap, jalur_kurikulum, jalur, aktif)
       VALUES (?, '2301001', NULL, 'Abu Aufa Ukasah', 'diniyah', 'banin', 1)`,
    ).run(PENGAJAR);
  });

  function sisipUsulan(kolomTambahan: Record<string, string | null>): void {
    const dasar: Record<string, string | null> = {
      id: '01JRZ8QK7M4N2P5V9X3B6C8D04',
      santri_id: SANTRI,
      tanggal: '2026-08-10',
      jenis: 'sakit',
      alasan: null,
      dilaporkan_oleh_wali_id: WALI,
      dicatat_oleh_wali_id: WALI,
      dicatat_oleh_pengajar_id: null,
      kanal: 'bot_wali',
      status: 'menunggu',
      ditanggapi_oleh_pengajar_id: null,
      dibatalkan_oleh_wali_id: null,
      waktu_tanggap: null,
      dibuat_pada: '2026-08-09T22:15:00+07:00',
      ...kolomTambahan,
    };
    const kolom = Object.keys(dasar);
    db.prepare(
      `INSERT INTO usulan_izin (${kolom.join(', ')}) VALUES (${kolom.map(() => '?').join(', ')})`,
    ).run(...kolom.map((k) => dasar[k] ?? null));
  }

  it('menerima usulan yang sah', () => {
    expect(() => sisipUsulan({})).not.toThrow();
  });

  it('kunci asing ditegakkan — santri yang tidak ada ditolak', () => {
    expect(() => sisipUsulan({ santri_id: '01JRZ8QK7M4N2P5V9X3B6C8D99' })).toThrow();
  });

  /** Jaminan ADR 0010, di tingkat data. */
  it('usulan yang sudah di-ack pengajar tidak bisa berstatus dibatalkan', () => {
    expect(() =>
      sisipUsulan({
        status: 'dibatalkan',
        dibatalkan_oleh_wali_id: WALI,
        ditanggapi_oleh_pengajar_id: PENGAJAR,
        waktu_tanggap: '2026-08-10T06:30:00+07:00',
      }),
    ).toThrow();
  });

  it('pembatalan yang sah diterima', () => {
    expect(() =>
      sisipUsulan({
        status: 'dibatalkan',
        dibatalkan_oleh_wali_id: WALI,
        waktu_tanggap: '2026-08-09T22:40:00+07:00',
      }),
    ).not.toThrow();
  });

  it('usulan menunggu tidak boleh punya penanggap', () => {
    expect(() => sisipUsulan({ ditanggapi_oleh_pengajar_id: PENGAJAR })).toThrow();
  });

  it('pencatat harus tepat satu pihak', () => {
    expect(() => sisipUsulan({ dicatat_oleh_wali_id: null })).toThrow();
    expect(() => sisipUsulan({ dicatat_oleh_pengajar_id: PENGAJAR })).toThrow();
  });

  it('nilai di luar kosakata terkendali ditolak', () => {
    expect(() => sisipUsulan({ jenis: 'bolos' })).toThrow();
    expect(() => sisipUsulan({ kanal: 'merpati' })).toThrow();
  });

  it('tabel STRICT menolak tipe yang salah', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
           VALUES ('01JRZ8QK7M4N2P5V9X3B6C8D05', '2026/2027', '2026-07-01', '2027-06-30', 'ya')`,
        )
        .run(),
    ).toThrow();
  });

  it('marhalah mutawashitoh diterima — ia ada dan berisi santri', () => {
    db.prepare(
      `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
       VALUES ('01JRZ8QK7M4N2P5V9X3B6C8D06', '2026/2027', '2026-07-01', '2027-06-30', 1)`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO rombel (id, tahun_ajaran_id, jalur, marhalah, nama, tingkat,
             wali_kelas_pengajar_id)
           VALUES ('01JRZ8QK7M4N2P5V9X3B6C8D07', '01JRZ8QK7M4N2P5V9X3B6C8D06',
             'banin', 'mutawashitoh', '7 (TUJUH)', 7, ?)`,
        )
        .run(PENGAJAR),
    ).not.toThrow();
  });
});
