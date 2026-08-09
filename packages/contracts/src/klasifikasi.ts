import { z } from 'zod';

/**
 * Klasifikasi data pribadi, melekat pada definisi kolom.
 *
 * Alasannya ada di AGENTS.md: penyaring di `packages/core` harus bekerja dari
 * **metadata**, bukan dari daftar nama kolom yang ditulis manual dan pasti akan
 * ketinggalan. Kolom baru yang lupa didaftarkan akan **tertahan uji**, bukan lolos
 * diam-diam — lihat `klasifikasi.test.ts`.
 *
 * Ini data anak di bawah umur dan UU PDP berlaku. `NIK` terisi nyata di master
 * berkas 04, jadi ini bukan risiko hipotetis.
 */
export const TingkatKlasifikasi = z.enum([
  /** Tidak pernah keluar dari `core`. Tidak ke prompt, tidak ke Sheet, tidak ke log. */
  'terlarang',
  /** Hanya ke pihak yang berhak menurut matriks peran; tidak pernah ke prompt LLM. */
  'sensitif',
  /** Boleh ke pengurus dan pengajar; ke wali hanya untuk anaknya sendiri. */
  'internal',
  /** Bebas. */
  'publik',
]);
export type TingkatKlasifikasi = z.infer<typeof TingkatKlasifikasi>;

/** Peta kolom → tingkat klasifikasi untuk satu entitas. */
export type PetaKlasifikasi<T> = Readonly<Record<keyof T & string, TingkatKlasifikasi>>;

/**
 * Entitas beserta skema dan klasifikasinya, disatukan supaya keduanya tidak bisa
 * menyimpang. Uji kelengkapan berjalan di atas bentuk ini.
 */
export interface Entitas<T> {
  readonly nama: string;
  readonly skema: z.ZodType<T>;
  readonly kolom: readonly (keyof T & string)[];
  readonly klasifikasi: PetaKlasifikasi<T>;
}

/**
 * Bentuk entitas tanpa tipe barisnya, supaya seluruh entitas bisa ditelusuri
 * dalam satu daftar. Tanpa ini, `Entitas<Santri>` dan `Entitas<Wali>` tidak punya
 * tipe bersama yang bisa diiterasi.
 */
export interface EntitasUmum {
  readonly nama: string;
  readonly kolom: readonly string[];
  readonly klasifikasi: Readonly<Record<string, TingkatKlasifikasi | undefined>>;
}

/** Satu-satunya tempat tipe baris dilepas. Dipakai untuk menyusun daftar entitas. */
export function sebagaiEntitasUmum<T>(entitas: Entitas<T>): EntitasUmum {
  return {
    nama: entitas.nama,
    kolom: entitas.kolom,
    klasifikasi: entitas.klasifikasi as Readonly<Record<string, TingkatKlasifikasi | undefined>>,
  };
}

const URUTAN: readonly TingkatKlasifikasi[] = ['publik', 'internal', 'sensitif', 'terlarang'];

/**
 * Menyaring nilai yang tidak boleh keluar dari `core`.
 *
 * Bekerja dari klasifikasi, bukan dari daftar nama kolom — menambah kolom baru
 * tidak menuntut perubahan di sini. Kolom yang belum diklasifikasikan **dibuang**,
 * bukan diloloskan; uji kelengkapan yang memastikan hal itu tidak pernah terjadi
 * diam-diam.
 */
export function saringUmum(
  entitas: EntitasUmum,
  baris: Readonly<Record<string, unknown>>,
  tingkatMaksimum: TingkatKlasifikasi,
): Record<string, unknown> {
  const batas = URUTAN.indexOf(tingkatMaksimum);
  const hasil: Record<string, unknown> = {};
  for (const kolom of entitas.kolom) {
    const tingkat = entitas.klasifikasi[kolom];
    if (tingkat !== undefined && URUTAN.indexOf(tingkat) <= batas) {
      hasil[kolom] = baris[kolom];
    }
  }
  return hasil;
}

/** Versi bertipe dari {@link saringUmum}. */
export function saring<T extends object>(
  entitas: Entitas<T>,
  baris: T,
  tingkatMaksimum: TingkatKlasifikasi,
): Partial<T> {
  return saringUmum(
    sebagaiEntitasUmum(entitas),
    baris as Readonly<Record<string, unknown>>,
    tingkatMaksimum,
  ) as Partial<T>;
}

/**
 * Apa yang boleh masuk prompt LLM: hanya `internal` dan `publik`.
 *
 * AGENTS.md — data pribadi disaring di `core` sebelum data keluar, bukan
 * diserahkan pada prompt untuk menahan diri.
 */
export function untukPrompt<T extends object>(entitas: Entitas<T>, baris: T): Partial<T> {
  return saring(entitas, baris, 'internal');
}
