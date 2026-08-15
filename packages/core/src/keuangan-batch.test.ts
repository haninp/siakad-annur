import { buatUlid } from '@siakad/contracts';
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
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
} from '@siakad/db';
import { describe, expect, it } from 'vitest';
import { terbitkanTagihanBulanan } from './keuangan-batch.js';
import type { DepKeuangan } from './keuangan-handler.js';

function siapkan() {
  const db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);

  const ta = buatUlid();
  const rombel = buatUlid();
  const komponen = buatUlid();
  const tarif = buatUlid();
  const santriIds = [buatUlid(), buatUlid()];

  db.prepare(
    `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026/2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(ta);
  db.prepare(
    `INSERT INTO rombel (id, tahun_ajaran_id, jalur, marhalah, nama, tingkat, wali_kelas_pengajar_id)
     VALUES (?, ?, 'banin', 'ibtidaiyyah', '1 (SATU)', 1, NULL)`,
  ).run(rombel, ta);
  for (const id of santriIds) {
    db.prepare(
      `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
         tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
         status, anak_ke, jumlah_saudara)
       VALUES (?, ?, NULL, NULL, ?, 'laki_laki', 'Depok', '2018-05-01', NULL, NULL,
         NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
    ).run(id, `262700${santriIds.indexOf(id) + 1}`, `Santri ${santriIds.indexOf(id) + 1}`);
    db.prepare(
      `INSERT INTO pendaftaran (santri_id, tahun_ajaran_id, rombel_id, tanggal_masuk,
         tanggal_keluar, status)
       VALUES (?, ?, ?, '2026-07-15', NULL, 'aktif')`,
    ).run(id, ta, rombel);
  }

  repoAkunKeuangan(db).sisip({ kode: 101, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
  repoKomponenBiaya(db).sisip({
    id: komponen,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: 101,
    aktif: true,
  });
  repoTarifKomponen(db).sisip({
    id: tarif,
    tahun_ajaran_id: ta,
    komponen_biaya_id: komponen,
    jalur: 'banin',
    marhalah: 'ibtidaiyyah',
    tingkat: 1,
    nominal: 450_000,
    aktif: true,
  });

  const dep: DepKeuangan = {
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

  const santri = santriIds.map((id, i) => ({
    id,
    nama_lengkap: `Santri ${i + 1}`,
  }));

  return { db, dep, ta, komponen, santri };
}

const periode = '2026-08';

describe('terbitkanTagihanBulanan', () => {
  it('menerbitkan tagihan untuk semua santri aktif', () => {
    const { db, dep, ta, komponen, santri } = siapkan();
    const hasil = terbitkanTagihanBulanan(dep, {
      santri,
      komponenBiayaId: komponen,
      tahunAjaranId: ta,
      periode,
      actorId: 'back-office',
    });

    expect(hasil.diterbitkan).toBe(2);
    expect(hasil.gagal).toBe(0);
    expect(hasil.sudahAda).toBe(0);
    expect(hasil.rincian).toHaveLength(2);

    const tagihan = db
      .prepare(`SELECT COUNT(*) AS n FROM tagihan WHERE periode = ?`)
      .get(periode) as { n: number };
    expect(tagihan.n).toBe(2);
  });

  it('idempoten dengan predikat sudahAda: periode kedua tidak membuat dobel', () => {
    const { db, dep, ta, komponen, santri } = siapkan();
    const opsi = {
      santri,
      komponenBiayaId: komponen,
      tahunAjaranId: ta,
      periode,
      actorId: 'back-office',
      sudahAda: (santriId: string) =>
        db
          .prepare(`SELECT 1 FROM tagihan WHERE santri_id = ? AND periode = ? AND komponen_biaya_id = ?`)
          .get(santriId, periode, komponen) !== undefined,
    };

    const pertama = terbitkanTagihanBulanan(dep, opsi);
    expect(pertama.diterbitkan).toBe(2);

    const kedua = terbitkanTagihanBulanan(dep, opsi);
    expect(kedua.diterbitkan).toBe(0);
    expect(kedua.sudahAda).toBe(2);

    const tagihan = db
      .prepare(`SELECT COUNT(*) AS n FROM tagihan WHERE periode = ?`)
      .get(periode) as { n: number };
    expect(tagihan.n).toBe(2);
  });

  it('tanpa predikat, duplikat dihitung sebagai gagal (handler menolak)', () => {
    const { dep, ta, komponen, santri } = siapkan();
    const opsi = {
      santri,
      komponenBiayaId: komponen,
      tahunAjaranId: ta,
      periode,
      actorId: 'back-office',
    };

    terbitkanTagihanBulanan(dep, opsi);
    const kedua = terbitkanTagihanBulanan(dep, opsi);
    expect(kedua.diterbitkan).toBe(0);
    expect(kedua.gagal).toBe(2);
  });
});
