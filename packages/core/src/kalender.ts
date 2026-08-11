import type { KalenderHijriah } from '@siakad/contracts';
import type { RepoKalenderHijriah } from '@siakad/db';

/**
 * Aturan murni kalender Hijriah.
 *
 * Semua konversi harus berjalan di atas tabel `kalender_hijriah` yang nyata,
 * bukan rumus — sesuai ADR 0004 dan ADR 0013.
 */

/** Cari bulan Hijriah yang mencakup tanggal Masehi tertentu. */
export function cariBulanHijriahPadaTanggal(
  repo: RepoKalenderHijriah,
  masehi: string,
): KalenderHijriah | undefined {
  return repo.hitungBulanPadaTanggal(masehi);
}

/** Tiga bulan yang ditentukan sidang isbat: Ramadan (9), Syawal (10), Dzulhijjah (12). */
export function butuhIsbat(bulan: number): boolean {
  return bulan === 9 || bulan === 10 || bulan === 12;
}
