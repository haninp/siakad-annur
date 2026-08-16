#!/usr/bin/env node
/**
 * npm run hijriah:isi — seed tabel kalender_hijriah dari myQuran API.
 *
 * Menggunakan endpoint /cal/ce/{tahun}-{bulan}-01 dengan method=islamic-umalqura
 * karena method standar myQuran menunjukkan anomali (lihat ADR 0013).
 *
 * Setiap baris dari API ditandai provisional=1 dan sumber='myquran' sampai
 * disetujui pengurus lewat handler setujuiBulanHijriah atau perintah bot.
 */

import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi, repoKalenderHijriah } from '@siakad/db';
import { LOKASI_DB } from './basis-data.ts';

const BASE_URL = 'https://api.myquran.com/v3/cal/ce';
const METODE = 'islamic-umalqura';
const ZONA_WAKTU = 'Asia/Jakarta';

interface ResponseApi {
  status: boolean;
  data?: {
    ce: {
      year: number;
      month: number;
      day: number;
    };
    hijr: {
      monthName: string;
    };
  };
}

function formatTanggal(year: number, month: number, day: number): string {
  return String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function tidur(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ambilAwalBulan(
  tahun: number,
  bulan: number,
): Promise<{ tanggal: string; nama: string }> {
  const url =
    BASE_URL +
    '/' +
    String(tahun) +
    '-' +
    String(bulan).padStart(2, '0') +
    '-01?method=' +
    METODE +
    '&tz=' +
    ZONA_WAKTU;

  for (let coba = 1; coba <= 3; coba++) {
    const response = await fetch(url);

    if (response.status === 429) {
      const tunggu = 500 * coba;
      console.log('    rate limit ' + tahun + '-' + bulan + ', tunggu ' + tunggu + 'ms...');
      await tidur(tunggu);
      continue;
    }

    if (!response.ok) {
      throw new Error('Gagal mengambil ' + tahun + '-' + bulan + ': HTTP ' + response.status);
    }

    const json = (await response.json()) as ResponseApi;
    if (!json.status || !json.data) {
      throw new Error('Respons myQuran tidak valid untuk ' + tahun + '-' + bulan);
    }

    const { ce, hijr } = json.data;
    return {
      tanggal: formatTanggal(ce.year, ce.month, ce.day),
      nama: hijr.monthName,
    };
  }

  throw new Error('Gagal mengambil ' + tahun + '-' + bulan + ' setelah 3 kali coba (rate limit)');
}

function parseArgs(argv: string[]): { tahun: number; sampai: number } {
  const args = argv.slice(2);
  let tahun = 1448;
  let sampai = 1450;

  for (const arg of args) {
    if (arg.startsWith('--tahun=')) {
      tahun = Number(arg.replace('--tahun=', ''));
    } else if (arg.startsWith('--sampai=')) {
      sampai = Number(arg.replace('--sampai=', ''));
    }
  }

  if (Number.isNaN(tahun) || Number.isNaN(sampai) || tahun > sampai) {
    throw new Error('Argumen --tahun dan --sampai harus angka valid dengan tahun <= sampai.');
  }

  return { tahun, sampai };
}

async function utama(): Promise<void> {
  const { tahun, sampai } = parseArgs(process.argv);

  console.log('Seed kalender_hijriah dari myQuran (' + METODE + ')');
  console.log('Rentang: ' + tahun + ' H sampai ' + sampai + ' H');

  const db = bukaBasisData({ lokasi: LOKASI_DB });
  jalankanMigrasi(db, DAFTAR_MIGRASI);

  const repo = repoKalenderHijriah(db);
  let total = 0;

  for (let th = tahun; th <= sampai; th++) {
    for (let bl = 1; bl <= 12; bl++) {
      const { tanggal, nama } = await ambilAwalBulan(th, bl);
      repo.simpan({
        tahun_hijriah: th,
        bulan_hijriah: bl,
        nama_bulan: nama,
        tanggal_mulai_masehi: tanggal,
        provisional: true,
        disetujui_oleh: null,
        disetujui_pada: null,
        diingatkan_pada: null,
        sumber: 'myquran',
        catatan: 'Di-seed otomatis dari myQuran API',
      });
      total++;
      console.log('  ' + th + '-' + String(bl).padStart(2, '0') + ' ' + nama + ' -> ' + tanggal);
      await tidur(150);
    }
  }

  db.close();
  console.log('Selesai. ' + total + ' bulan disimpan.');
  console.log('Ingatkan pengurus untuk menyetujui tiap bulan lewat /setujui {tahun}-{bulan}.');
}

utama().catch((err: unknown) => {
  console.error('Gagal seed kalender_hijriah:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
