#!/usr/bin/env node
/**
 * `npm run db:cadangkan` — salinan aman basis data sebelum intervensi langsung.
 *
 * Memakai `VACUUM INTO`, bukan menyalin berkas. Menyalin berkas SQLite yang sedang
 * dipakai bisa menghasilkan salinan yang rusak: isi WAL yang belum ter-checkpoint
 * tidak ikut, dan hasilnya tampak baik-baik saja sampai dibuka.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { bukaBasisData } from '@siakad/db';
import { LOKASI_DB } from './basis-data.ts';

const cap = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const tujuan = join(process.env.SIAKAD_CADANGAN ?? 'data/cadangan', `siakad-${cap}.db`);

mkdirSync(join(tujuan, '..'), { recursive: true });

const db = bukaBasisData({ lokasi: LOKASI_DB });
db.prepare('VACUUM INTO ?').run(tujuan);
db.close();

console.log(`\n\x1b[32m✓\x1b[0m cadangan dibuat: ${tujuan}`);
console.log(
  `\x1b[2m  Catat apa yang Anda ubah dan mengapa di docs/handoff/ — intervensi langsung\n` +
    `  tidak meninggalkan jejak di audit_log.\x1b[0m\n`,
);
