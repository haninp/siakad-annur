/**
 * Bot wali — status tagihan baca-saja (RFC-004).
 *
 * Baca-saja PENUH: tidak meng-import satu pun handler tulis dari core
 * (lebih ketat dari minimum ADR 0009/0010). Yang dipakai hanya query baca
 * dan aturan murni hitungKeringananEffektif.
 *
 * Binding sementara (dev bootstrap): DEV_WALI_TELEGRAM_IDS di .env memetakan
 * ID Telegram ke wali dengan tautan aktif terbanyak. Penggantinya: tabel
 * pengguna_telegram + deep link undangan (docs/04).
 *
 * Menjalankan:  npm run bot:wali
 */
import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { buatBot } from '@siakad/bot';
import { hitungKeringananEffektif } from '@siakad/core';
import { bukaBasisData } from '@siakad/db';
import type { Keringanan } from '@siakad/contracts';

const token = process.env.TELEGRAM_TOKEN_WALI;
if (!token) {
  console.error('TELEGRAM_TOKEN_WALI belum diisi di .env');
  process.exit(1);
}

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });

const devWaliIds = new Set(
  (process.env.DEV_WALI_TELEGRAM_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n)),
);

const bot = buatBot({ token });

const ZONA = 'Asia/Jakarta';

const periodeSekarang = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ── akses data (hanya baca) ───────────────────────────────────────────────────

interface SantriWali {
  id: string;
  nis: string | null;
  nama_lengkap: string;
}

/**
 * DEV bootstrap: ID Telegram di DEV_WALI_TELEGRAM_IDS dipetakan ke wali dengan
 * tautan aktif terbanyak. Ini SATU-SATUNYA bagian yang menebak — digantikan
 * pengguna_telegram + undangan (docs/04) saat tabelnya ada.
 */
function waliUntuk(telegramId: number | undefined) {
  if (telegramId === undefined || !devWaliIds.has(telegramId)) return undefined;
  return db
    .prepare(
      `SELECT w.id, w.nama_lengkap FROM wali w
       JOIN santri_wali ws ON ws.wali_id = w.id AND ws.aktif = 1
       GROUP BY w.id ORDER BY COUNT(*) DESC LIMIT 1`,
    )
    .get() as { id: string; nama_lengkap: string } | undefined;
}

function santriWali(waliId: string): SantriWali[] {
  return db
    .prepare(
      `SELECT s.id, s.nis, s.nama_lengkap FROM santri_wali ws
       JOIN santri s ON s.id = ws.santri_id
       WHERE ws.wali_id = ? AND ws.aktif = 1
       ORDER BY s.nama_lengkap`,
    )
    .all(waliId) as unknown as SantriWali[];
}

// ── tampilan (baca-saja; pola sama dengan bot-internal, RFC-003) ──────────────

function sisaTagihan(tagihanId: string, nominal: number): number {
  const keringanan = db
    .prepare(`SELECT nominal, persentase FROM keringanan WHERE tagihan_id = ?`)
    .all(tagihanId) as Keringanan[];
  const potongan = hitungKeringananEffektif(keringanan, nominal);
  const sudahBayar = (
    db
      .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM pembayaran WHERE tagihan_id = ?`)
      .get(tagihanId) as { n: number }
  ).n;
  return nominal - potongan - sudahBayar;
}

function teksTagihan(santri: SantriWali): string {
  const tagihan = db
    .prepare(
      `SELECT id, periode, nominal, status FROM tagihan
       WHERE santri_id = ? ORDER BY periode DESC LIMIT 6`,
    )
    .all(santri.id) as unknown as { id: string; periode: string; nominal: number; status: string }[];
  if (tagihan.length === 0) {
    return `${santri.nama_lengkap} belum punya tagihan.`;
  }
  const baris = tagihan.map((t) => {
    const sisa = sisaTagihan(t.id, t.nominal);
    let label: string;
    if (t.status === 'terbit') {
      label = sisa > 0 ? `sisa ${rupiah(sisa)}` : sisa === 0 ? 'lunas' : 'lunas, lebih bayar';
    } else {
      label = t.status;
    }
    return `${t.periode} — ${rupiah(t.nominal)} — ${label}`;
  });
  const lebihBayar = (
    db
      .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM lebih_bayar WHERE santri_id = ?`)
      .get(santri.id) as { n: number }
  ).n;
  return (
    `Tagihan ${santri.nama_lengkap}:\n` +
    baris.map((b) => `• ${b}`).join('\n') +
    `\n\nSaldo lebih bayar: ${rupiah(lebihBayar)}`
  );
}

function teksBulan(santri: SantriWali): string {
  const periode = periodeSekarang();
  const tagihan = db
    .prepare(
      `SELECT id, nominal, status FROM tagihan
       WHERE santri_id = ? AND periode = ? ORDER BY status`,
    )
    .get(santri.id, periode) as { id: string; nominal: number; status: string } | undefined;
  if (!tagihan) {
    return `${santri.nama_lengkap} belum punya tagihan pada ${periode}.`;
  }
  const sisa = sisaTagihan(tagihan.id, tagihan.nominal);
  const status =
    tagihan.status === 'lunas' || sisa <= 0 ? '✅ lunas' : sisa > 0 ? `⏳ sisa ${rupiah(sisa)}` : tagihan.status;
  return `Status ${santri.nama_lengkap} — ${periode}:\n• ${rupiah(tagihan.nominal)} — ${status}`;
}

// ── menu & tombol ─────────────────────────────────────────────────────────────

const TEKS_MENU =
  '🏡 SIAKAD An-Nuur — Bot Wali\n\n' +
  'Lihat status tagihan putra/putri Anda.';

function menuUtama(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Tagihan anak', 'menu:tagihan')
    .text('📊 Status bulan ini', 'menu:bulan');
}

function pemilihSantri(aksi: 'tagihan' | 'bulan', daftar: SantriWali[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of daftar) {
    kb.text(s.nama_lengkap, `${aksi}:${s.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  return kb;
}

function tombolMenu(): InlineKeyboard {
  return new InlineKeyboard().text('🏠 Menu utama', 'menu:utama');
}

async function ganti(ctx: CallbackQueryContext<Context>, teks: string, kb?: InlineKeyboard): Promise<void> {
  try {
    await ctx.editMessageText(teks, kb ? { reply_markup: kb } : undefined);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : '';
    if (!pesan.includes('message is not modified')) throw e;
  }
}

// Whitelist (RFC-004): hanya wali terdaftar di DEV_WALI_TELEGRAM_IDS.
bot.use(async (ctx, next) => {
  if (waliUntuk(ctx.from?.id)) return next();
  if (ctx.callbackQuery) {
    await ctx
      .answerCallbackQuery({ text: 'Maaf, akun Anda belum terdaftar sebagai wali.' })
      .catch(() => undefined);
    return;
  }
  await ctx.reply('Maaf, akun Anda belum terdaftar sebagai wali.').catch(() => undefined);
});

bot.command('mulai', async (ctx) => {
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  await ctx.reply(`Assalamualaikum, Bapak/Ibu ${wali.nama_lengkap}.\n\n${TEKS_MENU}`, {
    reply_markup: menuUtama(),
  });
});

bot.callbackQuery('menu:utama', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, TEKS_MENU, menuUtama());
});

bot.callbackQuery('menu:tagihan', async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const daftar = santriWali(wali.id);
  if (daftar.length === 0) {
    await ganti(ctx, 'Tidak ada santri yang tertaut pada akun Anda.');
    return;
  }
  await ganti(ctx, 'Tagihan siapa yang ingin dilihat?', pemilihSantri('tagihan', daftar));
});

bot.callbackQuery('menu:bulan', async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const daftar = santriWali(wali.id);
  if (daftar.length === 0) {
    await ganti(ctx, 'Tidak ada santri yang tertaut pada akun Anda.');
    return;
  }
  await ganti(ctx, 'Status bulan ini untuk siapa?', pemilihSantri('bulan', daftar));
});

bot.callbackQuery(/^tagihan:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const santri = santriWali(wali.id).find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  await ganti(ctx, teksTagihan(santri), tombolMenu());
});

bot.callbackQuery(/^bulan:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const santri = santriWali(wali.id).find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  await ganti(ctx, teksBulan(santri), tombolMenu());
});

// callback tak dikenal / kedaluwarsa
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Menu ini sudah kedaluwarsa. Kirim /mulai untuk menu baru.' });
});

bot.start();
