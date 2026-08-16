import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi } from '../index.js';
import { repoPenggunaTelegram } from './repo-pengguna-telegram.js';

/**
 * Guard `hubungkan` (RFC-009): kode undangan SEKALI PAKAI, dipaksakan di SQL —
 * hanya berhasil bila kode masih terpasang, baris aktif, dan telegram_id belum
 * terisi. Kode bekas otomatis tidak cocok.
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
    dibuat_pada: '2026-08-16T08:00:00+07:00',
  });
}

describe('repoPenggunaTelegram — hubungkan (sekali pakai)', () => {
  it('berhasil saat kode valid, baris aktif, telegram_id belum terisi', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.hubungkan(id, 'undang-K7Q2M9', 144666620);

    const terhubung = repo.cariByTelegramId(144666620);
    expect(terhubung?.id).toBe(id);
    expect(terhubung?.undangan_kode).toBeNull();
    expect(repo.cariByUndanganKode('undang-K7Q2M9')).toBeUndefined();
  });

  it('kode bekas (sudah NULL) tidak bisa dipakai dua kali', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    repo.hubungkan(id, 'undang-K7Q2M9', 144666620);
    expect(() => repo.hubungkan(id, 'undang-K7Q2M9', 177782856)).toThrow(/sudah dipakai/);
  });

  it('kode salah ditolak', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId);
    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id, waliId, 'undang-K7Q2M9');

    expect(() => repo.hubungkan(id, 'undang-SALAH1', 144666620)).toThrow(/tidak ditemukan/);
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
      dibuat_pada: '2026-08-16T08:00:00+07:00',
    });

    expect(() => repo.hubungkan(id, 'undang-K7Q2M9', 144666620)).toThrow(/tidak ditemukan/);
  });

  it('telegram_id yang sama tidak bisa dipakai pengguna lain', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId);
    sisipWali(waliLainId);
    const repo = repoPenggunaTelegram(db);

    const id1 = buatUlid(2_000_000_000_020);
    sisipUndangan(repo, id1, waliId, 'undang-AAAAAA');
    repo.hubungkan(id1, 'undang-AAAAAA', 144666620);

    const id2 = buatUlid(2_000_000_000_021);
    sisipUndangan(repo, id2, waliLainId, 'undang-BBBBBB');
    expect(() => repo.hubungkan(id2, 'undang-BBBBBB', 144666620)).toThrow();
  });
});
