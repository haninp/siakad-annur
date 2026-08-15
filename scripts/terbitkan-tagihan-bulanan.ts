#!/usr/bin/env node
/**
 * BACK OFFICE — terbitkan tagihan SPP bulan berjalan untuk seluruh santri aktif.
 *
 *   npm run tagihan:terbitkan
 *
 * RFC-003: pengurus tidak menerbitkan tagihan; ini jalur back office-nya.
 * Idempoten — santri yang sudah punya tagihan pada periode ini dilewati.
 * Nanti menjadi cron di apps/worker; script ini bentuk yang bisa dijalankan
 * kapan saja.
 */
import { terbitkanTagihanBulanan } from '@siakad/core';
import {
  bukaBasisData,
  buatDukunganTransaksi,
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

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });

const komponen = repoKomponenBiaya(db).ambilSemua().find((k) => k.kode === 'spp');
const tahunAjaran = repoTahunAjaran(db).ambilSemua().find((t) => t.aktif);
if (!komponen || !tahunAjaran) {
  console.error('Komponen biaya SPP atau tahun ajaran aktif belum diatur.');
  process.exit(1);
}

const santri = db
  .prepare(
    `SELECT s.id, s.nama_lengkap FROM santri s
     JOIN pendaftaran p ON p.santri_id = s.id
     WHERE p.status = 'aktif' ORDER BY s.nama_lengkap`,
  )
  .all() as unknown as { id: string; nama_lengkap: string }[];

const periode = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
}).format(new Date());

const hasil = terbitkanTagihanBulanan(
  {
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
  },
  {
    santri,
    komponenBiayaId: komponen.id,
    tahunAjaranId: tahunAjaran.id,
    periode,
    actorId: 'back-office',
    sudahAda: (santriId) =>
      db
        .prepare(
          `SELECT 1 FROM tagihan WHERE santri_id = ? AND periode = ? AND komponen_biaya_id = ?`,
        )
        .get(santriId, periode, komponen.id) !== undefined,
  },
);

console.log(`Penerbitan tagihan SPP ${hasil.periode} (back office)`);
console.log(`  diterbitkan : ${hasil.diterbitkan}`);
console.log(`  sudah ada   : ${hasil.sudahAda}`);
console.log(`  gagal       : ${hasil.gagal}`);
for (const rincian of hasil.rincian) {
  console.log(`  - ${rincian}`);
}

db.close();
