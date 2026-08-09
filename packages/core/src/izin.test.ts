import { describe, expect, it } from 'vitest';
import {
  BATAS_PEMBATALAN_PER_TANGGAL,
  bolehAjukanIzin,
  bolehBatalkanIzin,
  tanggalTerbaca,
  type RiwayatUsulan,
} from './izin.js';

const NAMA = 'Aidah';
const TANGGAL = '2026-08-10';

const batal = (n: number): RiwayatUsulan[] =>
  Array.from({ length: n }, () => ({ status: 'dibatalkan' as const }));

describe('batas batal lalu ajukan ulang', () => {
  it('pengajuan pertama selalu boleh', () => {
    expect(bolehAjukanIzin(NAMA, TANGGAL, [])).toEqual({ boleh: true });
  });

  it('boleh mengajukan ulang selama pembatalan belum mencapai batas', () => {
    for (let n = 0; n < BATAS_PEMBATALAN_PER_TANGGAL; n++) {
      expect(bolehAjukanIzin(NAMA, TANGGAL, batal(n)).boleh).toBe(true);
    }
  });

  it('pengajuan setelah pembatalan ke-3 ditolak', () => {
    const hasil = bolehAjukanIzin(NAMA, TANGGAL, batal(BATAS_PEMBATALAN_PER_TANGGAL));
    expect(hasil.boleh).toBe(false);
  });

  it('batas dihitung per anak per tanggal, bukan seumur hidup', () => {
    // Riwayat di atas seluruhnya milik satu anak pada satu tanggal; anak atau
    // tanggal lain punya riwayatnya sendiri, jadi tidak terpengaruh.
    expect(bolehAjukanIzin('Fauzan', '2026-08-11', []).boleh).toBe(true);
  });

  it('usulan yang ditolak wali kelas tidak ikut menghabiskan jatah pembatalan', () => {
    const riwayat: RiwayatUsulan[] = [
      { status: 'ditolak' },
      { status: 'ditolak' },
      { status: 'ditolak' },
      { status: 'ditolak' },
    ];
    expect(bolehAjukanIzin(NAMA, TANGGAL, riwayat).boleh).toBe(true);
  });
});

describe('pengajuan ganda', () => {
  it('ditolak bila masih ada yang menunggu konfirmasi', () => {
    const hasil = bolehAjukanIzin(NAMA, TANGGAL, [{ status: 'menunggu' }]);
    expect(hasil.boleh).toBe(false);
  });

  it('ditolak bila sudah dikonfirmasi wali kelas', () => {
    const hasil = bolehAjukanIzin(NAMA, TANGGAL, [{ status: 'diterima' }]);
    expect(hasil.boleh).toBe(false);
  });
});

describe('pembatalan', () => {
  it('boleh selama masih menunggu', () => {
    expect(bolehBatalkanIzin(NAMA, TANGGAL, { status: 'menunggu' })).toEqual({ boleh: true });
  });

  it('tidak boleh setelah dikonfirmasi wali kelas', () => {
    expect(bolehBatalkanIzin(NAMA, TANGGAL, { status: 'diterima' }).boleh).toBe(false);
  });

  it('tidak boleh dibatalkan dua kali', () => {
    expect(bolehBatalkanIzin(NAMA, TANGGAL, { status: 'dibatalkan' }).boleh).toBe(false);
  });
});

/**
 * AGENTS.md: pesan ke pengguna ditulis substantif, menyebut nama entitas bukan ID,
 * dan tidak pernah membocorkan nama tabel atau istilah teknis. Wali santri bukan
 * orang teknis — pesan yang tidak bisa ditindaklanjuti berarti sistem berhenti
 * sampai developer sempat menengok.
 */
describe('pesan untuk wali santri', () => {
  const semuaPenolakan = [
    bolehAjukanIzin(NAMA, TANGGAL, [{ status: 'menunggu' }]),
    bolehAjukanIzin(NAMA, TANGGAL, [{ status: 'diterima' }]),
    bolehAjukanIzin(NAMA, TANGGAL, batal(BATAS_PEMBATALAN_PER_TANGGAL)),
    bolehBatalkanIzin(NAMA, TANGGAL, { status: 'diterima' }),
    bolehBatalkanIzin(NAMA, TANGGAL, { status: 'ditolak' }),
    bolehBatalkanIzin(NAMA, TANGGAL, { status: 'dibatalkan' }),
  ].filter((h) => !h.boleh);

  it('setiap penolakan menyertakan pesan', () => {
    expect(semuaPenolakan).toHaveLength(6);
    for (const hasil of semuaPenolakan) {
      expect(hasil.boleh).toBe(false);
      if (!hasil.boleh) expect(hasil.pesan.length).toBeGreaterThan(20);
    }
  });

  it('menyebut nama anak dan tanggal terbaca, bukan ID atau format ISO', () => {
    for (const hasil of semuaPenolakan) {
      if (hasil.boleh) continue;
      expect(hasil.pesan).toContain(NAMA);
      expect(hasil.pesan).toContain('10 Agustus 2026');
      expect(hasil.pesan).not.toContain(TANGGAL);
    }
  });

  it('tidak membocorkan nama tabel, kolom, atau istilah teknis', () => {
    const bocor = [
      'usulan_izin',
      'santri_id',
      'status',
      'null',
      'undefined',
      'CHECK',
      'error',
      'ADR',
    ];
    for (const hasil of semuaPenolakan) {
      if (hasil.boleh) continue;
      for (const istilah of bocor) {
        expect(hasil.pesan.toLowerCase()).not.toContain(istilah.toLowerCase());
      }
    }
  });

  it('setiap penolakan menyebut apa yang harus dilakukan berikutnya', () => {
    for (const hasil of semuaPenolakan) {
      if (hasil.boleh) continue;
      const arahan = ['wali kelas', 'Batalkan dulu', 'Ajukan izin baru'];
      expect(arahan.some((a) => hasil.pesan.includes(a))).toBe(true);
    }
  });
});

describe('tanggalTerbaca', () => {
  it('mengubah ISO jadi bentuk yang dibaca orang', () => {
    expect(tanggalTerbaca('2026-08-10')).toBe('10 Agustus 2026');
    expect(tanggalTerbaca('2026-01-01')).toBe('1 Januari 2026');
    expect(tanggalTerbaca('2026-12-31')).toBe('31 Desember 2026');
  });

  it('mengembalikan masukan apa adanya bila bentuknya tak dikenal', () => {
    expect(tanggalTerbaca('kemarin')).toBe('kemarin');
  });
});
