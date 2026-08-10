import { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from '../daftar-migrasi.js';
import { jalankanMigrasi } from '../migrasi.js';
import { repoUsulanIzin } from './repo-usulan-izin.js';

function basisDataBaru(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function seedDasar(db: DatabaseSync): {
  santriId: string;
  waliId: string;
  pengajarId: string;
} {
  const santriId = buatUlid(1_000_000_000_000);
  const waliId = buatUlid(1_000_000_000_001);
  const pengajarId = buatUlid(1_000_000_000_002);

  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
       tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
       status, anak_ke, jumlah_saudara)
     VALUES (?, '2627001', NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId);

  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
  ).run(waliId);

  db.prepare(
    `INSERT INTO pengajar (id, no_induk, nik, nama_lengkap, jalur_kurikulum, jalur, aktif)
     VALUES (?, '2301001', NULL, 'Abu Aufa Ukasah', 'diniyah', 'banin', 1)`,
  ).run(pengajarId);

  return { santriId, waliId, pengajarId };
}

function usulanSah(
  id: string,
  santriId: string,
  waliId: string,
  status: 'menunggu' | 'dibatalkan' = 'menunggu',
): {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: 'sakit' | 'izin';
  alasan: string | null;
  dilaporkan_oleh_wali_id: string;
  dicatat_oleh_wali_id: string;
  dicatat_oleh_pengajar_id: null;
  kanal: 'bot_wali' | 'lisan' | 'grup' | 'telepon';
  status: typeof status;
  ditanggapi_oleh_pengajar_id: null;
  dibatalkan_oleh_wali_id: string | null;
  waktu_tanggap: string | null;
  dibuat_pada: string;
} {
  return {
    id,
    santri_id: santriId,
    tanggal: '2026-08-10',
    jenis: 'sakit',
    alasan: 'demam',
    dilaporkan_oleh_wali_id: waliId,
    dicatat_oleh_wali_id: waliId,
    dicatat_oleh_pengajar_id: null,
    kanal: 'bot_wali',
    status,
    ditanggapi_oleh_pengajar_id: null,
    dibatalkan_oleh_wali_id: status === 'dibatalkan' ? waliId : null,
    waktu_tanggap: status === 'dibatalkan' ? '2026-08-09T22:40:00+07:00' : null,
    dibuat_pada: '2026-08-09T22:15:00+07:00',
  };
}

describe('RepoUsulanIzin', () => {
  let db: DatabaseSync;
  let dasar: ReturnType<typeof seedDasar>;

  beforeEach(() => {
    db = basisDataBaru();
    dasar = seedDasar(db);
  });

  it('ajukan dan cari menunggu', () => {
    const repo = repoUsulanIzin(db);
    const id = buatUlid(1_000_000_000_003);
    repo.ajukan(usulanSah(id, dasar.santriId, dasar.waliId));

    const menunggu = repo.cariMenunggu();
    expect(menunggu).toHaveLength(1);
    expect(menunggu[0]?.id).toBe(id);
    expect(menunggu[0]?.status).toBe('menunggu');
  });

  it('batalkan hanya berhasil saat menunggu', () => {
    const repo = repoUsulanIzin(db);
    const id = buatUlid(1_000_000_000_003);
    repo.ajukan(usulanSah(id, dasar.santriId, dasar.waliId));

    repo.batalkan(id, dasar.waliId, '2026-08-09T22:40:00+07:00');
    expect(repo.cariMenunggu()).toHaveLength(0);

    const riwayat = repo.cariBySantri(dasar.santriId);
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0]?.status).toBe('dibatalkan');
  });

  it('tanggap mengubah status menjadi diterima atau ditolak', () => {
    const repo = repoUsulanIzin(db);
    const id = buatUlid(1_000_000_000_003);
    repo.ajukan(usulanSah(id, dasar.santriId, dasar.waliId));

    repo.tanggap(id, dasar.pengajarId, 'diterima', '2026-08-10T06:30:00+07:00');
    expect(repo.cariMenunggu()).toHaveLength(0);

    const riwayat = repo.cariBySantri(dasar.santriId);
    expect(riwayat[0]?.status).toBe('diterima');
    expect(riwayat[0]?.ditanggapi_oleh_pengajar_id).toBe(dasar.pengajarId);
  });

  it('batalkan gagal bila sudah ditanggapi', () => {
    const repo = repoUsulanIzin(db);
    const id = buatUlid(1_000_000_000_003);
    repo.ajukan(usulanSah(id, dasar.santriId, dasar.waliId));
    repo.tanggap(id, dasar.pengajarId, 'ditolak', '2026-08-10T06:30:00+07:00');

    expect(() =>
      repo.batalkan(id, dasar.waliId, '2026-08-10T07:00:00+07:00'),
    ).toThrow();
  });

  it('cariBySantri mengembalikan riwayat satu santri', () => {
    const repo = repoUsulanIzin(db);
    const id1 = buatUlid(1_000_000_000_003);
    const id2 = buatUlid(1_000_000_000_004);
    repo.ajukan(usulanSah(id1, dasar.santriId, dasar.waliId));
    repo.ajukan(usulanSah(id2, dasar.santriId, dasar.waliId));

    const riwayat = repo.cariBySantri(dasar.santriId);
    expect(riwayat).toHaveLength(2);
  });
});
