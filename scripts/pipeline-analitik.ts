/**
 * Runner pipeline analitik (RFC-018) — bronze→silver→gold, idempoten.
 * Menjalankan: npm run analisis:pipa
 */
import { jalankanPipelineAnalitik } from '@siakad/analytics';

const mulai = Date.now();
const hasil = await jalankanPipelineAnalitik();
console.log(`Pipeline analitik selesai (${((Date.now() - mulai) / 1000).toFixed(1)}s)`);
console.log({ snapshot: hasil.snapshot, bronze: hasil.bronze, silver: hasil.silver, gold: hasil.gold });