import type { RepoLaporan } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Laporan keuangan (RFC-014) — hak baca bendahara/pengurus/admin.
 *
 * Agregat dihitung di SQL (`repoLaporan`, AGENTS.md: angka dari SQL); core
 * hanya menegakkan izin, memvalidasi periode, dan merangkai `sisa`
 * (terbit − masuk, boleh negatif bila lebih bayar — informasi, bukan galat).
 *
 * Izin hidup di sini (AGENTS.md: izin hanya di core). Bot hanya menyembunyikan
 * tombol; penegak terakhir tetap handler ini.
 */

export interface DepLaporan {
  readonly repoLaporan: RepoLaporan;
}

export interface BacaLaporanInput {
  readonly aktor: Aktor;
  /** Periode Masehi `YYYY-MM` (tagihan SPP berperiode bulan Masehi). */
  readonly periode: string;
}

export interface BarisLaporan {
  readonly nama: string;
  readonly terbit: number;
  readonly masuk: number;
  readonly sisa: number;
}

export interface LaporanKeuangan {
  readonly periode: string;
  readonly komponen: BarisLaporan[];
  readonly ringkasan: { readonly terbit: number; readonly masuk: number; readonly sisa: number };
}

const POLA_PERIODE = /^\d{4}-\d{2}$/;

export function buatHandlerLaporan(dep: DepLaporan) {
  /** Laporan penerimaan + piutang satu periode (bendahara/pengurus/admin). */
  function bacaLaporanKeuangan(input: BacaLaporanInput): HasilHandler<LaporanKeuangan> {
    if (!peranCukup(input.aktor, 'bendahara', 'pengurus')) {
      return { ok: false, pesan: 'Hanya bendahara dan pengurus yang boleh membaca laporan keuangan.' };
    }
    const periode = (input.periode ?? '').trim();
    if (!POLA_PERIODE.test(periode)) {
      return { ok: false, pesan: 'Periode harus format YYYY-MM (contoh: 2026-08).' };
    }

    const perKomponen = dep.repoLaporan.laporanPerKomponen(periode).map((r) => ({
      nama: r.komponen,
      terbit: r.terbit,
      masuk: r.masuk,
      sisa: r.terbit - r.masuk,
    }));
    const ring = dep.repoLaporan.ringkasan(periode);
    return {
      ok: true,
      pesan: 'Laporan siap.',
      data: {
        periode,
        komponen: perKomponen,
        ringkasan: { terbit: ring.terbit, masuk: ring.masuk, sisa: ring.terbit - ring.masuk },
      },
    };
  }

  return { bacaLaporanKeuangan };
}
