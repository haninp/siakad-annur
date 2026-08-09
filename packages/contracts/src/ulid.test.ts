import { describe, expect, it } from 'vitest';
import { Ulid } from './enum.js';
import { buatUlid } from './ulid.js';

describe('buatUlid', () => {
  it('menghasilkan ULID yang lolos skema', () => {
    for (let i = 0; i < 200; i++) {
      expect(Ulid.safeParse(buatUlid()).success).toBe(true);
    }
  });

  it('panjangnya selalu 26 karakter', () => {
    expect(buatUlid()).toHaveLength(26);
  });

  it('tidak pernah kembar dalam satu milidetik yang sama', () => {
    const kumpulan = new Set(Array.from({ length: 5000 }, () => buatUlid(1_754_000_000_000)));
    expect(kumpulan.size).toBe(5000);
  });

  /** Inilah alasan memilih ULID daripada UUIDv4: urutan waktu = urutan leksikografis. */
  it('terurut menurut waktu saat diurutkan sebagai teks', () => {
    const lama = buatUlid(1_700_000_000_000);
    const baru = buatUlid(1_800_000_000_000);
    expect([baru, lama].sort()).toEqual([lama, baru]);
  });
});
