import { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from '../daftar-migrasi.js';
import { jalankanMigrasi } from '../migrasi.js';
import {
  repoPengajar,
  repoSantri,
  repoSantriWali,
  repoTahunAjaran,
  repoWali,
} from './repo-master.js';

function basisDataBaru(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

describe('repository master data', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
  });

  describe('santri — id tunggal', () => {
    it('sisip dan ambil kembali', () => {
      const repo = repoSantri(db);
      const id = buatUlid(1_000_000_000_000);
      const baris = {
        id,
        nis: '2627001',
        nisn: null,
        nik: null,
        nama_lengkap: 'Aidah',
        jenis_kelamin: 'perempuan' as const,
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2021-10-25',
        alamat: null,
        desa_kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
        kode_pos: null,
        status: 'aktif' as const,
        anak_ke: null,
        jumlah_saudara: null,
      };
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
      expect(repo.ambilSemua()).toHaveLength(1);
    });

    it('perbarui sebagian', () => {
      const repo = repoSantri(db);
      const id = buatUlid(1_000_000_000_000);
      repo.sisip({
        id,
        nis: '2627001',
        nisn: null,
        nik: null,
        nama_lengkap: 'Aidah',
        jenis_kelamin: 'perempuan',
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2021-10-25',
        alamat: null,
        desa_kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
        kode_pos: null,
        status: 'aktif',
        anak_ke: null,
        jumlah_saudara: null,
      });
      repo.perbarui(id, { nama_lengkap: 'Aisyah' });
      expect(repo.ambil(id)?.nama_lengkap).toBe('Aisyah');
    });

    it('hapus', () => {
      const repo = repoSantri(db);
      const id = buatUlid(1_000_000_000_000);
      repo.sisip({
        id,
        nis: '2627001',
        nisn: null,
        nik: null,
        nama_lengkap: 'Aidah',
        jenis_kelamin: 'perempuan',
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2021-10-25',
        alamat: null,
        desa_kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
        kode_pos: null,
        status: 'aktif',
        anak_ke: null,
        jumlah_saudara: null,
      });
      repo.hapus(id);
      expect(repo.ambil(id)).toBeUndefined();
      expect(repo.ambilSemua()).toHaveLength(0);
    });
  });

  describe('pengajar — konversi boolean', () => {
    it('boolean aktif tersimpan dan terbaca kembali sebagai boolean', () => {
      const repo = repoPengajar(db);
      const id = buatUlid(1_000_000_000_000);
      repo.sisip({
        id,
        no_induk: '2301001',
        nik: null,
        nama_lengkap: 'Abu Aufa Ukasah',
        jalur_kurikulum: 'diniyah' as const,
        jalur: 'banin' as const,
        aktif: true,
      });
      const hasil = repo.ambil(id);
      expect(hasil?.aktif).toBe(true);
      expect(typeof hasil?.aktif).toBe('boolean');
    });

    it('boolean false juga terbaca benar', () => {
      const repo = repoPengajar(db);
      const id = buatUlid(1_000_000_000_000);
      repo.sisip({
        id,
        no_induk: '2301002',
        nik: null,
        nama_lengkap: 'Ummu Zahro',
        jalur_kurikulum: 'diniyah' as const,
        jalur: 'banat' as const,
        aktif: false,
      });
      expect(repo.ambil(id)?.aktif).toBe(false);
    });
  });

  describe('santri_wali — kunci komposit', () => {
    it('sisip dan ambil berdasarkan tiga kolom kunci', () => {
      const repoS = repoSantri(db);
      const repoW = repoWali(db);
      const repoSW = repoSantriWali(db);

      const sid = buatUlid(1_000_000_000_000);
      const wid = buatUlid(1_000_000_000_001);

      repoS.sisip({
        id: sid,
        nis: '2627001',
        nisn: null,
        nik: null,
        nama_lengkap: 'Aidah',
        jenis_kelamin: 'perempuan',
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2021-10-25',
        alamat: null,
        desa_kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
        kode_pos: null,
        status: 'aktif',
        anak_ke: null,
        jumlah_saudara: null,
      });
      repoW.sisip({
        id: wid,
        nik: null,
        nama_lengkap: 'Hardianto',
        no_hp: null,
        alamat: null,
        status_hidup: 'hidup',
      });

      const baris = {
        santri_id: sid,
        wali_id: wid,
        hubungan: 'ayah' as const,
        penanggung_biaya: true,
        penerima_notifikasi: true,
        aktif: true,
      };
      repoSW.sisip(baris);

      expect(repoSW.ambil({ santri_id: sid, wali_id: wid, hubungan: 'ayah' })).toEqual(baris);
      expect(repoSW.ambilSemua()).toHaveLength(1);
    });

    it('perbarui dan hapus komposit', () => {
      const repoS = repoSantri(db);
      const repoW = repoWali(db);
      const repoSW = repoSantriWali(db);

      const sid = buatUlid(1_000_000_000_000);
      const wid = buatUlid(1_000_000_000_001);

      repoS.sisip({
        id: sid,
        nis: '2627001',
        nisn: null,
        nik: null,
        nama_lengkap: 'Aidah',
        jenis_kelamin: 'perempuan',
        tempat_lahir: 'Jakarta',
        tanggal_lahir: '2021-10-25',
        alamat: null,
        desa_kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
        kode_pos: null,
        status: 'aktif',
        anak_ke: null,
        jumlah_saudara: null,
      });
      repoW.sisip({
        id: wid,
        nik: null,
        nama_lengkap: 'Hardianto',
        no_hp: null,
        alamat: null,
        status_hidup: 'hidup',
      });

      repoSW.sisip({
        santri_id: sid,
        wali_id: wid,
        hubungan: 'ayah',
        penanggung_biaya: true,
        penerima_notifikasi: true,
        aktif: true,
      });

      repoSW.perbarui(
        { santri_id: sid, wali_id: wid, hubungan: 'ayah' },
        { penanggung_biaya: false },
      );
      expect(repoSW.ambil({ santri_id: sid, wali_id: wid, hubungan: 'ayah' })?.penanggung_biaya).toBe(
        false,
      );

      repoSW.hapus({ santri_id: sid, wali_id: wid, hubungan: 'ayah' });
      expect(repoSW.ambil({ santri_id: sid, wali_id: wid, hubungan: 'ayah' })).toBeUndefined();
    });
  });

  describe('tahun_ajaran — nullable dan boolean', () => {
    it('menyimpan dan membaca tahun ajaran', () => {
      const repo = repoTahunAjaran(db);
      const id = buatUlid(1_000_000_000_000);
      repo.sisip({
        id,
        kode: '2026/2027',
        mulai: '2026-07-01',
        selesai: '2027-06-30',
        aktif: true,
      });
      expect(repo.ambil(id)).toEqual({
        id,
        kode: '2026/2027',
        mulai: '2026-07-01',
        selesai: '2027-06-30',
        aktif: true,
      });
    });
  });
});
