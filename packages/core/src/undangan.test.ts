import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, repoPenggunaTelegram, repoWali } from '@siakad/db';
import { buatHandlerUndangan, type DepUndangan } from './undangan.js';

/**
 * Alur undangan (RFC-009): pengurus membuat kode sekali pakai, wali memakainya
 * sendiri. Validasi & izin di core — bukan di bot. Amandemen migrasi 7:
 * link bekas/dicabut dikenali statusnya; pengurus bisa cabut & lihat daftar.
 */

let db: DatabaseSync;
let handler: ReturnType<typeof buatHandlerUndangan>;

const ADMIN = { peran: 'admin', id: 'tg-admin' } as const;
const PENGURUS = { peran: 'pengurus', id: 'tg-pengurus' } as const;
const WALI = { peran: 'wali', id: 'tg-wali' } as const;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  handler = buatHandlerUndangan({
    repoPenggunaTelegram: repoPenggunaTelegram(db),
    repoWali: repoWali(db),
  } satisfies DepUndangan);
});

function sisipWali(id: string, nama: string): void {
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, ?, NULL, NULL, 'hidup')`,
  ).run(id, nama);
}

function buatKode(waliId: string): string {
  return handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'w' }).data!.undangan_kode!;
}

describe('buatUndangan', () => {
  it('admin membuat undangan untuk wali — kode mengikuti format', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');

    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'w' });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.peran).toBe('wali');
    expect(hasil.data?.wali_id).toBe(waliId);
    expect(hasil.data?.telegram_id).toBeNull();
    expect(hasil.data?.aktif).toBe(true);
    expect(hasil.data?.dipakai_pada).toBeNull();
    expect(hasil.data?.undangan_kode).toMatch(/^undang-[A-Z0-9]{6}$/);
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
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: 'w',
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

  it('wali yang undangannya sudah dicabut boleh dibuatkan undangan baru', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;
    handler.cabutUndangan({ aktor: ADMIN, undanganId: undangan.id, waktu: 'x' });

    const hasil = handler.buatUndangan({ aktor: ADMIN, waliId, waktu: 'x' });
    expect(hasil.ok).toBe(true);
  });
});

describe('gunakanUndangan', () => {
  it('wali memakai kode — terhubung dan kode hangus', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);

    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode, waktu: 'w' });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.telegram_id).toBe(177782856);
    const terhubung = repoPenggunaTelegram(db).cariByTelegramId(177782856);
    expect(terhubung?.wali_id).toBe(waliId);
    expect(terhubung?.dipakai_pada).toBe('w');
  });

  it('link yang sudah dipakai memberi info jelas "sudah digunakan"', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId, 'Bapak Contoh');
    sisipWali(waliLainId, 'Ibu Siti');
    const kode = buatKode(waliId);
    handler.gunakanUndangan({ telegramId: 177782856, kode, waktu: 'w' });

    const kedua = handler.gunakanUndangan({ telegramId: 144666620, kode, waktu: 'w' });
    expect(kedua.ok).toBe(false);
    expect(kedua.pesan).toMatch(/sudah digunakan/);
  });

  it('link yang dicabut memberi info "sudah dibatalkan pengurus"', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;
    handler.cabutUndangan({ aktor: ADMIN, undanganId: undangan.id, waktu: 'x' });

    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode, waktu: 'w' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah dibatalkan pengurus/);
  });

  it('kode asal-asalan ditolak', () => {
    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode: 'tebak-tebakan', waktu: 'w' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/tidak dikenal/);
  });

  it('telegram_id yang sudah terdaftar untuk wali lain ditolak (anti-hijack)', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId, 'Bapak Contoh');
    sisipWali(waliLainId, 'Ibu Siti');
    const kodeWaliA = buatKode(waliId);
    handler.gunakanUndangan({ telegramId: 177782856, kode: kodeWaliA, waktu: 'w' });

    const kodeWaliB = buatKode(waliLainId);
    const hasil = handler.gunakanUndangan({ telegramId: 177782856, kode: kodeWaliB, waktu: 'w' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah terdaftar untuk wali lain/);
  });
});

describe('cabutUndangan', () => {
  it('admin mencabut undangan yang masih menunggu', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;

    const hasil = handler.cabutUndangan({ aktor: ADMIN, undanganId: undangan.id, waktu: 'w' });

    expect(hasil.ok).toBe(true);
    expect(repoPenggunaTelegram(db).cariMenunggu()).toHaveLength(0);
  });

  it('wali tidak berhak mencabut', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;

    const hasil = handler.cabutUndangan({ aktor: WALI, undanganId: undangan.id, waktu: 'w' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Hanya pengurus/);
  });

  it('undangan yang sudah dipakai tidak bisa dicabut', () => {
    const waliId = buatUlid(2_000_000_000_001);
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;
    handler.gunakanUndangan({ telegramId: 177782856, kode, waktu: 'w' });

    const hasil = handler.cabutUndangan({ aktor: ADMIN, undanganId: undangan.id, waktu: 'w' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah dipakai/);
  });
});

describe('daftarUndangan', () => {
  it('admin melihat daftar undangan yang masih menunggu', () => {
    const waliId = buatUlid(2_000_000_000_001);
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId, 'Bapak Contoh');
    sisipWali(waliLainId, 'Ibu Siti');
    const kodeA = buatKode(waliId);
    const kodeB = buatKode(waliLainId);
    handler.gunakanUndangan({ telegramId: 177782856, kode: kodeA, waktu: 'w' });

    const hasil = handler.daftarUndangan({ aktor: ADMIN });

    expect(hasil.ok).toBe(true);
    expect(hasil.data).toHaveLength(1);
    expect(hasil.data?.[0]?.undangan_kode).toBe(kodeB);
  });

  it('wali tidak bisa melihat daftar undangan', () => {
    const hasil = handler.daftarUndangan({ aktor: WALI });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Hanya pengurus/);
  });
});
