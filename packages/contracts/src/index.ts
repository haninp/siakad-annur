/**
 * `@siakad/contracts` — sumber kebenaran bentuk data.
 *
 * Cakupan saat ini: master data **identitas, akademik, dan keuangan**
 * (tugas 0.10 dan 1.2).
 */

export * from './enum.js';
export * from './ulid.js';
export * from './klasifikasi.js';
export * from './identitas.js';
export * from './akademik.js';
export * from './kalender.js';
export * from './keuangan.js';
export * from './pembayaran.js';
export * from './turunan.js';
export * from './transaksi.js';
export * from './izin.js';
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
import { entitasUsulanIzin } from './izin.js';
import {
  entitasKurikulum,
  entitasMapel,
  entitasPendaftaran,
  entitasRombel,
  entitasSkalaNilai,
  entitasSkalaNilaiButir,
  entitasTahunAjaran,
} from './akademik.js';
import { entitasKalenderHijriah } from './kalender.js';
import { entitasPenggunaTelegram, entitasUsulanPembayaran } from './pembayaran.js';
import {
  entitasAkunKeuangan,
  entitasAlokasiProta,
  entitasKeringanan,
  entitasKomponenBiaya,
  entitasLebihBayar,
  entitasPembayaran,
  entitasPemakaianLebihBayar,
  entitasProta,
  entitasTagihan,
  entitasTarifKomponen,
} from './keuangan.js';

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
  sebagaiEntitasUmum(entitasKalenderHijriah),
];

/**
 * Entitas di luar master data. `usulan_izin` transaksional, bukan rujukan —
 * dipisah supaya daftar master tetap berarti apa yang dinamakannya.
 */
export const ENTITAS_IZIN: readonly EntitasUmum[] = [sebagaiEntitasUmum(entitasUsulanIzin)];

/** Entitas keuangan — hasil sesi P3 dan ADR 0012. */
export const ENTITAS_KEUANGAN: readonly EntitasUmum[] = [
  sebagaiEntitasUmum(entitasAkunKeuangan),
  sebagaiEntitasUmum(entitasKomponenBiaya),
  sebagaiEntitasUmum(entitasTarifKomponen),
  sebagaiEntitasUmum(entitasTagihan),
  sebagaiEntitasUmum(entitasKeringanan),
  sebagaiEntitasUmum(entitasPembayaran),
  sebagaiEntitasUmum(entitasProta),
  sebagaiEntitasUmum(entitasAlokasiProta),
  sebagaiEntitasUmum(entitasLebihBayar),
  sebagaiEntitasUmum(entitasPemakaianLebihBayar),
];

/** Entitas verifikasi pembayaran & pengguna telegram (RFC-008). */
export const ENTITAS_VERIFIKASI_PEMBAYARAN: readonly EntitasUmum[] = [
  sebagaiEntitasUmum(entitasUsulanPembayaran),
  sebagaiEntitasUmum(entitasPenggunaTelegram),
];

/** Seluruh entitas yang diuji kelengkapan klasifikasinya. */
export const SEMUA_ENTITAS: readonly EntitasUmum[] = [
  ...ENTITAS_MASTER_DATA,
  ...ENTITAS_IZIN,
  ...ENTITAS_KEUANGAN,
];
