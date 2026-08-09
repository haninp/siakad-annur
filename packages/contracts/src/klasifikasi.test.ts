import { describe, expect, it } from 'vitest';
import { ENTITAS_MASTER_DATA } from './index.js';
import { entitasSantri, type Santri } from './identitas.js';
import { saring, saringUmum, untukPrompt } from './klasifikasi.js';
import { DDL_MASTER_DATA, TABEL_MASTER_DATA } from './ddl.js';

/**
 * Inti dari uji ini: **kolom baru yang lupa diklasifikasikan harus menggagalkan
 * test**, bukan lolos diam-diam ke prompt LLM. AGENTS.md menuntut penyaringan
 * bekerja dari metadata, bukan dari daftar nama kolom yang ditulis manual.
 */
describe('kelengkapan klasifikasi data pribadi', () => {
  for (const entitas of ENTITAS_MASTER_DATA) {
    it(`${entitas.nama}: setiap kolom punya klasifikasi`, () => {
      const belumDiklasifikasi = entitas.kolom.filter((k) => entitas.klasifikasi[k] === undefined);
      expect(belumDiklasifikasi).toEqual([]);
    });

    it(`${entitas.nama}: tidak ada klasifikasi untuk kolom yang tidak ada`, () => {
      const kolom = new Set<string>(entitas.kolom);
      const berlebih = Object.keys(entitas.klasifikasi).filter((k) => !kolom.has(k));
      expect(berlebih).toEqual([]);
    });
  }

  it('setiap entitas terdaftar di DDL, dan sebaliknya', () => {
    const namaEntitas = ENTITAS_MASTER_DATA.map((e) => e.nama).sort();
    expect(namaEntitas).toEqual([...TABEL_MASTER_DATA].sort());
  });

  it('setiap tabel yang terdaftar benar-benar dibuat DDL', () => {
    for (const tabel of TABEL_MASTER_DATA) {
      expect(DDL_MASTER_DATA).toContain(`CREATE TABLE ${tabel} (`);
    }
  });
});

describe('NIK tidak pernah lolos ke luar core', () => {
  const santri: Santri = {
    id: '01JRZ8QK7M4N2P5V9X3B6C8D0E',
    nis: '2627001',
    nisn: null,
    nik: '3276046510210003',
    nama_lengkap: 'AIDAH WAFA FAUZIYAH',
    jenis_kelamin: 'perempuan',
    tempat_lahir: 'JAKARTA',
    tanggal_lahir: '2021-10-25',
    alamat: 'Jl. Swadaya RT 04/02, Limo, Depok',
    desa_kelurahan: 'Limo',
    kecamatan: 'Limo',
    kabupaten: 'Kota Depok',
    provinsi: 'Jawa Barat',
    kode_pos: null,
    status: 'aktif',
    anak_ke: 1,
    jumlah_saudara: 2,
  };

  it('untukPrompt membuang NIK', () => {
    const hasil = untukPrompt(entitasSantri, santri);
    expect(hasil).not.toHaveProperty('nik');
  });

  it('untukPrompt membuang data sensitif, bukan hanya yang terlarang', () => {
    const hasil = untukPrompt(entitasSantri, santri);
    expect(hasil).not.toHaveProperty('alamat');
    expect(hasil).not.toHaveProperty('tanggal_lahir');
  });

  it('untukPrompt tetap membawa yang internal', () => {
    const hasil = untukPrompt(entitasSantri, santri);
    expect(hasil.nama_lengkap).toBe('AIDAH WAFA FAUZIYAH');
    expect(hasil.nis).toBe('2627001');
  });

  it('bahkan pada tingkat sensitif, NIK tetap tertahan', () => {
    const hasil = saring(entitasSantri, santri, 'sensitif');
    expect(hasil).not.toHaveProperty('nik');
    expect(hasil.alamat).toBe('Jl. Swadaya RT 04/02, Limo, Depok');
  });

  it('tidak ada satu pun kolom terlarang yang lolos ke prompt', () => {
    for (const entitas of ENTITAS_MASTER_DATA) {
      const terlarang = entitas.kolom.filter((k) => entitas.klasifikasi[k] === 'terlarang');
      const baris = Object.fromEntries(entitas.kolom.map((k) => [k, 'nilai']));
      const hasil = saringUmum(entitas, baris, 'internal');
      for (const kolom of terlarang) {
        expect(hasil).not.toHaveProperty(kolom);
      }
    }
  });
});
