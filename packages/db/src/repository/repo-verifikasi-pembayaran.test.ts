import { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI } from '../daftar-migrasi.js';
import { jalankanMigrasi } from '../migrasi.js';
import { repoUsulanPembayaran } from './repo-usulan-pembayaran.js';
import { repoPenggunaTelegram } from './repo-pengguna-telegram.js';

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

function seedDasar() {
  const santriId = buatUlid(2_000_000_000_000);
  const waliId = buatUlid(2_000_000_000_001);
  const taId = buatUlid(2_000_000_000_002);
  const komponenId = buatUlid(2_000_000_000_003);
  const tagihanId = buatUlid(2_000_000_000_004);

  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
       tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
       status, anak_ke, jumlah_saudara)
     VALUES (?, '2627001', NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId);

  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
  ).run(waliId);

  db.prepare(
    `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2025-2026', '2025-07-01', '2026-06-30', 1)`,
  ).run(taId);

  db.prepare(
    `INSERT INTO akun_keuangan (kode, nama, arah, aktif)
     VALUES (101, 'Pemasukan SPP', 'masuk', 1)`,
  ).run();

  db.prepare(
    `INSERT INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
     VALUES (?, 'spp', 'SPP Bulanan', 101, 1)`,
  ).run(komponenId);

  db.prepare(
    `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
       skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
     VALUES (?, ?, ?, ?, '2026-08', 'masehi', '2026-09-10', 450000, NULL, 'terbit')`,
  ).run(tagihanId, santriId, taId, komponenId);

  return { santriId, waliId, tagihanId };
}

function usulanSah(id: string, santriId: string, waliId: string, tagihanId: string) {
  return {
    id,
    tagihan_id: tagihanId,
    wali_id: waliId,
    santri_id: santriId,
    nominal: 450_000,
    tanggal_bayar: '2026-08-13',
    metode: 'transfer' as const,
    nama_penerima: null,
    bukti_file_id: 'AgADtestfileid123',
    bukti_tipe: 'image/jpeg',
    catatan: null,
    status: 'diajukan' as const,
    diverifikasi_oleh: null,
    diverifikasi_waktu: null,
    alasan_penolakan: null,
    diajukan_pada: '2026-08-15T08:00:00+07:00',
  };
}

describe('repoUsulanPembayaran', () => {
  it('ajukan — tersimpan sebagai diajukan, muncul di cariMenunggu & cariBySantri', () => {
    const { santriId, waliId, tagihanId } = seedDasar();
    const repo = repoUsulanPembayaran(db);
    const id = buatUlid(2_000_000_000_010);
    repo.ajukan(usulanSah(id, santriId, waliId, tagihanId));

    const usulan = repo.cariById(id);
    expect(usulan?.status).toBe('diajukan');
    expect(repo.cariMenunggu()).toHaveLength(1);
    expect(repo.cariBySantri(santriId)).toHaveLength(1);
  });

  it('verifikasi — status terverifikasi + diverifikasi_oleh/waktu, hilang dari menunggu', () => {
    const { santriId, waliId, tagihanId } = seedDasar();
    const repo = repoUsulanPembayaran(db);
    const id = buatUlid(2_000_000_000_010);
    repo.ajukan(usulanSah(id, santriId, waliId, tagihanId));

    repo.verifikasi(id, 'bendahara-1', '2026-08-15T09:00:00+07:00');

    const usulan = repo.cariById(id);
    expect(usulan?.status).toBe('terverifikasi');
    expect(usulan?.diverifikasi_oleh).toBe('bendahara-1');
    expect(repo.cariMenunggu()).toHaveLength(0);
  });

  it('verifikasi dua kali — ditolak (transisi hanya dari diajukan)', () => {
    const { santriId, waliId, tagihanId } = seedDasar();
    const repo = repoUsulanPembayaran(db);
    const id = buatUlid(2_000_000_000_010);
    repo.ajukan(usulanSah(id, santriId, waliId, tagihanId));

    repo.verifikasi(id, 'bendahara-1', '2026-08-15T09:00:00+07:00');
    expect(() => repo.verifikasi(id, 'bendahara-1', '2026-08-15T10:00:00+07:00')).toThrow(
      /tidak ditemukan atau sudah/,
    );
  });

  it('tolak — status ditolak + alasan wajib terisi', () => {
    const { santriId, waliId, tagihanId } = seedDasar();
    const repo = repoUsulanPembayaran(db);
    const id = buatUlid(2_000_000_000_010);
    repo.ajukan(usulanSah(id, santriId, waliId, tagihanId));

    repo.tolak(id, 'bendahara-1', 'Uang belum masuk ke rekening.', '2026-08-15T09:00:00+07:00');

    const usulan = repo.cariById(id);
    expect(usulan?.status).toBe('ditolak');
    expect(usulan?.alasan_penolakan).toBe('Uang belum masuk ke rekening.');
    expect(repo.cariMenunggu()).toHaveLength(0);
  });

  it('tolak setelah verifikasi — ditolak (transisi hanya dari diajukan)', () => {
    const { santriId, waliId, tagihanId } = seedDasar();
    const repo = repoUsulanPembayaran(db);
    const id = buatUlid(2_000_000_000_010);
    repo.ajukan(usulanSah(id, santriId, waliId, tagihanId));

    repo.verifikasi(id, 'bendahara-1', '2026-08-15T09:00:00+07:00');
    expect(() => repo.tolak(id, 'bendahara-1', 'alasan', '2026-08-15T10:00:00+07:00')).toThrow(
      /tidak ditemukan atau sudah/,
    );
  });

  it('cariById — undefined bila tidak ada', () => {
    expect(repoUsulanPembayaran(db).cariById(buatUlid(9_999_999_999_999))).toBeUndefined();
  });
});

describe('repoPenggunaTelegram', () => {
  it('sisip + cariByTelegramId (hanya aktif)', () => {
    const waliId = buatUlid(2_000_000_000_001);
    db.prepare(
      `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
       VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
    ).run(waliId);

    const repo = repoPenggunaTelegram(db);
    const id = buatUlid(2_000_000_000_020);
    repo.sisip({
      id,
      telegram_id: null,
      peran: 'wali',
      wali_id: waliId,
      undangan_kode: 'undang-ABC123',
      aktif: true,
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: '2026-08-15T08:00:00+07:00',
    });

    expect(repo.cariByUndanganKode('undang-ABC123')?.id).toBe(id);
    expect(repo.cariByTelegramId(144666620)).toBeUndefined();

    repo.hubungkan(id, 'undang-ABC123', 144666620, '2026-08-15T09:00:00+07:00');
    expect(repo.cariByTelegramId(144666620)?.id).toBe(id);
    expect(repo.cariByUndanganKode('undang-ABC123')).toBeUndefined();
  });

  it('cariByWaliId — hanya pengguna aktif', () => {
    const waliId = buatUlid(2_000_000_000_001);
    db.prepare(
      `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
       VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
    ).run(waliId);

    const repo = repoPenggunaTelegram(db);
    repo.sisip({
      id: buatUlid(2_000_000_000_020),
      telegram_id: 111,
      peran: 'wali',
      wali_id: waliId,
      undangan_kode: null,
      aktif: false,
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: '2026-08-15T08:00:00+07:00',
    });

    expect(repo.cariByWaliId(waliId)).toBeUndefined();
  });
});
