/**
 * Identitas aktor dan penegakan peran minimum.
 *
 * Tabel `pengguna_telegram` belum ada, jadi handler menerima peran sebagai input
 * (keputusan desain 1.4). Bot yang menentukan peran dari pemetaan `telegram_id`;
 * `core` hanya menegakkan bahwa peran tersebut cukup untuk aksi yang diminta.
 *
 * Saat `pengguna_telegram` dibuat, pemetaan itu tinggal disambungkan — aturan
 * "peran cukup" tetap hidup di sini, tidak berpindah ke bot (AGENTS.md: izin
 * hanya ditegakkan di `packages/core`).
 */

export type Peran = 'superadmin' | 'admin' | 'bendahara' | 'pengajar' | 'wali';

export interface Aktor {
  readonly peran: Peran;
  readonly id: string;
}

/** Hasil baku handler — dibagi oleh handler izin dan keuangan. */
export interface HasilHandler<T> {
  readonly ok: boolean;
  readonly pesan?: string;
  readonly data?: T;
}

/**
 * Apakah aktor cukup untuk melakukan aksi yang mensyaratkan salah satu peran
 * berikut. `admin` selalu cukup (matriks peran).
 */
export function peranCukup(aktor: Aktor, ...perlu: readonly Peran[]): boolean {
  if (aktor.peran === 'superadmin') return true;
  return perlu.includes(aktor.peran);
}