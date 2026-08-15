import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bukaBasisData,
  buatDukunganTransaksi,
  DAFTAR_MIGRASI,
  jalankanMigrasi,
  repoAkunKeuangan,
  repoAlokasiProta,
  repoKeringanan,
  repoKomponenBiaya,
  repoLebihBayar,
  repoPembayaran,
  repoPemakaianLebihBayar,
  repoPendaftaran,
  repoProta,
  repoRombel,
  repoSantri,
  repoSantriWali,
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
  repoUsulanPembayaran,
} from '@siakad/db';
import { buatHandlerKeuangan } from './keuangan-handler.js';
import {
  buatHandlerVerifikasiPembayaran,
  namaFileBukti,
  type AjukanUsulanInput,
} from './pembayaran-verifikasi.js';

let db: DatabaseSync;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

function seedDasar() {
  const waliId = buatUlid(3_000_000_000_000);
  const santriId = buatUlid(3_000_000_000_001);
  const santriLainId = buatUlid(3_000_000_000_002);
  const taId = buatUlid(3_000_000_000_003);
  const komponenId = buatUlid(3_000_000_000_004);
  const tagihanId = buatUlid(3_000_000_000_005);
  const tagihanLainId = buatUlid(3_000_000_000_006);
  const tagihanLunasId = buatUlid(3_000_000_000_007);

  repoSantri(db).sisip({
    id: santriId,
    nis: '2627001',
    nisn: null,
    nik: null,
    nama_lengkap: 'Aidah',
    jenis_kelamin: 'perempuan',
    tempat_lahir: 'Jakarta',
    tanggal_lahir: '2021-10-25',
    alamat: null,
    desa_kelurahan: null,
    kecamatan: null,
    kabupaten: null,
    provinsi: null,
    kode_pos: null,
    status: 'aktif',
    anak_ke: null,
    jumlah_saudara: null,
  });
  repoSantri(db).sisip({
    id: santriLainId,
    nis: '2627002',
    nisn: null,
    nik: null,
    nama_lengkap: 'Baim',
    jenis_kelamin: 'laki_laki',
    tempat_lahir: 'Depok',
    tanggal_lahir: '2020-05-01',
    alamat: null,
    desa_kelurahan: null,
    kecamatan: null,
    kabupaten: null,
    provinsi: null,
    kode_pos: null,
    status: 'aktif',
    anak_ke: null,
    jumlah_saudara: null,
  });
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Hardianto', NULL, NULL, 'hidup')`,
  ).run(waliId);
  repoSantriWali(db).sisip({
    santri_id: santriId,
    wali_id: waliId,
    hubungan: 'ayah',
    penanggung_biaya: true,
    penerima_notifikasi: true,
    aktif: true,
  });
  repoTahunAjaran(db).sisip({
    id: taId,
    kode: '2025-2026',
    mulai: '2025-07-01',
    selesai: '2026-06-30',
    aktif: true,
  });
  repoAkunKeuangan(db).sisip({ kode: 101, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
  repoKomponenBiaya(db).sisip({
    id: komponenId,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: 101,
    aktif: true,
  });

  const sisipTagihan = (id: string, santri: string, status: 'terbit' | 'lunas', periode = '2026-08') =>
    db
      .prepare(
        `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
           skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
         VALUES (?, ?, ?, ?, ?, 'masehi', '2026-09-10', 450000, NULL, ?)`,
      )
      .run(id, santri, taId, komponenId, periode, status);

  sisipTagihan(tagihanId, santriId, 'terbit');
  sisipTagihan(tagihanLainId, santriLainId, 'terbit');
  sisipTagihan(tagihanLunasId, santriId, 'lunas', '2026-07');

  const depKeuangan = {
    repoTagihan: repoTagihan(db),
    repoTarifKomponen: repoTarifKomponen(db),
    repoKomponenBiaya: repoKomponenBiaya(db),
    repoSantri: repoSantri(db),
    repoPendaftaran: repoPendaftaran(db),
    repoRombel: repoRombel(db),
    repoTahunAjaran: repoTahunAjaran(db),
    repoKeringanan: repoKeringanan(db),
    repoPembayaran: repoPembayaran(db),
    repoProta: repoProta(db),
    repoAlokasiProta: repoAlokasiProta(db),
    repoLebihBayar: repoLebihBayar(db),
    repoPemakaianLebihBayar: repoPemakaianLebihBayar(db),
    transaksi: buatDukunganTransaksi(db),
  };
  const keuangan = buatHandlerKeuangan(depKeuangan);
  const verifikasi = buatHandlerVerifikasiPembayaran({
    ...depKeuangan,
    repoUsulanPembayaran: repoUsulanPembayaran(db),
    repoSantriWali: repoSantriWali(db),
    keuangan,
  });

  return {
    waliId,
    santriId,
    santriLainId,
    tagihanId,
    tagihanLainId,
    tagihanLunasId,
    verifikasi,
    keuangan,
  };
}

const wali = (id: string) => ({ peran: 'wali' as const, id });
const bendahara = (id = 'bendahara-1') => ({ peran: 'bendahara' as const, id });

function usulanSah(over?: Partial<AjukanUsulanInput>): AjukanUsulanInput {
  return {
    aktor: wali('wali-1'),
    tagihanId: 'tagihan',
    santriId: 'santri',
    nominal: 450_000,
    tanggalBayar: '2026-08-13',
    metode: 'transfer' as const,
    namaPenerima: null,
    buktiFileId: 'AgADbukti123',
    buktiTipe: 'image/jpeg',
    catatan: null,
    waktu: '2026-08-15T08:00:00+07:00',
    ...over,
  };
}

describe('namaFileBukti', () => {
  it('format konvensi: NIS-tanggal-nominal-metode.ext', () => {
    expect(
      namaFileBukti({
        nis: '2627001',
        tanggal: '2026-08-13',
        nominal: 450_000,
        metode: 'transfer',
        ekstensi: 'jpg',
      }),
    ).toBe('2627001-2026-08-13-450000-transfer.jpg');
  });
});

describe('ajukanUsulan', () => {
  it('sukses — tersimpan diajukan, pesan menunggu verifikasi', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    const hasil = verifikasi.ajukanUsulan(
      usulanSah({ aktor: wali(waliId), tagihanId, santriId }),
    );
    expect(hasil.ok).toBe(true);
    const jumlah = db
      .prepare(`SELECT COUNT(*) AS n FROM usulan_pembayaran WHERE status = 'diajukan'`)
      .get() as { n: number };
    expect(jumlah.n).toBe(1);
  });

  it('cash tanpa nama penerima — ditolak', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    const hasil = verifikasi.ajukanUsulan(
      usulanSah({ aktor: wali(waliId), tagihanId, santriId, metode: 'tunai', namaPenerima: null }),
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('nama penerima');
  });

  it('santri bukan anak wali — ditolak', () => {
    const { waliId, santriLainId, tagihanLainId, verifikasi } = seedDasar();
    const hasil = verifikasi.ajukanUsulan(
      usulanSah({ aktor: wali(waliId), tagihanId: tagihanLainId, santriId: santriLainId }),
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('tidak terhubung');
  });

  it('tagihan milik santri lain — ditolak', () => {
    const { waliId, santriId, tagihanLainId, verifikasi } = seedDasar();
    const hasil = verifikasi.ajukanUsulan(
      usulanSah({ aktor: wali(waliId), tagihanId: tagihanLainId, santriId }),
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('Tagihan tidak ditemukan');
  });

  it('tagihan sudah lunas — ditolak', () => {
    const { waliId, santriId, tagihanLunasId, verifikasi } = seedDasar();
    const hasil = verifikasi.ajukanUsulan(
      usulanSah({ aktor: wali(waliId), tagihanId: tagihanLunasId, santriId }),
    );
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('sudah lunas');
  });

  it('usulan ganda untuk tagihan sama — ditolak', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    const pertama = verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    expect(pertama.ok).toBe(true);
    const kedua = verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    expect(kedua.ok).toBe(false);
    expect(kedua.pesan).toContain('menunggu verifikasi');
  });
});

describe('verifikasiUsulan', () => {
  it('wali tidak boleh memverifikasi', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    const usulan = db
      .prepare(`SELECT id FROM usulan_pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { id: string };
    const hasil = verifikasi.verifikasiUsulan({
      aktor: wali(waliId),
      usulanId: usulan.id,
      waktu: '2026-08-15T09:00:00+07:00',
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('bendahara');
  });

  it('bendahara verifikasi — sukses, uang masuk tercatat (akrual)', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    const usulan = db
      .prepare(`SELECT id FROM usulan_pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { id: string };

    const hasil = verifikasi.verifikasiUsulan({
      aktor: bendahara(),
      usulanId: usulan.id,
      waktu: '2026-08-15T09:00:00+07:00',
    });
    expect(hasil.ok).toBe(true);

    const status = db
      .prepare(`SELECT status, diverifikasi_oleh FROM usulan_pembayaran WHERE id = ?`)
      .get(usulan.id) as { status: string; diverifikasi_oleh: string | null };
    expect(status.status).toBe('terverifikasi');
    expect(status.diverifikasi_oleh).toBe('bendahara-1');

    // kas masuk: pembayaran tercatat atas tagihan tsb
    const jumlah = db
      .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { n: number };
    expect(jumlah.n).toBe(450_000);
  });

  it('usulan sudah diproses — ditolak', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    const usulan = db
      .prepare(`SELECT id FROM usulan_pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { id: string };

    verifikasi.verifikasiUsulan({ aktor: bendahara(), usulanId: usulan.id, waktu: '2026-08-15T09:00:00+07:00' });
    const kedua = verifikasi.verifikasiUsulan({
      aktor: bendahara(),
      usulanId: usulan.id,
      waktu: '2026-08-15T10:00:00+07:00',
    });
    expect(kedua.ok).toBe(false);
    expect(kedua.pesan).toContain('sudah diproses');
  });
});

describe('tolakUsulan', () => {
  it('alasan kosong — ditolak', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    const usulan = db
      .prepare(`SELECT id FROM usulan_pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { id: string };
    const hasil = verifikasi.tolakUsulan({
      aktor: bendahara(),
      usulanId: usulan.id,
      alasan: '   ',
      waktu: '2026-08-15T09:00:00+07:00',
    });
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('Alasan penolakan wajib');
  });

  it('alasan ada — sukses, status ditolak + alasan terisi, uang TIDAK masuk', () => {
    const { waliId, santriId, tagihanId, verifikasi } = seedDasar();
    verifikasi.ajukanUsulan(usulanSah({ aktor: wali(waliId), tagihanId, santriId }));
    const usulan = db
      .prepare(`SELECT id FROM usulan_pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { id: string };

    const hasil = verifikasi.tolakUsulan({
      aktor: bendahara(),
      usulanId: usulan.id,
      alasan: 'Uang belum masuk ke rekening.',
      waktu: '2026-08-15T09:00:00+07:00',
    });
    expect(hasil.ok).toBe(true);

    const status = db
      .prepare(`SELECT status, alasan_penolakan FROM usulan_pembayaran WHERE id = ?`)
      .get(usulan.id) as { status: string; alasan_penolakan: string | null };
    expect(status.status).toBe('ditolak');
    expect(status.alasan_penolakan).toBe('Uang belum masuk ke rekening.');

    const jumlah = db
      .prepare(`SELECT COUNT(*) AS n FROM pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { n: number };
    expect(jumlah.n).toBe(0);
  });
});
