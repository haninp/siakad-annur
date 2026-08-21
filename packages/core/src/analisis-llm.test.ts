import { describe, expect, it } from 'vitest';
import {
  buatPenyediaNarasiZen,
  kumpulkanAngka,
  periksaAngkaDariJson,
  rangkaiNarasiAman,
  type PenyediaNarasi,
} from './analisis-llm.js';

describe('kumpulkanAngka', () => {
  it('mengumpulkan angka dari struktur JSON bertingkat', () => {
    expect(kumpulkanAngka({ ringkasan: { terbit: 450_000, masuk: 450_000 }, komponen: [{ terbit: 400 }] })).toEqual([
      450_000, 450_000, 400,
    ]);
  });
});

describe('periksaAngkaDariJson', () => {
  const data = { terbit: 450_000, masuk: 450_000, sisa: 0 };

  it('narasi hanya berisi angka yang ada di JSON → diterima', () => {
    const hasil = periksaAngkaDariJson('Total terbit 450000, masuk 450000, sisa 0.', data);
    expect(hasil.ok).toBe(true);
  });

  it('narasi memuat angka asing → ditolak (anti-halusinasi)', () => {
    const hasil = periksaAngkaDariJson('Total tunggakan 77 dan terbit 450000.', data);
    expect(hasil.ok).toBe(false);
    expect(hasil.angkaAsing).toContain(77);
  });
});

describe('penyedia & rangkaiNarasiAman', () => {
  it('penyedia Zen tanpa key menolak (P5 belum siap)', async () => {
    const penyedia = buatPenyediaNarasiZen({});
    await expect(penyedia.rangkai({ tool: 'x', parameter: {}, data: {} })).rejects.toThrow(/belum dikonfigurasi/);
  });

  it('rangkaiNarasiAman menolak narasi dengan angka asing', async () => {
    const stub: PenyediaNarasi = { async rangkai() { return 'Laporan terbit 450000, tunggakan 123.'; } };
    const hasil = await rangkaiNarasiAman(stub, { tool: 'x', parameter: {}, data: { terbit: 450_000 } });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toContain('123');
  });

  it('rangkaiNarasiAman menerima narasi yang angka-angkanya dari data', async () => {
    const stub: PenyediaNarasi = { async rangkai() { return 'Terbit 450000, masuk 450000, sisa 0.'; } };
    const hasil = await rangkaiNarasiAman(stub, { tool: 'x', parameter: {}, data: { terbit: 450_000, masuk: 450_000, sisa: 0 } });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.narasi).toContain('450000');
  });
});
