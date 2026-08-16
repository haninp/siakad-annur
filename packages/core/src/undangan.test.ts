import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, repoPenggunaTelegram, repoWali } from '@siakad/db';
import { buatHandlerUndangan, type DepUndangan } from './undangan.js';

/**
 * Alur undangan (RFC-009): pengurus membuat kode sekali pakai, wali memakainya
 * sendiri. Validasi & izin di core — bukan di bot.
 */

let db: DatabaseSync;
let handler: ReturnType<typeof buatHandlerUndangan>;

const ADMIN = { peran: 'admin', id: 'tg-admin' } as const;
const PENGURUS = { peran: 'pengurus', id: 'tg-pengurus' } as const;
const WALI = { peran: 'wali', id: 'tg-wali' } as const;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  handler = buatHandlerUndangan({ repoPenggunaTelegram: repoPenggunaTelegram(db), repoWali: repoWali(db) } satisfies DepUndangan);
});

function sisipWali(id: string, nama: string): void {
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, ?, NULL, NULL, 'hidup')`,
  ).run(id, nama);
}

describe('buatUndangan', () => {
  it('admin membuat undangan untuk wali — kode mengikuti format', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');

    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: '2026-08-16T08:00:00+07:00' });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.peran).toBe('wali');
    expect(hasil.data?.wali_id).toBe(waliId);
    expect(hasil.data?.telegram_id).toBeNull();
    expect(hasil.data?.aktif).toBe(true);
    expect(hasil.data?.undangan_kode).toMatch(/^undang-[A-Z0-9]{6}$/);
    expect(repoPenggunaTelegram(db).cariByUndanganKode(hasil.data!.undangan_kode!)?.id).toBe(hasil.data!.id);
  });

  it('pengurus boleh membuat undangan', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    expect(handler.buatUndangan({ aktor: PENGURUS, waliId, waktu: 'x' }).ok).toBe(true);
  });

  it('wali tidak boleh membuat undangan', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const hasil = handler.buatUndangan({ aktor: WALI, waliId, waktu: 'x' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Hanya pengurus/);
  });

  it('wali yang tidak dikenal ditolak', () => {
    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId: buatUlid(9_999_999_999_999), waktu: 'x' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/tidak ditemukan/);
  });

  it('wali yang sudah terdaftar tidak diberi undangan lagi', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    repoPenggunaTelegram(db).sisip({
      id: buatUlid(2_000_000_000_020),
      telegram_id: 144666620,
      peran: 'wali',
      wali_id: waliId,
      undangan_kode: null,
      aktif: true,
      dibuat_pada: '2026-08-16T08:00:00+07:00',
    });

    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah terdaftar/);
  });

  it('wali yang masih punya undangan belum dipakai ditolak', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' });

    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/belum dipakai/);
  });
});

describe('gunakanUndangan', () => {
  it('wali memakai kode — terhubung dan kode hangus', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const dibuat = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' });
    const kode = dibuat.data!.undangan_kode!;

    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.telegram_id).toBe(177782856);
    const terhubung = repoPenggunaTelegram(db).cariByTelegramId(177782856);
    expect(terhubung?.wali_id).toBe(waliId);
    expect(terhubung?.undangan_kode).toBeNull();
  });

  it('kode yang sama tidak bisa dipakai dua kali', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' }).data!.undangan_kode!;
    handler.gunakanUndangan({ telegramId: 177782856, kode });

    const kedua = handler.gunakanUndangan({ telegramId: 144666620, kode });
    expect(kedua.ok).toBe(false);
    expect(kedua.pesan).toMatch(/tidak dikenal atau sudah dipakai/);
  });

  it('kode asal-asalan ditolak', () => {
    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode: 'tebak-tebakan' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/tidak dikenal atau sudah dipakai/);
  });

  it('telegram_id yang sudah terdaftar untuk wali lain ditolak (anti-hijack)', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId, 'Bapak Contoh');
    sisipWali(waliLainId, 'Ibu Siti');
    const kodeWaliA = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' }).data!.undangan_kode!;
    handler.gunakanUndangan({ telegramId: 177782856, kode: kodeWaliA });

    const kodeWaliB = handler.buatUndangan({ aktor: ADMIN, waliId: waliLainId, waktu: 'x' }).data!.undangan_kode!;
    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode: kodeWaliB });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah terdaftar untuk wali lain/);
  });
});
