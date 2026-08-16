/**
 * Worker notifikasi (RFC-011): tagihan yang baru terbit diberitahukan
 * proaktif ke wali terdaftar via bot wali (@rtq_annur_bot).
 *
 * Long-running dengan interval (default 60 dtk); `--sekali` untuk satu
 * putaran (uji). Logika batch ada di `packages/core` — di sini hanya
 * fungsi kirim (fetch Telegram) dan interval.
 *
 * Menjalankan:  npm run worker:notifikasi        (loop)
 *               npm run worker:notifikasi -- --sekali
 */
import { buatHandlerNotifikasi } from '@siakad/core';
import { bukaBasisData, repoNotifikasi } from '@siakad/db';

const tokenWali = process.env.TELEGRAM_TOKEN_WALI;
if (!tokenWali) {
  console.error('TELEGRAM_TOKEN_WALI belum diisi di .env');
  process.exit(1);
}

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });
const notifikasi = buatHandlerNotifikasi({ repoNotifikasi: repoNotifikasi(db) });

async function kirimTelegram(telegramId: number, teks: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${tokenWali}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text: teks }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function satuPutaran(): Promise<void> {
  const hasil = await notifikasi.kirimNotifikasiTerbit({
    waktu: new Date().toISOString(),
    kirim: kirimTelegram,
  });
  if (hasil.tagihanDiproses > 0) {
    console.log(
      `[${new Date().toISOString()}] notifikasi tagihan: ${hasil.tagihanDiproses} diproses, ` +
        `${hasil.pesanTerkirim} terkirim, ${hasil.gagal} gagal`,
    );
  }
}

const sekali = process.argv.includes('--sekali');
const intervalMs = (Number(process.env.WORKER_INTERVAL_DETIK ?? 60) || 60) * 1000;

async function loop(): Promise<void> {
  await satuPutaran();
  if (sekali) process.exit(0);
  setTimeout(loop, intervalMs);
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

void loop();
