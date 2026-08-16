import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from '../daftar-migrasi.js';
import { jalankanMigrasi } from '../migrasi.js';
import { repoKalenderHijriah } from './repo-kalender.js';

function basisDataBaru(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function barisSah(tahun: number, bulan: number, mulai: string): {
  tahun_hijriah: number;
  bulan_hijriah: number;
  nama_bulan: string;
  tanggal_mulai_masehi: string;
  provisional: boolean;
  disetujui_oleh: null;
  disetujui_pada: null;
  diingatkan_pada: null;
  sumber: 'myquran';
  catatan: null;
} {
  return {
    tahun_hijriah: tahun,
    bulan_hijriah: bulan,
    nama_bulan: 'Bulan ' + bulan,
    tanggal_mulai_masehi: mulai,
    provisional: true,
    disetujui_oleh: null,
    disetujui_pada: null,
    diingatkan_pada: null,
    sumber: 'myquran',
    catatan: null,
  };
}

describe('repoKalenderHijriah', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
  });

  it('sisip, ambil, dan ambilSemua', () => {
    const repo = repoKalenderHijriah(db);
    const baris = barisSah(1448, 1, '2026-06-16');
    repo.sisip(baris);

    expect(repo.ambil(1448, 1)).toEqual(baris);
    expect(repo.ambilSemua()).toHaveLength(1);
  });

  it('perbarui catatan', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 1, '2026-06-16'));
    repo.perbarui(1448, 1, { catatan: 'Dicek ulang' });

    const hasil = repo.ambil(1448, 1);
    expect(hasil?.catatan).toBe('Dicek ulang');
  });

  it('cariProvisional dengan dan tanpa filter tahun', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 1, '2026-06-16'));
    repo.sisip(barisSah(1448, 2, '2026-07-15'));
    repo.sisip({ ...barisSah(1449, 1, '2027-06-06'), provisional: false });

    expect(repo.cariProvisional()).toHaveLength(2);
    expect(repo.cariProvisional(1448)).toHaveLength(2);
    expect(repo.cariProvisional(1449)).toHaveLength(0);
  });

  it('tandaiSetuju mengubah provisional dan jejak persetujuan', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 1, '2026-06-16'));
    repo.tandaiSetuju(1448, 1, 'pengurus-01', '2026-06-15T10:00:00+07:00');

    const hasil = repo.ambil(1448, 1);
    expect(hasil?.provisional).toBe(false);
    expect(hasil?.disetujui_oleh).toBe('pengurus-01');
    expect(hasil?.disetujui_pada).toBe('2026-06-15T10:00:00+07:00');
  });

  it('simpan upsert dan reset persetujuan', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 1, '2026-06-16'));
    repo.tandaiSetuju(1448, 1, 'pengurus-01', '2026-06-15T10:00:00+07:00');

    repo.simpan({ ...barisSah(1448, 1, '2026-06-17'), catatan: 'Diperbarui' });

    const hasil = repo.ambil(1448, 1);
    expect(hasil?.tanggal_mulai_masehi).toBe('2026-06-17');
    expect(hasil?.provisional).toBe(true);
    expect(hasil?.disetujui_oleh).toBeNull();
    expect(hasil?.catatan).toBe('Diperbarui');
  });

  it('hitungBulanPadaTanggal mencari bulan yang mencakup tanggal', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 1, '2026-06-16'));
    repo.sisip(barisSah(1448, 2, '2026-07-15'));

    expect(repo.hitungBulanPadaTanggal('2026-06-20')?.bulan_hijriah).toBe(1);
    expect(repo.hitungBulanPadaTanggal('2026-07-20')?.bulan_hijriah).toBe(2);
    expect(repo.hitungBulanPadaTanggal('2026-06-01')).toBeUndefined();
  });
});

describe('cariPerluDiingatkan & tandaiDiingatkan (RFC-012)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
  });

  it('hanya baris provisional yang belum diingatkan dalam rentang', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip(barisSah(1448, 9, '2026-08-18'));
    repo.sisip(barisSah(1448, 10, '2026-09-01'));
    repo.sisip({ ...barisSah(1449, 1, '2027-06-06'), provisional: false });
    repo.tandaiDiingatkan(1448, 10, 'w');

    const daftar = repo.cariPerluDiingatkan('2026-08-16', '2026-08-19');
    expect(daftar.map((k) => k.bulan_hijriah)).toEqual([9]);

    repo.tandaiDiingatkan(1448, 9, 'w2');
    expect(repo.cariPerluDiingatkan('2026-08-16', '2026-08-19')).toHaveLength(0);
  });
});
