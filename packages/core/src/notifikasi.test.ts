import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, repoNotifikasi } from '@siakad/db';
import { buatHandlerNotifikasi, teksNotifikasiTagihan, type DepNotifikasi } from './notifikasi.js';

/**
 * Worker notifikasi (RFC-011): batch kirim ke wali terdaftar, penandaan
 * idempoten, dan perilaku tagihan tanpa penerima (tidak ditandai).
 */

let db: DatabaseSync;
let handler: ReturnType<typeof buatHandlerNotifikasi>;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  handler = buatHandlerNotifikasi({ repoNotifikasi: repoNotifikasi(db) } satisfies DepNotifikasi);
});

function seedDasar(telegramId: number | null): { santriId: string; komponen: string; ta: string } {
  const komponen = buatUlid(1_000_000_000_002);
  const ta = buatUlid(1_000_000_000_003);
  const santriId = buatUlid(1_000_000_000_004);
  const waliId = buatUlid(1_000_000_000_005);

  db.prepare(`INSERT INTO akun_keuangan (kode, nama, arah, aktif) VALUES (1, 'Kas', 'masuk', 1)`).run();
  db.prepare(
    `INSERT INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
     VALUES (?, 'spp', 'SPP Bulanan', 1, 1)`,
  ).run(komponen);
  db.prepare(
    `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026-2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(ta);
  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
       alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos, status, anak_ke, jumlah_saudara)
     VALUES (?, '2627001', NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId);
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Bapak Contoh', NULL, NULL, 'hidup')`,
  ).run(waliId);
  db.prepare(
    `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya, penerima_notifikasi, aktif)
     VALUES (?, ?, 'ayah', 1, 1, 1)`,
  ).run(santriId, waliId);
  db.prepare(
    `INSERT INTO pengguna_telegram (id, telegram_id, peran, wali_id, undangan_kode, aktif, dibuat_pada)
     VALUES (?, ?, 'wali', ?, NULL, 1, '2026-08-16T08:00:00+07:00')`,
  ).run(buatUlid(1_000_000_000_006), telegramId, waliId);
  return { santriId, komponen, ta };
}

function sisipTagihan(id: string, santriId: string, komponen: string, ta: string): void {
  db.prepare(
    `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
       skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
     VALUES (?, ?, ?, ?, '2026-08', 'masehi', '2026-09-10', 450000, NULL, 'terbit')`,
  ).run(id, santriId, ta, komponen);
}

describe('teksNotifikasiTagihan', () => {
  it('memuat komponen, periode, nominal, batas bayar, dan arah ke bot', () => {
    const teks = teksNotifikasiTagihan({
      tagihan_id: 'x',
      periode: '2026-08',
      nominal: 450000,
      jatuh_tempo: '2026-09-10',
      komponen_nama: 'SPP Bulanan',
      santri_id: 's',
      santri_nama: 'Aidah',
    });
    expect(teks).toContain('SPP Bulanan');
    expect(teks).toContain('2026-08');
    expect(teks).toContain('Aidah');
    expect(teks).toContain('Rp 450.000');
    expect(teks).toContain('Batas bayar: 2026-09-10');
    expect(teks).toContain('@rtq_annur_bot');
  });
});

describe('kirimNotifikasiTerbit', () => {
  it('mengirim ke wali terdaftar dan menandai — putaran kedua kosong', async () => {
    const { santriId, komponen, ta } = seedDasar(144666620);
    sisipTagihan(buatUlid(2_000_000_000_001), santriId, komponen, ta);

    const terkirim: { telegramId: number; teks: string }[] = [];
    const pertama = await handler.kirimNotifikasiTerbit({
      waktu: 'w1',
      kirim: async (telegramId, teks) => {
        terkirim.push({ telegramId, teks });
        return true;
      },
    });

    expect(pertama).toEqual({ tagihanDiproses: 1, pesanTerkirim: 1, gagal: 0 });
    expect(terkirim).toHaveLength(1);
    expect(terkirim[0]?.telegramId).toBe(144666620);

    const kedua = await handler.kirimNotifikasiTerbit({
      waktu: 'w2',
      kirim: async () => true,
    });
    expect(kedua).toEqual({ tagihanDiproses: 0, pesanTerkirim: 0, gagal: 0 });
  });

  it('tagihan tanpa wali terdaftar TIDAK ditandai — tetap muncul di putaran berikutnya', async () => {
    const { santriId, komponen, ta } = seedDasar(null);
    const tagihanId = buatUlid(2_000_000_000_001);
    sisipTagihan(tagihanId, santriId, komponen, ta);

    const pertama = await handler.kirimNotifikasiTerbit({ waktu: 'w1', kirim: async () => true });
    expect(pertama.pesanTerkirim).toBe(0);
    expect(pertama.tagihanDiproses).toBe(1);

    const kedua = await handler.kirimNotifikasiTerbit({ waktu: 'w2', kirim: async () => true });
    expect(kedua.tagihanDiproses).toBe(1);
    expect(pertama.pesanTerkirim).toBe(0);
  });

  it('kirim gagal dihitung, tagihan tetap ditandai (anti-duplikat)', async () => {
    const { santriId, komponen, ta } = seedDasar(144666620);
    sisipTagihan(buatUlid(2_000_000_000_001), santriId, komponen, ta);

    const hasil = await handler.kirimNotifikasiTerbit({
      waktu: 'w1',
      kirim: async () => false,
    });
    expect(hasil).toEqual({ tagihanDiproses: 1, pesanTerkirim: 0, gagal: 1 });

    const kedua = await handler.kirimNotifikasiTerbit({ waktu: 'w2', kirim: async () => true });
    expect(kedua.tagihanDiproses).toBe(0);
  });

  it('satu tagihan dengan dua wali terdaftar → dua pesan', async () => {
    const { santriId, komponen, ta } = seedDasar(144666620);
    const wali2 = buatUlid(1_000_000_000_007);
    db.prepare(
      `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
       VALUES (?, NULL, 'Ibu Siti', NULL, NULL, 'hidup')`,
    ).run(wali2);
    db.prepare(
      `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya, penerima_notifikasi, aktif)
       VALUES (?, ?, 'ibu', 0, 1, 1)`,
    ).run(santriId, wali2);
    db.prepare(
      `INSERT INTO pengguna_telegram (id, telegram_id, peran, wali_id, undangan_kode, aktif, dibuat_pada)
       VALUES (?, 177782856, 'wali', ?, NULL, 1, '2026-08-16T08:00:00+07:00')`,
    ).run(buatUlid(1_000_000_000_008), wali2);
    sisipTagihan(buatUlid(2_000_000_000_001), santriId, komponen, ta);

    const hasil = await handler.kirimNotifikasiTerbit({
      waktu: 'w1',
      kirim: async () => true,
    });
    expect(hasil.pesanTerkirim).toBe(2);
  });
});
