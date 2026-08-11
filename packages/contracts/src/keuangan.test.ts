import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  AkunKeuangan,
  AlokasiProta,
  DDL_KEUANGAN,
  Keringanan,
  KomponenBiaya,
  LebihBayar,
  Pembayaran,
  Prota,
  Tagihan,
  TarifKomponen,
} from './keuangan.js';

const ULID = '01JRZ8QK7M4N2P5V9X3B6C8D0E';
const ULID2 = '01JRZ8QK7M4N2P5V9X3B6C8D0F';
const WAKTU = '2026-08-10T06:30:00+07:00';

const akunSah = {
  kode: 1,
  nama: 'SPP',
  arah: 'masuk' as const,
  aktif: true,
};

const komponenSah = {
  id: ULID,
  kode: 'spp' as const,
  nama: 'SPP',
  akun_keuangan_kode: 1,
  aktif: true,
};

const tarifSah = {
  id: ULID,
  tahun_ajaran_id: ULID2,
  komponen_biaya_id: ULID,
  jalur: null,
  marhalah: null,
  tingkat: null,
  nominal: 150000,
  aktif: true,
};

const tagihanSah = {
  id: ULID,
  santri_id: ULID2,
  tahun_ajaran_id: ULID2,
  komponen_biaya_id: ULID,
  periode: '2026-08',
  skema_periode: 'masehi' as const,
  jatuh_tempo: '2026-08-10',
  nominal: 150000,
  prorata_mulai: null,
  status: 'terbit' as const,
};

const keringananSah = {
  id: ULID,
  tagihan_id: ULID2,
  nominal: 50000,
  persentase: null,
  alasan: 'Kondisi ekonomi',
  disetujui_oleh: ULID,
  waktu: WAKTU,
};

const pembayaranSah = {
  id: ULID,
  tagihan_id: ULID2,
  tanggal: '2026-08-10',
  nominal: 100000,
  metode: 'transfer' as const,
  sumber: 'wali' as const,
  cicilan_ke: null,
  dicatat_oleh: ULID,
  waktu: WAKTU,
};

const protaSah = {
  id: ULID,
  donatur_wali_id: ULID2,
  nama_donatur: null,
  santri_id: ULID,
  tahun_ajaran_id: ULID2,
  periode: '2026-08',
  nominal: 150000,
  sisa: 0,
};

const alokasiProtaSah = {
  id: ULID,
  prota_id: ULID2,
  tagihan_id: ULID2,
  nominal: 150000,
  waktu: WAKTU,
};

const lebihBayarSah = {
  id: ULID,
  santri_id: ULID,
  nominal: 50000,
  asal_pembayaran_id: null,
  waktu: WAKTU,
};

describe('akun_keuangan', () => {
  it('menerima akun masuk yang sah', () => {
    expect(AkunKeuangan.parse(akunSah).kode).toBe(1);
  });

  it('menolak arah di luar enum', () => {
    expect(AkunKeuangan.safeParse({ ...akunSah, arah: 'tengah' }).success).toBe(false);
  });
});

describe('komponen_biaya', () => {
  it('menerima komponen yang sah', () => {
    expect(KomponenBiaya.parse(komponenSah).kode).toBe('spp');
  });

  it('menolak kode di luar enum', () => {
    expect(KomponenBiaya.safeParse({ ...komponenSah, kode: 'lainnya' }).success).toBe(false);
  });
});

describe('tarif_komponen', () => {
  it('menerima tarif umum', () => {
    expect(TarifKomponen.parse(tarifSah).nominal).toBe(150000);
  });

  it('menerima tarif dengan penyempitan marhalah', () => {
    expect(
      TarifKomponen.parse({ ...tarifSah, marhalah: 'ra' as const, jalur: 'ra_paud' as const }).marhalah,
    ).toBe('ra');
  });
});

describe('tagihan', () => {
  it('menerima tagihan yang sah', () => {
    expect(Tagihan.parse(tagihanSah).periode).toBe('2026-08');
  });

  it('menolak skema periode di luar enum', () => {
    expect(Tagihan.safeParse({ ...tagihanSah, skema_periode: 'lunar' }).success).toBe(false);
  });

  it('menolak nominal negatif', () => {
    expect(Tagihan.safeParse({ ...tagihanSah, nominal: -1000 }).success).toBe(false);
  });
});

describe('keringanan', () => {
  it('menerima keringanan nominal', () => {
    expect(Keringanan.parse(keringananSah).nominal).toBe(50000);
  });

  it('menerima keringanan persentase', () => {
    expect(
      Keringanan.parse({ ...keringananSah, nominal: null, persentase: 50 }).persentase,
    ).toBe(50);
  });

  it('menolak ketika nominal dan persentase keduanya kosong', () => {
    expect(Keringanan.safeParse({ ...keringananSah, nominal: null, persentase: null }).success).toBe(
      false,
    );
  });
});

describe('pembayaran', () => {
  it('menerima pembayaran tunai', () => {
    expect(Pembayaran.parse({ ...pembayaranSah, metode: 'tunai' as const }).metode).toBe('tunai');
  });

  it('menolak cicilan ke-7', () => {
    expect(Pembayaran.safeParse({ ...pembayaranSah, cicilan_ke: 7 }).success).toBe(false);
  });

  it('menolak metode di luar enum', () => {
    expect(Pembayaran.safeParse({ ...pembayaranSah, metode: 'cek' }).success).toBe(false);
  });
});

describe('prota', () => {
  it('menerima prota dengan donatur terdaftar', () => {
    expect(Prota.parse(protaSah).donatur_wali_id).toBe(ULID2);
  });

  it('menerima prota dengan donatur eksternal', () => {
    expect(
      Prota.parse({ ...protaSah, donatur_wali_id: null, nama_donatur: 'Donatur Anonim' }).nama_donatur,
    ).toBe('Donatur Anonim');
  });

  it('menolak ketika donatur_wali_id dan nama_donatur keduanya kosong', () => {
    expect(Prota.safeParse({ ...protaSah, donatur_wali_id: null, nama_donatur: null }).success).toBe(
      false,
    );
  });

  it('menolak sisa negatif', () => {
    expect(Prota.safeParse({ ...protaSah, sisa: -1000 }).success).toBe(false);
  });
});

describe('alokasi_prota', () => {
  it('menerima alokasi yang sah', () => {
    expect(AlokasiProta.parse(alokasiProtaSah).nominal).toBe(150000);
  });
});

describe('lebih_bayar', () => {
  it('menerima lebih bayar yang sah', () => {
    expect(LebihBayar.parse(lebihBayarSah).nominal).toBe(50000);
  });

  it('menolak nominal negatif', () => {
    expect(LebihBayar.safeParse({ ...lebihBayarSah, nominal: -1 }).success).toBe(false);
  });
});

/**
 * Uji DDL: CHECK constraints ditegakkan mesin SQLite, bukan hanya zod.
 */
describe('jaminan skema keuangan di basis data', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(DDL_KEUANGAN);

  it('tabel keuangan terbentuk', () => {
    const tabel = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(tabel.map((t) => t.name)).toContain('tagihan');
    expect(tabel.map((t) => t.name)).toContain('pembayaran');
  });

  it('CHECK menolak pembayaran dengan cicilan_ke 7', () => {
    db.exec(`
      INSERT INTO akun_keuangan (kode, nama, arah, aktif) VALUES (1, 'SPP', 'masuk', 1);
      INSERT INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
        VALUES ('${ULID}', 'spp', 'SPP', 1, 1);
    `);
    expect(() =>
      db
        .prepare(
          `INSERT INTO pembayaran (id, tagihan_id, tanggal, nominal, metode, sumber, cicilan_ke, dicatat_oleh, waktu)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(ULID, ULID2, '2026-08-10', 100000, 'tunai', 'wali', 7, ULID, WAKTU),
    ).toThrow();
  });
});
