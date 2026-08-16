import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { DDL_KALENDER_HIJRIAH, KalenderHijriah } from './kalender.js';

const barisSah = {
  tahun_hijriah: 1448,
  bulan_hijriah: 2,
  nama_bulan: 'Safar',
  tanggal_mulai_masehi: '2026-07-16',
  provisional: true,
  disetujui_oleh: null,
  disetujui_pada: null,
  diingatkan_pada: null,
  sumber: 'myquran' as const,
  catatan: null,
};

describe('skema kalender_hijriah', () => {
  it('menerima baris sah', () => {
    const hasil = KalenderHijriah.safeParse(barisSah);
    expect(hasil.success).toBe(true);
  });

  it('menolak bulan di luar 1 sampai 12', () => {
    const hasil = KalenderHijriah.safeParse({ ...barisSah, bulan_hijriah: 13 });
    expect(hasil.success).toBe(false);
  });

  it('menolak sumber asing', () => {
    const hasil = KalenderHijriah.safeParse({ ...barisSah, sumber: 'lainnya' });
    expect(hasil.success).toBe(false);
  });

  it('menolak tanggal tidak ISO', () => {
    const hasil = KalenderHijriah.safeParse({
      ...barisSah,
      tanggal_mulai_masehi: '16 Juli 2026',
    });
    expect(hasil.success).toBe(false);
  });
});

describe('jaminan skema kalender_hijriah di basis data', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(DDL_KALENDER_HIJRIAH);

  it('tabel kalender_hijriah terbentuk', () => {
    const tabel = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(tabel.map((t) => t.name)).toContain('kalender_hijriah');
  });

  it('CHECK menolak provisional selain 0 atau 1', () => {
    expect(() =>
      db
        .prepare(
          'INSERT INTO kalender_hijriah (tahun_hijriah, bulan_hijriah, nama_bulan, tanggal_mulai_masehi, provisional, sumber) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(1448, 1, 'Muharam', '2026-06-16', 2, 'myquran'),
    ).toThrow();
  });
});
