import { DatabaseSync } from 'node:sqlite';

/**
 * Pembuka koneksi basis data.
 *
 * Alasan berkas ini ada: setelan yang menentukan keutuhan data di SQLite berlaku
 * **per-koneksi**, bukan per-berkas. Koneksi yang dibuka tanpa menyetelnya akan
 * berperilaku berbeda dari yang menjalankan migrasi — tanpa galat, tanpa tanda.
 *
 * Soal kunci asing: `node:sqlite` **sudah menyalakannya secara baku** (berbeda dari
 * SQLite mentah maupun `better-sqlite3`, yang mematikannya). PRAGMA di bawah karena
 * itu bukan penambal, melainkan penegasan: ia menjaga dari default yang berubah dan
 * dari koneksi yang sengaja dibuat dengan `enableForeignKeyConstraints: false`.
 * Bergantung pada default yang tidak kita kendalikan adalah cara mahal untuk
 * kehilangan integritas rujukan diam-diam.
 */

export interface OpsiKoneksi {
  /** `':memory:'` untuk uji. */
  readonly lokasi: string;
  /**
   * Berapa lama menunggu bila berkas sedang dikunci proses lain, dalam milidetik.
   * Bot dan worker berbagi satu berkas, jadi tabrakan itu wajar dan bukan galat.
   */
  readonly tungguKunciMs?: number;
}

export function bukaBasisData(opsi: OpsiKoneksi): DatabaseSync {
  const db = new DatabaseSync(opsi.lokasi);

  // Urutannya penting: nyalakan penegakan sebelum satu pun pernyataan lain jalan.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`PRAGMA busy_timeout = ${opsi.tungguKunciMs ?? 5000}`);

  if (opsi.lokasi !== ':memory:') {
    // WAL membuat pembaca tidak memblokir penulis — bot, worker, dan pipeline
    // OLAP membaca berkas yang sama. Tidak berlaku untuk basis data di memori.
    db.exec('PRAGMA journal_mode = WAL');
  }

  return db;
}

/** Apakah penegakan kunci asing benar-benar menyala pada koneksi ini. */
export function kunciAsingMenyala(db: DatabaseSync): boolean {
  const baris = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number } | undefined;
  return baris?.foreign_keys === 1;
}
