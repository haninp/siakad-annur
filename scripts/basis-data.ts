#!/usr/bin/env node
/**
 * `npm run db` — menyiapkan basis data SQLite untuk pengembangan.
 *
 * Sesuai AGENTS.md aturan 5, alur ini jadi npm script supaya jalan sama saja di
 * Claude Code, opencode, maupun terminal biasa — tidak ada perkakas eksklusif.
 *
 *   npm run db             buat berkas dan jalankan migrasi
 *   npm run db:isi         sekalian isi data contoh untuk dijelajahi
 *   npm run db:ulang       hapus berkas lalu bangun ulang dari nol
 *   npm run db:jelajah     buka shell sqlite3 pada berkas itu
 *
 * Berkasnya di `data/sqlite/`, yang tidak pernah masuk git.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buatUlid } from '@siakad/contracts';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, versiTerpasang } from '@siakad/db';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Lokasi berkas basis data.
 *
 * Diambil dari `SIAKAD_DB` bila ada — di dalam container ia menunjuk ke volume
 * `/data`, sedangkan di host ia jatuh ke `data/sqlite/`. Menghitungnya dari letak
 * skrip saja membuat container menulis ke dalam citranya sendiri, yang tidak boleh
 * ditulis dan tidak akan bertahan.
 */
export const LOKASI_DB = process.env.SIAKAD_DB ?? join(AKAR, 'data', 'sqlite', 'siakad.db');

const tebal = (t: string): string => `\x1b[1m${t}\x1b[0m`;
const hijau = (t: string): string => `\x1b[32m${t}\x1b[0m`;
const redup = (t: string): string => `\x1b[2m${t}\x1b[0m`;

/**
 * Data contoh — seluruhnya **karangan**. Tidak ada satu pun nama santri, wali,
 * atau pengajar sungguhan di sini. Berkas warisan memuat nama anak di bawah umur
 * beserta NIK-nya; menyalinnya ke data contoh berarti menyebarkannya ke setiap
 * mesin pengembang tanpa alasan.
 */
function isiContoh(db: ReturnType<typeof bukaBasisData>): void {
  const ta = buatUlid();
  const rombel = buatUlid();
  const pengajar = buatUlid();
  const santri = [buatUlid(), buatUlid()];
  const wali = buatUlid();

  db.exec('BEGIN');

  db.prepare(
    `INSERT INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026/2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(ta);

  db.prepare(
    `INSERT INTO pengajar (id, no_induk, nik, nama_lengkap, jalur_kurikulum, jalur, aktif)
     VALUES (?, '2601001', NULL, 'Ustadz Contoh', 'diniyah', 'banin', 1)`,
  ).run(pengajar);

  db.prepare(
    `INSERT INTO rombel (id, tahun_ajaran_id, jalur, marhalah, nama, tingkat,
       wali_kelas_pengajar_id)
     VALUES (?, ?, 'banin', 'ibtidaiyyah', '1 (SATU)', 1, ?)`,
  ).run(rombel, ta, pengajar);

  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Bapak Contoh', '08120000000', NULL, 'hidup')`,
  ).run(wali);

  // Orang tua asuh (PROTA) — wali biasa dengan hubungan 'asuh', bukan peran terpisah.
  const donatur = buatUlid();
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Donatur Contoh', NULL, NULL, 'hidup')`,
  ).run(donatur);

  const namaSantri = ['Santri Contoh Satu', 'Santri Contoh Dua'];
  santri.forEach((id, i) => {
    db.prepare(
      `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir,
         tanggal_lahir, alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos,
         status, anak_ke, jumlah_saudara)
       VALUES (?, ?, NULL, NULL, ?, 'laki_laki', 'Depok', '2018-05-0' || ?,
         NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
    ).run(id, `262700${i + 1}`, namaSantri[i] ?? 'Santri Contoh', String(i + 1));

    // Satu wali, dua santri — bentuk yang membuat santri_id wajib eksplisit.
    db.prepare(
      `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya,
         penerima_notifikasi, aktif)
       VALUES (?, ?, 'ayah', 1, 1, 1)`,
    ).run(id, wali);

    db.prepare(
      `INSERT INTO pendaftaran (santri_id, tahun_ajaran_id, rombel_id, tanggal_masuk,
         tanggal_keluar, status)
       VALUES (?, ?, ?, '2026-07-15', NULL, 'aktif')`,
    ).run(id, ta, rombel);
  });

  // Santri kedua punya orang tua asuh: satu santri, dua wali dengan hubungan berbeda.
  db.prepare(
    `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya,
       penerima_notifikasi, aktif)
     VALUES (?, ?, 'asuh', 1, 0, 1)`,
  ).run(santri[1] ?? null, donatur);

  // Tiga usulan izin dalam tiga keadaan berbeda, supaya alurnya terlihat.
  const usulan: [string, Record<string, string | number | null>][] = [
    ['menunggu konfirmasi wali kelas', { status: 'menunggu' }],
    [
      'sudah dikonfirmasi wali kelas',
      {
        status: 'diterima',
        ditanggapi_oleh_pengajar_id: pengajar,
        waktu_tanggap: '2026-08-10T06:30:00+07:00',
      },
    ],
    [
      'dibatalkan wali sebelum dikonfirmasi',
      {
        status: 'dibatalkan',
        dibatalkan_oleh_wali_id: wali,
        waktu_tanggap: '2026-08-09T22:40:00+07:00',
      },
    ],
  ];

  usulan.forEach(([alasan, tambahan], i) => {
    const dasar: Record<string, string | number | null> = {
      id: buatUlid(),
      santri_id: santri[0] ?? null,
      tanggal: `2026-08-${String(10 + i).padStart(2, '0')}`,
      jenis: 'sakit',
      alasan,
      dilaporkan_oleh_wali_id: wali,
      dicatat_oleh_wali_id: wali,
      dicatat_oleh_pengajar_id: null,
      kanal: 'bot_wali',
      status: 'menunggu',
      ditanggapi_oleh_pengajar_id: null,
      dibatalkan_oleh_wali_id: null,
      waktu_tanggap: null,
      dibuat_pada: '2026-08-09T22:15:00+07:00',
      ...tambahan,
    };
    const kolom = Object.keys(dasar);
    db.prepare(
      `INSERT INTO usulan_izin (${kolom.join(', ')})
       VALUES (${kolom.map(() => '?').join(', ')})`,
    ).run(...kolom.map((k) => dasar[k] ?? null));
  });

  db.exec('COMMIT');
}

function utama(): void {
  const isi = process.argv.includes('--isi');
  const ulang = process.argv.includes('--ulang');

  mkdirSync(dirname(LOKASI_DB), { recursive: true });

  if (ulang) {
    // Basis data pengembangan boleh dibuang; yang berisi data sungguhan tidak.
    // Perubahan skema setelah peluncuran wajib jadi migrasi baru, bukan hapus-ulang.
    for (const akhiran of ['', '-wal', '-shm']) {
      rmSync(`${LOKASI_DB}${akhiran}`, { force: true });
    }
  }
  const db = bukaBasisData({ lokasi: LOKASI_DB });

  const sebelum = versiTerpasang(db);
  const hasil = jalankanMigrasi(db, DAFTAR_MIGRASI);

  console.log(tebal('\nBASIS DATA'));
  console.log('─'.repeat(40));
  console.log(`  berkas   ${LOKASI_DB}`);
  if (ulang) console.log(`  ${redup('dibangun ulang dari nol')}`);
  console.log(`  versi    ${sebelum} → ${versiTerpasang(db)}`);
  console.log(
    `  migrasi  ${hasil.diterapkan.length > 0 ? `diterapkan ${hasil.diterapkan.join(', ')}` : 'tidak ada yang baru'}`,
  );

  if (isi) {
    const sudahAda = db.prepare('SELECT COUNT(*) AS n FROM santri').get() as { n: number };
    if (sudahAda.n > 0) {
      console.log(`  contoh   ${redup('dilewati — sudah ada isinya')}`);
    } else {
      isiContoh(db);
      console.log(`  contoh   ${hijau('terisi')}`);
    }
  }

  const tabel = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  console.log(`  tabel    ${tabel.length}`);

  db.close();

  console.log(tebal('\nMENJELAJAHI ISINYA'));
  console.log('─'.repeat(40));
  console.log('  npm run db:jelajah        shell sqlite3 (.tables, .schema, SELECT ...)');
  console.log('  Di VSCode: pasang ekstensi SQLite, lalu buka berkas di atas.');
  console.log(`  ${redup('Berkasnya di data/, yang tidak pernah masuk git.')}\n`);
}

utama();
