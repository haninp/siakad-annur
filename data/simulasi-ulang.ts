#!/usr/bin/env node
/**
 * ISI DATA DUMMY — siakad-annur dev (dijalankan SETELAH `npm run db:ulang`).
 *
 * Membuat data contoh yang kaya untuk uji coba lapangan:
 *   - 3 wali, 8 santri (2 dari seed + 6 baru), masing-masing dengan tautan aktif
 *   - Tagihan SPP 2026-08 untuk semua santri
 *   - Variasi status pembayaran:
 *       • 2627002  SUDAH BAYAR (lunas penuh)
 *       • 2627006  SUDAH BAYAR + kelebihan → Saldo Rp 50.000
 *       • 2627003  BAYAR SEBAGIAN (Rp 200.000)
 *       • 2627004  MENUNGGU VERIFIKASI (usulan transfer diajukan)
 *       • sisanya  BELUM BAYAR
 *
 * Jalankan dari akar repo:  node data/simulasi-ulang.ts
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
  repoSantriWali,
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
  repoUsulanPembayaran,
  repoWaliAlias,
} from '@siakad/db';
import { buatHandlerKeuangan, buatHandlerVerifikasiPembayaran } from '@siakad/core';

const db = bukaBasisData({ lokasi: 'data/sqlite/siakad.db' });
const aktor = { peran: 'pengurus', id: 'dummy-data' } as const;
const waktu = '2026-08-15T08:00:00+07:00';
const periode = '2026-08';

// ── entitas keuangan minimal (idempoten) ─────────────────────────────────────
const akunKode = 101;
if (!(db.prepare(`SELECT 1 FROM akun_keuangan WHERE kode = ?`).get(akunKode) as unknown)) {
  repoAkunKeuangan(db).sisip({ kode: akunKode, nama: 'Pemasukan SPP', arah: 'masuk', aktif: true });
}
let komponenSpp = (db.prepare(`SELECT id FROM komponen_biaya WHERE kode = 'spp'`).get() as
  | { id: string }
  | undefined)?.id;
if (!komponenSpp) {
  komponenSpp = buatUlid();
  repoKomponenBiaya(db).sisip({
    id: komponenSpp,
    kode: 'spp',
    nama: 'SPP Bulanan',
    akun_keuangan_kode: akunKode,
    aktif: true,
  });
}
const ta = db.prepare(`SELECT id FROM tahun_ajaran WHERE aktif = 1`).get() as { id: string };

// ── santri & wali tambahan ────────────────────────────────────────────────────

interface SantriBaru {
  nis: string;
  nama: string;
  jenis_kelamin: 'laki_laki' | 'perempuan';
  wali: { nama: string; hubungan: 'ayah' | 'ibu' | 'asuh' };
}

const SANTRI_BARU: SantriBaru[] = [
  { nis: '2627003', nama: 'Fathan Rabbani', jenis_kelamin: 'laki_laki', wali: { nama: 'Ibu Siti Aminah', hubungan: 'ibu' } },
  { nis: '2627004', nama: 'Khalid Affan', jenis_kelamin: 'laki_laki', wali: { nama: 'Ibu Siti Aminah', hubungan: 'ibu' } },
  { nis: '2627005', nama: 'Aisyah Zahra', jenis_kelamin: 'perempuan', wali: { nama: 'Ibu Siti Aminah', hubungan: 'ibu' } },
  { nis: '2627006', nama: 'Zahra Ramadhani', jenis_kelamin: 'perempuan', wali: { nama: 'Bapak Ahmad Fauzi', hubungan: 'ayah' } },
  { nis: '2627007', nama: 'Bilal Haqqi', jenis_kelamin: 'laki_laki', wali: { nama: 'Bapak Ahmad Fauzi', hubungan: 'ayah' } },
  { nis: '2627008', nama: 'Maryam Shalihah', jenis_kelamin: 'perempuan', wali: { nama: 'Bapak Ahmad Fauzi', hubungan: 'ayah' } },
];

// rombel & tanggal dari santri seed pertama (dipakai semua santri baru)
const contoh = db
  .prepare(
    `SELECT s.id, p.rombel_id FROM santri s JOIN pendaftaran p ON p.santri_id = s.id
     WHERE p.status = 'aktif' ORDER BY s.id LIMIT 1`,
  )
  .get() as { id: string; rombel_id: string };

// tarif per rombel (idempoten)
const rombel = db
  .prepare(`SELECT jalur, marhalah, tingkat FROM rombel WHERE id = ?`)
  .get(contoh.rombel_id) as {
  jalur: 'banin' | 'banat' | 'ra_paud' | null;
  marhalah: string | null;
  tingkat: number;
};
const adaTarif = db
  .prepare(
    `SELECT 1 FROM tarif_komponen
     WHERE komponen_biaya_id = ? AND tahun_ajaran_id = ? AND jalur = ? AND marhalah = ? AND tingkat = ?`,
  )
  .get(komponenSpp, ta.id, rombel.jalur, rombel.marhalah, rombel.tingkat) as unknown;
if (!adaTarif) {
  repoTarifKomponen(db).sisip({
    id: buatUlid(),
    tahun_ajaran_id: ta.id,
    komponen_biaya_id: komponenSpp,
    jalur: rombel.jalur,
    marhalah: rombel.marhalah as 'paud' | 'ra' | 'ibtidaiyyah' | 'mutawashitoh' | null,
    tingkat: rombel.tingkat,
    nominal: 450_000,
    aktif: true,
  });
}

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

// ── sisip santri baru + wali + tautan + pendaftaran ──────────────────────────
const idSantriBaru = new Map<string, string>(); // nis → santriId
const idWaliBaru = new Map<string, string>(); // nama wali → waliId

for (const s of SANTRI_BARU) {
  const santriId = buatUlid();
  idSantriBaru.set(s.nis, santriId);
  repoSantri(db).sisip({
    id: santriId,
    nis: s.nis,
    nisn: null,
    nik: null,
    nama_lengkap: s.nama,
    jenis_kelamin: s.jenis_kelamin,
    tempat_lahir: 'Depok',
    tanggal_lahir: '2019-01-01',
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

  let waliId = idWaliBaru.get(s.wali.nama);
  if (!waliId) {
    waliId = buatUlid();
    idWaliBaru.set(s.wali.nama, waliId);
    db.prepare(
      `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
       VALUES (?, NULL, ?, NULL, NULL, 'hidup')`,
    ).run(waliId, s.wali.nama);
  }

  repoSantriWali(db).sisip({
    santri_id: santriId,
    wali_id: waliId,
    hubungan: s.wali.hubungan,
    penanggung_biaya: true,
    penerima_notifikasi: true,
    aktif: true,
  });

  db.prepare(
    `INSERT INTO pendaftaran (santri_id, tahun_ajaran_id, rombel_id, tanggal_masuk, tanggal_keluar, status)
     VALUES (?, ?, ?, '2025-07-14', NULL, 'aktif')`,
  ).run(santriId, ta.id, contoh.rombel_id);
}

// ── alias nama wali (RFC-013) ────────────────────────────────────────────────
// Tampilan pakai kunyah → panggilan → nama lengkap (`formatNamaTampil` di core).
// Alias di-insert idempoten — aman dijalankan ulang.
const aliasWali: Record<string, { kunyah?: string; panggilan?: string }> = {
  'Ibu Siti Aminah': { kunyah: 'Ummu Aisyah', panggilan: 'Bu Siti' },
  'Bapak Ahmad Fauzi': { kunyah: 'Abu Bilal', panggilan: 'Pak Fauzi' },
  'Bapak Contoh': { kunyah: 'Abu Umar', panggilan: 'Pak Umar' },
  'Donatur Contoh': { panggilan: 'Pak Donatur' },
};
const cariWaliId = (nama: string): string | undefined =>
  (db.prepare(`SELECT id FROM wali WHERE nama_lengkap = ?`).get(nama) as
    | { id: string }
    | undefined)?.id;
for (const [nama, alias] of Object.entries(aliasWali)) {
  const waliId = idWaliBaru.get(nama) ?? cariWaliId(nama);
  if (!waliId) continue;
  const sisipAlias = (jenis: 'kunyah' | 'panggilan', nilai: string): void => {
    const ada = db
      .prepare(`SELECT 1 FROM wali_alias WHERE wali_id = ? AND nama = ? AND jenis = ?`)
      .get(waliId!, nilai, jenis) as unknown;
    if (ada) return;
    repoWaliAlias(db).sisip({ wali_id: waliId!, nama: nilai, jenis, sumber: 'manual' });
  };
  if (alias.kunyah) sisipAlias('kunyah', alias.kunyah);
  if (alias.panggilan) sisipAlias('panggilan', alias.panggilan);
}

// ── terbitkan tagihan untuk SEMUA santri aktif ───────────────────────────────
const semuaSantri = db
  .prepare(
    `SELECT s.id, s.nis, s.nama_lengkap FROM santri s
     JOIN pendaftaran p ON p.santri_id = s.id
     WHERE p.status = 'aktif' ORDER BY s.nama_lengkap`,
  )
  .all() as { id: string; nis: string; nama_lengkap: string }[];

console.log(`Terbitkan tagihan SPP ${periode} untuk ${semuaSantri.length} santri…`);
for (const s of semuaSantri) {
  const ada = db
    .prepare(`SELECT 1 FROM tagihan WHERE santri_id = ? AND periode = ? AND komponen_biaya_id = ?`)
    .get(s.id, periode, komponenSpp) as unknown;
  if (ada) continue;
  const r = keuangan.terbitkanTagihan({
    aktor,
    santriId: s.id,
    komponenBiayaId: komponenSpp,
    tahunAjaranId: ta.id,
    periode,
    skemaPeriode: 'masehi',
    waktu,
  });
  if (!r.ok) console.log(`  • ${s.nama_lengkap}: GAGAL — ${r.pesan}`);
}

// ── pembayaran variatif ──────────────────────────────────────────────────────
const tagihanId = (nis: string) =>
  (db
    .prepare(
      `SELECT t.id FROM tagihan t JOIN santri s ON s.id = t.santri_id
       WHERE s.nis = ? AND t.periode = ?`,
    )
    .get(nis, periode) as { id: string }).id;

const bayar = (nis: string, nominal: number) =>
  keuangan.catatPembayaran({
    aktor,
    tagihanId: tagihanId(nis),
    tanggal: '2026-08-10',
    nominal,
    metode: 'transfer',
    sumber: 'wali',
    sebagaiCicilan: true,
    waktu,
  });

console.log('\nPembayaran variatif:');
console.log(`  • 2627002 (Contoh Dua) bayar penuh 450.000: ${bayar('2627002', 450_000).pesan}`);
console.log(`  • 2627006 (Zahra) bayar 500.000 (lebih): ${bayar('2627006', 500_000).pesan}`);
console.log(`  • 2627003 (Fathan) bayar 200.000 (sebagian): ${bayar('2627003', 200_000).pesan}`);

// usulan menunggu verifikasi (2627004 — Khalid, transfer, bukti dummy)
const usulan = verifikasi.ajukanUsulan({
  aktor: { peran: 'wali', id: idWaliBaru.get('Ibu Siti Aminah') ?? '' },
  tagihanId: tagihanId('2627004'),
  santriId: idSantriBaru.get('2627004') ?? '',
  nominal: 450_000,
  tanggalBayar: '2026-08-14',
  metode: 'transfer',
  namaPenerima: null,
  buktiFileId: 'AgADdummybukti',
  buktiTipe: 'image/jpeg',
  catatan: null,
  waktu,
});
console.log(`  • 2627004 (Khalid) usulan transfer: ${usulan.ok ? 'MENUNGGU VERIFIKASI ✅' : 'GAGAL — ' + usulan.pesan}`);

// ── tampilan akhir (per wali — seperti yang dilihat bot) ─────────────────────
console.log('\n' + '═'.repeat(60));
console.log('RINGKASAN PER WALI (yang dilihat bot wali)');
console.log('═'.repeat(60));

const statusRingkas = (santriId: string) => {
  const row = db
    .prepare(
      `SELECT t.status,
              (t.nominal - COALESCE((SELECT SUM(p.nominal) FROM pembayaran p WHERE p.tagihan_id = t.id), 0)) AS sisa,
              (SELECT COUNT(*) FROM usulan_pembayaran u WHERE u.tagihan_id = t.id AND u.status = 'diajukan') AS usulan
       FROM tagihan t WHERE t.santri_id = ? AND t.periode = ?`,
    )
    .get(santriId, periode) as { status: string; sisa: number; usulan: number };
  if (row.usulan > 0) return '⏳ MENUNGGU VERIFIKASI';
  if (row.status === 'lunas' || row.sisa <= 0) return '✅ SUDAH BAYAR';
  if (row.sisa < 450_000) return `⏳ BAYAR SEBAGIAN (sisa ${row.sisa.toLocaleString('id-ID')})`;
  return '⛔ BELUM BAYAR';
};

for (const w of db.prepare(`SELECT id, nama_lengkap FROM wali ORDER BY nama_lengkap`).all() as {
  id: string;
  nama_lengkap: string;
}[]) {
  const anak = db
    .prepare(
      `SELECT s.id, s.nis, s.nama_lengkap FROM santri_wali ws
       JOIN santri s ON s.id = ws.santri_id
       WHERE ws.wali_id = ? AND ws.aktif = 1 ORDER BY s.nama_lengkap`,
    )
    .all(w.id) as { id: string; nis: string; nama_lengkap: string }[];
  if (anak.length === 0) continue;
  console.log(`\n${w.nama_lengkap}:`);
  for (const a of anak) {
    console.log(`  • ${a.nama_lengkap} (${a.nis}) — ${statusRingkas(a.id)}`);
  }
}

db.close();
console.log('\nSELESAI — data dummy siap. Kondisi: 2 lunas (1 bersaldo), 1 sebagian, 1 menunggu verifikasi, 4 belum bayar.');
