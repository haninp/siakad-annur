/**
 * Bot wali — status tagihan baca-saja (RFC-004, kosakata tegas RFC-005).
 *
 * Alur (RFC-006, keputusan UX Hani): /start langsung menampilkan RINGKASAN
 * AGREGAT semua anak (status bulan berjalan per anak/komponen), lalu satu
 * tombol "📋 Detail tagihan" → pilih anak → rincian lengkap. Dua menu lama
 * ("Tagihan anak" & "Status bulan ini") yang overlap digabung menjadi satu.
 *
 * Baca-saja PENUH: tidak meng-import satu pun handler tulis dari core
 * (lebih ketat dari minimum ADR 0009/0010). Label status memakai kosakata
 * domain `statusPembayaran`/`formatStatusPembayaran` di core (RFC-005).
 *
 * Binding sementara (dev bootstrap): DEV_WALI_TELEGRAM_IDS di .env memetakan
 * ID Telegram ke wali dengan tautan aktif terbanyak. Penggantinya: tabel
 * pengguna_telegram + deep link undangan (docs/04).
 *
 * Menjalankan:  npm run bot:wali
 */
import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { buatBot } from '@siakad/bot';
import { formatStatusPembayaran, statusPembayaran } from '@siakad/core';
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

// ── tampilan (baca-saja; kosakata tegas RFC-005) ──────────────────────────────

interface BarisTagihan {
  id: string;
  periode: string;
  nominal: number;
  status: string;
  jatuh_tempo: string | null;
  komponen_nama: string;
}

function tagihanSantri(santriId: string, periode?: string): BarisTagihan[] {
  const sql = periode
    ? `SELECT t.id, t.periode, t.nominal, t.status, t.jatuh_tempo, k.nama AS komponen_nama
       FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
       WHERE t.santri_id = ? AND t.periode = ? ORDER BY t.status, t.periode DESC`
    : `SELECT t.id, t.periode, t.nominal, t.status, t.jatuh_tempo, k.nama AS komponen_nama
       FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
       WHERE t.santri_id = ? ORDER BY t.periode DESC LIMIT 6`;
  const args = periode ? [santriId, periode] : [santriId];
  return db.prepare(sql).all(...args) as unknown as BarisTagihan[];
}

function keringananTagihan(tagihanId: string): Keringanan[] {
  return db
    .prepare(`SELECT nominal, persentase FROM keringanan WHERE tagihan_id = ?`)
    .all(tagihanId) as Keringanan[];
}

function pembayaranTagihan(tagihanId: string) {
  return db
    .prepare(`SELECT nominal, tanggal FROM pembayaran WHERE tagihan_id = ? ORDER BY tanggal`)
    .all(tagihanId) as { nominal: number; tanggal: string }[];
}

function formatTagihan(t: BarisTagihan): string {
  const pembayaran = pembayaranTagihan(t.id);
  const st = statusPembayaran({
    statusTagihan: t.status as 'terbit' | 'lunas' | 'dibatalkan',
    nominal: t.nominal,
    keringanan: keringananTagihan(t.id),
    pembayaran,
  });
  return formatStatusPembayaran(st, {
    periode: t.periode,
    jatuhTempo: t.jatuh_tempo,
    pembayaran,
    komponen: t.komponen_nama,
  });
}

/** Baris ringkas untuk tampilan agregat — tanpa jatuh tempo (ada di detail). */
function ringkasanStatus(t: BarisTagihan): string {
  const st = statusPembayaran({
    statusTagihan: t.status as 'terbit' | 'lunas' | 'dibatalkan',
    nominal: t.nominal,
    keringanan: keringananTagihan(t.id),
    pembayaran: pembayaranTagihan(t.id),
  });
  switch (st.status) {
    case 'belum_bayar':
      return `${t.komponen_nama}: BELUM BAYAR (${rupiah(st.nominal)})`;
    case 'bayar_sebagian':
      return `${t.komponen_nama}: BAYAR SEBAGIAN (sisa ${rupiah(st.sisa)})`;
    case 'sudah_bayar':
      return `${t.komponen_nama}: SUDAH BAYAR`;
    case 'dibatalkan':
      return `${t.komponen_nama}: DIBATALKAN`;
  }
}

/** Tampilan utama: ringkasan agregat SEMUA anak di bawah wali (RFC-006). */
function teksRingkasan(wali: { id: string; nama_lengkap: string }): string {
  const periode = periodeSekarang();
  const daftar = santriWali(wali.id);
  if (daftar.length === 0) {
    return 'Tidak ada santri yang tertaut pada akun Anda.';
  }
  const baris: string[] = [];
  for (const s of daftar) {
    const tagihan = tagihanSantri(s.id, periode);
    if (tagihan.length === 0) {
      baris.push(`👤 ${s.nama_lengkap}\n   • belum ada tagihan ${periode}`);
      continue;
    }
    baris.push(`👤 ${s.nama_lengkap}\n   • ${tagihan.map(ringkasanStatus).join('\n   • ')}`);
  }
  return `📊 Status ${periode}:\n\n${baris.join('\n')}`;
}

function teksTagihan(santri: SantriWali): string {
  const tagihan = tagihanSantri(santri.id);
  if (tagihan.length === 0) {
    return `${santri.nama_lengkap} belum punya tagihan.`;
  }
  const lebihBayar = (
    db
      .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM lebih_bayar WHERE santri_id = ?`)
      .get(santri.id) as { n: number }
  ).n;
  return (
    `📋 Tagihan ${santri.nama_lengkap}:\n\n` +
    tagihan.map((t) => `• ${formatTagihan(t)}`).join('\n\n') +
    `\n\nSaldo: ${rupiah(lebihBayar)}`
  );
}

// ── menu & tombol ─────────────────────────────────────────────────────────────

function menuUtama(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Detail tagihan', 'menu:detail')
    .text('🔄 Perbarui', 'menu:utama');
}

function pemilihSantri(daftar: SantriWali[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of daftar) {
    kb.text(s.nama_lengkap, `detail:${s.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  return kb;
}

function tombolKembali(): InlineKeyboard {
  return new InlineKeyboard().text('👈 Kembali ke ringkasan', 'menu:utama');
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

bot.command('start', async (ctx) => {
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  await ctx.reply(
    `Assalamualaikum, Bapak/Ibu ${wali.nama_lengkap}.\n\n${teksRingkasan(wali)}`,
    { reply_markup: menuUtama() },
  );
});

bot.callbackQuery('menu:utama', async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  await ganti(ctx, teksRingkasan(wali), menuUtama());
});

bot.callbackQuery('menu:detail', async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const daftar = santriWali(wali.id);
  if (daftar.length === 0) {
    await ganti(ctx, 'Tidak ada santri yang tertaut pada akun Anda.');
    return;
  }
  await ganti(ctx, 'Detail tagihan siapa?', pemilihSantri(daftar));
});

bot.callbackQuery(/^detail:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const santri = santriWali(wali.id).find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  await ganti(ctx, teksTagihan(santri), tombolKembali());
});

// callback tak dikenal / kedaluwarsa
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Menu ini sudah kedaluwarsa. Kirim /start untuk menu baru.' });
});

bot.start();
