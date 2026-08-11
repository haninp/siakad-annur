import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoAkunKeuangan,
  repoKomponenBiaya,
  repoPendaftaran,
  repoRombel,
  repoSantri,
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
} from '@siakad/db';
import { buatHandlerKeuangan } from './keuangan-handler.js';

function basisDataBaru() {
  const db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function seedDasar(db: DatabaseSync) {
  const pengurusId = buatUlid(1_000_000_000_000);
  const santriId = buatUlid(1_000_000_000_001);
  const tahunAjaranId = buatUlid(1_000_000_000_002);
  const rombelId = buatUlid(1_000_000_000_003);
  const akunKode = 101;
  const komponenSppId = buatUlid(1_000_000_000_004);
  const komponenGedungId = buatUlid(1_000_000_000_005);
  const tarifSppSpesifikId = buatUlid(1_000_000_000_006);
  const tarifSppUmumId = buatUlid(1_000_000_000_007);
  const tarifGedungId = buatUlid(1_000_000_000_008);

  repoSantri(db).sisip({
    id: santriId,
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

  repoTahunAjaran(db).sisip({
    id: tahunAjaranId,
    kode: '2026/2027',
    mulai: '2026-07-01',
    selesai: '2027-06-30',
    aktif: true,
  });

  repoAkunKeuangan(db).sisip({
    kode: akunKode,
    nama: 'Pemasukan SPP',
    arah: 'masuk',
    aktif: true,
  });

  repoRombel(db).sisip({
    id: rombelId,
    tahun_ajaran_id: tahunAjaranId,
    jalur: 'banin',
    marhalah: 'ibtidaiyyah',
    nama: 'Banin Ibtidaiyyah 4',
    tingkat: 4,
    wali_kelas_pengajar_id: null,
  });

  repoPendaftaran(db).sisip({
    santri_id: santriId,
    tahun_ajaran_id: tahunAjaranId,
    rombel_id: rombelId,
    tanggal_masuk: '2026-08-10',
    tanggal_keluar: null,
    status: 'aktif',
  });

  repoKomponenBiaya(db).sisip({
    id: komponenSppId,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: akunKode,
    aktif: true,
  });

  repoKomponenBiaya(db).sisip({
    id: komponenGedungId,
    kode: 'uang_gedung',
    nama: 'Uang Gedung',
    akun_keuangan_kode: akunKode,
    aktif: true,
  });

  // tarif spesifik: banin ibtidaiyyah tingkat 4
  repoTarifKomponen(db).sisip({
    id: tarifSppSpesifikId,
    tahun_ajaran_id: tahunAjaranId,
    komponen_biaya_id: komponenSppId,
    jalur: 'banin',
    marhalah: 'ibtidaiyyah',
    tingkat: 4,
    nominal: 450_000,
    aktif: true,
  });

  // tarif umum SPP
  repoTarifKomponen(db).sisip({
    id: tarifSppUmumId,
    tahun_ajaran_id: tahunAjaranId,
    komponen_biaya_id: komponenSppId,
    jalur: null,
    marhalah: null,
    tingkat: null,
    nominal: 500_000,
    aktif: true,
  });

  // tarif uang gedung (komponen sekali)
  repoTarifKomponen(db).sisip({
    id: tarifGedungId,
    tahun_ajaran_id: tahunAjaranId,
    komponen_biaya_id: komponenGedungId,
    jalur: null,
    marhalah: null,
    tingkat: null,
    nominal: 2_000_000,
    aktif: true,
  });

  return {
    db,
    pengurusId,
    santriId,
    tahunAjaranId,
    rombelId,
    akunKode,
    komponenSppId,
    komponenGedungId,
    tarifSppSpesifikId,
    tarifSppUmumId,
    tarifGedungId,
  };
}

function handlerDari(db: DatabaseSync) {
  return buatHandlerKeuangan({
    repoTagihan: repoTagihan(db),
    repoTarifKomponen: repoTarifKomponen(db),
    repoKomponenBiaya: repoKomponenBiaya(db),
    repoSantri: repoSantri(db),
    repoPendaftaran: repoPendaftaran(db),
    repoRombel: repoRombel(db),
    repoTahunAjaran: repoTahunAjaran(db),
  });
}

describe('handler keuangan', () => {
  let db: DatabaseSync;
  let dasar: ReturnType<typeof seedDasar>;

  beforeEach(() => {
    db = basisDataBaru();
    dasar = seedDasar(db);
  });

  describe('terbitkanTagihan', () => {
    it('menerbitkan tagihan SPP dengan tarif spesifik', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'pengurus', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-08',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(true);
      expect(hasil.data?.nominal).toBe(450_000);
      expect(hasil.data?.status).toBe('terbit');
      expect(hasil.pesan).toContain('Aidah');
      expect(hasil.pesan).toContain('Agustus 2026');
      expect(hasil.pesan).toContain('Rp 450.000');
    });

    it('jatuh tempo default tanggal 10 bulan berikutnya', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'pengurus', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-08',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.data?.jatuh_tempo).toBe('2026-09-10');
    });

    it('menerbitkan tagihan komponen sekali', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'pengurus', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenGedungId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026/2027',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(true);
      expect(hasil.data?.nominal).toBe(2_000_000);
      expect(hasil.data?.prorata_mulai).toBeNull();
    });

    it('menolak peran wali atau pengajar', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'wali', id: buatUlid() },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-08',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('pengurus');
    });

    it('menolak tagihan duplikat', () => {
      const handler = handlerDari(db);
      const input = {
        aktor: { peran: 'pengurus' as const, id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-08',
        skemaPeriode: 'masehi' as const,
        waktu: '2026-08-01T08:00:00+07:00',
      };

      expect(handler.terbitkanTagihan(input).ok).toBe(true);
      const hasil = handler.terbitkanTagihan(input);
      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('sudah ada');
    });

    it('menolak SPP sebelum tanggal masuk', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'pengurus', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-07',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('tidak terdaftar KBM');
    });

    it('menolak bila tarif tidak ditemukan', () => {
      const komponenTanpaTarifId = buatUlid(1_000_000_000_009);
      repoKomponenBiaya(db).sisip({
        id: komponenTanpaTarifId,
        kode: 'sarpras',
        nama: 'Sarpras',
        akun_keuangan_kode: dasar.akunKode,
        aktif: true,
      });

      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'pengurus', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: komponenTanpaTarifId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026/2027',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('Tarif');
    });

    it('admin selalu boleh meski peran bukan pengurus', () => {
      const handler = handlerDari(db);
      const hasil = handler.terbitkanTagihan({
        aktor: { peran: 'admin', id: dasar.pengurusId },
        santriId: dasar.santriId,
        komponenBiayaId: dasar.komponenSppId,
        tahunAjaranId: dasar.tahunAjaranId,
        periode: '2026-08',
        skemaPeriode: 'masehi',
        waktu: '2026-08-01T08:00:00+07:00',
      });

      expect(hasil.ok).toBe(true);
    });
  });
});