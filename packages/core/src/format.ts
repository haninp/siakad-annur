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