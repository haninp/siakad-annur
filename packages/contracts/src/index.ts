/**
 * `@siakad/contracts` — sumber kebenaran bentuk data.
 *
 * Cakupan saat ini: master data **identitas dan akademik** (tugas 0.10).
 * Bagian keuangan menunggu sesi P3 — lihat docs/06-migrasi-legacy.md.
 */

export * from './enum.js';
export * from './klasifikasi.js';
export * from './identitas.js';
export * from './akademik.js';
export * from './turunan.js';
export * from './ddl.js';

import {
  entitasPengajar,
  entitasPengajarAlias,
  entitasSantri,
  entitasSantriAlias,
  entitasSantriWali,
  entitasWali,
  entitasWaliAlias,
} from './identitas.js';
import { sebagaiEntitasUmum, type EntitasUmum } from './klasifikasi.js';
import {
  entitasKurikulum,
  entitasMapel,
  entitasPendaftaran,
  entitasRombel,
  entitasSkalaNilai,
  entitasSkalaNilaiButir,
  entitasTahunAjaran,
} from './akademik.js';

/**
 * Seluruh entitas master data. Uji kelengkapan klasifikasi berjalan di atas
 * daftar ini — entitas baru yang lupa didaftarkan di sini tidak akan diperiksa,
 * jadi daftar ini sendiri diuji terhadap DDL.
 */
export const ENTITAS_MASTER_DATA: readonly EntitasUmum[] = [
  sebagaiEntitasUmum(entitasSantri),
  sebagaiEntitasUmum(entitasSantriAlias),
  sebagaiEntitasUmum(entitasWali),
  sebagaiEntitasUmum(entitasWaliAlias),
  sebagaiEntitasUmum(entitasSantriWali),
  sebagaiEntitasUmum(entitasPengajar),
  sebagaiEntitasUmum(entitasPengajarAlias),
  sebagaiEntitasUmum(entitasTahunAjaran),
  sebagaiEntitasUmum(entitasRombel),
  sebagaiEntitasUmum(entitasPendaftaran),
  sebagaiEntitasUmum(entitasSkalaNilai),
  sebagaiEntitasUmum(entitasSkalaNilaiButir),
  sebagaiEntitasUmum(entitasMapel),
  sebagaiEntitasUmum(entitasKurikulum),
];
