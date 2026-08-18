/**
 * Fungsi format bersama — dipakai oleh aturan izin dan keuangan.
 *
 * Pesan ke pengguna ditulis substantif (AGENTS.md): tanggal, rupiah, dan periode
 * ditampilkan dalam bentuk yang dibaca orang, bukan kode mesin. Semuanya dikumpulkan
 * di sini supaya konvensi penulisan tidak menyimpang antar handler.
 */

const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

/** `2026-08-10` → `10 Agustus 2026`. Wali tidak membaca tanggal ber-format ISO. */
export function tanggalTerbaca(iso: string): string {
  const [tahun, bulan, hari] = iso.split('-');
  const namaBulan = BULAN[Number(bulan) - 1];
  if (tahun === undefined || hari === undefined || namaBulan === undefined) return iso;
  return `${Number(hari)} ${namaBulan} ${tahun}`;
}

/**
 * `Agustus 2026` untuk periode `2026-08` skema Masehi.
 * `1447 Jumadil Akhir` untuk periode Hijriah tak tertanggal — untuk sementara
 * dikembalikan apa adanya; konversi Hijriah menyusul lewat `kalender_hijriah`.
 */
export function formatPeriode(periode: string, skema: 'masehi' | 'hijriah'): string {
  if (skema === 'hijriah') return periode;
  const [tahun, bulan] = periode.split('-');
  const namaBulan = BULAN[Number(bulan) - 1];
  if (tahun === undefined || bulan === undefined || namaBulan === undefined) return periode;
  return `${namaBulan} ${tahun}`;
}

/**
 * `500000` → `Rp 500.000`. Memakai pemisah ribuan titik (konvensi Indonesia,
 * latin tanpa spasi tipografis; ruang sempit di Telegram). Nominal keuangan
 * selalu bilangan bulat (`Uang = int`) dan tak negatif, jadi tidak ada cabang
 * desimal maupun minus.
 */
export function formatRupiah(nominal: number): string {
  const bulat = Math.round(nominal);
  const denganTitik = bulat.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${denganTitik}`;
}

/** `2026-08-10T10:00:00+07:00` → `2026-08-10`. */
export function tanggalDariWaktu(waktu: string): string {
  return waktu.slice(0, 10);
}

// ── MarkdownV2 & spoiler (RFC-013) ──────────────────────────────────────────

/**
 * Escape karakter khusus MarkdownV2 Telegram. Wajib dipanggil SEBELUM teks
 * dirender dengan `parse_mode: MarkdownV2` — teks tanpa escape bisa mematahkan
 * parsing pesan (atau lebih buruk: menyisipkan format yang tidak dikehendaki).
 * Karakter yang di-escape: `_ * [ ] ( ) ~ ` > # + - = | { } . !` dan backslash.
 */
export function escapeMarkdownV2(teks: string): string {
  return teks.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Bungkus teks dalam spoiler MarkdownV2 (`||…||`). Teks di-escape lebih dulu —
 * pemanggil TIDAK perlu (dan tidak boleh) meng-escape sendiri.
 *
 * Spoiler hanya dipakai untuk data identitas (tanggal lahir, NIK/NISN bila
 * dirender) sesuai RFC-013 keputusan 5 — nama dan NIS anak TIDAK dimasking.
 */
export function spoil(teks: string): string {
  return `||${escapeMarkdownV2(teks)}||`;
}

/**
 * Nama tampil wali (RFC-013 keputusan 2) — dipakai kedua bot, tidak ada format
 * kedua yang bisa menyimpang. Urutan: alias `kunyah` → alias `panggilan` →
 * nama lengkap. Alias lain (`ktp`, `keuangan`, `ejaan_lama`) TIDAK untuk
 * tampilan.
 *
 * `alias` boleh kosong — fungsi tetap mengembalikan nama lengkap.
 */
export function formatNamaTampil(
  wali: { readonly nama_lengkap: string },
  alias: readonly { readonly jenis: string; readonly nama: string }[],
): string {
  const kunyah = alias.find((a) => a.jenis === 'kunyah')?.nama;
  if (kunyah) return kunyah;
  const panggilan = alias.find((a) => a.jenis === 'panggilan')?.nama;
  if (panggilan) return panggilan;
  return wali.nama_lengkap;
}