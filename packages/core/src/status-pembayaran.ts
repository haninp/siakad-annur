import { hitungKeringananEffektif } from './keuangan.js';
import { formatRupiah } from './format.js';
import type { Keringanan } from '@siakad/contracts';

/**
 * Kosakata status pembayaran — aturan domain (RFC-005).
 *
 * Label tegas untuk bot wali & pengurus: SUDAH BAYAR / BAYAR SEBAGIAN /
 * BELUM BAYAR / DIBATALKAN. Dihitung dari transaksi, bukan kolom turunan
 * (AGENTS.md: angka turunan tidak disimpan).
 *
 * Catatan: state "proses verifikasi" (verifikasi mutasi bank) belum ada di
 * skema — muncul saat fitur verifikasi dibangun (RFC-005, matriks peran).
 */

export interface PembayaranRingkas {
  readonly nominal: number;
  readonly tanggal: string;
}

export interface KeringananRingkas {
  readonly nominal: number | null;
  readonly persentase: number | null;
}

export type StatusPembayaran =
  | { readonly status: 'dibatalkan' }
  | {
      readonly status: 'belum_bayar';
      readonly nominal: number;
      readonly sudahBayar: 0;
      readonly sisa: number;
    }
  | {
      readonly status: 'bayar_sebagian';
      readonly nominal: number;
      readonly sudahBayar: number;
      readonly sisa: number;
    }
  | {
      readonly status: 'sudah_bayar';
      readonly nominal: number;
      readonly totalBayar: number;
      /** Tanggal pembayaran terakhir — kapan tagihan lunas. */
      readonly lunasPada: string | null;
    };

export interface InputStatusPembayaran {
  readonly statusTagihan: 'terbit' | 'lunas' | 'dibatalkan';
  readonly nominal: number;
  readonly keringanan: readonly KeringananRingkas[];
  /** Urut naik berdasarkan tanggal — pembayaran terakhir = pelunasan. */
  readonly pembayaran: readonly PembayaranRingkas[];
}

export function statusPembayaran(input: InputStatusPembayaran): StatusPembayaran {
  if (input.statusTagihan === 'dibatalkan') {
    return { status: 'dibatalkan' };
  }

  // hitungKeringananEffektif hanya membaca nominal/persentase — bentuk ringkas aman.
  const potongan = hitungKeringananEffektif(input.keringanan as Keringanan[], input.nominal);
  const totalBayar = input.pembayaran.reduce((jumlah, p) => jumlah + p.nominal, 0);
  const sisa = input.nominal - potongan - totalBayar;

  if (sisa <= 0) {
    const terakhir = input.pembayaran[input.pembayaran.length - 1];
    return {
      status: 'sudah_bayar',
      nominal: input.nominal,
      totalBayar,
      lunasPada: terakhir?.tanggal ?? null,
    };
  }
  if (totalBayar > 0) {
    return { status: 'bayar_sebagian', nominal: input.nominal, sudahBayar: totalBayar, sisa };
  }
  return { status: 'belum_bayar', nominal: input.nominal, sudahBayar: 0, sisa };
}

/**
 * Format tampilan satu tagihan — kosakata tegas (RFC-005).
 * Satu sumber format untuk bot wali & pengurus.
 */
export function formatStatusPembayaran(
  st: StatusPembayaran,
  info: { readonly periode: string; readonly jatuhTempo: string | null },
): string {
  if (st.status === 'dibatalkan') {
    return `${info.periode} — DIBATALKAN`;
  }
  const kepala = `${info.periode} — ${formatRupiah(st.nominal)}`;
  switch (st.status) {
    case 'belum_bayar':
      return `${kepala} — BELUM BAYAR\n    • Nominal ${formatRupiah(st.nominal)} · Batas ${info.jatuhTempo ?? '-'}`;
    case 'bayar_sebagian':
      return (
        `${kepala} — BAYAR SEBAGIAN\n` +
        `    • Sudah dibayar ${formatRupiah(st.sudahBayar)} · Sisa ${formatRupiah(st.sisa)} · Batas ${info.jatuhTempo ?? '-'}`
      );
    case 'sudah_bayar':
      return `${kepala} — SUDAH BAYAR\n    • Total ${formatRupiah(st.totalBayar)}${st.lunasPada ? ` · Lunas ${st.lunasPada}` : ''}`;
  }
}
