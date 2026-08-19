import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoPenggunaTelegram,
} from '@siakad/db';
import { buatHandlerUndanganUser } from './undangan-user.js';

let db: DatabaseSync;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

const superadmin = { peran: 'superadmin' as const, id: 'superadmin-1' };
const admin = { peran: 'admin' as const, id: 'admin-1' };
const bendahara = { peran: 'bendahara' as const, id: 'bendahara-1' };
const wali = { peran: 'wali' as const, id: 'wali-1' };

const handler = () => buatHandlerUndanganUser({ repoPenggunaTelegram: repoPenggunaTelegram(db) });

describe('buatUndanganUser', () => {
  it('superadmin membuat undangan bendahara — kode tersimpan berperan bendahara', () => {
    const hasil = handler().buatUndanganUser({
      aktor: superadmin,
      peran: 'bendahara',
      waktu: '2026-08-18T09:00:00+07:00',
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.data?.peran).toBe('bendahara');
    expect(hasil.data?.undangan_kode).toMatch(/^undang-/);
  });

  it('non-superadmin (admin/bendahara/wali) ditolak', () => {
    for (const aktor of [admin, bendahara, wali]) {
      const hasil = handler().buatUndanganUser({ aktor, peran: 'admin', waktu: '2026-08-18T09:00:00+07:00' });
      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('superadmin');
    }
  });

  it('peran superadmin TIDAK bisa diundang', () => {
    // @ts-expect-error superadmin bukan PeranUndanganUser yang sah
    const hasil = handler().buatUndanganUser({ aktor: superadmin, peran: 'superadmin', waktu: '2026-08-18T09:00:00+07:00' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('Peran');
  });
});

describe('gunakanUndanganUser', () => {
  function buat(peran: 'admin' | 'bendahara' | 'pengajar') {
    const hasil = handler().buatUndanganUser({ aktor: superadmin, peran, waktu: '2026-08-18T09:00:00+07:00' });
    if (!hasil.ok || !hasil.data?.undangan_kode) throw new Error('gagal buat');
    return hasil.data.undangan_kode;
  }

  it('kode valid — terhubung, peran sesuai, dipakai_pada terisi', () => {
    const kode = buat('bendahara');
    const hasil = handler().gunakanUndanganUser({ kode, telegramId: 555000111, waktu: '2026-08-18T10:00:00+07:00' });
    expect(hasil.ok).toBe(true);
    expect(hasil.data?.peran).toBe('bendahara');
    expect(hasil.data?.telegram_id).toBe(555000111);
    const baris = repoPenggunaTelegram(db).cariByUndanganKode(kode);
    expect(baris).toBeUndefined(); // sudah dipakai → tidak lagi "menunggu"
    const user = repoPenggunaTelegram(db).cariByTelegramId(555000111);
    expect(user?.peran).toBe('bendahara');
  });

  it('kode yang sudah dipakai — ditolak', () => {
    const kode = buat('admin');
    handler().gunakanUndanganUser({ kode, telegramId: 555000111, waktu: '2026-08-18T10:00:00+07:00' });
    const kedua = handler().gunakanUndanganUser({ kode, telegramId: 555000222, waktu: '2026-08-18T11:00:00+07:00' });
    expect(kedua.ok).toBe(false);
    expect(kedua.pesan).toContain('sudah digunakan');
  });

  it('telegram yang sudah terdaftar — ditolak (anti-hijack)', () => {
    const kode = buat('admin');
    handler().gunakanUndanganUser({ kode, telegramId: 555000111, waktu: '2026-08-18T10:00:00+07:00' });
    const kode2 = buat('pengajar');
    const hasil = handler().gunakanUndanganUser({ kode: kode2, telegramId: 555000111, waktu: '2026-08-18T11:00:00+07:00' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('sudah terdaftar');
  });
});

describe('daftarUndanganUser', () => {
  it('superadmin melihat yang menunggu; non-superadmin ditolak', () => {
    handler().buatUndanganUser({ aktor: superadmin, peran: 'pengajar', waktu: '2026-08-18T09:00:00+07:00' });
    const daftar = handler().daftarUndanganUser({ aktor: superadmin });
    expect(daftar.ok).toBe(true);
    expect(daftar.data).toHaveLength(1);
    expect(daftar.data?.[0]?.peran).toBe('pengajar');

    expect(handler().daftarUndanganUser({ aktor: admin }).ok).toBe(false);
  });
});

describe('cabutUndanganUser', () => {
  it('superadmin mencabut; file-link tidak bisa dipakai lagi', () => {
    const buat = handler().buatUndanganUser({ aktor: superadmin, peran: 'admin', waktu: '2026-08-18T09:00:00+07:00' });
    const id = buat.data?.id ?? '';
    const cabut = handler().cabutUndanganUser({ aktor: superadmin, undanganId: id, waktu: '2026-08-18T12:00:00+07:00' });
    expect(cabut.ok).toBe(true);
    const gunakan = handler().gunakanUndanganUser({ kode: buat.ok ? buat.data?.undangan_kode ?? '' : '', telegramId: 999000111, waktu: '2026-08-18T13:00:00+07:00' });
    expect(gunakan.ok).toBe(false);
  });

  it('non-superadmin tidak bisa mencabut', () => {
    const buat = handler().buatUndanganUser({ aktor: superadmin, peran: 'admin', waktu: '2026-08-18T09:00:00+07:00' });
    const hasil = handler().cabutUndanganUser({ aktor: bendahara, undanganId: buat.data?.id ?? '', waktu: '2026-08-18T12:00:00+07:00' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('superadmin');
  });
});
