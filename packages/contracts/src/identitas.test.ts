import { describe, expect, it } from 'vitest';
import { Pengajar, Santri, SantriAlias, SantriWali, Wali } from './identitas.js';

const ULID = '01JRZ8QK7M4N2P5V9X3B6C8D0E';

const santriSah = {
  id: ULID,
  nis: '2627001',
  nisn: null,
  nik: '3276046510210003',
  nama_lengkap: 'AIDAH WAFA FAUZIYAH',
  jenis_kelamin: 'perempuan',
  tempat_lahir: 'JAKARTA',
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
};

describe('Santri', () => {
  it('menerima baris yang sah', () => {
    expect(Santri.parse(santriSah).nis).toBe('2627001');
  });

  it('menolak NIK yang bukan 16 digit', () => {
    expect(Santri.safeParse({ ...santriSah, nik: '327604651021' }).success).toBe(false);
  });

  it('menerima NISN kosong — data nyata memang belum terisi', () => {
    expect(Santri.safeParse({ ...santriSah, nisn: null }).success).toBe(true);
  });

  it('menolak tanggal lahir yang bukan ISO', () => {
    // Berkas lama menulis `25 Oktober 2021` dan `16/08/2018`; keduanya harus
    // dinormalkan importer, bukan disimpan apa adanya.
    expect(Santri.safeParse({ ...santriSah, tanggal_lahir: '25 Oktober 2021' }).success).toBe(
      false,
    );
    expect(Santri.safeParse({ ...santriSah, tanggal_lahir: '16/08/2018' }).success).toBe(false);
  });

  it('menolak nama kosong', () => {
    expect(Santri.safeParse({ ...santriSah, nama_lengkap: '   ' }).success).toBe(false);
  });

  it('menolak ULID yang tidak sah', () => {
    expect(Santri.safeParse({ ...santriSah, id: 'bukan-ulid' }).success).toBe(false);
  });
});

describe('Wali', () => {
  it('menerima NIK kosong — belum didata di sheet mana pun', () => {
    const hasil = Wali.safeParse({
      id: ULID,
      nik: null,
      nama_lengkap: 'HARDIANTO',
      no_hp: '089620728660',
      status_hidup: 'hidup',
    });
    expect(hasil.success).toBe(true);
  });

  it('membedakan tidak_diketahui dari hidup', () => {
    const dasar = { id: ULID, nik: null, nama_lengkap: 'MUTMAINNAH', no_hp: null };
    expect(Wali.safeParse({ ...dasar, status_hidup: 'tidak_diketahui' }).success).toBe(true);
    expect(Wali.safeParse({ ...dasar, status_hidup: 'belum_tahu' }).success).toBe(false);
  });
});

describe('SantriWali', () => {
  it('penanggung_biaya dan penerima_notifikasi hanya boolean', () => {
    const dasar = { santri_id: ULID, wali_id: ULID, hubungan: 'ayah', penerima_notifikasi: true };
    expect(SantriWali.safeParse({ ...dasar, penanggung_biaya: true }).success).toBe(true);
    expect(SantriWali.safeParse({ ...dasar, penanggung_biaya: 'Orang Tua' }).success).toBe(false);
    expect(SantriWali.safeParse({ ...dasar, penanggung_biaya: 1 }).success).toBe(false);
  });
});

describe('Pengajar', () => {
  it('menerima kunyah sebagai nama_lengkap', () => {
    // Sebagian mudaris tercatat HANYA dengan kunyah di berkas warisan.
    const hasil = Pengajar.safeParse({
      id: ULID,
      no_induk: '2301001',
      nik: null,
      nama_lengkap: 'ABU AUFA UKASAH',
      jalur_kurikulum: 'diniyah',
      jalur: 'banin',
    });
    expect(hasil.success).toBe(true);
  });
});

describe('alias nama', () => {
  it('kunyah adalah salah satu jenis alias', () => {
    const hasil = SantriAlias.safeParse({
      santri_id: ULID,
      nama: 'ABU IBRAHIM',
      jenis: 'kunyah',
      sumber: 'berkas_04',
    });
    expect(hasil.success).toBe(true);
  });

  it('sumber harus salah satu berkas yang dikenal', () => {
    const hasil = SantriAlias.safeParse({
      santri_id: ULID,
      nama: 'AISYAH ALILLATUL HANIYYAH BANDU',
      jenis: 'keuangan',
      sumber: 'berkas_05',
    });
    expect(hasil.success).toBe(false);
  });
});
