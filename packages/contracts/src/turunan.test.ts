import { describe, expect, it } from 'vitest';
import { hitungStatusYatim } from './turunan.js';

describe('hitungStatusYatim', () => {
  it('kedua orang tua hidup: bukan yatim, dan pasti', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'hidup' },
        { hubungan: 'ibu', status_hidup: 'hidup' },
      ]),
    ).toEqual({ status: null, pasti: true });
  });

  it('ayah wafat, ibu hidup: yatim', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'wafat' },
        { hubungan: 'ibu', status_hidup: 'hidup' },
      ]),
    ).toEqual({ status: 'yatim', pasti: true });
  });

  it('ibu wafat, ayah hidup: piatu', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'hidup' },
        { hubungan: 'ibu', status_hidup: 'wafat' },
      ]),
    ).toEqual({ status: 'piatu', pasti: true });
  });

  it('keduanya wafat: yatim-piatu', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'wafat' },
        { hubungan: 'ibu', status_hidup: 'wafat' },
      ]),
    ).toEqual({ status: 'yatim_piatu', pasti: true });
  });

  /**
   * Ini bentuk data nyata di berkas 04: `status_ayah` terisi, `status_ibu` kosong
   * seluruhnya. Yang sudah pasti tetap dilaporkan, tapi kesimpulannya belum final.
   */
  it('ayah wafat, ibu belum didata: yatim tapi belum pasti', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'wafat' },
        { hubungan: 'ibu', status_hidup: 'tidak_diketahui' },
      ]),
    ).toEqual({ status: 'yatim', pasti: false });
  });

  it('ibu tidak tercatat sama sekali diperlakukan sama dengan tidak diketahui', () => {
    expect(hitungStatusYatim([{ hubungan: 'ayah', status_hidup: 'wafat' }])).toEqual({
      status: 'yatim',
      pasti: false,
    });
  });

  it('ayah hidup, ibu belum didata: belum bisa disebut bukan-yatim', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'ayah', status_hidup: 'hidup' },
        { hubungan: 'ibu', status_hidup: 'tidak_diketahui' },
      ]),
    ).toEqual({ status: null, pasti: false });
  });

  it('tidak ada data sama sekali: tidak menyimpulkan apa pun', () => {
    expect(hitungStatusYatim([])).toEqual({ status: null, pasti: false });
  });

  it('wali non-orang-tua tidak memengaruhi perhitungan', () => {
    expect(
      hitungStatusYatim([
        { hubungan: 'wali', status_hidup: 'wafat' },
        { hubungan: 'ayah', status_hidup: 'hidup' },
        { hubungan: 'ibu', status_hidup: 'hidup' },
      ]),
    ).toEqual({ status: null, pasti: true });
  });
});
