import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoPenggunaTelegram,
  repoSantri,
  repoSantriWali,
  repoWali,
} from '@siakad/db';
import { buatHandlerUndangan, type DepUndangan } from './undangan.js';

/**
 * Alur undangan (RFC-009): pengurus membuat kode sekali pakai, wali memakainya
 * sendiri. Validasi & izin di core — bukan di bot. Amandemen migrasi 7:
 * link bekas/dicabut dikenali statusnya; pengurus bisa cabut & lihat daftar.
 *
 * RFC-013: reconfirmation — wali menyebut nama anaknya sebelum terhubung;
 * periksaUndangan memvalidasi tanpa menghubungkan, konfirmasiUndangan mencocokkan
 * jawaban (case-insensitive, persis setelah trim) lalu menghubungkan.
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
    repoSantriWali: repoSantriWali(db),
    repoSantri: repoSantri(db),
  } satisfies DepUndangan);
});

function sisipWali(id: string, nama: string): void {
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, ?, NULL, NULL, 'hidup')`,
  ).run(id, nama);
}

function sisipAnak(santriId: string, waliId: string, nama: string, nis = '2627001'): void {
  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
       tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
       status, anak_ke, jumlah_saudara)
     VALUES (?, ?, NULL, NULL, ?, 'laki_laki', 'Depok', '2019-01-01',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId, nis, nama);
  db.prepare(
    `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya,
       penerima_notifikasi, aktif)
     VALUES (?, ?, 'ayah', 1, 1, 1)`,
  ).run(santriId, waliId);
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

describe('periksaUndangan (RFC-013)', () => {
  const waliId = buatUlid(2_000_000_000_001);

  it('kode valid dilaporkan OK dengan jumlah anak', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    sisipAnak(buatUlid(2_000_000_000_012), waliId, 'Santri Contoh Dua', '2627002');
    const kode = buatKode(waliId);

    const hasil = handler.periksaUndangan({ kode });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.waliId).toBe(waliId);
    expect(hasil.data?.jumlahAnak).toBe(2);
  });

  it('kode asal-asalan ditolak', () => {
    const hasil = handler.periksaUndangan({ kode: 'tebak-tebakan' });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/tidak dikenal/);
  });

  it('link yang sudah dipakai ditolak', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);
    handler.gunakanUndangan({ telegramId: 177782856, kode, waktu: 'w' });

    const hasil = handler.periksaUndangan({ kode });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah digunakan/);
  });

  it('link yang dicabut ditolak', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);
    const undangan = repoPenggunaTelegram(db).cariStatusByKode(kode)!;
    handler.cabutUndangan({ aktor: ADMIN, undanganId: undangan.id, waktu: 'x' });

    const hasil = handler.periksaUndangan({ kode });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah dibatalkan/);
  });

  it('wali tanpa anak aktif diarahkan ke pengurus (mustahil lulus konfirmasi)', () => {
    sisipWali(waliId, 'Bapak Contoh');
    const kode = buatKode(waliId);

    const hasil = handler.periksaUndangan({ kode });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Hubungi pengurus/);
  });
});

describe('konfirmasiUndangan (RFC-013)', () => {
  const waliId = buatUlid(2_000_000_000_001);

  it('nama anak yang cocok → terhubung dan kode hangus', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);

    const hasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: 'Santri Contoh Satu',
      waktu: 'w',
    });

    expect(hasil.ok).toBe(true);
    expect(hasil.data?.telegram_id).toBe(177782856);
    const terhubung = repoPenggunaTelegram(db).cariByTelegramId(177782856);
    expect(terhubung?.wali_id).toBe(waliId);
    expect(terhubung?.dipakai_pada).toBe('w');
  });

  it('cocok case-insensitive dan setelah trim', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Aisyah Zahra');
    const kode = buatKode(waliId);

    const hasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: '  aisyah ZAHRA  ',
      waktu: 'w',
    });

    expect(hasil.ok).toBe(true);
  });

  it('salah satu dari beberapa anak diterima', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    sisipAnak(buatUlid(2_000_000_000_012), waliId, 'Aisyah Zahra', '2627002');
    const kode = buatKode(waliId);

    const hasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: 'Aisyah Zahra',
      waktu: 'w',
    });

    expect(hasil.ok).toBe(true);
  });

  it('nama yang tidak cocok ditolak DAN kode tetap berlaku', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);

    const gagal = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: 'Nama Orang Lain',
      waktu: 'w',
    });
    expect(gagal.ok).toBe(false);
    expect(gagal.pesan).toMatch(/tidak cocok/);

    // Kode TIDAK hangus — pemilik sah bisa coba lagi (proteksi, bukan hukuman).
    const menunggu = repoPenggunaTelegram(db).cariMenunggu();
    expect(menunggu.some((u) => u.undangan_kode === kode)).toBe(true);

    const berhasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: 'Santri Contoh Satu',
      waktu: 'w',
    });
    expect(berhasil.ok).toBe(true);
  });

  it('tiga kali salah pun kode tetap berlaku (percobaan dihitung bot, core menolak konsisten)', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);

    for (let i = 0; i < 3; i++) {
      const hasil = handler.konfirmasiUndangan({
        telegramId: 177782856,
        kode,
        namaAnak: 'Bukan Anaknya',
        waktu: 'w',
      });
      expect(hasil.ok).toBe(false);
    }
    expect(repoPenggunaTelegram(db).cariMenunggu().some((u) => u.undangan_kode === kode)).toBe(true);
  });

  it('jawaban kosong ditolak', () => {
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    const kode = buatKode(waliId);

    const hasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: '   ',
      waktu: 'w',
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/Sebutkan nama/);
  });

  it('telegram_id yang sudah terdaftar ditolak sebelum verifikasi nama (anti-hijack)', () => {
    const waliLainId = buatUlid(2_000_000_000_002);
    sisipWali(waliId, 'Bapak Contoh');
    sisipAnak(buatUlid(2_000_000_000_011), waliId, 'Santri Contoh Satu');
    sisipWali(waliLainId, 'Ibu Siti');
    const kodeLain = buatKode(waliLainId);
    handler.gunakanUndangan({ telegramId: 177782856, kode: kodeLain, waktu: 'w' });

    const kode = buatKode(waliId);
    const hasil = handler.konfirmasiUndangan({
      telegramId: 177782856,
      kode,
      namaAnak: 'Santri Contoh Satu',
      waktu: 'w',
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toMatch(/sudah terdaftar untuk wali lain/);
  });
});
