/**
 * Bot internal — uji coba keuangan (RFC-001) + menu tombol (RFC-002).
 *
 * Alur utama: /mulai → menu tombol (inline keyboard). Pemilihan santri dan
 * konfirmasi tulis semuanya lewat tombol; perintah teks RFC-001 tetap ada
 * sebagai fallback (dan untuk nominal custom).
 *
 * Desain: stateless — seluruh state di-carry di callback_data (≤64 byte),
 * satu pesan diedit sepanjang alur (editMessageText).
 *
 * Whitelist admin: ADMIN_TELEGRAM_IDS di .env (comma-separated).
 * Izin & aturan tetap lewat buatHandlerKeuangan di packages/core (AGENTS.md).
 *
 * Menjalankan:  npm run bot:internal
 */
import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { buatBot } from '@siakad/bot';
import { buatHandlerKeuangan, hitungKeringananEffektif } from '@siakad/core';
import type { Keringanan } from '@siakad/contracts';
import {
  bukaBasisData,
  buatDukunganTransaksi,
  repoAlokasiProta,
  repoKeringanan,
  repoKomponenBiaya,
  repoLebihBayar,
  repoPembayaran,
  repoPemakaianLebihBayar,
  repoPendaftaran,
  repoProta,
  repoRombel,
  repoSantri,
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
} from '@siakad/db';

const token = process.env.TELEGRAM_TOKEN_INTERNAL;
if (!token) {
  console.error('TELEGRAM_TOKEN_INTERNAL belum diisi di .env');
  process.exit(1);
}

const adminIds = new Set(
  (process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n)),
);

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });
const keuangan = buatHandlerKeuangan({
  repoTagihan: repoTagihan(db),
  repoTarifKomponen: repoTarifKomponen(db),
  repoKomponenBiaya: repoKomponenBiaya(db),
  repoSantri: repoSantri(db),
  repoPendaftaran: repoPendaftaran(db),
  repoRombel: repoRombel(db),
  repoTahunAjaran: repoTahunAjaran(db),
  repoKeringanan: repoKeringanan(db),
  repoPembayaran: repoPembayaran(db),
  repoProta: repoProta(db),
  repoAlokasiProta: repoAlokasiProta(db),
  repoLebihBayar: repoLebihBayar(db),
  repoPemakaianLebihBayar: repoPemakaianLebihBayar(db),
  transaksi: buatDukunganTransaksi(db),
});

const bot = buatBot({ token });

const ZONA = 'Asia/Jakarta';

const tanggalSekarang = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const periodeSekarang = (): string => tanggalSekarang().slice(0, 7);

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function adminAktif(id: number | undefined): boolean {
  return id !== undefined && adminIds.has(id);
}

// ── akses data ────────────────────────────────────────────────────────────────

interface BarisSantri {
  id: string;
  nis: string | null;
  nama_lengkap: string;
}

function santriAktif(): BarisSantri[] {
  return db
    .prepare(
      `SELECT s.id, s.nis, s.nama_lengkap FROM santri s
       JOIN pendaftaran p ON p.santri_id = s.id
       WHERE p.status = 'aktif' ORDER BY s.nama_lengkap`,
    )
    .all() as unknown as BarisSantri[];
}

function cariSantri(nis: string): BarisSantri | undefined {
  return santriAktif().find((s) => s.nis === nis);
}

function komponenSpp() {
  return repoKomponenBiaya(db).ambilSemua().find((k) => k.kode === 'spp');
}

function tahunAjaranAktif() {
  return repoTahunAjaran(db).ambilSemua().find((t) => t.aktif);
}

// ── logika aksi (dipakai perintah teks & tombol) ─────────────────────────────

function terbitkanTagihan(santri: BarisSantri, actorId: string) {
  const komponen = komponenSpp();
  if (!komponen) return { ok: false as const, pesan: 'Komponen biaya SPP belum diatur. Hubungi pengurus.' };
  const tahunAjaran = tahunAjaranAktif();
  if (!tahunAjaran) return { ok: false as const, pesan: 'Belum ada tahun ajaran yang aktif.' };
  return keuangan.terbitkanTagihan({
    aktor: { peran: 'pengurus', id: actorId },
    santriId: santri.id,
    komponenBiayaId: komponen.id,
    tahunAjaranId: tahunAjaran.id,
    periode: periodeSekarang(),
    skemaPeriode: 'masehi',
    waktu: new Date().toISOString(),
  });
}

function catatPembayaran(santri: BarisSantri, nominal: number, actorId: string) {
  const tagihan = db
    .prepare(
      `SELECT id FROM tagihan
       WHERE santri_id = ? AND status = 'terbit'
       ORDER BY periode DESC, jatuh_tempo DESC LIMIT 1`,
    )
    .get(santri.id) as { id: string } | undefined;
  if (!tagihan) {
    return { ok: false as const, pesan: `${santri.nama_lengkap} tidak punya tagihan yang belum lunas.` };
  }
  return keuangan.catatPembayaran({
    aktor: { peran: 'pengurus', id: actorId },
    tagihanId: tagihan.id,
    tanggal: tanggalSekarang(),
    nominal,
    metode: 'tunai',
    sumber: 'wali',
    sebagaiCicilan: true,
    waktu: new Date().toISOString(),
  });
}

function teksStatus(santri: BarisSantri): string {
  const tagihan = db
    .prepare(
      `SELECT id, periode, nominal, status FROM tagihan
       WHERE santri_id = ? ORDER BY periode DESC LIMIT 6`,
    )
    .all(santri.id) as { id: string; periode: string; nominal: number; status: string }[];
  if (tagihan.length === 0) {
    return `${santri.nama_lengkap} belum punya tagihan.`;
  }
  const baris = tagihan.map((t) => {
    const keringanan = db
      .prepare(`SELECT nominal, persentase FROM keringanan WHERE tagihan_id = ?`)
      .all(t.id) as Keringanan[];
    const potongan = hitungKeringananEffektif(keringanan, t.nominal);
    const sudahBayar = (
      db
        .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM pembayaran WHERE tagihan_id = ?`)
        .get(t.id) as { n: number }
    ).n;
    const sisa = t.nominal - potongan - sudahBayar;
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
    `Tagihan ${santri.nama_lengkap}${santri.nis ? ` (NIS ${santri.nis})` : ''}:\n` +
    baris.map((b) => `• ${b}`).join('\n') +
    `\n\nSaldo lebih bayar: ${rupiah(lebihBayar)}`
  );
}

// ── menu & tombol (RFC-002) ──────────────────────────────────────────────────

const TEKS_MENU =
  '🏫 SIAKAD An-Nuur — Menu Uji Coba\n\n' +
  'Pilih menu di bawah, atau ketik perintah langsung:\n' +
  '/tagihan <nis> · /bayar <nis> <nominal> · /status <nis>';

function menuUtama(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Status tagihan', 'menu:status')
    .text('🧾 Terbitkan SPP', 'menu:terbit')
    .row()
    .text('💰 Bayar', 'menu:bayar');
}

function pemilihSantri(aksi: 'status' | 'terbit' | 'bayar'): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of santriAktif()) {
    kb.text(`${s.nama_lengkap}${s.nis ? ` (${s.nis})` : ''}`, `${aksi}:${s.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  return kb;
}

function tombolMenu(): InlineKeyboard {
  return new InlineKeyboard().text('🏠 Menu utama', 'menu:utama');
}

function actorId(ctx: { from?: { id?: number } | undefined }): string {
  return `tg-${ctx.from?.id ?? '?'}`;
}

/** Edit pesan menu; abaikan galat "message is not modified" (tombol ditekan dua kali). */
async function ganti(
  ctx: CallbackQueryContext<Context>,
  teks: string,
  kb?: InlineKeyboard,
): Promise<void> {
  try {
    await ctx.editMessageText(teks, kb ? { reply_markup: kb } : undefined);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : '';
    if (!pesan.includes('message is not modified')) throw e;
  }
}

// Whitelist (RFC-001): hanya /mulai yang bebas; sisanya butuh admin terdaftar.
bot.use(async (ctx, next) => {
  if (adminAktif(ctx.from?.id)) return next();
  const teks = ctx.message?.text ?? '';
  if (teks.startsWith('/mulai')) return next();
  if (ctx.callbackQuery) {
    await ctx
      .answerCallbackQuery({ text: 'Maaf, bot ini masih dalam uji coba terbatas.' })
      .catch(() => undefined);
    return;
  }
  await ctx.reply('Maaf, bot ini masih dalam uji coba terbatas.').catch(() => undefined);
});

bot.command('mulai', async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(
    `Assalamualaikum, selamat datang di bot internal SIAKAD An-Nuur.\n` +
      `ID Telegram Anda: ${id} — ` +
      (adminAktif(id) ? 'terdaftar sebagai admin uji coba.' : 'belum terdaftar.') +
      `\n\n${TEKS_MENU}`,
    { reply_markup: menuUtama() },
  );
});

// ── menu utama ────────────────────────────────────────────────────────────────

bot.callbackQuery('menu:utama', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, TEKS_MENU, menuUtama());
});

bot.callbackQuery('menu:status', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, 'Pilih santri:', pemilihSantri('status'));
});

bot.callbackQuery('menu:terbit', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, 'Terbitkan SPP untuk siapa?', pemilihSantri('terbit'));
});

bot.callbackQuery('menu:bayar', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, 'Bayar tagihan siapa?', pemilihSantri('bayar'));
});

// ── status ────────────────────────────────────────────────────────────────────

bot.callbackQuery(/^status:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  await ganti(ctx, teksStatus(santri), tombolMenu());
});

// ── terbitkan tagihan ─────────────────────────────────────────────────────────

bot.callbackQuery(/^terbit:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  await ganti(ctx, `Terbitkan tagihan SPP bulan ini untuk ${santri.nama_lengkap}?`, 
    new InlineKeyboard()
      .text('✅ Ya, terbitkan', `terbit-ya:${santri.id}`)
      .text('❌ Batal', 'menu:utama'));
});

bot.callbackQuery(/^terbit-ya:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  const hasil = terbitkanTagihan(santri, actorId(ctx));
  await ganti(ctx, hasil.pesan ?? 'Selesai.', tombolMenu());
});

// ── bayar ─────────────────────────────────────────────────────────────────────

bot.callbackQuery(/^bayar:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  const kb = new InlineKeyboard();
  for (const nominal of [150_000, 250_000, 450_000]) {
    kb.text(rupiah(nominal), `bayar-jml:${santri.id}:${nominal}`);
  }
  kb.row().text('🏠 Menu utama', 'menu:utama');
  await ganti(ctx, `Pilih nominal pembayaran untuk ${santri.nama_lengkap}:`, kb);
});

bot.callbackQuery(/^bayar-jml:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  const nominal = Number(ctx.match[2]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  await ganti(
    ctx,
    `Catat pembayaran ${rupiah(nominal)} untuk ${santri.nama_lengkap}?`,
    new InlineKeyboard()
      .text('✅ Ya, catat', `bayar-ya:${santri.id}:${nominal}`)
      .text('❌ Batal', 'menu:utama'),
  );
});

bot.callbackQuery(/^bayar-ya:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const santri = santriAktif().find((s) => s.id === ctx.match[1]);
  const nominal = Number(ctx.match[2]);
  if (!santri) {
    await ganti(ctx, 'Data santri tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /mulai.');
    return;
  }
  const hasil = catatPembayaran(santri, nominal, actorId(ctx));
  await ganti(ctx, hasil.pesan ?? 'Selesai.', tombolMenu());
});

// ── perintah teks (fallback RFC-001) ─────────────────────────────────────────

bot.command('tagihan', async (ctx) => {
  const nis = ctx.match.trim();
  if (!nis) {
    await ctx.reply('Gunakan: /tagihan <nis>. Contoh: /tagihan 2627001', { reply_markup: tombolMenu() });
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`, { reply_markup: tombolMenu() });
    return;
  }
  const hasil = terbitkanTagihan(santri, actorId(ctx));
  await ctx.reply(hasil.pesan ?? 'Selesai.', { reply_markup: tombolMenu() });
});

bot.command('bayar', async (ctx) => {
  const [nis, nominalTeks] = ctx.match.trim().split(/\s+/);
  if (!nis || !nominalTeks) {
    await ctx.reply('Gunakan: /bayar <nis> <nominal>. Contoh: /bayar 2627001 150000', {
      reply_markup: tombolMenu(),
    });
    return;
  }
  const nominal = Number(nominalTeks);
  if (!Number.isInteger(nominal) || nominal <= 0) {
    await ctx.reply('Nominal harus angka bulat positif.', { reply_markup: tombolMenu() });
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`, { reply_markup: tombolMenu() });
    return;
  }
  const hasil = catatPembayaran(santri, nominal, actorId(ctx));
  await ctx.reply(hasil.pesan ?? 'Selesai.', { reply_markup: tombolMenu() });
});

bot.command('status', async (ctx) => {
  const nis = ctx.match.trim();
  if (!nis) {
    await ctx.reply('Gunakan: /status <nis>. Contoh: /status 2627001', { reply_markup: tombolMenu() });
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`, { reply_markup: tombolMenu() });
    return;
  }
  await ctx.reply(teksStatus(santri), { reply_markup: tombolMenu() });
});

// callback tak dikenal / kedaluwarsa
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Menu ini sudah kedaluwarsa. Kirim /mulai untuk menu baru.' });
});

bot.start();
