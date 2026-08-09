import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { bukaBasisData, kunciAsingMenyala } from './koneksi.js';
import { DAFTAR_MIGRASI } from './daftar-migrasi.js';
import { jalankanMigrasi } from './migrasi.js';

describe('bukaBasisData', () => {
  it('menyalakan penegakan kunci asing', () => {
    const db = bukaBasisData({ lokasi: ':memory:' });
    expect(kunciAsingMenyala(db)).toBe(true);
  });

  /**
   * Mencatat perilaku yang sedang kita andalkan: `node:sqlite` menyalakan kunci
   * asing secara baku — berbeda dari SQLite mentah dan `better-sqlite3`. Kalau
   * default itu berubah suatu hari, uji ini yang memberitahu, bukan data rusak
   * yang ditemukan berbulan-bulan kemudian.
   */
  it('node:sqlite menyalakan kunci asing secara baku', () => {
    expect(kunciAsingMenyala(new DatabaseSync(':memory:'))).toBe(true);
  });

  /** Dan inilah yang dijaga PRAGMA di `bukaBasisData`: default itu bisa ditimpa. */
  it('kunci asing bisa dimatikan sengaja, jadi menyetelnya tetap berarti', () => {
    const mati = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
    expect(kunciAsingMenyala(mati)).toBe(false);

    mati.exec('PRAGMA foreign_keys = ON');
    expect(kunciAsingMenyala(mati)).toBe(true);
  });

  it('koneksi baru ke basis data yang sudah bermigrasi tetap menegakkan kunci asing', () => {
    // Menyalakannya di runner migrasi saja tidak cukup: pragma berlaku per-koneksi.
    const db = bukaBasisData({ lokasi: ':memory:' });
    jalankanMigrasi(db, DAFTAR_MIGRASI);
    expect(() =>
      db
        .prepare(
          `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya,
             penerima_notifikasi)
           VALUES ('01JRZ8QK7M4N2P5V9X3B6C8D01', '01JRZ8QK7M4N2P5V9X3B6C8D02', 'ayah', 1, 1)`,
        )
        .run(),
    ).toThrow();
  });
});
