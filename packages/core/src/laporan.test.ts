import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoAkunKeuangan,
  repoKomponenBiaya,
  repoLaporan,
  repoPembayaran,
  repoSantri,
  repoTahunAjaran,
} from '@siakad/db';
import { buatHandlerLaporan } from './laporan.js';

let db: DatabaseSync;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

/** Seed dasar: 2 komponen aktif, 2 santri, 3 tagihan + 2 pembayaran. */
function seedDasar() {
  const santriA = buatUlid(3_100_000_000_001);
  const santriB = buatUlid(3_100_000_000_002);
  const taId = buatUlid(3_100_000_000_003);
  const komponenSpp = buatUlid(3_100_000_000_004);
  const komponenModul = buatUlid(3_100_000_000_009);

  const sisipSantri = (id: string, nis: string, nama: string) =>
    repoSantri(db).sisip({
      id,
      nis,
      nisn: null,
      nik: null,
      nama_lengkap: nama,
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
  sisipSantri(santriA, '2627001', 'Aidah');
  sisipSantri(santriB, '2627002', 'Baim');

  repoTahunAjaran(db).sisip({
    id: taId,
    kode: '2025-2026',
    mulai: '2025-07-01',
    selesai: '2026-06-30',
    aktif: true,
  });
  repoAkunKeuangan(db).sisip({ kode: 101, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
  repoKomponenBiaya(db).sisip({
    id: komponenSpp,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: 101,
    aktif: true,
  });
  repoKomponenBiaya(db).sisip({
    id: komponenModul,
    kode: 'modul_buku_atk',
    nama: 'Uang Modul',
    akun_keuangan_kode: 101,
    aktif: true,
  });

  const sisipTagihan = (
    id: string,
    santri: string,
    status: 'terbit' | 'lunas',
    periode = '2026-08',
  ) =>
    db
      .prepare(
        `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
           skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
         VALUES (?, ?, ?, ?, ?, 'masehi', '2026-09-10', 450000, NULL, ?)`,
      )
      .run(id, santri, taId, komponenSpp, periode, status);

  // t1: terbit tanpa bayar · t2: terbit lunas penuh · t3: periode lain, lunas
  const t1 = buatUlid(3_100_000_000_005);
  const t2 = buatUlid(3_100_000_000_006);
  const t3 = buatUlid(3_100_000_000_007);
  sisipTagihan(t1, santriA, 'terbit');
  sisipTagihan(t2, santriB, 'terbit');
  sisipTagihan(t3, santriA, 'lunas', '2026-07');

  repoPembayaran(db).sisip({
    id: buatUlid(3_100_000_000_008),
    tagihan_id: t2,
    tanggal: '2026-08-15',
    nominal: 450_000,
    metode: 'transfer',
    sumber: 'wali',
    cicilan_ke: null,
    dicatat_oleh: buatUlid(3_100_000_000_010),
    waktu: '2026-08-15T09:00:00+07:00',
  });
  repoPembayaran(db).sisip({
    id: buatUlid(3_100_000_000_011),
    tagihan_id: t3,
    tanggal: '2026-07-15',
    nominal: 450_000,
    metode: 'tunai',
    sumber: 'wali',
    cicilan_ke: null,
    dicatat_oleh: buatUlid(3_100_000_000_010),
    waktu: '2026-07-15T09:00:00+07:00',
  });

  return { laporan: buatHandlerLaporan({ repoLaporan: repoLaporan(db) }), t1, t2, t3 };
}

const wali = (id = 'wali-1') => ({ peran: 'wali' as const, id });
const bendahara = (id = 'bendahara-1') => ({ peran: 'bendahara' as const, id });
const pengurus = (id = 'pengurus-1') => ({ peran: 'admin' as const, id });
const admin = (id = 'admin-1') => ({ peran: 'admin' as const, id });

describe('bacaLaporanKeuangan — izin', () => {
  it('wali ditolak', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: wali(), periode: '2026-08' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('bendahara');
  });

  it('bendahara boleh', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: bendahara(), periode: '2026-08' });
    expect(hasil.ok).toBe(true);
  });

  it('pengurus boleh', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: pengurus(), periode: '2026-08' });
    expect(hasil.ok).toBe(true);
  });

  it('admin selalu boleh', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: admin(), periode: '2026-08' });
    expect(hasil.ok).toBe(true);
  });
});

describe('bacaLaporanKeuangan — periode', () => {
  it('format bukan YYYY-MM — ditolak', () => {
    const { laporan } = seedDasar();
    for (const periode of ['2026-8', 'agustus', '', '2026/08']) {
      const hasil = laporan.bacaLaporanKeuangan({ aktor: bendahara(), periode });
      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('YYYY-MM');
    }
  });

  it('periode tanpa data — komponen aktif tetap muncul dengan nol', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: bendahara(), periode: '2026-01' });
    expect(hasil.ok).toBe(true);
    expect(hasil.data?.komponen).toHaveLength(2);
    expect(hasil.data?.komponen.every((k) => k.terbit === 0 && k.masuk === 0)).toBe(true);
    expect(hasil.data?.ringkasan).toEqual({ terbit: 0, masuk: 0, sisa: 0 });
  });
});

describe('bacaLaporanKeuangan — angka agregat (SQL)', () => {
  it('per komponen & ringkasan periode 2026-08', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: bendahara(), periode: '2026-08' });
    expect(hasil.ok).toBe(true);
    const byNama = new Map((hasil.data?.komponen ?? []).map((k) => [k.nama, k]));

    // SPP Bulanan: 2 tagihan terbit (2×450rb), 1 lunas penuh → masuk 450rb
    const spp = byNama.get('SPP Bulanan');
    expect(spp).toMatchObject({ terbit: 900_000, masuk: 450_000, sisa: 450_000 });
    // Uang Modul: aktif tanpa tagihan → nol
    expect(byNama.get('Uang Modul')).toMatchObject({ terbit: 0, masuk: 0, sisa: 0 });

    expect(hasil.data?.ringkasan).toEqual({ terbit: 900_000, masuk: 450_000, sisa: 450_000 });
  });

  it('periode lain tidak bocor ke agregat', () => {
    const { laporan } = seedDasar();
    const hasil = laporan.bacaLaporanKeuangan({ aktor: bendahara(), periode: '2026-07' });
    expect(hasil.ok).toBe(true);
    // Tagihan 2026-07 lunas: terbit ikut terhitung (status lunas), masuk = pembayarannya.
    expect(hasil.data?.ringkasan).toEqual({ terbit: 450_000, masuk: 450_000, sisa: 0 });
  });
});