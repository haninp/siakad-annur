/**
 * Bot internal — keuangan santri (RFC-001/002/003 + hirarki menu RFC-005).
 *
 * Hirarki menu (RFC-005): Menu Utama → 💰 Keuangan → (👤 Santri | 📊 Rekap | 💰 Piutang)
 *   Santri → pilih komponen (SPP / Uang Modul / Uang Gedung) → pilih santri → rincian.
 * Komponen di-generate dinamis dari tabel komponen_biaya.
 *
 * Kosakata status (SUDAH BAYAR / BAYAR SEBAGIAN / BELUM BAYAR / DIBATALKAN)
 * dan formatnya hidup di packages/core (statusPembayaran/formatStatusPembayaran,
 * RFC-005) — satu sumber untuk bot internal & wali.
 *
 * Alur stateless: state di-carry di callback_data (≤64 byte), satu pesan diedit
 * sepanjang alur. Whitelist admin: ADMIN_TELEGRAM_IDS di .env.
 * Izin & aturan tetap lewat buatHandlerKeuangan di packages/core (AGENTS.md).
 *
 * Menjalankan:  npm run bot:internal
 */
import { InlineKeyboard, type CallbackQueryContext, type Context } from 'grammy';
import { buatBot } from '@siakad/bot';
import {
  buatHandlerKeuangan,
  buatHandlerUndangan,
  buatHandlerVerifikasiPembayaran,
  formatStatusPembayaran,
  statusPembayaran,
  terbitkanTagihanBulanan,
  type StatusPembayaran,
} from '@siakad/core';
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

/** Bendahara (RFC-008) — verifikasi pembayaran; ID di .env (menyusul). */
const bendaharaIds = new Set(
  (process.env.BENDAHARA_TELEGRAM_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n)),
);

const db = bukaBasisData({ lokasi: process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db' });
const dep = {
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
const keuangan = buatHandlerKeuangan(dep);
const verifikasi = buatHandlerVerifikasiPembayaran({
  ...dep,
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
  return id !== undefined && (adminIds.has(id) || bendaharaIds.has(id));
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

function komponenAktif() {
  return repoKomponenBiaya(db).ambilSemua().filter((k) => k.aktif);
}

function komponenById(id: string) {
  return repoKomponenBiaya(db).ambilSemua().find((k) => k.id === id);
}

function komponenSpp() {
  return komponenAktif().find((k) => k.kode === 'spp');
}

function tahunAjaranAktif() {
  return repoTahunAjaran(db).ambilSemua().find((t) => t.aktif);
}

// ── status pembayaran (kosakata tegas RFC-005) ───────────────────────────────

interface BarisTagihan {
  id: string;
  periode: string;
  nominal: number;
  status: string;
  jatuh_tempo: string | null;
  komponen_nama: string;
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

function statusTagihan(t: BarisTagihan): StatusPembayaran {
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

// ── logika aksi (dipakai perintah teks & tombol) ─────────────────────────────

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

/** Status tagihan per santri — semua komponen (tanpa komponenId) atau satu komponen. */
function teksStatus(santri: BarisSantri, komponenId?: string): string {
  const sql = komponenId
    ? `SELECT t.id, t.periode, t.nominal, t.status, t.jatuh_tempo, k.nama AS komponen_nama
       FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
       WHERE t.santri_id = ? AND t.komponen_biaya_id = ? ORDER BY t.periode DESC LIMIT 6`
    : `SELECT t.id, t.periode, t.nominal, t.status, t.jatuh_tempo, k.nama AS komponen_nama
       FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
       WHERE t.santri_id = ? ORDER BY t.periode DESC LIMIT 6`;
  const args = komponenId ? [santri.id, komponenId] : [santri.id];
  const tagihan = db.prepare(sql).all(...args) as unknown as BarisTagihan[];
  if (tagihan.length === 0) {
    return `${santri.nama_lengkap} belum punya tagihan.`;
  }
  const lebihBayar = (
    db
      .prepare(`SELECT COALESCE(SUM(nominal), 0) AS n FROM lebih_bayar WHERE santri_id = ?`)
      .get(santri.id) as { n: number }
  ).n;
  return (
    `Tagihan ${santri.nama_lengkap}${santri.nis ? ` (NIS ${santri.nis})` : ''}:\n\n` +
    tagihan.map((t) => `• ${formatTagihan(t)}`).join('\n\n') +
    `\n\nSaldo: ${rupiah(lebihBayar)}`
  );
}

// ── rekap & piutang per komponen (RFC-003, RFC-005) ──────────────────────────

function teksRekap(komponenId: string): string {
  const periode = periodeSekarang();
  const komponen = komponenById(komponenId);
  const daftar = santriAktif();
  const baris: string[] = [];
  let lunas = 0;
  let belum = 0;
  let tanpa = 0;
  let sisaTotal = 0;

  for (const s of daftar) {
    const tagihan = db
      .prepare(
        `SELECT t.id, t.nominal, t.status, t.jatuh_tempo, k.nama AS komponen_nama
         FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
         WHERE t.santri_id = ? AND t.periode = ? AND t.komponen_biaya_id = ?`,
      )
      .get(s.id, periode, komponenId) as BarisTagihan | undefined;
    if (!tagihan) {
      tanpa += 1;
      baris.push(`• ${s.nama_lengkap} — belum ada tagihan`);
      continue;
    }
    const st = statusTagihan(tagihan);
    if (st.status === 'sudah_bayar') {
      lunas += 1;
      baris.push(`• ${s.nama_lengkap} — ✅ SUDAH BAYAR`);
    } else if (st.status === 'bayar_sebagian') {
      belum += 1;
      sisaTotal += st.sisa;
      baris.push(`• ${s.nama_lengkap} — ⏳ BAYAR SEBAGIAN (sisa ${rupiah(st.sisa)})`);
    } else if (st.status === 'belum_bayar') {
      belum += 1;
      sisaTotal += st.sisa;
      baris.push(`• ${s.nama_lengkap} — ⛔ BELUM BAYAR (${rupiah(st.sisa)})`);
    } else {
      baris.push(`• ${s.nama_lengkap} — DIBATALKAN`);
    }
  }

  return (
    `📊 Rekap ${komponen?.nama ?? 'tagihan'} ${periode}\n\n` +
    baris.join('\n') +
    `\n\n✅ Sudah bayar: ${lunas} · ⛔ Belum lunas: ${belum} · Sisa total: ${rupiah(sisaTotal)}` +
    (tanpa > 0 ? `\nℹ️ Belum ada tagihan: ${tanpa}` : '')
  );
}

function teksPiutang(komponenId: string): string {
  const periode = periodeSekarang();
  const komponen = komponenById(komponenId);
  const baris: string[] = [];
  let piutangBulan = 0;
  let piutangTotal = 0;

  for (const s of santriAktif()) {
    const tagihan = db
      .prepare(
        `SELECT t.id, t.nominal, t.periode, t.status, t.jatuh_tempo, k.nama AS komponen_nama
         FROM tagihan t JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
         WHERE t.santri_id = ? AND t.komponen_biaya_id = ? AND t.status = 'terbit'`,
      )
      .all(s.id, komponenId) as unknown as BarisTagihan[];
    let total = 0;
    for (const t of tagihan) {
      const st = statusTagihan(t);
      if (st.status === 'belum_bayar' || st.status === 'bayar_sebagian') {
        total += st.sisa;
        if (t.periode === periode) piutangBulan += st.sisa;
      }
    }
    if (total > 0) {
      piutangTotal += total;
      baris.push(`• ${s.nama_lengkap} — ${rupiah(total)}`);
    }
  }

  if (baris.length === 0) {
    return `💰 Piutang ${komponen?.nama ?? ''} ${periode}: tidak ada. 🎉`;
  }
  return (
    `💰 Piutang ${komponen?.nama ?? ''}\n\n` +
    baris.join('\n') +
    `\n\nPiutang ${periode}: ${rupiah(piutangBulan)} · Total: ${rupiah(piutangTotal)}`
  );
}

/** Back office via bot — hanya admin (RFC-003). */
function terbitkanBulanan(): string {
  const komponen = komponenSpp();
  const tahunAjaran = tahunAjaranAktif();
  if (!komponen || !tahunAjaran) {
    return 'Komponen biaya SPP atau tahun ajaran aktif belum diatur. Hubungi pengurus.';
  }
  const santri = santriAktif();
  const hasil = terbitkanTagihanBulanan(dep, {
    santri,
    komponenBiayaId: komponen.id,
    tahunAjaranId: tahunAjaran.id,
    periode: periodeSekarang(),
    actorId: 'back-office-bot',
    sudahAda: (santriId) =>
      db
        .prepare(
          `SELECT 1 FROM tagihan WHERE santri_id = ? AND periode = ? AND komponen_biaya_id = ?`,
        )
        .get(santriId, periodeSekarang(), komponen.id) !== undefined,
  });
  return (
    `🧾 Penerbitan tagihan SPP ${hasil.periode} (back office)\n` +
    hasil.rincian.map((r) => `• ${r}`).join('\n') +
    `\n\nDiterbitkan: ${hasil.diterbitkan} · Sudah ada: ${hasil.sudahAda}` +
    (hasil.gagal > 0 ? ` · Gagal: ${hasil.gagal}` : '')
  );
}

// ── menu & tombol (RFC-002, RFC-003, RFC-005) ────────────────────────────────

const TEKS_MENU =
  '🏫 SIAKAD An-Nuur — Menu Pengurus\n\n' +
  'Pilih 💰 Keuangan untuk pembayaran santri.\n' +
  'Perintah: /status <nis> · /rekap · /piutang · (admin) /terbitkan · /undang · /bayar <nis> <nominal>';

function menuUtama(): InlineKeyboard {
  return new InlineKeyboard().text('💰 Keuangan', 'menu:keuangan');
}

function menuKeuangan(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👤 Santri', 'keu:santri')
    .text('📊 Rekap bulan ini', 'keu:rekap')
    .row()
    .text('💰 Piutang', 'keu:piutang')
    .text('💳 Usulan pembayaran', 'keu:usulan')
    .row()
    .text('🏠 Menu utama', 'menu:utama');
}

function pemilihKomponen(aksi: 'ks' | 'kr' | 'kp'): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const k of komponenAktif()) {
    kb.text(k.nama, `${aksi}:${k.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  return kb;
}

function pemilihSantri(komponenId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const s of santriAktif()) {
    kb.text(`${s.nama_lengkap}${s.nis ? ` (${s.nis})` : ''}`, `kss:${komponenId}:${s.id}`).row();
  }
  kb.text('👈 Kembali', 'keu:santri');
  return kb;
}

// ── undangan wali (RFC-009) ──────────────────────────────────────────────────

function waliAktif(): { id: string; nama_lengkap: string }[] {
  return db.prepare(`SELECT id, nama_lengkap FROM wali ORDER BY nama_lengkap`).all() as {
    id: string;
    nama_lengkap: string;
  }[];
}

function pemilihWaliUndangan(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const w of waliAktif()) {
    kb.text(w.nama_lengkap, `undang:pilih:${w.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  return kb;
}

function teksHasilUndangan(hasil: {
  ok: boolean;
  pesan?: string;
  data?: { undangan_kode: string | null } | undefined;
}): string {
  if (!hasil.ok || !hasil.data?.undangan_kode) return hasil.pesan ?? 'Gagal membuat undangan.';
  return (
    `✉️ Undangan berhasil dibuat.\n\n` +
    `Kode: ${hasil.data.undangan_kode}\n\n` +
    `Sampaikan kode ini ke wali. Wali membuka @rtq_annur_bot lalu mengirim:\n` +
    `/start ${hasil.data.undangan_kode}\n\n` +
    `Kode hanya bisa dipakai sekali.`
  );
}

function tombolMenu(): InlineKeyboard {
  return new InlineKeyboard().text('🏠 Menu utama', 'menu:utama');
}

function actorId(ctx: { from?: { id?: number } | undefined }): string {
  return `tg-${ctx.from?.id ?? '?'}`;
}

/** Edit pesan menu; abaikan galat "message is not modified" (tombol ditekan dua kali). */
async function ganti(ctx: CallbackQueryContext<Context>, teks: string, kb?: InlineKeyboard): Promise<void> {
  try {
    await ctx.editMessageText(teks, kb ? { reply_markup: kb } : undefined);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : '';
    if (!pesan.includes('message is not modified')) throw e;
  }
}

// Whitelist (RFC-001): hanya /start yang bebas; sisanya butuh admin terdaftar.
bot.use(async (ctx, next) => {
  if (adminAktif(ctx.from?.id)) return next();
  const teks = ctx.message?.text ?? '';
  if (teks.startsWith('/start')) return next();
  if (ctx.callbackQuery) {
    await ctx
      .answerCallbackQuery({ text: 'Maaf, bot ini masih dalam uji coba terbatas.' })
      .catch(() => undefined);
    return;
  }
  await ctx.reply('Maaf, bot ini masih dalam uji coba terbatas.').catch(() => undefined);
});

bot.command('start', async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(
    `Assalamualaikum, selamat datang di bot internal SIAKAD An-Nuur.\n` +
      `ID Telegram Anda: ${id} — ` +
      (adminAktif(id) ? 'terdaftar sebagai admin uji coba.' : 'belum terdaftar.') +
      `\n\n${TEKS_MENU}`,
    { reply_markup: menuUtama() },
  );
});

// ── navigasi menu ─────────────────────────────────────────────────────────────

bot.callbackQuery('menu:utama', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, TEKS_MENU, menuUtama());
});

bot.callbackQuery('menu:keuangan', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ganti(ctx, '💰 Keuangan — pilih menu:', menuKeuangan());
});

bot.callbackQuery('keu:santri', async (ctx) => {
  await ctx.answerCallbackQuery();
  const komponen = komponenAktif();
  if (komponen.length === 0) {
    await ganti(ctx, 'Belum ada komponen biaya aktif. Hubungi pengurus.');
    return;
  }
  await ganti(ctx, 'Pilih komponen biaya:', pemilihKomponen('ks'));
});

bot.callbackQuery('keu:rekap', async (ctx) => {
  await ctx.answerCallbackQuery();
  const komponen = komponenAktif();
  if (komponen.length === 0) {
    await ganti(ctx, 'Belum ada komponen biaya aktif. Hubungi pengurus.');
    return;
  }
  await ganti(ctx, 'Rekap komponen apa?', pemilihKomponen('kr'));
});

bot.callbackQuery('keu:piutang', async (ctx) => {
  await ctx.answerCallbackQuery();
  const komponen = komponenAktif();
  if (komponen.length === 0) {
    await ganti(ctx, 'Belum ada komponen biaya aktif. Hubungi pengurus.');
    return;
  }
  await ganti(ctx, 'Piutang komponen apa?', pemilihKomponen('kp'));
});

// ── status santri per komponen ────────────────────────────────────────────────

bot.callbackQuery(/^ks:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  if (!id) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const komponen = komponenById(id);
  if (!komponen) {
    await ganti(ctx, 'Komponen tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  await ganti(ctx, `${komponen.nama} — untuk santri siapa?`, pemilihSantri(komponen.id));
});

bot.callbackQuery(/^kss:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const komponenId = ctx.match[1];
  const santriId = ctx.match[2];
  if (!komponenId || !santriId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const komponen = komponenById(komponenId);
  const santri = santriAktif().find((s) => s.id === santriId);
  if (!komponen || !santri) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  await ganti(ctx, teksStatus(santri, komponen.id), tombolMenu());
});

// ── rekap & piutang per komponen ──────────────────────────────────────────────

bot.callbackQuery(/^kr:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  if (!id) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  await ganti(ctx, teksRekap(id), tombolMenu());
});

bot.callbackQuery(/^kp:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  if (!id) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  await ganti(ctx, teksPiutang(id), tombolMenu());
});

// ── perintah teks (fallback) ──────────────────────────────────────────────────

bot.command('terbitkan', async (ctx) => {
  await ctx.reply(terbitkanBulanan(), { reply_markup: tombolMenu() });
});

bot.command('undang', async (ctx) => {
  const daftar = waliAktif();
  if (daftar.length === 0) {
    await ctx.reply('Belum ada wali di data master.', { reply_markup: tombolMenu() });
    return;
  }
  await ctx.reply('Buat undangan untuk wali siapa?', { reply_markup: pemilihWaliUndangan() });
});

bot.callbackQuery('menu:undang', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (waliAktif().length === 0) {
    await ganti(ctx, 'Belum ada wali di data master.');
    return;
  }
  await ganti(ctx, 'Buat undangan untuk wali siapa?', pemilihWaliUndangan());
});

bot.callbackQuery(/^undang:pilih:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const waliId = ctx.match[1];
  if (!waliId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const hasil = undangan.buatUndangan({
    aktor: { peran: 'admin', id: actorId(ctx) },
    waliId,
    waktu: new Date().toISOString(),
  });
  const kb = new InlineKeyboard()
    .text('✉️ Buat undangan lain', 'menu:undang')
    .text('🏠 Menu utama', 'menu:utama');
  await ganti(ctx, teksHasilUndangan(hasil), kb);
});

bot.command('rekap', async (ctx) => {
  const komponen = komponenAktif()[0];
  if (!komponen) {
    await ctx.reply('Belum ada komponen biaya aktif.', { reply_markup: tombolMenu() });
    return;
  }
  await ctx.reply(teksRekap(komponen.id), { reply_markup: tombolMenu() });
});

bot.command('piutang', async (ctx) => {
  const komponen = komponenAktif()[0];
  if (!komponen) {
    await ctx.reply('Belum ada komponen biaya aktif.', { reply_markup: tombolMenu() });
    return;
  }
  await ctx.reply(teksPiutang(komponen.id), { reply_markup: tombolMenu() });
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

// ── alur bendahara: usulan pembayaran (RFC-008) ─────────────────────────────

/** State "tunggu alasan penolakan" — chatId → usulanId (in-memory). */
const stateTolak = new Map<number, string>();

const tokenWali = process.env.TELEGRAM_TOKEN_WALI;

/** Notifikasi ke wali via bot wali (token lokal — pesan datang dari @rtq_annur_bot). */
async function kirimNotifWali(waliId: string, teks: string): Promise<void> {
  if (!tokenWali) return;
  const terdaftar = repoPenggunaTelegram(db).cariByWaliId(waliId);
  const telegramId =
    terdaftar?.telegram_id ?? Number((process.env.DEV_WALI_TELEGRAM_IDS ?? '').split(',')[0]);
  if (!telegramId) return;
  await fetch(`https://api.telegram.org/bot${tokenWali}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramId, text: teks }),
  }).catch(() => undefined);
}

function teksUsulan(u: {
  id: string;
  nominal: number;
  tanggal_bayar: string;
  metode: string;
  nama_penerima: string | null;
  status: string;
  alasan_penolakan: string | null;
}): string {
  const santri = db
    .prepare(
      `SELECT s.nama_lengkap, k.nama AS komponen FROM usulan_pembayaran up
       JOIN santri s ON s.id = up.santri_id
       JOIN tagihan t ON t.id = up.tagihan_id
       JOIN komponen_biaya k ON k.id = t.komponen_biaya_id
       WHERE up.id = ?`,
    )
    .get(u.id) as { nama_lengkap: string; komponen: string };
  return (
    `💳 ${santri.nama_lengkap} — ${santri.komponen}\n` +
    `   • Nominal: ${rupiah(u.nominal)}\n` +
    `   • Tanggal bayar: ${u.tanggal_bayar}\n` +
    `   • Metode: ${u.metode}${u.nama_penerima ? `\n   • Penerima: ${u.nama_penerima}` : ''}`
  );
}

bot.callbackQuery('keu:usulan', async (ctx) => {
  await ctx.answerCallbackQuery();
  const daftar = db
    .prepare(
      `SELECT id, nominal, tanggal_bayar, metode, nama_penerima, status, alasan_penolakan
       FROM usulan_pembayaran WHERE status = 'diajukan' ORDER BY diajukan_pada`,
    )
    .all() as {
    id: string;
    nominal: number;
    tanggal_bayar: string;
    metode: string;
    nama_penerima: string | null;
    status: string;
    alasan_penolakan: string | null;
  }[];
  if (daftar.length === 0) {
    await ganti(ctx, 'Tidak ada usulan pembayaran yang menunggu verifikasi. 🎉', tombolMenu());
    return;
  }
  const kb = new InlineKeyboard();
  for (const u of daftar) {
    kb.text(teksUsulan(u).split('\n')[0] ?? '', `usulan:${u.id}`).row();
  }
  kb.text('🏠 Menu utama', 'menu:utama');
  await ganti(ctx, `💳 ${daftar.length} usulan menunggu verifikasi:\n\n${daftar.map(teksUsulan).join('\n\n')}`, kb);
});

bot.callbackQuery(/^usulan:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const usulanId = ctx.match[1];
  if (!usulanId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const u = db
    .prepare(
      `SELECT id, tagihan_id, nominal, tanggal_bayar, metode, nama_penerima, status, alasan_penolakan
       FROM usulan_pembayaran WHERE id = ?`,
    )
    .get(usulanId) as
    | {
        id: string;
        tagihan_id: string;
        nominal: number;
        tanggal_bayar: string;
        metode: string;
        nama_penerima: string | null;
        status: string;
        alasan_penolakan: string | null;
      }
    | undefined;
  if (!u || u.status !== 'diajukan') {
    await ganti(ctx, 'Usulan tidak ditemukan atau sudah diproses.', tombolMenu());
    return;
  }
  const kb = new InlineKeyboard()
    .text('👁 Lihat bukti', `usulan-bukti:${u.id}`)
    .row()
    .text('✅ Verifikasi', `usulan-ya:${u.id}`)
    .text('❌ Tolak', `usulan-tolak:${u.id}`)
    .row()
    .text('👈 Kembali', 'keu:usulan');
  await ganti(ctx, teksUsulan(u), kb);
});

bot.callbackQuery(/^usulan-bukti:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const usulanId = ctx.match[1];
  if (!usulanId) return;
  const u = db
    .prepare(`SELECT bukti_file_id, bukti_tipe FROM usulan_pembayaran WHERE id = ?`)
    .get(usulanId) as { bukti_file_id: string; bukti_tipe: string } | undefined;
  if (!u) return;
  await ctx.replyWithPhoto(u.bukti_file_id, { caption: '📎 Bukti pembayaran usulan di atas.' }).catch(() =>
    ctx.reply('Bukti tidak bisa ditampilkan (file mungkin sudah kedaluwarsa).'),
  );
});

bot.callbackQuery(/^usulan-ya:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const usulanId = ctx.match[1];
  if (!usulanId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const hasil = verifikasi.verifikasiUsulan({
    aktor: { peran: 'bendahara', id: actorId(ctx) },
    usulanId,
    waktu: new Date().toISOString(),
  });
  await ganti(ctx, hasil.pesan ?? 'Selesai.', tombolMenu());
  if (hasil.ok) {
    const waliId = (db.prepare(`SELECT wali_id FROM usulan_pembayaran WHERE id = ?`).get(usulanId) as
      | { wali_id: string }
      | undefined)?.wali_id;
    if (waliId) await kirimNotifWali(waliId, '✅ Pembayaran Anda telah DITERIMA dan dicatat. Terima kasih!');
  }
});

bot.callbackQuery(/^usulan-tolak:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.from?.id ?? -1;
  const usulanId = ctx.match[1];
  if (!usulanId) {
    await ganti(ctx, 'Data tidak ditemukan. Menu mungkin sudah kedaluwarsa — kirim /start.');
    return;
  }
  const u = db
    .prepare(`SELECT id, status FROM usulan_pembayaran WHERE id = ?`)
    .get(usulanId) as { id: string; status: string } | undefined;
  if (!u || u.status !== 'diajukan') {
    await ganti(ctx, 'Usulan tidak ditemukan atau sudah diproses.', tombolMenu());
    return;
  }
  stateTolak.set(chatId, u.id);
  await ganti(ctx, 'Ketik ALASAN penolakan (wajib). Alasan ini akan dikirim ke wali.', tombolBatalUsulan());
});

function tombolBatalUsulan(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Batal', 'keu:usulan');
}

// teks bebas → alasan penolakan
bot.on('message:text', async (ctx) => {
  const chatId = ctx.from?.id ?? -1;
  const usulanId = stateTolak.get(chatId);
  if (!usulanId) return;
  const alasan = (ctx.message.text ?? '').trim();
  if (!alasan) {
    await ctx.reply('Alasan penolakan tidak boleh kosong.');
    return;
  }
  stateTolak.delete(chatId);
  const hasil = verifikasi.tolakUsulan({
    aktor: { peran: 'bendahara', id: actorId(ctx) },
    usulanId,
    alasan,
    waktu: new Date().toISOString(),
  });
  await ctx.reply(hasil.pesan ?? 'Selesai.', { reply_markup: tombolMenu() });
  if (hasil.ok) {
    const waliId = (db.prepare(`SELECT wali_id FROM usulan_pembayaran WHERE id = ?`).get(usulanId) as
      | { wali_id: string }
      | undefined)?.wali_id;
    if (waliId) await kirimNotifWali(waliId, `❌ Pembayaran Anda DITOLAK.\nAlasan: ${alasan}\nStatus tagihan tetap BELUM BAYAR.`);
  }
});

// callback tak dikenal / kedaluwarsa
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Menu ini sudah kedaluwarsa. Kirim /start untuk menu baru.' });
});

bot.start();
