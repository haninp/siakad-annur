#!/usr/bin/env node
/**
 * `npm run selesai` — dijalankan setelah build, lint, dan test hijau.
 *
 * Tugasnya bukan memverifikasi (npm script yang mendahuluinya sudah melakukan itu),
 * melainkan menutup sesi dengan benar: memastikan docs/STATE.md benar-benar mencerminkan
 * kondisi terakhir, agar agent berikutnya tidak perlu membongkar ulang.
 */

import { execFileSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(AKAR, 'docs/STATE.md');

const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: AKAR, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

console.log('\n\x1b[32m✓ build, lint, dan test hijau\x1b[0m');

const kotor = git('status', '--short');
if (kotor) {
  console.log('\n\x1b[1mPERUBAHAN BELUM DI-COMMIT\x1b[0m');
  console.log('─'.repeat(32));
  console.log(kotor);
}

// STATE.md yang basi lebih berbahaya daripada tidak ada, karena ia dipercaya.
let stateBasi = true;
if (existsSync(STATE)) {
  const diubah = statSync(STATE).mtimeMs;
  const jamSejak = (Date.now() - diubah) / 36e5;
  stateBasi = jamSejak > 4;
  console.log(
    `\ndocs/STATE.md terakhir diubah ${jamSejak < 1 ? 'kurang dari sejam lalu' : `${Math.round(jamSejak)} jam lalu`}.`,
  );
} else {
  console.log('\n\x1b[33mdocs/STATE.md belum ada.\x1b[0m');
}

if (stateBasi) {
  console.log('\n\x1b[33mSebelum menutup sesi, perbarui docs/STATE.md:\x1b[0m');
  console.log('  • apa yang baru selesai');
  console.log('  • apa yang sedang dikerjakan, dan sampai mana');
  console.log('  • langkah berikutnya');
  console.log('  • keputusan yang masih menggantung');
  console.log('  • jebakan yang baru ditemukan');
  console.log('\nLalu centang tugas yang selesai di docs/TUGAS.md dan commit.\n');
} else {
  console.log(
    '\n\x1b[32mSTATE.md tampak mutakhir. Pastikan tugas selesai sudah dicentang di TUGAS.md.\x1b[0m\n',
  );
}
