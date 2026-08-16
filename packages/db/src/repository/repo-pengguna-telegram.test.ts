import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi } from '../index.js';
import { repoPenggunaTelegram } from './repo-pengguna-telegram.js';

/**
 * Guard undangan (RFC-009 + amandemen migrasi 7): kode SEKALI PAKAI dipaksakan
 * di SQL; kode bekas tetap tersimpan supaya status link bisa dikenali
 * (dipakai / dicabut / masih menunggu).
 */

let db: DatabaseSync;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

function sisipWali(id: string): void {
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Wali Uji', NULL, NULL, 'hidup')`,
  ).run(id);
}

function sisipUndangan(repo: ReturnType<typeof repoPenggunaTelegram>, id: string, waliId: string, kode: string): void {
  repo.sisip({
    id,
    telegram_id: null,
    peran: 'wali',
    wali_id: waliId,
    undangan_kode: kode,
    aktif: true,
    dipakai_pada: null,
    dicabut_pada: null,
    dibuat_pada: '2026-08-16T08:00:00+07:00',
  });
}

describe('hubungkan — sekali pakai', () => {
  it('berhasil saat kode valid, baris aktif, telegram_id belum terisi', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.hubungkan(id, 'undang-K7Q2M9', 144666620, '2026-08-16T09:00:00+07:00');

    const terhubung = repo.cariByTelegramId(144666620);
    expect(terhubung?.id).toBe(id);
    expect(terhubung?.dipakai_pada).toBe('2026-08-16T09:00:00+07:00');
    // Kode bekas TIDAK bisa dipakai lagi (guard dipakai_pada).
    expect(repo.cariByUndanganKode('undang-K7Q2M9')).toBeUndefined();
  });

  it('kode bekas tidak bisa dipakai dua kali', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.hubungkan(id, 'undang-K7Q2M9', 144666620, 'w1');
    expect(() => repo.hubungkan(id, 'undang-K7Q2M9', 177782856, 'w2')).toThrow(/sudah dipakai/);
  });

  it('kode salah ditolak', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    expect(() => repo.hubungkan(id, 'undang-SALAH1', 144666620, 'w')).toThrow(/tidak ditemukan/);
    expect(repo.cariByTelegramId(144666620)).toBeUndefined();
  });

  it('baris non-aktif ditolak', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    repo.sisip({
      id,
      telegram_id: null,
      peran: 'wali',
      wali_id: waliId,
      undangan_kode: 'undang-K7Q2M9',
      aktif: false,
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: '2026-08-16T08:00:00+07:00',
    });

    expect(() => repo.hubungkan(id, 'undang-K7Q2M9', 144666620, 'w')).toThrow(/tidak ditemukan/);
  });

  it('telegram_id yang sama tidak bisa dipakai pengguna lain', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId);
    sisipWali(waliLainId);
    const repo = repoPenggunaTelegram(db);

    const id1 = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id1, waliId, 'undang-AAAAAA');
    repo.hubungkan(id1, 'undang-AAAAAA', 144666620, 'w');

    const id2 = buatUlid(2_000_000_000_021);
    sisipUndangan(repo, id2, waliLainId, 'undang-BBBBBB');
    expect(() => repo.hubungkan(id2, 'undang-BBBBBB', 144666620, 'w')).toThrow();
  });
});

describe('cariStatusByKode — membedakan status link', () => {
  it('link bekas (sudah dipakai) tetap dikenali', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.hubungkan(id, 'undang-K7Q2M9', 144666620, 'w1');

    const status = repo.cariStatusByKode('undang-K7Q2M9');
    expect(status?.dipakai_pada).toBe('w1');
    expect(status?.dicabut_pada).toBeNull();
  });

  it('link yang dicabut dikenali lewat dicabut_pada', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.cabut(id, 'w1');

    const status = repo.cariStatusByKode('undang-K7Q2M9');
    expect(status?.dicabut_pada).toBe('w1');
    expect(status?.aktif).toBe(false);
    expect(repo.cariByUndanganKode('undang-K7Q2M9')).toBeUndefined();
  });

  it('kode yang tidak pernah ada → undefined', () => {
    expect(repoPenggunaTelegram(db).cariStatusByKode('undang-ZZZZZZ')).toBeUndefined();
  });
});

describe('cariMenunggu — daftar undangan aktif', () => {
  it('hanya undangan yang masih bisa dipakai', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId);
    sisipWali(waliLainId);
    const repo = repoPenggunaTelegram(db);

    const menunggu = buatUlid(2_000_000_000_020);
    const dipakai = buatUlid(2_000_000_000_021);
    const dicabut = buatUlid(2_000_000_000_022);
    sisipUndangan(repo, menunggu, waliId, 'undang-AAAAAA');
    sisipUndangan(repo, dipakai, waliLainId, 'undang-BBBBBB');
    sisipUndangan(repo, dicabut, waliLainId, 'undang-CCCCCC');

    repo.hubungkan(dipakai, 'undang-BBBBBB', 144666620, 'w');
    repo.cabut(dicabut, 'w');

    const daftar = repo.cariMenunggu();
    expect(daftar.map((u) => u.id)).toEqual([menunggu]);
  });
});

describe('cabut — revoke undangan', () => {
  it('mencabut undangan yang masih menunggu', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.cabut(id, 'w');

    expect(repo.cariMenunggu()).toHaveLength(0);
    expect(repo.cariStatusByKode('undang-K7Q2M9')?.dicabut_pada).toBe('w');
  });

  it('undangan yang sudah dipakai tidak bisa dicabut', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');
    repo.hubungkan(id, 'undang-K7Q2M9', 144666620, 'w');

    expect(() => repo.cabut(id, 'w2')).toThrow(/sudah dipakai/);
  });

  it('pencabutan dua kali ditolak', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.cabut(id, 'w1');
    expect(() => repo.cabut(id, 'w2')).toThrow(/sudah dipakai\/dicabut/);
  });
});
