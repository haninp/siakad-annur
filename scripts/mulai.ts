#!/usr/bin/env node
/**
 * `npm run mulai` — orientasi awal sesi.
 *
 * Repo ini dikerjakan bergantian oleh agent yang berbeda, masing-masing memulai tanpa
 * ingatan dari sesi sebelumnya. Skrip ini mengubah orientasi dari penelusuran menjadi
 * satu perintah: kondisi terkini, tugas berikutnya, dan jejak commit terakhir.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');

const judul = (teks: string): void => {
  console.log(`\n\x1b[1m${teks}\x1b[0m`);
  console.log('─'.repeat(Math.min(teks.length, 72)));
};

const baca = (relatif: string): string | null => {
  const jalur = join(AKAR, relatif);
  return existsSync(jalur) ? readFileSync(jalur, 'utf8') : null;
};

const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: AKAR, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

// ── Kondisi terkini ────────────────────────────────────────────────────────────
judul('KONDISI TERKINI — docs/STATE.md');
const state = baca('docs/STATE.md');
console.log(state ? state.trim() : 'docs/STATE.md belum ada.');

// ── Tugas berikutnya ───────────────────────────────────────────────────────────
judul('TUGAS BERIKUTNYA — docs/TUGAS.md');
const tugas = baca('docs/TUGAS.md');
if (!tugas) {
  console.log('docs/TUGAS.md belum ada.');
} else {
  // Tampilkan baris tugas yang belum selesai saja; yang sudah dicentang tidak menolong
  // agent yang baru mulai.
  const belum = tugas
    .split('\n')
    .filter((baris) => /^\s*[-*]\s*\[ \]/.test(baris))
    .slice(0, 8);
  console.log(belum.length ? belum.join('\n') : 'Tidak ada tugas terbuka.');
}

// ── Jejak terakhir ─────────────────────────────────────────────────────────────
judul('LIMA COMMIT TERAKHIR');
console.log(git('log', '-5', '--format=%h  %ad  %s', '--date=short') || 'Belum ada commit.');

const kotor = git('status', '--short');
if (kotor) {
  judul('PERUBAHAN BELUM DI-COMMIT');
  console.log(kotor);
  console.log(
    '\n\x1b[33mSesi sebelumnya berakhir tanpa commit. Periksa apakah pekerjaannya utuh sebelum menimpanya.\x1b[0m',
  );
}

judul('LANGKAH BERIKUTNYA');
console.log('  1. Baca AGENTS.md bila ini sesi pertama Anda di repo ini');
console.log('  2. Ambil tugas teratas dari docs/TUGAS.md');
console.log('  3. Akhiri dengan `npm run selesai`\n');
