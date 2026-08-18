import { describe, expect, it } from 'vitest';
import { escapeMarkdownV2, formatNamaTampil, spoil } from './format.js';

/**
 * Helper format tampilan (RFC-013): escape MarkdownV2, spoiler, dan nama tampil
 * wali. Aturan tampil alias satu-satunya hidup di sini — kedua bot memakainya.
 */

describe('escapeMarkdownV2', () => {
  it('meng-escape seluruh karakter khusus MarkdownV2', () => {
    const semua = '_ * [ ] ( ) ~ ` > # + - = | { } . !';
    const hasil = escapeMarkdownV2(semua);
    for (const karakter of semua.split(' ')) {
      expect(hasil).toContain(`\\${karakter}`);
    }
  });

  it('meng-escape backslash', () => {
    expect(escapeMarkdownV2('a\\b')).toBe('a\\\\b');
  });

  it('teks biasa tidak berubah', () => {
    expect(escapeMarkdownV2('Aisyah Zahra 2627005')).toBe('Aisyah Zahra 2627005');
  });
});

describe('spoil', () => {
  it('membungkus teks ter-escape dalam ||…||', () => {
    expect(spoil('12-08-2019')).toBe('||12\\-08\\-2019||');
  });

  it('meng-escape isi sebelum dibungkus — pemanggil tidak perlu double-escape', () => {
    // Titik adalah karakter khusus MarkdownV2.
    expect(spoil('12.08.2019')).toBe('||12\\.08\\.2019||');
  });
});

describe('formatNamaTampil', () => {
  const wali = { nama_lengkap: 'Ibu Siti Aminah binti Mahmud' };

  it('kunyah menang atas panggilan dan nama lengkap', () => {
    const alias = [
      { jenis: 'panggilan', nama: 'Bu Siti', sumber: 'wawancara' },
      { jenis: 'kunyah', nama: 'Ummu Aisyah', sumber: 'wawancara' },
    ];
    expect(formatNamaTampil(wali, alias)).toBe('Ummu Aisyah');
  });

  it('tanpa kunyah, panggilan dipakai', () => {
    const alias = [{ jenis: 'panggilan', nama: 'Bu Siti', sumber: 'wawancara' }];
    expect(formatNamaTampil(wali, alias)).toBe('Bu Siti');
  });

  it('tanpa alias, nama lengkap dipakai', () => {
    expect(formatNamaTampil(wali, [])).toBe('Ibu Siti Aminah binti Mahmud');
  });

  it('alias ktp/keuangan/ejaan_lama TIDAK dipakai untuk tampilan', () => {
    const alias = [
      { jenis: 'ktp', nama: 'SITI AMINAH', sumber: 'berkas' },
      { jenis: 'ejaan_lama', nama: 'Siti Aminah', sumber: 'berkas' },
    ];
    expect(formatNamaTampil(wali, alias)).toBe('Ibu Siti Aminah binti Mahmud');
  });
});