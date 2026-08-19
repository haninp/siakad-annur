import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { DAFTAR_MIGRASI, jalankanMigrasi, repoKalenderHijriah } from '@siakad/db';
import { buatUlid } from '@siakad/contracts';
import { buatHandlerKalender } from './kalender-handler.js';
import { cariBulanHijriahPadaTanggal } from './kalender.js';

function basisDataBaru(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  return db;
}

function handlerDari(db: DatabaseSync) {
  return buatHandlerKalender({
    repoKalenderHijriah: repoKalenderHijriah(db),
  });
}

function seedBulan(db: DatabaseSync, tahun = 1448, bulan = 9) {
  repoKalenderHijriah(db).sisip({
    tahun_hijriah: tahun,
    bulan_hijriah: bulan,
    nama_bulan: 'Ramadhan',
    tanggal_mulai_masehi: '2027-02-07',
    provisional: true,
    disetujui_oleh: null,
    disetujui_pada: null,
    diingatkan_pada: null,
    sumber: 'myquran',
    catatan: null,
  });
}

describe('aturan kalender', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
  });

  it('cariBulanHijriahPadaTanggal mengembalikan bulan yang mencakup tanggal', () => {
    const repo = repoKalenderHijriah(db);
    repo.sisip({
      tahun_hijriah: 1448,
      bulan_hijriah: 1,
      nama_bulan: 'Muharam',
      tanggal_mulai_masehi: '2026-06-16',
      provisional: false,
      disetujui_oleh: null,
      disetujui_pada: null,
      diingatkan_pada: null,
      sumber: 'kemenag',
      catatan: null,
    });
    repo.sisip({
      tahun_hijriah: 1448,
      bulan_hijriah: 2,
      nama_bulan: 'Safar',
      tanggal_mulai_masehi: '2026-07-15',
      provisional: false,
      disetujui_oleh: null,
      disetujui_pada: null,
      diingatkan_pada: null,
      sumber: 'kemenag',
      catatan: null,
    });

    const hasil = cariBulanHijriahPadaTanggal(repo, '2026-06-20');
    expect(hasil?.tahun_hijriah).toBe(1448);
    expect(hasil?.bulan_hijriah).toBe(1);
  });
});

describe('handler kalender', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = basisDataBaru();
  });

  it('menyetujui bulan provisional dan mencatat jejak', () => {
    seedBulan(db);
    const handler = handlerDari(db);
    const pengurusId = buatUlid();

    const hasil = handler.setujuiBulanHijriah({
      aktor: { peran: 'admin', id: pengurusId },
      tahun: 1448,
      bulan: 9,
      waktu: '2027-02-06T10:00:00+07:00',
    });

    expect(hasil.ok).toBe(true);
    expect(hasil.pesan).toContain('Ramadhan');
    expect(hasil.pesan).toContain('sidang isbat');

    const baris = repoKalenderHijriah(db).ambil(1448, 9);
    expect(baris?.provisional).toBe(false);
    expect(baris?.disetujui_oleh).toBe(pengurusId);
  });

  it('menolak peran pengajar', () => {
    seedBulan(db);
    const handler = handlerDari(db);

    const hasil = handler.setujuiBulanHijriah({
      aktor: { peran: 'pengajar', id: buatUlid() },
      tahun: 1448,
      bulan: 9,
      waktu: '2027-02-06T10:00:00+07:00',
    });

    expect(hasil.ok).toBe(false);
  });

  it('menolak bila bulan sudah disetujui', () => {
    seedBulan(db);
    const repo = repoKalenderHijriah(db);
    repo.tandaiSetuju(1448, 9, buatUlid(), '2027-02-06T10:00:00+07:00');
    const handler = handlerDari(db);

    const hasil = handler.setujuiBulanHijriah({
      aktor: { peran: 'admin', id: buatUlid() },
      tahun: 1448,
      bulan: 9,
      waktu: '2027-02-06T10:00:00+07:00',
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('sudah disetujui');
  });

  it('menolak bila bulan belum ada', () => {
    const handler = handlerDari(db);

    const hasil = handler.setujuiBulanHijriah({
      aktor: { peran: 'admin', id: buatUlid() },
      tahun: 1448,
      bulan: 9,
      waktu: '2027-02-06T10:00:00+07:00',
    });

    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('belum tersedia');
  });
});
