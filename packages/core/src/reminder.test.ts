import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoKalenderHijriah,
  repoNotifikasi,
} from '@siakad/db';
import { buatHandlerReminder, teksReminderHijriah, teksReminderJatuhTempo } from './reminder.js';

/**
 * Reminder worker (RFC-012): kalender hijriah → pengurus, jatuh tempo
 * H-3/H-1 → wali terdaftar. Idempoten lewat jejaknya sendiri.
 */

let db: DatabaseSync;
let handler: ReturnType<typeof buatHandlerReminder>;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
  handler = buatHandlerReminder({
    repoNotifikasi: repoNotifikasi(db),
    repoKalenderHijriah: repoKalenderHijriah(db),
  });
});

function sisipKalender(tahun: number, bulan: number, mulai: string): void {
  repoKalenderHijriah(db).sisip({
    tahun_hijriah: tahun,
    bulan_hijriah: bulan,
    nama_bulan: 'Ramadhan',
    tanggal_mulai_masehi: mulai,
    provisional: true,
    disetujui_oleh: null,
    disetujui_pada: null,
    diingatkan_pada: null,
    sumber: 'myquran',
    catatan: null,
  });
}

let urutan = 0;
function seedSantriWali(telegramId: number | null): { santriId: string; komponen: string; ta: string } {
  urutan += 1;
  const komponen = 'kmp-spp';
  const ta = 'ta-2026-2027';
  const santriId = buatUlid(3_000_000_000_000 + urutan);
  const waliId = buatUlid(3_100_000_000_000 + urutan);

  db.prepare(`INSERT OR IGNORE INTO akun_keuangan (kode, nama, arah, aktif) VALUES (1, 'Kas', 'masuk', 1)`).run();
  db.prepare(
    `INSERT OR IGNORE INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
     VALUES (?, 'spp', 'SPP Bulanan', 1, 1)`,
  ).run(komponen);
  db.prepare(
    `INSERT OR IGNORE INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026-2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(ta);
  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
       alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos, status, anak_ke, jumlah_saudara)
     VALUES (?, ?, NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId, `26270${urutan}`);
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
  ).run(buatUlid(3_200_000_000_000 + urutan), telegramId, waliId);
  return { santriId, komponen, ta };
}

function sisipTagihan(id: string, santriId: string, komponen: string, ta: string, jatuhTempo: string): void {
  db.prepare(
    `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
       skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
     VALUES (?, ?, ?, ?, '2026-08', 'masehi', ?, 450000, NULL, 'terbit')`,
  ).run(id, santriId, ta, komponen, jatuhTempo);
}

describe('teks reminder', () => {
  it('reminder hijriah memuat nama bulan, tahun, tanggal, dan perintah /setujui', () => {
    const teks = teksReminderHijriah({
      tahun_hijriah: 1448,
      bulan_hijriah: 9,
      nama_bulan: 'Ramadhan',
      tanggal_mulai_masehi: '2027-02-07',
      provisional: true,
      disetujui_oleh: null,
      disetujui_pada: null,
      diingatkan_pada: null,
      sumber: 'myquran',
      catatan: null,
    });
    expect(teks).toContain('Ramadhan');
    expect(teks).toContain('1448');
    expect(teks).toContain('2027-02-07');
    expect(teks).toContain('/setujui 1448-09');
  });

  it('reminder jatuh tempo memuat komponen, nominal, dan batas bayar', () => {
    const teks = teksReminderJatuhTempo(
      {
        tagihan_id: 'x',
        periode: '2026-08',
        nominal: 450000,
        jatuh_tempo: '2026-09-10',
        komponen_nama: 'SPP Bulanan',
        santri_id: 's',
        santri_nama: 'Aidah',
      },
      'h3',
    );
    expect(teks).toContain('SPP Bulanan');
    expect(teks).toContain('Rp 450.000');
    expect(teks).toContain('2026-09-10');
    expect(teks).toContain('3 hari lagi');
  });
});

describe('kirimReminderHijriah', () => {
  it('mengirim ke pengurus dan menandai — putaran kedua kosong', async () => {
    sisipKalender(1448, 9, '2026-08-18'); // dalam jendela 3 hari dari 2026-08-16
    sisipKalender(1448, 10, '2026-09-01'); // di luar jendela

    const terkirim: string[] = [];
    const pertama = await handler.kirimReminderHijriah({
      hariIni: '2026-08-16',
      dalamHari: 3,
      pengurusIds: [144666620],
      waktu: 'w1',
      kirim: async (_id, teks) => {
        terkirim.push(teks);
        return true;
      },
    });

    expect(pertama).toEqual({ itemDiproses: 1, pesanTerkirim: 1, gagal: 0 });
    expect(terkirim[0]).toContain('/setujui 1448-09');

    const kedua = await handler.kirimReminderHijriah({
      hariIni: '2026-08-16',
      dalamHari: 3,
      pengurusIds: [144666620],
      waktu: 'w2',
      kirim: async () => true,
    });
    expect(kedua.itemDiproses).toBe(0);
  });

  it('tanpa pengurus tidak ditandai (menunggu daftar pengurus)', async () => {
    sisipKalender(1448, 9, '2026-08-18');
    const hasil = await handler.kirimReminderHijriah({
      hariIni: '2026-08-16',
      dalamHari: 3,
      pengurusIds: [],
      waktu: 'w1',
      kirim: async () => true,
    });
    expect(hasil.pesanTerkirim).toBe(0);
    expect(hasil.itemDiproses).toBe(1);

    const kedua = await handler.kirimReminderHijriah({
      hariIni: '2026-08-16',
      dalamHari: 3,
      pengurusIds: [144666620],
      waktu: 'w2',
      kirim: async () => true,
    });
    expect(kedua.itemDiproses).toBe(1);
  });
});

describe('kirimReminderJatuhTempo', () => {
  it('H-3 dan H-1 masing-masing dikirim sekali ke wali terdaftar', async () => {
    const { santriId, komponen, ta } = seedSantriWali(144666620);
    const tagihan = buatUlid(4_000_000_000_001);
    sisipTagihan(tagihan, santriId, komponen, ta, '2026-08-19'); // H-3 dari 16

    const terkirim: string[] = [];
    const hasil = await handler.kirimReminderJatuhTempo({
      hariIni: '2026-08-16',
      waktu: 'w1',
      kirim: async (_id, teks) => {
        terkirim.push(teks);
        return true;
      },
    });

    expect(hasil.itemDiproses).toBe(1);
    expect(hasil.pesanTerkirim).toBe(1);
    expect(terkirim[0]).toContain('3 hari lagi');

    // Putaran berikutnya: tidak dikirim ulang (sudah ditandai h3)
    const kedua = await handler.kirimReminderJatuhTempo({
      hariIni: '2026-08-16',
      waktu: 'w2',
      kirim: async () => true,
    });
    expect(kedua.pesanTerkirim).toBe(0);

    // Dua hari kemudian (H-1) tahap h1 terkirim
    const h1 = await handler.kirimReminderJatuhTempo({
      hariIni: '2026-08-18',
      waktu: 'w3',
      kirim: async () => true,
    });
    expect(h1.pesanTerkirim).toBe(1);
  });

  it('tagihan tanpa wali terdaftar tidak ditandai', async () => {
    const { santriId, komponen, ta } = seedSantriWali(null);
    sisipTagihan(buatUlid(4_000_000_000_002), santriId, komponen, ta, '2026-08-19');

    const pertama = await handler.kirimReminderJatuhTempo({
      hariIni: '2026-08-16',
      waktu: 'w1',
      kirim: async () => true,
    });
    expect(pertama.pesanTerkirim).toBe(0);

    const kedua = await handler.kirimReminderJatuhTempo({
      hariIni: '2026-08-16',
      waktu: 'w2',
      kirim: async () => true,
    });
    expect(kedua.itemDiproses).toBe(1);
  });
});
