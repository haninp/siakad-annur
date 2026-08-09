import type { HubunganWali, StatusHidup, StatusYatim } from './enum.js';

/**
 * Status turunan — **dihitung, tidak pernah disimpan**.
 *
 * AGENTS.md melarang menyimpannya, dan sistem lama rusak persis karena angka
 * turunan disimpan terpisah dari sumbernya lalu menyimpang tanpa ada yang
 * menyadari. Yang menyimpang di sini adalah dasar pemberian keringanan.
 */

export interface HubunganOrangTua {
  readonly hubungan: HubunganWali;
  readonly status_hidup: StatusHidup;
}

export interface HasilStatusYatim {
  /** `null` berarti tidak ada orang tua yang diketahui wafat. */
  readonly status: StatusYatim | null;
  /**
   * `false` bila ada orang tua yang belum didata, sehingga kesimpulannya masih
   * bisa berubah. Seorang `yatim` yang belum pasti bisa ternyata `yatim_piatu`.
   */
  readonly pasti: boolean;
}

/**
 * Status keyatiman, diturunkan dari status hidup ayah dan ibu.
 *
 * `tidak_diketahui` **tidak** diperlakukan sebagai `hidup`. Di data nyata
 * `status_ibu` kosong seluruhnya sementara `status_ayah` terisi — menganggap
 * kosong sebagai "masih hidup" akan diam-diam menghapus status piatu seorang
 * santri, sedangkan menganggapnya "wafat" akan mengarang keringanan.
 *
 * Yang sudah pasti tetap dilaporkan: ayah yang wafat membuat anak **yatim**
 * walaupun status ibunya belum didata — hanya saja `pasti` bernilai `false`,
 * karena bisa jadi ia sebenarnya yatim-piatu.
 */
export function hitungStatusYatim(hubungan: readonly HubunganOrangTua[]): HasilStatusYatim {
  const statusDari = (peran: HubunganWali): StatusHidup =>
    hubungan.find((h) => h.hubungan === peran)?.status_hidup ?? 'tidak_diketahui';

  const ayah = statusDari('ayah');
  const ibu = statusDari('ibu');

  const pasti = ayah !== 'tidak_diketahui' && ibu !== 'tidak_diketahui';

  if (ayah === 'wafat' && ibu === 'wafat') return { status: 'yatim_piatu', pasti: true };
  if (ayah === 'wafat') return { status: 'yatim', pasti };
  if (ibu === 'wafat') return { status: 'piatu', pasti };
  return { status: null, pasti };
}
