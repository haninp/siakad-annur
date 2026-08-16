/**
 * Worker (RFC-011/012) — notifikasi & reminder:
 *  1. Tagihan terbit → wali terdaftar (RFC-011)
 *  2. Jatuh tempo H-3 / H-1 → wali terdaftar (RFC-012)
 *  3. Kalender hijriah provisional akan dimulai → pengurus (RFC-012, handoff 0013)
 *
 * Long-running dengan interval (default 60 dtk); `--sekali` untuk satu
 * putaran (uji). Logika batch di `packages/core` — di sini hanya fungsi
 * kirim (fetch Telegram), interval, dan daftar pengurus.
 *
 * Menjalankan:  npm run worker:notifikasi        (loop)
 *               npm run worker:notifikasi -- --sekali
 */
import { buatHandlerNotifikasi, buatHandlerReminder } from '@siakad/core';
import { bukaBasisData, repoKalenderHijriah, repoNotifikasi } from '@siakad/db';

const tokenWali = process.env.TELEGRAM_TOKEN_WALI;
if (!tokenWali) {
  console.error('TELEGRAM_TOKEN_WALI belum diisi di .env');
  process.exit(1);
}

const adminIds = (process.env.ADMIN_TELEGRAM_IDS ?? '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isInteger(n));

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });
const notifikasi = buatHandlerNotifikasi({ repoNotifikasi: repoNotifikasi(db) });
const reminder = buatHandlerReminder({
  repoNotifikasi: repoNotifikasi(db),
  repoKalenderHijriah: repoKalenderHijriah(db),
});

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

const tanggalJakarta = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

async function satuPutaran(): Promise<void> {
  const waktu = new Date().toISOString();
  const hariIni = tanggalJakarta();

  const terbit = await notifikasi.kirimNotifikasiTerbit({ waktu, kirim: kirimTelegram });
  if (terbit.tagihanDiproses > 0) {
    console.log(
      `[${waktu}] notifikasi terbit: ${terbit.tagihanDiproses} tagihan, ` +
        `${terbit.pesanTerkirim} terkirim, ${terbit.gagal} gagal`,
    );
  }

  const tempo = await reminder.kirimReminderJatuhTempo({ waktu, hariIni, kirim: kirimTelegram });
  if (tempo.itemDiproses > 0) {
    console.log(
      `[${waktu}] reminder jatuh tempo: ${tempo.itemDiproses} tagihan, ` +
        `${tempo.pesanTerkirim} terkirim, ${tempo.gagal} gagal`,
    );
  }

  const hijriah = await reminder.kirimReminderHijriah({
    waktu,
    hariIni,
    dalamHari: 3,
    pengurusIds: adminIds,
    kirim: kirimTelegram,
  });
  if (hijriah.itemDiproses > 0) {
    console.log(
      `[${waktu}] reminder hijriah: ${hijriah.itemDiproses} bulan, ` +
        `${hijriah.pesanTerkirim} terkirim, ${hijriah.gagal} gagal`,
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
