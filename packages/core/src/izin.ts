import type { StatusUsulan } from '@siakad/contracts';
import { tanggalTerbaca } from './format.js';
export { tanggalTerbaca };

/**
 * Aturan pengajuan dan pembatalan izin absen.
 *
 * Bentuk datanya ditegakkan `packages/contracts` (CHECK dan zod); yang di sini
 * adalah aturan yang **butuh riwayat** untuk diputuskan, sehingga tidak bisa
 * hidup sebagai batasan satu baris. ADR 0010 sudah menyatakan tempatnya di sini.
 *
 * Pesan yang dikembalikan ditujukan langsung ke wali santri. Karena itu ia
 * menyebut nama anak dan apa yang harus dilakukan, dan **tidak pernah** menyebut
 * nama tabel, kode galat, atau istilah teknis (AGENTS.md).
 */

/**
 * Berapa kali wali boleh membatalkan lalu mengajukan ulang untuk satu anak pada
 * satu tanggal.
 *
 * Tanpa batas, pembatalan berulang membuat wali kelas menerima pemberitahuan
 * yang tidak habis-habis untuk anak yang sama — dan pemberitahuan yang terlalu
 * sering akhirnya tidak dibaca sama sekali.
 */
export const BATAS_PEMBATALAN_PER_TANGGAL = 3;

export interface RiwayatUsulan {
  readonly status: StatusUsulan;
}

export type Keputusan = { readonly boleh: true } | { readonly boleh: false; readonly pesan: string };

/**
 * Apakah wali boleh mengajukan izin untuk seorang anak pada satu tanggal.
 *
 * @param riwayat seluruh usulan yang sudah ada untuk **anak dan tanggal itu**.
 */
export function bolehAjukanIzin(
  namaSantri: string,
  tanggal: string,
  riwayat: readonly RiwayatUsulan[],
): Keputusan {
  const kapan = tanggalTerbaca(tanggal);

  if (riwayat.some((u) => u.status === 'menunggu')) {
    return {
      boleh: false,
      pesan:
        `Izin ${namaSantri} untuk ${kapan} sudah dikirim dan sedang menunggu konfirmasi ` +
        `wali kelas. Batalkan dulu bila ingin mengubahnya.`,
    };
  }

  if (riwayat.some((u) => u.status === 'diterima')) {
    return {
      boleh: false,
      pesan:
        `Izin ${namaSantri} untuk ${kapan} sudah dikonfirmasi wali kelas. ` +
        `Bila ada perubahan, sampaikan langsung kepada wali kelas.`,
    };
  }

  const jumlahBatal = riwayat.filter((u) => u.status === 'dibatalkan').length;
  if (jumlahBatal >= BATAS_PEMBATALAN_PER_TANGGAL) {
    return {
      boleh: false,
      pesan:
        `Izin ${namaSantri} untuk ${kapan} sudah dibatalkan ${jumlahBatal} kali. ` +
        `Untuk perubahan berikutnya, sampaikan langsung kepada wali kelas.`,
    };
  }

  return { boleh: true };
}

/**
 * Apakah wali boleh membatalkan usulannya.
 *
 * Hanya selama belum di-_acknowledge_ wali kelas (ADR 0010). Bentuk datanya juga
 * menolak pembatalan yang sudah ditanggapi, jadi aturan ini lapis pertama —
 * bukan satu-satunya penjaga.
 */
export function bolehBatalkanIzin(
  namaSantri: string,
  tanggal: string,
  usulan: RiwayatUsulan,
): Keputusan {
  const kapan = tanggalTerbaca(tanggal);

  switch (usulan.status) {
    case 'menunggu':
      return { boleh: true };
    case 'diterima':
      return {
        boleh: false,
        pesan:
          `Izin ${namaSantri} untuk ${kapan} sudah dikonfirmasi wali kelas sehingga tidak ` +
          `bisa dibatalkan lagi. Sampaikan perubahannya langsung kepada wali kelas.`,
      };
    case 'ditolak':
      return {
        boleh: false,
        pesan:
          `Izin ${namaSantri} untuk ${kapan} sudah ditanggapi wali kelas. ` +
          `Tidak ada yang perlu dibatalkan.`,
      };
    case 'dibatalkan':
      return {
        boleh: false,
        pesan:
          `Izin ${namaSantri} untuk ${kapan} sudah dibatalkan sebelumnya. ` +
          `Ajukan izin baru bila ${namaSantri} tetap tidak masuk.`,
      };
  }
}
