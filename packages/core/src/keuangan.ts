import type { Keringanan, TarifKomponen } from '@siakad/contracts';

/**
 * Aturan bisnis keuangan murni — tanpa repositori, tanpa side-effect.
 *
 * Handler `keuangan-handler.ts` menyusun langkah dari fungsi-fungsi di sini.
 * Menempatkannya terpisah membuat aturan bisa diuji langsung, tanpa basis data,
 * dan didokumentasikan lewat nama dan tanda tangannya.
 *
 * Prinsip pokok (AGENTS.md, ADR 0012): angka turunan tidak disimpan. Yang ada
 * di sini menghitung dari input, bukan membaca kolom turunan.
 */

/** Maksimal cicilan per tagihan — sesuai sistem lama (Cicilan ke- (Max 6)). */
export const MAKS_CICILAN = 6;

/** Cara mencari tarif. Diimplementasikan oleh `repoTarifKomponen` di handler. */
export interface LookupTarif {
  readonly cariAktif: (
    tahunAjaranId: string,
    komponenBiayaId: string,
    jalur: string | null,
    marhalah: string | null,
    tingkat: number | null,
  ) => TarifKomponen | undefined;
  readonly cariUmum: (tahunAjaranId: string, komponenBiayaId: string) => TarifKomponen | undefined;
}

export interface TarifBerlakuInput {
  readonly tahunAjaranId: string;
  readonly komponenBiayaId: string;
  /** Null artinya tidak menyempitkan — pakai tarif umum. */
  readonly jalur: string | null;
  readonly marhalah: string | null;
  readonly tingkat: number | null;
}

/**
 * Cari tarif berlaku: spesifik dulu, bila tidak ada jatuh ke umum.
 *
 * Fallback adalah keputusan bisnis, jadi hidup di `core` — bukan di repo
 * (1.3). Repo hanya menyediakan bahan: `cariAktif` (persis) dan `cariUmum`.
 */
export function cariTarifBerlaku(
  lookup: LookupTarif,
  input: TarifBerlakuInput,
): TarifKomponen | undefined {
  const spesifik = lookup.cariAktif(
    input.tahunAjaranId,
    input.komponenBiayaId,
    input.jalur,
    input.marhalah,
    input.tingkat,
  );
  if (spesifik !== undefined) return spesifik;
  return lookup.cariUmum(input.tahunAjaranId, input.komponenBiayaId);
}

/**
 * Apakah sebuah periode tagihan berlaku untuk santri pada tahun ajaran tertentu.
 *
 * - **SPP** (kategori 'spp', berperiode Masehi `YYYY-MM`): berlaku bila periode
 *   berada dalam rentang `bulan_mulai` (tanggal masuk) hingga `bulan_akhir`
 *   (tanggal keluar, atau bulan selesai tahun ajaran). Prorata **tanpa pecahan**
 *   — bulan masuk tetap ditagih penuh (keputusan P3 + desain 1.4).
 * - **Komponen sekali** (`pendaftaran`, `uang_gedung`, dsb.): terbit sekali per
 *   tahun ajaran, jadi periode = kode tahun ajaran dan selalu berlaku selama
 *   santri terdaftar pada tahun ajaran itu.
 */
export function apakahPeriodeBerlaku(params: {
  readonly kodeKomponen: string;
  readonly skemaPeriode: 'masehi' | 'hijriah';
  readonly periode: string;
  readonly tanggalMasuk: string;
  readonly tanggalKeluar: string | null;
  /** Bulan akhir tahun ajaran, mis. `2027-06` (dari `tahun_ajaran.selesai`). */
  readonly tahunAjaranSelesai: string;
}): boolean {
  if (params.kodeKomponen !== 'spp') return true;

  if (params.skemaPeriode === 'hijriah') return true;

  const bulanMulaiKbm = params.tanggalMasuk.slice(0, 7);
  const bulanAkhir = params.tanggalKeluar !== null
    ? params.tanggalKeluar.slice(0, 7)
    : params.tahunAjaranSelesai.slice(0, 7);

  return params.periode >= bulanMulaiKbm && params.periode <= bulanAkhir;
}

/**
 * Jatuh tempo default: tanggal 10 bulan **berikutnya** dari periode Masehi.
 *
 * Untuk `2026-08` → `2026-09-10`. Bila periode Desember, tahun ikut maju.
 * Untuk skema Hijriah dan periode sekali (kode TA), jatuh tempo ditetapkan
 * pemanggil — fungsi ini hanya menangani SPP Masehi.
 */
export function hitungJatuhTempoDefault(periode: string): string {
  const [tahunStr, bulanStr] = periode.split('-');
  const tahun = Number(tahunStr);
  const bulan = Number(bulanStr);
  if (Number.isNaN(tahun) || Number.isNaN(bulan) || bulan < 1 || bulan > 12) {
    return periode;
  }
  const bulanBerikut = bulan === 12 ? 1 : bulan + 1;
  const tahunBerikut = bulan === 12 ? tahun + 1 : tahun;
  const bulanBerikutStr = bulanBerikut.toString().padStart(2, '0');
  return `${tahunBerikut}-${bulanBerikutStr}-10`;
}

/**
 * Jumlah keringanan dalam rupiah. Nominal langsung; persentase diubah menjadi
 * rupiah dari nominal tagihan. Hasil dibulatkan ke integer.
 */
export function hitungKeringananEffektif(
  keringanan: readonly Keringanan[],
  nominalTagihan: number,
): number {
  return keringanan.reduce((total, k) => {
    if (k.nominal !== null) return total + k.nominal;
    if (k.persentase !== null) return total + Math.round((nominalTagihan * k.persentase) / 100);
    return total;
  }, 0);
}

/**
 * Sisa tagihan yang harus dibayar: nominal dikurangi keringanan efektif dan
 * total pembayaran yang sudah masuk.
 */
export function hitungOutstanding(params: {
  readonly nominal: number;
  readonly keringanan: readonly Keringanan[];
  readonly sudahBayar: number;
}): number {
  const potongan = hitungKeringananEffektif(params.keringanan, params.nominal);
  return Math.max(0, params.nominal - potongan - params.sudahBayar);
}

/**
 * Nomor cicilan berikutnya. Pembayaran non-cicilan (`cicilan_ke=null`) ikut
 * dihitung sebagai bagian dari pembayaran tagihan, tapi tidak menambah nomor
 * cicilan. Jadi hanya hitung yang `cicilan_ke !== null`.
 */
export function cicilanBerikutnya(pembayaranLalu: readonly { cicilan_ke: number | null }[]): number {
  const maks = pembayaranLalu.reduce((acc, p) => {
    return p.cicilan_ke !== null && p.cicilan_ke > acc ? p.cicilan_ke : acc;
  }, 0);
  return maks + 1;
}