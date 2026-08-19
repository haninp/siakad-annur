import type { RepoKalenderHijriah } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';
import { butuhIsbat } from './kalender.js';

export interface SetujuiBulanHijriahInput {
  readonly aktor: Aktor;
  readonly tahun: number;
  readonly bulan: number;
  readonly waktu: string;
}

export interface DependensiHandlerKalender {
  readonly repoKalenderHijriah: RepoKalenderHijriah;
}

export function buatHandlerKalender(dep: DependensiHandlerKalender) {
  return {
    setujuiBulanHijriah(input: SetujuiBulanHijriahInput): HasilHandler<void> {
      if (!peranCukup(input.aktor, 'admin')) {
        return {
          ok: false,
          pesan: 'Hanya admin yang boleh menyetujui bulan Hijriah.',
        };
      }

      const baris = dep.repoKalenderHijriah.ambil(input.tahun, input.bulan);
      if (baris === undefined) {
        return {
          ok: false,
          pesan:
            'Kalender Hijriah ' + input.bulan + '/' + input.tahun + ' belum tersedia. ' +
            'Seed kalender terlebih dahulu.',
        };
      }

      if (!baris.provisional) {
        return {
          ok: false,
          pesan:
            'Bulan ' + baris.nama_bulan + ' ' + input.tahun + ' H sudah disetujui sebelumnya.',
        };
      }

      dep.repoKalenderHijriah.tandaiSetuju(input.tahun, input.bulan, input.aktor.id, input.waktu);

      const pesanIsbat = butuhIsbat(input.bulan)
        ? ' Hasil sidang isbat sudah tercatat.'
        : '';

      return {
        ok: true,
        pesan:
          'Bulan ' + baris.nama_bulan + ' ' + input.tahun + ' H mulai ' +
          baris.tanggal_mulai_masehi + ' sudah disetujui.' + pesanIsbat,
      };
    },
  };
}

export type HandlerKalender = ReturnType<typeof buatHandlerKalender>;
