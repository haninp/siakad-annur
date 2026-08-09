import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Runner migrasi SQLite.
 *
 * Memakai `node:sqlite` bawaan Node, bukan pustaka native. Tidak ada langkah
 * kompilasi, tidak ada binary per-arsitektur — sejalan dengan ADR 0006: repo
 * harus bisa dijalankan siapa pun tanpa perkakas khusus.
 *
 * Pesan galat di berkas ini **ditujukan ke developer**, bukan pengguna akhir,
 * jadi ia memang menyebut nama tabel dan nomor versi. Aturan "pesan substantif
 * dan bebas istilah teknis" di AGENTS.md berlaku untuk pesan ke wali dan
 * pengajar — lihat `@siakad/core`.
 */

export interface Migrasi {
  /** Menaik dan tidak pernah dipakai ulang. */
  readonly versi: number;
  readonly nama: string;
  readonly sql: string;
}

export interface HasilMigrasi {
  readonly diterapkan: readonly number[];
  readonly sudahAda: readonly number[];
}

const TABEL_MIGRASI = `
CREATE TABLE IF NOT EXISTS migrasi (
  versi          INTEGER PRIMARY KEY,
  nama           TEXT NOT NULL,
  sidik_jari     TEXT NOT NULL,
  diterapkan_pada TEXT NOT NULL
) STRICT;
`;

/**
 * Sidik jari isi migrasi, **tanpa normalisasi apa pun**.
 *
 * Perubahan spasi pun harus terdeteksi: begitu sebuah migrasi sudah diterapkan,
 * setiap suntingan berarti isi basis data dan isi kode tidak lagi menggambarkan
 * hal yang sama. Itu justru jenis penyimpangan yang paling sulit ditemukan
 * belakangan.
 */
export function sidikJari(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

interface BarisMigrasi {
  readonly versi: number;
  readonly nama: string;
  readonly sidik_jari: string;
}

function periksaDaftar(daftar: readonly Migrasi[]): void {
  const terlihat = new Set<number>();
  let sebelumnya = 0;
  for (const m of daftar) {
    if (!Number.isInteger(m.versi) || m.versi < 1) {
      throw new Error(`Migrasi "${m.nama}" punya versi tidak sah: ${m.versi}`);
    }
    if (terlihat.has(m.versi)) {
      throw new Error(`Versi migrasi ${m.versi} dipakai lebih dari sekali`);
    }
    if (m.versi <= sebelumnya) {
      throw new Error(
        `Daftar migrasi harus menaik: versi ${m.versi} muncul setelah ${sebelumnya}`,
      );
    }
    terlihat.add(m.versi);
    sebelumnya = m.versi;
  }
}

/**
 * Menerapkan migrasi yang belum pernah dijalankan, dan **menolak berjalan** bila
 * riwayat basis data tidak lagi cocok dengan daftar di kode.
 *
 * Idempoten: memanggilnya dua kali tidak mengubah apa pun pada panggilan kedua.
 */
export function jalankanMigrasi(db: DatabaseSync, daftar: readonly Migrasi[]): HasilMigrasi {
  periksaDaftar(daftar);

  db.exec('PRAGMA foreign_keys = ON');
  db.exec(TABEL_MIGRASI);

  const sudah = db.prepare('SELECT versi, nama, sidik_jari FROM migrasi ORDER BY versi').all() as
    | BarisMigrasi[]
    | [];
  const peta = new Map(daftar.map((m) => [m.versi, m]));

  for (const baris of sudah) {
    const m = peta.get(baris.versi);
    if (m === undefined) {
      throw new Error(
        `Basis data memuat migrasi ${baris.versi} ("${baris.nama}") yang tidak ada di daftar. ` +
          `Migrasi yang sudah diterapkan tidak boleh dihapus dari kode.`,
      );
    }
    if (sidikJari(m.sql) !== baris.sidik_jari) {
      throw new Error(
        `Migrasi ${baris.versi} ("${baris.nama}") berubah setelah diterapkan. ` +
          `Jangan sunting migrasi lama — tambahkan migrasi baru.`,
      );
    }
  }

  const sudahVersi = new Set(sudah.map((b) => b.versi));
  const diterapkan: number[] = [];

  for (const m of daftar) {
    if (sudahVersi.has(m.versi)) continue;

    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.prepare(
        'INSERT INTO migrasi (versi, nama, sidik_jari, diterapkan_pada) VALUES (?, ?, ?, ?)',
      ).run(m.versi, m.nama, sidikJari(m.sql), new Date().toISOString());
      db.exec('COMMIT');
    } catch (galat) {
      db.exec('ROLLBACK');
      throw new Error(`Migrasi ${m.versi} ("${m.nama}") gagal: ${(galat as Error).message}`, {
        cause: galat,
      });
    }
    diterapkan.push(m.versi);
  }

  return { diterapkan, sudahAda: [...sudahVersi].sort((a, b) => a - b) };
}

/** Versi tertinggi yang sudah diterapkan; `0` bila basis data masih kosong. */
export function versiTerpasang(db: DatabaseSync): number {
  const ada = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrasi'")
    .get();
  if (ada === undefined) return 0;
  const baris = db.prepare('SELECT MAX(versi) AS versi FROM migrasi').get() as {
    versi: number | null;
  };
  return baris.versi ?? 0;
}
