#!/usr/bin/env node
/**
 * UJI COBA — alur keuangan di atas basis data pengembangan (data/sqlite/siakad.db)
 *
 * Data santri/rombel/tahun-ajaran berasal dari `npm run db:isi` (karangan).
 * Entitas keuangan (akun, komponen SPP, tarif) diisi skrip ini karena seed
 * contoh memang belum memuatnya.
 *
 * File ini sengaja di data/ (gitignored) — bukan bagian dari repo.
 *
 * Jalankan dari akar repo:  node data/uji-keuangan.ts
 */
import { buatUlid } from '@siakad/contracts';
import {
  bukaBasisData,
  buatDukunganTransaksi,
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
import { buatHandlerKeuangan } from '@siakad/core';

const db = bukaBasisData({ lokasi: 'data/sqlite/siakad.db' });
const aktor = { peran: 'pengurus', id: 'demo-pengurus' } as const;
const waktu = '2026-08-12T08:00:00+07:00';

// ── temukan entitas dari seed ────────────────────────────────────────────────
const santri = db
  .prepare(
    `SELECT s.id, s.nama_lengkap, p.rombel_id
     FROM santri s JOIN pendaftaran p ON p.santri_id = s.id
     WHERE p.status = 'aktif' ORDER BY s.id LIMIT 1`,
  )
  .get() as { id: string; nama_lengkap: string; rombel_id: string };
const ta = db.prepare(`SELECT id, kode FROM tahun_ajaran WHERE aktif = 1`).get() as {
  id: string;
  kode: string;
};
const rombel = db
  .prepare(`SELECT jalur, marhalah, tingkat FROM rombel WHERE id = ?`)
  .get(santri.rombel_id) as {
  jalur: 'banin' | 'banat' | 'ra_paud' | null;
  marhalah: 'paud' | 'ra' | 'ibtidaiyyah' | 'mutawashitoh' | null;
  tingkat: number;
};

console.log(`Santri : ${santri.nama_lengkap}`);
console.log(`TA     : ${ta.kode} | Rombel: ${rombel.jalur}/${rombel.marhalah} tkt ${rombel.tingkat}`);
console.log('─'.repeat(56));

// ── isi entitas keuangan minimal (seed contoh belum memuatnya; idempoten) ──
const akunKode = 101;
if (!(db.prepare(`SELECT 1 FROM akun_keuangan WHERE kode = ?`).get(akunKode) as unknown)) {
  repoAkunKeuangan(db).sisip({ kode: akunKode, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
}
const komponenSpp = (db.prepare(`SELECT id FROM komponen_biaya WHERE kode = 'spp'`).get() as
  | { id: string }
  | undefined)?.id ?? buatUlid();
if (!(db.prepare(`SELECT 1 FROM komponen_biaya WHERE kode = 'spp'`).get() as unknown)) {
  repoKomponenBiaya(db).sisip({
    id: komponenSpp,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: akunKode,
    aktif: true,
  });
}
const adaTarif = db
  .prepare(
    `SELECT 1 FROM tarif_komponen
     WHERE komponen_biaya_id = ? AND tahun_ajaran_id = ?
       AND jalur = ? AND marhalah = ? AND tingkat = ?`,
  )
  .get(komponenSpp, ta.id, rombel.jalur, rombel.marhalah, rombel.tingkat) as unknown;
if (!adaTarif) {
  repoTarifKomponen(db).sisip({
    id: buatUlid(),
    tahun_ajaran_id: ta.id,
    komponen_biaya_id: komponenSpp,
    jalur: rombel.jalur,
    marhalah: rombel.marhalah,
    tingkat: rombel.tingkat,
    nominal: 450_000,
    aktif: true,
  });
}

const h = buatHandlerKeuangan({
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
});

const langkah = (judul: string, hasil: { ok: boolean; pesan: string }) => {
  console.log(`\n[${hasil.ok ? 'OK  ' : 'GAGAL'}] ${judul}`);
  console.log(`  → ${hasil.pesan}`);
};

// 1. Terbitkan tagihan SPP Agustus 2026
const t = h.terbitkanTagihan({
  aktor,
  santriId: santri.id,
  komponenBiayaId: komponenSpp,
  tahunAjaranId: ta.id,
  periode: '2026-08',
  skemaPeriode: 'masehi',
  waktu,
});
langkah('Terbitkan tagihan SPP 2026-08', t);
if (!t.ok) process.exit(1);

const tagihan = db
  .prepare(
    `SELECT id, nominal, status, jatuh_tempo FROM tagihan
     WHERE santri_id = ? AND komponen_biaya_id = ?`,
  )
  .get(santri.id, komponenSpp) as { id: string; nominal: number; status: string; jatuh_tempo: string | null };
console.log(`  Nominal: Rp ${Number(tagihan.nominal).toLocaleString('id-ID')} | status: ${tagihan.status} | jatuh tempo: ${tagihan.jatuh_tempo ?? '-'}`);

// 2. Bayar cicilan 1 — Rp150.000 tunai
langkah(
  'Bayar cicilan 1 (Rp150.000, tunai)',
  h.catatPembayaran({
    aktor,
    tagihanId: tagihan.id,
    tanggal: '2026-08-05',
    nominal: 150_000,
    metode: 'tunai',
    sumber: 'wali',
    sebagaiCicilan: true,
    waktu,
  }),
);

// 3. Tetapkan keringanan 10%
langkah(
  'Tetapkan keringanan 10%',
  h.tetapkanKeringanan({
    aktor,
    tagihanId: tagihan.id,
    nominal: null,
    persentase: 10,
    alasan: 'Keringanan uji coba',
    waktu,
  }),
);

// 4. Lunasi sisa — cicilan 2 via transfer
const sisa = db
  .prepare(
    `SELECT (nominal - COALESCE((SELECT SUM(nominal) FROM pembayaran WHERE tagihan_id = t.id), 0)) AS sisa
     FROM tagihan t WHERE t.id = ?`,
  )
  .get(tagihan.id) as { sisa: number };
const sisaRp = Number(sisa.sisa);
langkah(
  `Bayar cicilan 2 (Rp${sisaRp.toLocaleString('id-ID')}, transfer)`,
  h.catatPembayaran({
    aktor,
    tagihanId: tagihan.id,
    tanggal: '2026-08-12',
    nominal: sisaRp,
    metode: 'transfer',
    sumber: 'wali',
    sebagaiCicilan: true,
    waktu,
  }),
);

// 5. Kelebihan bayar Rp25.000 — diamati apakah masuk saldo lebih bayar / ditolak
langkah(
  'Bayar berlebih Rp25.000 (qris)',
  h.catatPembayaran({
    aktor,
    tagihanId: tagihan.id,
    tanggal: '2026-08-13',
    nominal: 25_000,
    metode: 'qris',
    sumber: 'wali',
    sebagaiCicilan: false,
    waktu,
  }),
);

// ── state akhir ──────────────────────────────────────────────────────────────
const akhir = db
  .prepare(
    `SELECT status,
       (nominal - COALESCE((SELECT SUM(nominal) FROM pembayaran WHERE tagihan_id = tagihan.id), 0)) AS outstanding
     FROM tagihan WHERE id = ?`,
  )
  .get(tagihan.id) as { status: string; outstanding: number };
const lb = db
  .prepare(`SELECT COALESCE(SUM(nominal), 0) AS saldo FROM lebih_bayar WHERE santri_id = ?`)
  .get(santri.id) as { saldo: number };
const totalBayar = db
  .prepare(`SELECT COALESCE(SUM(nominal), 0) AS total FROM pembayaran WHERE tagihan_id = ?`)
  .get(tagihan.id) as { total: number };

console.log('\n' + '═'.repeat(56));
console.log('STATE AKHIR');
console.log('─'.repeat(56));
console.log(`  Status tagihan  : ${akhir.status}`);
console.log(`  Outstanding     : Rp ${Number(akhir.outstanding).toLocaleString('id-ID')}`);
console.log(`  Total dibayar   : Rp ${Number(totalBayar.total).toLocaleString('id-ID')}`);
console.log(`  Saldo lebih bayar: Rp ${Number(lb.saldo).toLocaleString('id-ID')}`);
console.log('═'.repeat(56));

db.close();
