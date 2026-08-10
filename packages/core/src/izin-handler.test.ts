import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoSantri,
  repoSantriWali,
  repoUsulanIzin,
} from '@siakad/db';
import { buatHandlerIzin } from './izin-handler.js';

function basisDataBaru() {
  const db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function seedDasar(db: DatabaseSync) {
  const santriId = buatUlid(1_000_000_000_000);
  const waliId = buatUlid(1_000_000_000_001);
  const waliLainId = buatUlid(1_000_000_000_002);

  const repoS = repoSantri(db);
  repoS.sisip({
    id: santriId,
    nis: '2627001',
    nisn: null,
    nik: null,
    nama_lengkap: 'Aidah',
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

  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
  ).run(waliId);
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Siti', NULL, NULL, 'hidup')`,
  ).run(waliLainId);

  const repoW = repoSantriWali(db);
  repoW.sisip({
    santri_id: santriId,
    wali_id: waliId,
    hubungan: 'ayah',
    penanggung_biaya: true,
    penerima_notifikasi: true,
    aktif: true,
  });
  repoW.sisip({
    santri_id: santriId,
    wali_id: waliLainId,
    hubungan: 'ibu',
    penanggung_biaya: false,
    penerima_notifikasi: true,
    aktif: true,
  });

  return { db, santriId, waliId, waliLainId };
}

describe('handler izin', () => {
  let db: DatabaseSync;
  let dasar: ReturnType<typeof seedDasar>;

  beforeEach(() => {
    db = basisDataBaru();
    dasar = seedDasar(db);
  });

  const handlerDari = (db: DatabaseSync) =>
    buatHandlerIzin({
      repoUsulan: repoUsulanIzin(db),
      repoSantri: repoSantri(db),
      repoSantriWali: repoSantriWali(db),
    });

  describe('ajukanIzin', () => {
    it('wali bisa mengajukan izin untuk anaknya', () => {
      const handler = handlerDari(db);
      const hasil = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      expect(hasil.ok).toBe(true);
      expect(hasil.pesan).toContain('Aidah');
      expect(hasil.pesan).toContain('10 Agustus 2026');
      expect(hasil.data?.status).toBe('menunggu');
    });

    it('wali lain yang juga tertaut bisa mengajukan untuk anak yang sama', () => {
      const handler = handlerDari(db);
      const hasil = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'izin',
        alasan: null,
        waliId: dasar.waliLainId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      expect(hasil.ok).toBe(true);
    });

    it('wali yang tidak tertaut ditolak', () => {
      const handler = handlerDari(db);
      const hasil = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: buatUlid(1_000_000_000_099),
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('tidak terdaftar');
    });

    it('tidak bisa mengajukan ganda untuk tanggal yang sama', () => {
      const handler = handlerDari(db);
      handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      const hasil = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'muntah',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:20:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('sedang menunggu konfirmasi');
    });
  });

  describe('batalkanIzin', () => {
    it('pelapor bisa membatalkan usulannya sendiri', () => {
      const handler = handlerDari(db);
      const ajukan = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      const usulanId = ajukan.data?.id ?? '';
      const hasil = handler.batalkanIzin({
        usulanId,
        waliId: dasar.waliId,
        waktu: '2026-08-09T22:40:00+07:00',
      });

      expect(hasil.ok).toBe(true);
      expect(hasil.pesan).toContain('dibatalkan');
    });

    it('wali lain tidak bisa membatalkan usulan bukan miliknya', () => {
      const handler = handlerDari(db);
      const ajukan = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      const usulanId = ajukan.data?.id ?? '';
      const hasil = handler.batalkanIzin({
        usulanId,
        waliId: dasar.waliLainId,
        waktu: '2026-08-09T22:40:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('Anda buat sendiri');
    });

    it('tidak bisa membatalkan usulan yang sudah ditanggapi', () => {
      const repoU = repoUsulanIzin(db);
      const handler = handlerDari(db);
      const ajukan = handler.ajukanIzin({
        santriId: dasar.santriId,
        tanggal: '2026-08-10',
        jenis: 'sakit',
        alasan: 'demam',
        waliId: dasar.waliId,
        kanal: 'bot_wali',
        waktu: '2026-08-09T22:15:00+07:00',
      });

      const usulanId = ajukan.data?.id ?? '';
      const pengajarId = buatUlid(1_000_000_000_003);
      db.prepare(
        `INSERT INTO pengajar (id, no_induk, nik, nama_lengkap, jalur_kurikulum, jalur, aktif)
         VALUES (?, '2301001', NULL, 'Abu Aufa Ukasah', 'diniyah', 'banin', 1)`,
      ).run(pengajarId);
      repoU.tanggap(usulanId, pengajarId, 'diterima', '2026-08-10T06:30:00+07:00');

      const hasil = handler.batalkanIzin({
        usulanId,
        waliId: dasar.waliId,
        waktu: '2026-08-10T07:00:00+07:00',
      });

      expect(hasil.ok).toBe(false);
      expect(hasil.pesan).toContain('sudah dikonfirmasi');
    });
  });
});
