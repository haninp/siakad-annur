import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  DDL_MASTER_DATA,
  DDL_KEUANGAN,
  DDL_ABSENSI,
  DDL_KALENDER_HIJRIAH,
  DDL_IZIN,
  DDL_PEMAKAIAN_LEBIH_BAYAR,
} from '@siakad/contracts';
import { repoLaporan, repoAbsensi } from '@siakad/db';
import { jalankanPipelineAnalitik } from './pipeline.js';
import {
  goldPerKomponen,
  goldRingkasan,
  goldTrenSpp,
  goldTrenAbsen,
} from './gold.js';
import { slugSnapshot } from './bronze.js';

describe('pipeline analitik (RFC-018): bronze→silver→gold', () => {
  let dir: string;
  let lokasiDb: string;
  let lokasiDuck: string;
  let akarParquet: string;
  const snapshot = '2026-08-24T00:00:00.000Z';

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'siakad-analitik-'));
    lokasiDb = path.join(dir, 'db.sqlite');
    lokasiDuck = path.join(dir, 'gudang.duckdb');
    akarParquet = path.join(dir, 'parquet');

    const db = new DatabaseSync(lokasiDb);
    db.exec(DDL_MASTER_DATA);
    db.exec(DDL_KEUANGAN);
    db.exec(DDL_ABSENSI);
    db.exec(DDL_IZIN);
    db.exec(DDL_KALENDER_HIJRIAH);
    db.exec(DDL_PEMAKAIAN_LEBIH_BAYAR);
    db.exec(`
      INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, status)
        VALUES ('S1', 'N1', 'Santri Satu', 'laki_laki', 'Jakarta', '2015-01-01', 'aktif');
      INSERT INTO pengajar (id, no_induk, nama_lengkap, jalur_kurikulum, jalur, aktif)
        VALUES ('G1', '1001', 'Guru Satu', 'diniyah', 'banin', 1);
      INSERT INTO akun_keuangan (kode, nama, arah, aktif) VALUES (1, 'Kas SPP', 'masuk', 1);
      INSERT INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
        VALUES ('K1', 'spp', 'SPP', 1, 1), ('K2', 'raport', 'Raport', 1, 0);
      INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
        VALUES ('TA1', '2025/2026', '2025-07-01', '2026-06-30', 1);
      INSERT INTO rombel (id, tahun_ajaran_id, jalur, marhalah, nama, tingkat, wali_kelas_pengajar_id)
        VALUES ('R1', 'TA1', 'banin', 'ibtidaiyyah', '1A', 1, 'G1');
      INSERT INTO pendaftaran (santri_id, tahun_ajaran_id, rombel_id, tanggal_masuk, status)
        VALUES ('S1', 'TA1', 'R1', '2025-07-01', 'aktif');
      INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode, skema_periode, jatuh_tempo, nominal, status)
        VALUES ('T1', 'S1', 'TA1', 'K1', '2026-08', 'masehi', '2026-08-10', 500000, 'lunas'),
               ('T2', 'S1', 'TA1', 'K1', '2026-09', 'masehi', '2026-09-10', 400000, 'terbit');
      INSERT INTO pembayaran (id, tagihan_id, tanggal, nominal, metode, sumber, dicatat_oleh, waktu)
        VALUES ('P1', 'T1', '2026-08-05', 500000, 'tunai', 'wali', 'admin', '2026-08-05T08:00:00Z');
      INSERT INTO absensi (id, santri_id, tanggal, status, dicatat_oleh, waktu)
        VALUES ('A1', 'S1', '2026-08-03', 'hadir', 'guru', '2026-08-03T07:00:00Z'),
               ('A2', 'S1', '2026-08-04', 'izin', 'guru', '2026-08-04T07:00:00Z');
    `);
    db.close();
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('membangun bronze/silver/gold dari DB terkontrol', async () => {
    const hasil = await jalankanPipelineAnalitik({ lokasiDb, akarParquet, lokasiDuck, snapshot });
    expect(hasil.bronze).toContain('tagihan');
    expect(hasil.silver).toContain('fact_tagihan');
    expect(hasil.gold).toContain('mart_ringkasan');
  });

  it('gold padan dengan nilai harapan (ringkasan Agustus 2026)', async () => {
    const perKomponen = await goldPerKomponen(lokasiDuck, '2026-08');
    expect(perKomponen).toEqual([{ komponen: 'SPP', terbit: 500000, masuk: 500000 }]);
    const ring = await goldRingkasan(lokasiDuck, '2026-08');
    expect(ring).toEqual({ terbit: 500000, masuk: 500000 });

    const tren = await goldTrenSpp(lokasiDuck, 'S1', '2026-07', '2026-12');
    expect(tren).toEqual([
      { periode: '2026-08', terbit: 500000, masuk: 500000, sisa: 0 },
      { periode: '2026-09', terbit: 400000, masuk: 0, sisa: 400000 },
    ]);

    const absen = await goldTrenAbsen(lokasiDuck, 'S1', '2026-08-01', '2026-08-31');
    expect(absen).toEqual([{ bulan: '2026-08', hadir: 1, izin: 1, sakit: 0, alpa: 0, total: 2 }]);
  });

  it('gold tren absen adalah nol tanpa data absensi (santri lain)', async () => {
    const tren = await goldTrenAbsen(lokasiDuck, 'S1', '2026-07-01', '2026-07-31');
    expect(tren).toEqual([]);
  });

  it('snapshot slug konsisten (imura dir nama folder)', () => {
    expect(slugSnapshot(snapshot)).toBe('20260824T000000');
  });

  it('Fase 2 dual-run: gold ≡ repoLaporan/repoAbsensi pada data sama (konsistensi)', async () => {
    const db = new DatabaseSync(lokasiDb);
    const repo = repoLaporan(db);
    const repoAbs = repoAbsensi(db);

    const kompRepo = repo.laporanPerKomponen('2026-08').map((r) => ({ komponen: r.komponen, terbit: r.terbit, masuk: r.masuk }));
    expect(await goldPerKomponen(lokasiDuck, '2026-08')).toEqual(kompRepo);

    const ringRepo = repo.ringkasan('2026-08');
    expect(await goldRingkasan(lokasiDuck, '2026-08')).toEqual({ terbit: ringRepo.terbit, masuk: ringRepo.masuk });

    expect(await goldTrenSpp(lokasiDuck, 'S1', '2026-07', '2026-12')).toEqual(repo.trenSpp('S1', '2026-07', '2026-12'));
    expect(await goldTrenAbsen(lokasiDuck, 'S1', '2026-08-01', '2026-08-31')).toEqual(
      repoAbs.ringkasanPerBulan('S1', '2026-08-01', '2026-08-31'),
    );
    db.close();
  });
});