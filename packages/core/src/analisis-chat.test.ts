import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoAkunKeuangan,
  repoAnalisisLog,
  repoKomponenBiaya,
  repoLaporan,
  repoPembayaran,
  repoSantri,
  repoTahunAjaran,
} from '@siakad/db';
import { buatHandlerAnalisis } from './analisis-chat.js';

let db: DatabaseSync;
let dasar: { santriId: string; taId: string; komponenSppId: string };

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  const santriId = buatUlid(3_200_000_000_001);
  const taId = buatUlid(3_200_000_000_002);
  const komponenSppId = buatUlid(3_200_000_000_003);
  repoSantri(db).sisip({
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
  repoTahunAjaran(db).sisip({
    id: taId,
    kode: '2025-2026',
    mulai: '2025-07-01',
    selesai: '2026-06-30',
    aktif: true,
  });
  repoAkunKeuangan(db).sisip({ kode: 101, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
  repoKomponenBiaya(db).sisip({
    id: komponenSppId,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: 101,
    aktif: true,
  });
  const sisip = (periode: string, status: 'terbit' | 'lunas') => {
    const tagihanId = buatUlid();
    db.prepare(
      `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
         skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
       VALUES (?, ?, ?, ?, ?, 'masehi', '2026-09-10', 450000, NULL, ?)`,
    ).run(tagihanId, santriId, taId, komponenSppId, periode, status);
    return tagihanId;
  };
  // 2026-07 lunas (bayar 450k), 2026-08 terbit tanpa bayar
  const t7 = sisip('2026-07', 'lunas');
  sisip('2026-08', 'terbit');
  repoPembayaran(db).sisip({
    id: buatUlid(),
    tagihan_id: t7,
    tanggal: '2026-07-15',
    nominal: 450_000,
    metode: 'transfer',
    sumber: 'wali',
    cicilan_ke: null,
    dicatat_oleh: buatUlid(),
    waktu: '2026-07-15T09:00:00+07:00',
  });
  dasar = { santriId, taId, komponenSppId };
});

const superadmin = { peran: 'superadmin' as const, id: 'tg-superadmin' };
const admin = { peran: 'admin' as const, id: 'tg-admin' };
const bendahara = { peran: 'bendahara' as const, id: 'tg-bendahara' };
const wali = { peran: 'wali' as const, id: 'tg-wali' };

const handler = () => buatHandlerAnalisis({ repoLaporan: repoLaporan(db), repoAnalisisLog: repoAnalisisLog(db) });
const WAKTU = '2026-08-19T09:00:00+07:00';

describe('analisisTool — ringkasan_laporan', () => {
  it('bendahara: ringkasan sesuai data (angka dari SQL)', () => {
    const hasil = handler().analisisTool({
      aktor: bendahara,
      tool: 'ringkasan_laporan',
      parameter: { periode: '2026-07' },
      waktu: WAKTU,
    });
    expect(hasil.ok).toBe(true);
    const data = hasil.data as { periode: string; ringkasan: { terbit: number; masuk: number; sisa: number } };
    expect(data.periode).toBe('2026-07');
    expect(data.ringkasan).toEqual({ terbit: 450_000, masuk: 450_000, sisa: 0 });
  });

  it('admin & superadmin boleh; wali ditolak', () => {
    expect(handler().analisisTool({ aktor: admin, tool: 'ringkasan_laporan', parameter: { periode: '2026-08' }, waktu: WAKTU }).ok).toBe(true);
    expect(handler().analisisTool({ aktor: superadmin, tool: 'ringkasan_laporan', parameter: { periode: '2026-08' }, waktu: WAKTU }).ok).toBe(true);
    const w = handler().analisisTool({ aktor: wali, tool: 'ringkasan_laporan', parameter: { periode: '2026-08' }, waktu: WAKTU });
    expect(w.ok).toBe(false);
    expect(w.pesan).toContain('bendahara');
  });

  it('parameter periode tidak valid ditolak (tanpa log)', () => {
    const hasil = handler().analisisTool({ aktor: bendahara, tool: 'ringkasan_laporan', parameter: { periode: 'agustus' }, waktu: WAKTU });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('tidak valid');
    expect(repoAnalisisLog(db).cariByAktor('tg-bendahara')).toHaveLength(0);
  });
});

describe('analisisTool — tren_pembayaran_spp', () => {
  it('bendahara: baris per periode terbit/masuk/sisa', () => {
    const hasil = handler().analisisTool({
      aktor: bendahara,
      tool: 'tren_pembayaran_spp',
      parameter: { santri_id: dasar.santriId, mulai: '2026-07', selesai: '2026-08' },
      waktu: WAKTU,
    });
    expect(hasil.ok).toBe(true);
    const data = hasil.data as { baris: { periode: string; terbit: number; masuk: number; sisa: number }[] };
    expect(data.baris).toHaveLength(2);
    expect(data.baris[0]).toMatchObject({ periode: '2026-07', terbit: 450_000, masuk: 450_000, sisa: 0 });
    expect(data.baris[1]).toMatchObject({ periode: '2026-08', terbit: 450_000, masuk: 0, sisa: 450_000 });
  });
});

describe('audit', () => {
  it('permintaan sukses tercatat di analisis_log', () => {
    handler().analisisTool({ aktor: bendahara, tool: 'ringkasan_laporan', parameter: { periode: '2026-07' }, waktu: WAKTU });
    handler().analisisTool({ aktor: bendahara, tool: 'tren_pembayaran_spp', parameter: { santri_id: dasar.santriId, mulai: '2026-07', selesai: '2026-08' }, waktu: WAKTU });
    const log = repoAnalisisLog(db).cariByAktor('tg-bendahara');
    expect(log).toHaveLength(2);
    expect(log.map((l) => l.tool).sort()).toEqual(['ringkasan_laporan', 'tren_pembayaran_spp']);
  });
});
