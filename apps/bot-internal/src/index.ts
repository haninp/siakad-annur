/**
 * Bot internal minimal untuk uji coba keuangan — RFC-001.
 *
 * Empat perintah: /mulai, /tagihan <nis>, /bayar <nis> <nominal>, /status <nis>.
 * Whitelist admin: ADMIN_TELEGRAM_IDS di .env (comma-separated).
 * Izin & aturan tetap lewat buatHandlerKeuangan di packages/core — bot tidak
 * menulis aturan sendiri (AGENTS.md).
 *
 * Menjalankan:  npm run bot:internal
 * (node --env-file=.env apps/bot-internal/dist/index.js)
 */
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

function adminAktif(id: number | undefined): boolean {
  return id !== undefined && adminIds.has(id);
}

function cariSantri(nis: string) {
  return repoSantri(db).ambilSemua().find((s) => s.nis === nis);
}

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// Whitelist (RFC-001): hanya /mulai yang bebas; sisanya butuh admin terdaftar.
bot.use(async (ctx, next) => {
  const teks = ctx.message?.text ?? '';
  if (teks.startsWith('/mulai') || adminAktif(ctx.from?.id)) return next();
  await ctx.reply('Maaf, bot ini masih dalam uji coba terbatas.');
});

bot.command('mulai', async (ctx) => {
  const id = ctx.from?.id;
  await ctx.reply(
    'Assalamualaikum, selamat datang di bot internal SIAKAD An-Nuur.\n\n' +
      `ID Telegram Anda: ${id}\n` +
      (adminAktif(id)
        ? 'Anda terdaftar sebagai admin uji coba.'
        : 'Anda belum terdaftar sebagai admin.') +
      '\n\nPerintah uji coba keuangan:\n' +
      '/tagihan <nis> — terbitkan tagihan SPP bulan ini\n' +
      '/bayar <nis> <nominal> — catat pembayaran tagihan yang belum lunas\n' +
      '/status <nis> — rincian tagihan & saldo lebih bayar',
  );
});

bot.command('tagihan', async (ctx) => {
  const nis = ctx.match.trim();
  if (!nis) {
    await ctx.reply('Gunakan: /tagihan <nis>. Contoh: /tagihan 2627001');
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`);
    return;
  }
  const komponen = repoKomponenBiaya(db).ambilSemua().find((k) => k.kode === 'spp');
  if (!komponen) {
    await ctx.reply('Komponen biaya SPP belum diatur. Hubungi pengurus.');
    return;
  }
  const tahunAjaran = repoTahunAjaran(db).ambilSemua().find((t) => t.aktif);
  if (!tahunAjaran) {
    await ctx.reply('Belum ada tahun ajaran yang aktif.');
    return;
  }
  const hasil = keuangan.terbitkanTagihan({
    aktor: { peran: 'pengurus', id: `tg-${ctx.from?.id}` },
    santriId: santri.id,
    komponenBiayaId: komponen.id,
    tahunAjaranId: tahunAjaran.id,
    periode: periodeSekarang(),
    skemaPeriode: 'masehi',
    waktu: new Date().toISOString(),
  });
  await ctx.reply(hasil.pesan ?? 'Selesai.');
});

bot.command('bayar', async (ctx) => {
  const [nis, nominalTeks] = ctx.match.trim().split(/\s+/);
  if (!nis || !nominalTeks) {
    await ctx.reply('Gunakan: /bayar <nis> <nominal>. Contoh: /bayar 2627001 150000');
    return;
  }
  const nominal = Number(nominalTeks);
  if (!Number.isInteger(nominal) || nominal <= 0) {
    await ctx.reply('Nominal harus angka bulat positif.');
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`);
    return;
  }
  const tagihan = db
    .prepare(
      `SELECT id FROM tagihan
       WHERE santri_id = ? AND status = 'terbit'
       ORDER BY periode DESC, jatuh_tempo DESC LIMIT 1`,
    )
    .get(santri.id) as { id: string } | undefined;
  if (!tagihan) {
    await ctx.reply(`${santri.nama_lengkap} tidak punya tagihan yang belum lunas.`);
    return;
  }
  const hasil = keuangan.catatPembayaran({
    aktor: { peran: 'pengurus', id: `tg-${ctx.from?.id}` },
    tagihanId: tagihan.id,
    tanggal: tanggalSekarang(),
    nominal,
    metode: 'tunai',
    sumber: 'wali',
    sebagaiCicilan: true,
    waktu: new Date().toISOString(),
  });
  await ctx.reply(hasil.pesan ?? 'Selesai.');
});

bot.command('status', async (ctx) => {
  const nis = ctx.match.trim();
  if (!nis) {
    await ctx.reply('Gunakan: /status <nis>. Contoh: /status 2627001');
    return;
  }
  const santri = cariSantri(nis);
  if (!santri) {
    await ctx.reply(`Tidak ada santri dengan NIS ${nis}.`);
    return;
  }
  const tagihan = db
    .prepare(
      `SELECT id, periode, nominal, status FROM tagihan
       WHERE santri_id = ? ORDER BY periode DESC LIMIT 6`,
    )
    .all(santri.id) as { id: string; periode: string; nominal: number; status: string }[];
  if (tagihan.length === 0) {
    await ctx.reply(`${santri.nama_lengkap} belum punya tagihan.`);
    return;
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
  await ctx.reply(
    `Tagihan ${santri.nama_lengkap} (NIS ${nis}):\n` +
      baris.map((b) => `• ${b}`).join('\n') +
      `\n\nSaldo lebih bayar: ${rupiah(lebihBayar)}`,
  );
});

bot.start();
