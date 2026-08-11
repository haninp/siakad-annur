import type { DatabaseSync } from 'node:sqlite';
import type { DukunganTransaksi } from '@siakad/contracts';

/**
 * Membuat wrapper transaksi SQLite sederhana (BEGIN / COMMIT / ROLLBACK).
 *
 * Operasi di dalam `fn` harus sinkron — sesuai pola `node:sqlite` dan handler
 * keuangan yang ada. Bila `fn` melempar error, transaksi di-rollback.
 */
export function buatDukunganTransaksi(db: DatabaseSync): DukunganTransaksi {
  return {
    jalankanTransaksi: <T>(fn: () => T): T => {
      db.exec('BEGIN');
      try {
        const hasil = fn();
        db.exec('COMMIT');
        return hasil;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}