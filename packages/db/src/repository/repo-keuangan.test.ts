import { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from '../daftar-migrasi.js';
import { jalankanMigrasi } from '../migrasi.js';
import {
  repoAkunKeuangan,
  repoAlokasiProta,
  repoKeringanan,
  repoKomponenBiaya,
  repoLebihBayar,
  repoPembayaran,
  repoProta,
  repoTagihan,
  repoTarifKomponen,
} from './repo-keuangan.js';

function basisDataBaru(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function seedSantri(db: DatabaseSync): string {
  const id = buatUlid(1_000_000_000_000);
  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
       tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
       status, anak_ke, jumlah_saudara)
     VALUES (?, '2627001', NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(id);
  return id;
}

function seedWali(db: DatabaseSync): string {
  const id = buatUlid(1_000_000_000_001);
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
  ).run(id);
  return id;
}

function seedTahunAjaran(db: DatabaseSync): string {
  const id = buatUlid(1_000_000_000_002);
  db.prepare(
    `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026/2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(id);
  return id;
}

function seedAkunKeuangan(db: DatabaseSync): number {
  const kode = 101;
  db.prepare(
    `INSERT INTO akun_keuangan (kode, nama, arah, aktif)
     VALUES (?, 'Pemasukan SPP', 'masuk', 1)`,
  ).run(kode);
  return kode;
}

function seedKomponenBiaya(db: DatabaseSync, akunKode: number): string {
  const id = buatUlid(1_000_000_000_003);
  db.prepare(
    `INSERT INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
     VALUES (?, 'spp', 'SPP Bulanan', ?, 1)`,
  ).run(id, akunKode);
  return id;
}

function seedDasar(db: DatabaseSync): {
  santriId: string;
  waliId: string;
  tahunAjaranId: string;
  akunKode: number;
  komponenId: string;
} {
  const akunKode = seedAkunKeuangan(db);
  return {
    santriId: seedSantri(db),
    waliId: seedWali(db),
    tahunAjaranId: seedTahunAjaran(db),
    akunKode,
    komponenId: seedKomponenBiaya(db, akunKode),
  };
}

function tagihanSah(
  id: string,
  santriId: string,
  tahunAjaranId: string,
  komponenId: string,
  status: 'terbit' | 'lunas' | 'dibatalkan' = 'terbit',
): {
  id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  komponen_biaya_id: string;
  periode: string;
  skema_periode: 'hijriah' | 'masehi';
  jatuh_tempo: string;
  nominal: number;
  prorata_mulai: string | null;
  status: typeof status;
} {
  return {
    id,
    santri_id: santriId,
    tahun_ajaran_id: tahunAjaranId,
    komponen_biaya_id: komponenId,
    periode: '2026-08',
    skema_periode: 'masehi',
    jatuh_tempo: '2026-08-25',
    nominal: 500_000,
    prorata_mulai: null,
    status,
  };
}

describe('RepoKeuangan', () => {
  let db: DatabaseSync;
  let dasar: ReturnType<typeof seedDasar>;

  beforeEach(() => {
    db = basisDataBaru();
    dasar = seedDasar(db);
  });

  describe('repoAkunKeuangan', () => {
    it('sisip dan ambil berdasarkan kode numerik', () => {
      const repo = repoAkunKeuangan(db);
      const baris = { kode: 201, nama: 'Pendaftaran', arah: 'masuk' as const, aktif: true };
      repo.sisip(baris);
      expect(repo.ambil(201)).toEqual(baris);
      expect(repo.ambilSemua()).toHaveLength(2);
    });

    it('boolean aktif tersimpan dan terbaca kembali', () => {
      const repo = repoAkunKeuangan(db);
      repo.sisip({ kode: 202, nama: 'Arsip', arah: 'keluar' as const, aktif: false });
      const hasil = repo.ambil(202);
      expect(hasil?.aktif).toBe(false);
      expect(typeof hasil?.aktif).toBe('boolean');
    });

    it('perbarui dan hapus', () => {
      const repo = repoAkunKeuangan(db);
      repo.sisip({ kode: 202, nama: 'Arsip', arah: 'keluar' as const, aktif: false });
      repo.perbarui(202, { nama: 'Arsip Update' });
      expect(repo.ambil(202)?.nama).toBe('Arsip Update');
      repo.hapus(202);
      expect(repo.ambil(202)).toBeUndefined();
    });
  });

  describe('repoKomponenBiaya', () => {
    it('sisip dan ambil kembali', () => {
      const repo = repoKomponenBiaya(db);
      const id = buatUlid(1_000_000_000_004);
      const baris = {
        id,
        kode: 'raport' as const,
        nama: 'Raport',
        akun_keuangan_kode: dasar.akunKode,
        aktif: true,
      };
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
    });

    it('cariByKode mengembalikan komponen yang cocok', () => {
      const repo = repoKomponenBiaya(db);
      const hasil = repo.cariByKode('spp');
      expect(hasil?.nama).toBe('SPP Bulanan');
      expect(repo.cariByKode('tidak_ada')).toBeUndefined();
    });
  });

  describe('repoTarifKomponen', () => {
    it('sisip dan ambil kembali', () => {
      const repo = repoTarifKomponen(db);
      const id = buatUlid(1_000_000_000_005);
      const baris = {
        id,
        tahun_ajaran_id: dasar.tahunAjaranId,
        komponen_biaya_id: dasar.komponenId,
        jalur: 'banin' as const,
        marhalah: 'ibtidaiyyah' as const,
        tingkat: 4,
        nominal: 450_000,
        aktif: true,
      };
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
    });

    it('cariAktif mencocokkan persis termasuk NULL', () => {
      const repo = repoTarifKomponen(db);
      const umumId = buatUlid(1_000_000_000_006);
      const spesifikId = buatUlid(1_000_000_000_007);

      repo.sisip({
        id: umumId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        komponen_biaya_id: dasar.komponenId,
        jalur: null,
        marhalah: null,
        tingkat: null,
        nominal: 500_000,
        aktif: true,
      });
      repo.sisip({
        id: spesifikId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        komponen_biaya_id: dasar.komponenId,
        jalur: 'banin' as const,
        marhalah: null,
        tingkat: null,
        nominal: 450_000,
        aktif: true,
      });

      const hasilUmum = repo.cariAktif(dasar.tahunAjaranId, dasar.komponenId, null, null, null);
      expect(hasilUmum?.id).toBe(umumId);

      const hasilSpesifik = repo.cariAktif(
        dasar.tahunAjaranId,
        dasar.komponenId,
        'banin',
        null,
        null,
      );
      expect(hasilSpesifik?.id).toBe(spesifikId);

      const tidakKetemu = repo.cariAktif(
        dasar.tahunAjaranId,
        dasar.komponenId,
        'banat',
        null,
        null,
      );
      expect(tidakKetemu).toBeUndefined();
    });

    it('cariUmum mengembalikan tarif semua-NULL', () => {
      const repo = repoTarifKomponen(db);
      const id = buatUlid(1_000_000_000_006);
      repo.sisip({
        id,
        tahun_ajaran_id: dasar.tahunAjaranId,
        komponen_biaya_id: dasar.komponenId,
        jalur: null,
        marhalah: null,
        tingkat: null,
        nominal: 500_000,
        aktif: true,
      });
      expect(repo.cariUmum(dasar.tahunAjaranId, dasar.komponenId)?.nominal).toBe(500_000);
      expect(repo.cariUmum(dasar.tahunAjaranId, buatUlid(1_000_000_000_999))).toBeUndefined();
    });
  });

  describe('repoTagihan', () => {
    it('sisip dan ambil kembali', () => {
      const repo = repoTagihan(db);
      const id = buatUlid(1_000_000_000_007);
      const baris = tagihanSah(id, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId);
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
    });

    it('cariBySantri, cariBySantriDanPeriode, dan cariByStatus', () => {
      const repo = repoTagihan(db);
      const id1 = buatUlid(1_000_000_000_007);
      const id2 = buatUlid(1_000_000_000_008);
      repo.sisip(tagihanSah(id1, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));
      repo.sisip({
        ...tagihanSah(id2, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId),
        periode: '2026-09',
      });

      expect(repo.cariBySantri(dasar.santriId)).toHaveLength(2);
      expect(repo.cariBySantriDanPeriode(dasar.santriId, '2026-08')).toHaveLength(1);
      expect(repo.cariByStatus('terbit')).toHaveLength(2);
    });

    it('tandaiLunas hanya dari status terbit', () => {
      const repo = repoTagihan(db);
      const id = buatUlid(1_000_000_000_007);
      repo.sisip(tagihanSah(id, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));
      repo.tandaiLunas(id);
      expect(repo.ambil(id)?.status).toBe('lunas');
      expect(() => repo.tandaiLunas(id)).toThrow();
    });

    it('batalkan hanya dari status terbit', () => {
      const repo = repoTagihan(db);
      const id = buatUlid(1_000_000_000_007);
      repo.sisip(tagihanSah(id, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));
      repo.batalkan(id);
      expect(repo.ambil(id)?.status).toBe('dibatalkan');
      expect(() => repo.batalkan(id)).toThrow();
    });

    it('gagal sisip bila santri tidak ada', () => {
      const repo = repoTagihan(db);
      const id = buatUlid(1_000_000_000_007);
      const baris = tagihanSah(id, buatUlid(1_000_000_000_999), dasar.tahunAjaranId, dasar.komponenId);
      expect(() => repo.sisip(baris)).toThrow();
    });
  });

  describe('repoKeringanan', () => {
    it('sisip dan cariByTagihan', () => {
      const repoT = repoTagihan(db);
      const repoK = repoKeringanan(db);
      const tagihanId = buatUlid(1_000_000_000_007);
      repoT.sisip(tagihanSah(tagihanId, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));

      const id = buatUlid(1_000_000_000_008);
      const baris = {
        id,
        tagihan_id: tagihanId,
        nominal: 100_000,
        persentase: null,
        alasan: 'Anak yatim',
        disetujui_oleh: dasar.waliId,
        waktu: '2026-08-10T10:00:00+07:00',
      };
      repoK.sisip(baris);
      expect(repoK.ambil(id)).toEqual(baris);
      expect(repoK.cariByTagihan(tagihanId)).toHaveLength(1);
    });

    it('gagal bila nominal dan persentase keduanya NULL', () => {
      const repoT = repoTagihan(db);
      const repoK = repoKeringanan(db);
      const tagihanId = buatUlid(1_000_000_000_007);
      repoT.sisip(tagihanSah(tagihanId, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));

      expect(() =>
        repoK.sisip({
          id: buatUlid(1_000_000_000_008),
          tagihan_id: tagihanId,
          nominal: null,
          persentase: null,
          alasan: 'Salah input',
          disetujui_oleh: dasar.waliId,
          waktu: '2026-08-10T10:00:00+07:00',
        }),
      ).toThrow();
    });
  });

  describe('repoPembayaran', () => {
    it('sisip, cariByTagihan, dan hitungTotalByTagihan', () => {
      const repoT = repoTagihan(db);
      const repoP = repoPembayaran(db);
      const tagihanId = buatUlid(1_000_000_000_007);
      repoT.sisip(tagihanSah(tagihanId, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));

      const id1 = buatUlid(1_000_000_000_008);
      const id2 = buatUlid(1_000_000_000_009);
      repoP.sisip({
        id: id1,
        tagihan_id: tagihanId,
        tanggal: '2026-08-10',
        nominal: 200_000,
        metode: 'transfer' as const,
        sumber: 'wali' as const,
        cicilan_ke: 1,
        dicatat_oleh: dasar.waliId,
        waktu: '2026-08-10T10:00:00+07:00',
      });
      repoP.sisip({
        id: id2,
        tagihan_id: tagihanId,
        tanggal: '2026-08-15',
        nominal: 300_000,
        metode: 'tunai' as const,
        sumber: 'wali' as const,
        cicilan_ke: 2,
        dicatat_oleh: dasar.waliId,
        waktu: '2026-08-15T10:00:00+07:00',
      });

      expect(repoP.cariByTagihan(tagihanId)).toHaveLength(2);
      expect(repoP.hitungTotalByTagihan(tagihanId)).toBe(500_000);
      expect(repoP.hitungTotalByTagihan(buatUlid(1_000_000_000_999))).toBe(0);
    });
  });

  describe('repoProta', () => {
    it('sisip, cariBySantri, dan cariByPeriode', () => {
      const repo = repoProta(db);
      const id = buatUlid(1_000_000_000_007);
      const baris = {
        id,
        donatur_wali_id: dasar.waliId,
        nama_donatur: null,
        santri_id: dasar.santriId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        periode: '2026-08',
        nominal: 1_000_000,
        sisa: 1_000_000,
      };
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
      expect(repo.cariBySantri(dasar.santriId)).toHaveLength(1);
      expect(repo.cariByPeriode('2026-08')).toHaveLength(1);
    });

    it('kurangiSisa mengurangi dan gagal bila sisa tidak cukup', () => {
      const repo = repoProta(db);
      const id = buatUlid(1_000_000_000_007);
      repo.sisip({
        id,
        donatur_wali_id: null,
        nama_donatur: 'Donatur Anonim',
        santri_id: dasar.santriId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        periode: '2026-08',
        nominal: 500_000,
        sisa: 500_000,
      });
      repo.kurangiSisa(id, 200_000);
      expect(repo.ambil(id)?.sisa).toBe(300_000);
      expect(() => repo.kurangiSisa(id, 400_000)).toThrow();
    });

    it('gagal bila donatur_wali_id dan nama_donatur keduanya NULL', () => {
      const repo = repoProta(db);
      expect(() =>
        repo.sisip({
          id: buatUlid(1_000_000_000_007),
          donatur_wali_id: null,
          nama_donatur: null,
          santri_id: dasar.santriId,
          tahun_ajaran_id: dasar.tahunAjaranId,
          periode: '2026-08',
          nominal: 500_000,
          sisa: 500_000,
        }),
      ).toThrow();
    });
  });

  describe('repoAlokasiProta', () => {
    it('sisip, cariByProta, dan cariByTagihan', () => {
      const repoT = repoTagihan(db);
      const repoP = repoProta(db);
      const repoA = repoAlokasiProta(db);

      const tagihanId = buatUlid(1_000_000_000_007);
      repoT.sisip(tagihanSah(tagihanId, dasar.santriId, dasar.tahunAjaranId, dasar.komponenId));

      const protaId = buatUlid(1_000_000_000_008);
      repoP.sisip({
        id: protaId,
        donatur_wali_id: dasar.waliId,
        nama_donatur: null,
        santri_id: dasar.santriId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        periode: '2026-08',
        nominal: 1_000_000,
        sisa: 1_000_000,
      });

      const id = buatUlid(1_000_000_000_009);
      const baris = {
        id,
        prota_id: protaId,
        tagihan_id: tagihanId,
        nominal: 500_000,
        waktu: '2026-08-10T10:00:00+07:00',
      };
      repoA.sisip(baris);
      expect(repoA.ambil(id)).toEqual(baris);
      expect(repoA.cariByProta(protaId)).toHaveLength(1);
      expect(repoA.cariByTagihan(tagihanId)).toHaveLength(1);
    });

    it('gagal bila tagihan_id tidak ada', () => {
      const repoP = repoProta(db);
      const repoA = repoAlokasiProta(db);
      const protaId = buatUlid(1_000_000_000_008);
      repoP.sisip({
        id: protaId,
        donatur_wali_id: dasar.waliId,
        nama_donatur: null,
        santri_id: dasar.santriId,
        tahun_ajaran_id: dasar.tahunAjaranId,
        periode: '2026-08',
        nominal: 1_000_000,
        sisa: 1_000_000,
      });
      expect(() =>
        repoA.sisip({
          id: buatUlid(1_000_000_000_009),
          prota_id: protaId,
          tagihan_id: buatUlid(1_000_000_000_999),
          nominal: 500_000,
          waktu: '2026-08-10T10:00:00+07:00',
        }),
      ).toThrow();
    });
  });

  describe('repoLebihBayar', () => {
    it('sisip, cariBySantri, hitungSaldo, dan tambahSaldo', () => {
      const repo = repoLebihBayar(db);
      const id = buatUlid(1_000_000_000_007);
      const baris = {
        id,
        santri_id: dasar.santriId,
        nominal: 150_000,
        asal_pembayaran_id: null,
        waktu: '2026-08-10T10:00:00+07:00',
      };
      repo.sisip(baris);
      expect(repo.ambil(id)).toEqual(baris);
      expect(repo.cariBySantri(dasar.santriId)).toHaveLength(1);
      expect(repo.hitungSaldo(dasar.santriId)).toBe(150_000);

      repo.tambahSaldo({
        id: buatUlid(1_000_000_000_008),
        santri_id: dasar.santriId,
        nominal: 50_000,
        asal_pembayaran_id: null,
        waktu: '2026-08-15T10:00:00+07:00',
      });
      expect(repo.hitungSaldo(dasar.santriId)).toBe(200_000);
      expect(repo.hitungSaldo(buatUlid(1_000_000_000_999))).toBe(0);
    });
  });
});
