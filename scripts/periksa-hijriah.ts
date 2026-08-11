#!/usr/bin/env node
/**
 * npm run hijriah:periksa — cetak daftar bulan Hijriah yang masih provisional.
 *
 * Pengurus mengecek daftar ini, lalu menyetujui lewat bot/command handler
 * setujuiBulanHijriah. Bot reminder otomatis menunggu P1 (token Telegram).
 */

import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, repoKalenderHijriah } from '@siakad/db';
import { LOKASI_DB } from './basis-data.ts';

function utama(): void {
  const db = bukaBasisData({ lokasi: LOKASI_DB });
  jalankanMigrasi(db, DAFTAR_MIGRASI);

  const repo = repoKalenderHijriah(db);
  const daftar = repo.cariProvisional();

  console.log('Bulan Hijriah yang menunggu persetujuan:');
  console.log('─'.repeat(60));

  if (daftar.length === 0) {
    console.log('Tidak ada. Semua bulan sudah disetujui.');
    db.close();
    return;
  }

  for (const b of daftar) {
    const butuhIsbat = b.bulan_hijriah === 9 || b.bulan_hijriah === 10 || b.bulan_hijriah === 12;
    const catatan = butuhIsbat ? ' [butuh sidang isbat]' : '';
    console.log(
      '  ' +
        b.tahun_hijriah +
        '-' +
        String(b.bulan_hijriah).padStart(2, '0') +
        ' ' +
        b.nama_bulan +
        ' -> mulai ' +
        b.tanggal_mulai_masehi +
        catatan,
    );
  }

  console.log('');
  console.log('Cara menyetujui:');
  console.log('  - Bot Telegram (P1): /setujui {tahun}-{bulan}');
  console.log('  - Handler core: setujuiBulanHijriah({tahun, bulan, aktor, waktu})');

  db.close();
}

utama();
