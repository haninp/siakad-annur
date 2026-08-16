/**
 * Bot wali — status tagihan + pengajuan pembayaran (RFC-004/005/006/008).
 *
 * Alur (RFC-006): /start langsung menampilkan RINGKASAN AGREGAT semua anak,
 * tombol "📋 Detail tagihan" → detail per anak.
 *
 * Alur bayar (RFC-008): "💳 Bayar tagihan" → pilih anak → pilih tagihan →
 * pilih metode → (tunai: WAJIB ketik nama penerima) → upload foto bukti →
 * konfirmasi → `ajukanUsulan` (core) → menunggu verifikasi bendahara.
 * Bukti TIDAK disimpan di disk — cukup `file_id` Telegram (keputusan Hani).
 *
 * Hak tulis bertambah (RFC-008, amandemen ADR 0009): hanya `ajukanUsulan`
 * dari `pembayaran-verifikasi` — selain itu tetap baca-saja penuh.
 *
 * Menjalankan:  npm run bot:wali
 */
import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { buatBot } from '@siakad/bot';
import { formatStatusPembayaran, statusPembayaran } from '@siakad/core';
import { buatHandlerUndangan, buatHandlerVerifikasiPembayaran } from '@siakad/core';
import { bukaBasisData } from '@siakad/db';
import type { Keringanan } from '@siakad/contracts';
import {
  buatDukunganTransaksi,
  repoAlokasiProta,
  repoKeringanan,
  repoKomponenBiaya,
  repoLebihBayar,
  repoPembayaran,
  repoPemakaianLebihBayar,
  repoPendaftaran,
  repoPenggunaTelegram,
  repoProta,
  repoRombel,
  repoSantri,
  repoSantriWali,
  repoTagihan,
  repoTarifKomponen,
  repoTahunAjaran,
  repoUsulanPembayaran,
  repoWali,
} from '@siakad/db';
import { buatHandlerKeuangan } from '@siakad/core';

const token = process.env.TELEGRAM_TOKEN_WALI;
if (!token) {
  console.error('TELEGRAM_TOKEN_WALI belum diisi di .env');
  process.exit(1);
}

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });

/**
 * DEV bootstrap: pemetaan telegram_id → wali SPESIFIK via `DEV_WALI_BINDING`
 * (format: `id1=Nama Wali,id2=Nama Wali`). Tiap ID mewakili satu wali yang
 * jelas — simulasi realistis. Penggantinya: pengguna_telegram + undangan.
 */
const devWaliBinding = new Map<number, string>();
for (const pasangan of (process.env.DEV_WALI_BINDING ?? '').split(',')) {
  const [idTeks, nama] = pasangan.split('=');
  const id = Number(idTeks?.trim());
  if (Number.isInteger(id) && nama?.trim()) {
    devWaliBinding.set(id, nama.trim());
  }
}

const depKeuangan = {
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
};
const keuangan = buatHandlerKeuangan(depKeuangan);
const verifikasi = buatHandlerVerifikasiPembayaran({
  ...depKeuangan,
  repoUsulanPembayaran: repoUsulanPembayaran(db),
  repoSantriWali: repoSantriWali(db),
  keuangan,
});
const undangan = buatHandlerUndangan({
  repoPenggunaTelegram: repoPenggunaTelegram(db),
  repoWali: repoWali(db),
});

const bot = buatBot({ token });

const ZONA = 'Asia/Jakarta';

const periodeSekarang = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

const tanggalSekarang = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ── state pengajuan bayar (in-memory, sesi singkat — hilang saat restart) ────

interface StateBayar {
  waliId: string;
  santriId: string;
  tagihanId: string;
  nominal: number;
  metode: 'tunai' | 'transfer' | 'qris';
  namaPenerima: string | null;
  buktiFileId: string | null;
  buktiTipe: string | null;
  step: 'tunggu-nama' | 'tunggu-bukti' | 'konfirmasi';
}
const stateBayar = new Map<number, StateBayar>();

// ── akses data (baca) ────────────────────────────────────────────────────────

interface SantriWali {
  id: string;
  nis: string | null;
  nama_lengkap: string;
}

function waliUntuk(telegramId: number | undefined) {
  if (telegramId === undefined) return undefined;
  // Sumber kebenaran (RFC-009): pengguna_telegram — wali yang mendaftar lewat undangan.
  const terdaftar = repoPenggunaTelegram(db).cariByTelegramId(telegramId);
  if (terdaftar?.peran === 'wali' && terdaftar.wali_id) {
    const wali = db
      .prepare(`SELECT id, nama_lengkap FROM wali WHERE id = ?`)
      .get(terdaftar.wali_id) as { id: string; nama_lengkap: string } | undefined;
    if (wali) return wali;
  }
  // Fallback DEV (DEV_WALI_BINDING) — simulasi pengembangan sampai wali nyata terdaftar.
  const nama = devWaliBinding.get(telegramId);
  if (!nama) return undefined;
  return db
    .prepare(`SELECT id, nama_lengkap FROM wali WHERE nama_lengkap = ?`)
    .get(nama) as { id: string; nama_lengkap: string } | undefined;
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

// ── tampilan (kosakata tegas RFC-005) ────────────────────────────────────────

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

function statusTagihan(t: BarisTagihan) {
  return statusPembayaran({
    statusTagihan: t.status as 'terbit' | 'lunas' | 'dibatalkan',
    nominal: t.nominal,
    keringanan: keringananTagihan(t.id),
    pembayaran: pembayaranTagihan(t.id),
  });
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

/** Baris ringkas untuk tampilan agregat. */
function ringkasanStatus(t: BarisTagihan): string {
  const st = statusTagihan(t);
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

/** Ada usulan diajukan untuk tagihan ini? → tampil "⏳ MENUNGGU VERIFIKASI". */
function usulanDiajukan(tagihanId: string): boolean {
  return (
    db
      .prepare(`SELECT 1 FROM usulan_pembayaran WHERE tagihan_id = ? AND status = 'diajukan'`)
      .get(tagihanId) !== undefined
  );
}

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
    const rincian = tagihan.map((t) => {
      const dasar = `• ${ringkasanStatus(t)}`;
      return usulanDiajukan(t.id) ? `${dasar}\n   ⏳ MENUNGGU VERIFIKASI` : dasar;
    });
    baris.push(`👤 ${s.nama_lengkap}\n   ${rincian.join('\n   ')}`);
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
    .text('💳 Bayar tagihan', 'menu:bayar')
    .row()
    .text('🔄 Perbarui', 'menu:utama');
}

function pemilihSantri(aksi: 'detail' | 'bayar', daftar: SantriWali[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of daftar) {
    kb.text(s.nama_lengkap, `${aksi}:${s.id}`).row();
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

// Whitelist (RFC-004, diperluas RFC-009): wali terdaftar boleh semua;
// /start bebas — itulah jalur pendaftaran (dengan kode undangan).
bot.use(async (ctx, next) => {
  if (waliUntuk(ctx.from?.id)) return next();
  const teks = ctx.message?.text ?? '';
  if (teks.startsWith('/start')) return next();
  if (ctx.callbackQuery) {
    await ctx
      .answerCallbackQuery({ text: 'Maaf, akun Anda belum terdaftar sebagai wali.' })
      .catch(() => undefined);
    return;
  }
  await ctx.reply('Maaf, akun Anda belum terdaftar sebagai wali.').catch(() => undefined);
});

bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  let wali = waliUntuk(telegramId);
  if (wali) {
    await ctx.reply(`Assalamualaikum, Bapak/Ibu ${wali.nama_lengkap}.\n\n${teksRingkasan(wali)}`, {
      reply_markup: menuUtama(),
    });
    return;
  }

  const kode = (ctx.match ?? '').toString().trim();
  if (!kode) {
    await ctx.reply(
      'Assalamualaikum. Akun Anda belum terdaftar sebagai wali.\n\n' +
        'Buka LINK UNDANGAN yang dikirim pengurus (contoh: https://t.me/rtq_annur_bot?start=undang-XXXXXX).\n' +
        'Atau kirim manual: /start <kode undangan>',
    );
    return;
  }

  const hasil = undangan.gunakanUndangan({ telegramId, kode });
  if (!hasil.ok) {
    await ctx.reply(hasil.pesan ?? 'Pendaftaran gagal. Coba lagi.');
    return;
  }
  wali = waliUntuk(telegramId);
  if (!wali) {
    await ctx.reply('Pendaftaran berhasil. Kirim /start untuk melihat tagihan.');
    return;
  }
  await ctx.reply(
    `Assalamualaikum, Bapak/Ibu ${wali.nama_lengkap}. Pendaftaran berhasil.\n\n${teksRingkasan(wali)}`,
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
    await ganti(ctx, 'Tidak ada santri yang tertaut pada akun Anda.', tombolKembali());
    return;
  }
  await ganti(ctx, 'Detail tagihan siapa?', pemilihSantri('detail', daftar));
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

// ── alur bayar (RFC-008) ──────────────────────────────────────────────────────

bot.callbackQuery('menu:bayar', async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const daftar = santriWali(wali.id);
  if (daftar.length === 0) {
    await ganti(ctx, 'Tidak ada santri yang tertaut pada akun Anda.', tombolKembali());
    return;
  }
  await ganti(ctx, 'Bayar tagihan untuk siapa?', pemilihSantri('bayar', daftar));
});

bot.callbackQuery(/^bayar:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const santriId = ctx.match[1];
  if (!santriId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const santri = santriWali(wali.id).find((s) => s.id === santriId);
  if (!santri) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  // tagihan yang masih bisa dibayar: terbit + belum ada usulan diajukan
  const tagihan = tagihanSantri(santri.id).filter((t) => {
    if (t.status !== 'terbit') return false;
    const st = statusTagihan(t);
    if (st.status === 'sudah_bayar') return false;
    return !usulanDiajukan(t.id);
  });
  if (tagihan.length === 0) {
    await ganti(
      ctx,
      `${santri.nama_lengkap} tidak punya tagihan yang perlu dibayar.\n\nTagihan yang sudah lunas atau sedang menunggu verifikasi tidak bisa diajukan lagi.`,
      new InlineKeyboard()
        .text('👈 Pilih santri lain', 'menu:bayar')
        .text('🏠 Menu utama', 'menu:utama'),
    );
    return;
  }
  const kb = new InlineKeyboard();
  for (const t of tagihan) {
    const st = statusTagihan(t);
    const sisa = st.status === 'belum_bayar' || st.status === 'bayar_sebagian' ? st.sisa : t.nominal;
    kb.text(`${t.komponen_nama} ${t.periode} — ${rupiah(sisa)}`, `bayar-tagihan:${t.id}:${sisa}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  await ganti(ctx, `Pilih tagihan ${santri.nama_lengkap} yang ingin dibayar:`, kb);
});

bot.callbackQuery(/^bayar-tagihan:(.+):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const tagihanId = ctx.match[1];
  if (!tagihanId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const nominal = Number(ctx.match[2]);
  const santriId = (db.prepare(`SELECT santri_id FROM tagihan WHERE id = ?`).get(tagihanId) as
    | { santri_id: string }
    | undefined)?.santri_id;
  if (!santriId || !santriWali(wali.id).some((s) => s.id === santriId)) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const kb = new InlineKeyboard()
    .text('💵 Tunai', `bayar-metode:${tagihanId}:${nominal}:tunai`)
    .text('🏦 Transfer', `bayar-metode:${tagihanId}:${nominal}:transfer`)
    .text('📱 QRIS', `bayar-metode:${tagihanId}:${nominal}:qris`)
    .row()
    .text('🏠 Menu utama', 'menu:utama');
  await ganti(ctx, `Pilih metode pembayaran ${rupiah(nominal)}:`, kb);
});

bot.callbackQuery(/^bayar-metode:(.+):(\d+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const wali = waliUntuk(ctx.from?.id);
  if (!wali) return;
  const metode = ctx.match[3] as 'tunai' | 'transfer' | 'qris';
  const tagihanId = ctx.match[1];
  if (!metode || !tagihanId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const nominal = Number(ctx.match[2]);
  const santriId = (db.prepare(`SELECT santri_id FROM tagihan WHERE id = ?`).get(tagihanId) as
    | { santri_id: string }
    | undefined)?.santri_id;
  if (!santriId || !santriWali(wali.id).some((s) => s.id === santriId)) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }

  if (metode === 'tunai') {
    stateBayar.set(ctx.from!.id, {
      waliId: wali.id,
      santriId,
      tagihanId,
      nominal,
      metode,
      namaPenerima: null,
      buktiFileId: null,
      buktiTipe: null,
      step: 'tunggu-nama',
    });
    await ganti(
      ctx,
      `Pembayaran tunai ${rupiah(nominal)}.\n\n` +
        `Ketik nama penerima uang (siapa yang menerima pembayaran), lalu kirim.`,
      tombolBatal(),
    );
    return;
  }

  stateBayar.set(ctx.from!.id, {
    waliId: wali.id,
    santriId,
    tagihanId,
    nominal,
    metode,
    namaPenerima: null,
    buktiFileId: null,
    buktiTipe: null,
    step: 'tunggu-bukti',
  });
  await ganti(
    ctx,
    `Metode ${metode.toUpperCase()} ${rupiah(nominal)}.\n\nKirim FOTO bukti pembayaran (struk transfer / screenshot QRIS).`,
    tombolBatal(),
  );
});

function tombolBatal(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Batal', 'menu:utama');
}

// teks bebas → nama penerima (cash)
bot.on('message:text', async (ctx) => {
  const st = stateBayar.get(ctx.from?.id ?? -1);
  if (!st || st.step !== 'tunggu-nama') return;
  const nama = (ctx.message.text ?? '').trim();
  if (!nama) {
    await ctx.reply('Nama penerima tidak boleh kosong. Ketik nama penerima uang.');
    return;
  }
  st.namaPenerima = nama;
  st.step = 'tunggu-bukti';
  stateBayar.set(ctx.from!.id, st);
  await ctx.reply(`Nama penerima: ${nama}.\n\nSekarang kirim FOTO bukti pembayaran tunai.`, {
    reply_markup: tombolBatal(),
  });
});

// foto bukti
bot.on('message:photo', async (ctx) => {
  const st = stateBayar.get(ctx.from?.id ?? -1);
  if (!st || st.step !== 'tunggu-bukti') return;
  const foto = ctx.message.photo?.at(-1);
  if (!foto) return;
  st.buktiFileId = foto.file_id;
  st.buktiTipe = 'image/jpeg';
  st.step = 'konfirmasi';
  stateBayar.set(ctx.from!.id, st);

  const metodeLabel = st.metode === 'tunai' ? 'Tunai' : st.metode.toUpperCase();
  const kb = new InlineKeyboard()
    .text('✅ Kirim pengajuan', 'bayar-kirim')
    .text('❌ Batal', 'menu:utama');
  await ctx.reply(
    `Ringkasan pengajuan:\n\n` +
      `• Tagihan: ${rupiah(st.nominal)}\n` +
      `• Metode: ${metodeLabel}${st.namaPenerima ? `\n• Penerima: ${st.namaPenerima}` : ''}\n` +
      `• Bukti: foto terlampir ✅\n\n` +
      `Kirim pengajuan ke bendahara?`,
    { reply_markup: kb },
  );
});

bot.callbackQuery('bayar-kirim', async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.from?.id ?? -1;
  const st = stateBayar.get(chatId);
  if (!st || st.step !== 'konfirmasi' || !st.buktiFileId) {
    await ganti(ctx, 'Sesi pengajuan tidak ditemukan atau sudah kedaluwarsa. Mulai dari /start.');
    return;
  }
  const hasil = verifikasi.ajukanUsulan({
    aktor: { peran: 'wali', id: st.waliId },
    tagihanId: st.tagihanId,
    santriId: st.santriId,
    nominal: st.nominal,
    tanggalBayar: tanggalSekarang(),
    metode: st.metode,
    namaPenerima: st.namaPenerima,
    buktiFileId: st.buktiFileId,
    buktiTipe: st.buktiTipe ?? 'image/jpeg',
    catatan: null,
    waktu: new Date().toISOString(),
  });
  stateBayar.delete(chatId);
  await ganti(ctx, hasil.pesan ?? 'Selesai.', tombolKembali());
});

// callback tak dikenal / kedaluwarsa
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Menu ini sudah kedaluwarsa. Kirim /start untuk menu baru.' });
});

bot.start();
