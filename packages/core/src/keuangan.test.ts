import { describe, expect, it } from 'vitest';
import {
  apakahPeriodeBerlaku,
  cariTarifBerlaku,
  hitungJatuhTempoDefault,
  type LookupTarif,
} from './keuangan.js';
import { formatPeriode, formatRupiah, tanggalTerbaca } from './format.js';
import type { TarifKomponen } from '@siakad/contracts';

const tarif = (nominal: number): TarifKomponen => ({
  id: '01HXXXXXXXAMPLETARIFFFFF',
  tahun_ajaran_id: 'TA',
  komponen_biaya_id: 'KB',
  jalur: null,
  marhalah: null,
  tingkat: null,
  nominal,
  aktif: true,
});

describe('cariTarifBerlaku', () => {
  it('memakai tarif spesifik bila ada', () => {
    const spesifik = tarif(450_000);
    spesifik.jalur = 'banin';
    const lookup: LookupTarif = {
      cariAktif: () => spesifik,
      cariUmum: () => tarif(500_000),
    };
    const hasil = cariTarifBerlaku(lookup, {
      tahunAjaranId: 'TA',
      komponenBiayaId: 'KB',
      jalur: 'banin',
      marhalah: null,
      tingkat: null,
    });
    expect(hasil?.nominal).toBe(450_000);
  });

  it('jatuh ke tarif umum bila spesifik tak ada', () => {
    const umum = tarif(500_000);
    const lookup: LookupTarif = {
      cariAktif: () => undefined,
      cariUmum: () => umum,
    };
    const hasil = cariTarifBerlaku(lookup, {
      tahunAjaranId: 'TA',
      komponenBiayaId: 'KB',
      jalur: 'banin',
      marhalah: null,
      tingkat: null,
    });
    expect(hasil?.nominal).toBe(500_000);
  });

  it('mengembalikan undefined bila keduanya tak ada', () => {
    const lookup: LookupTarif = {
      cariAktif: () => undefined,
      cariUmum: () => undefined,
    };
    expect(
      cariTarifBerlaku(lookup, {
        tahunAjaranId: 'TA',
        komponenBiayaId: 'KB',
        jalur: 'banin',
        marhalah: null,
        tingkat: null,
      }),
    ).toBeUndefined();
  });
});

describe('apakahPeriodeBerlaku', () => {
  const base = {
    kodeKomponen: 'spp',
    skemaPeriode: 'masehi' as const,
    tanggalMasuk: '2026-07-10',
    tanggalKeluar: null as string | null,
    tahunAjaranSelesai: '2027-06-30',
  };

  it('SPP berlaku di bulan masuk', () => {
    expect(apakahPeriodeBerlaku({ ...base, periode: '2026-07' })).toBe(true);
  });

  it('SPP berlaku di bulan akhir tahun ajaran', () => {
    expect(apakahPeriodeBerlaku({ ...base, periode: '2027-06' })).toBe(true);
  });

  it('SPP tidak berlaku sebelum bulan masuk', () => {
    expect(apakahPeriodeBerlaku({ ...base, periode: '2026-06' })).toBe(false);
  });

  it('SPP tidak berlaku setelah bulan keluar', () => {
    expect(
      apakahPeriodeBerlaku({ ...base, tanggalKeluar: '2026-09-15', periode: '2026-10' }),
    ).toBe(false);
  });

  it('SPP berlaku pada bulan keluar', () => {
    expect(
      apakahPeriodeBerlaku({ ...base, tanggalKeluar: '2026-09-15', periode: '2026-09' }),
    ).toBe(true);
  });

  it('komponen sekali selalu berlaku', () => {
    expect(
      apakahPeriodeBerlaku({ ...base, kodeKomponen: 'uang_gedung', periode: '2026/2027' }),
    ).toBe(true);
  });

  it('skema Hijriah selalu berlaku (konversi menyusul)', () => {
    expect(
      apakahPeriodeBerlaku({ ...base, skemaPeriode: 'hijriah', periode: '1447 Muharram' }),
    ).toBe(true);
  });
});

describe('hitungJatuhTempoDefault', () => {
  it('tanggal 10 bulan berikutnya', () => {
    expect(hitungJatuhTempoDefault('2026-08')).toBe('2026-09-10');
    expect(hitungJatuhTempoDefault('2027-01')).toBe('2027-02-10');
  });

  it('Desember maju ke Januari tahun depan', () => {
    expect(hitungJatuhTempoDefault('2026-12')).toBe('2027-01-10');
  });

  it('mengembalikan apa adanya bila bentuk periode tak dikenal', () => {
    expect(hitungJatuhTempoDefault('2026/2027')).toBe('2026/2027');
  });
});

describe('format', () => {
  it('formatPeriode Masehi', () => {
    expect(formatPeriode('2026-08', 'masehi')).toBe('Agustus 2026');
  });

  it('formatPeriode Hijriah dikembalikan apa adanya', () => {
    expect(formatPeriode('1447/1448', 'hijriah')).toBe('1447/1448');
  });

  it('formatRupiah memakai pemisah ribuan titik', () => {
    expect(formatRupiah(500_000)).toBe('Rp 500.000');
    expect(formatRupiah(1_000_000)).toBe('Rp 1.000.000');
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('tanggalTerbaca tetap jalan dari format', () => {
    expect(tanggalTerbaca('2026-08-10')).toBe('10 Agustus 2026');
  });
});