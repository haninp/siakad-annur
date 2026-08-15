import { buatUlid, type MetodePembayaran, type SantriWali, type UsulanPembayaran } from '@siakad/contracts';
import type { buatHandlerKeuangan, DepKeuangan } from './keuangan-handler.js';
import type { RepoMasterKomposit, RepoUsulanPembayaran } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Alur verifikasi pembayaran (RFC-008):
 * wali ajukan usulan + bukti → bendahara verifikasi/tolak → baru uang masuk.
 *
 * Akrual: `usulan_pembayaran` mencatat tahap "diajukan"; `pembayaran` (kas)
 * hanya terisi saat `terverifikasi` (memanggil `catatPembayaran`).
 *
 * Izin hidup di sini (AGENTS.md: izin hanya di core). Bukti TIDAK disimpan
 * di disk — cukup `bukti_file_id` Telegram (keputusan Hani, RFC-008).
 */

export interface DepVerifikasiPembayaran extends DepKeuangan {
  readonly repoUsulanPembayaran: RepoUsulanPembayaran;
  readonly repoSantriWali: RepoMasterKomposit<SantriWali>;
  /** Handler keuangan — verifikasi memanggil `catatPembayaran` (uang masuk). */
  readonly keuangan: ReturnType<typeof buatHandlerKeuangan>;
}

export interface AjukanUsulanInput {
  readonly aktor: Aktor;
  readonly tagihanId: string;
  readonly santriId: string;
  readonly nominal: number;
  /** Tanggal bayar yang diklaim wali (YYYY-MM-DD). */
  readonly tanggalBayar: string;
  readonly metode: MetodePembayaran;
  /** Wajib diisi bila metode `tunai` — wali menyebut nama penerima uang. */
  readonly namaPenerima?: string | null;
  /** Telegram file_id bukti — tidak disimpan di disk. */
  readonly buktiFileId: string;
  readonly buktiTipe: string;
  readonly catatan?: string | null;
  readonly waktu: string;
}

export interface VerifikasiUsulanInput {
  readonly aktor: Aktor;
  readonly usulanId: string;
  readonly waktu: string;
}

export interface TolakUsulanInput {
  readonly aktor: Aktor;
  readonly usulanId: string;
  /** Wajib — disampaikan ke wali. */
  readonly alasan: string;
  readonly waktu: string;
}

/** Konvensi nama bukti bayar (RFC-008): {NIS}-{tanggal}-{nominal}-{metode}.{ext} */
export function namaFileBukti(input: {
  readonly nis: string;
  readonly tanggal: string;
  readonly nominal: number;
  readonly metode: MetodePembayaran;
  readonly ekstensi: string;
}): string {
  const bersih = input.ekstensi.replace(/^\./, '').toLowerCase() || 'jpg';
  return `${input.nis}-${input.tanggal}-${input.nominal}-${input.metode}.${bersih}`;
}

export function buatHandlerVerifikasiPembayaran(dep: DepVerifikasiPembayaran) {
  /** Wali mengajukan klaim pembayaran + bukti untuk tagihan anaknya. */
  function ajukanUsulan(input: AjukanUsulanInput): HasilHandler<UsulanPembayaran> {
    if (!peranCukup(input.aktor, 'wali')) {
      return { ok: false, pesan: 'Hanya wali terdaftar yang boleh mengajukan pembayaran.' };
    }

    const nominal = Number(input.nominal);
    if (!Number.isInteger(nominal) || nominal <= 0) {
      return { ok: false, pesan: 'Nominal harus angka bulat positif.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggalBayar)) {
      return { ok: false, pesan: 'Tanggal bayar harus format YYYY-MM-DD.' };
    }
    if (!input.buktiFileId || !input.buktiFileId.trim()) {
      return { ok: false, pesan: 'Bukti pembayaran wajib dilampirkan.' };
    }
    if (input.metode === 'tunai' && !(input.namaPenerima ?? '').trim()) {
      return { ok: false, pesan: 'Untuk pembayaran tunai, sebutkan nama penerima uang.' };
    }

    // Santri harus anak dari wali ini (tautan aktif).
    const tertaut = dep.repoSantriWali.ambilSemua().some(
      (sw) => sw.santri_id === input.santriId && sw.wali_id === input.aktor.id && sw.aktif,
    );
    if (!tertaut) {
      return { ok: false, pesan: 'Santri tidak terhubung dengan akun Anda.' };
    }

    // Tagihan harus milik santri tersebut dan masih terbit.
    const tagihan = dep.repoTagihan.ambil(input.tagihanId);
    if (!tagihan || tagihan.santri_id !== input.santriId) {
      return { ok: false, pesan: 'Tagihan tidak ditemukan.' };
    }
    if (tagihan.status !== 'terbit') {
      return { ok: false, pesan: 'Tagihan ini sudah lunas atau dibatalkan.' };
    }

    // Cegah usulan ganda yang masih diajukan untuk tagihan yang sama.
    const sudahDiajukan = dep.repoUsulanPembayaran
      .cariBySantri(input.santriId)
      .some((u) => u.tagihan_id === input.tagihanId && u.status === 'diajukan');
    if (sudahDiajukan) {
      return { ok: false, pesan: 'Sudah ada pengajuan pembayaran yang menunggu verifikasi.' };
    }

    const usulan: UsulanPembayaran = {
      id: buatUlid(),
      tagihan_id: input.tagihanId,
      wali_id: input.aktor.id,
      santri_id: input.santriId,
      nominal,
      tanggal_bayar: input.tanggalBayar,
      metode: input.metode,
      nama_penerima: input.metode === 'tunai' ? (input.namaPenerima ?? '').trim() : null,
      bukti_file_id: input.buktiFileId.trim(),
      bukti_tipe: input.buktiTipe.trim() || 'application/octet-stream',
      catatan: input.catatan?.trim() || null,
      status: 'diajukan',
      diverifikasi_oleh: null,
      diverifikasi_waktu: null,
      alasan_penolakan: null,
      diajukan_pada: input.waktu,
    };
    dep.repoUsulanPembayaran.ajukan(usulan);
    return {
      ok: true,
      pesan: 'Pengajuan pembayaran diterima. Menunggu verifikasi bendahara.',
      data: usulan,
    };
  }

  /** Bendahara mengonfirmasi uang masuk → catat pembayaran (akrual). */
  function verifikasiUsulan(input: VerifikasiUsulanInput): HasilHandler<never> {
    if (!peranCukup(input.aktor, 'bendahara', 'pengurus')) {
      return { ok: false, pesan: 'Hanya bendahara dan admin yang boleh memverifikasi pembayaran.' };
    }
    const usulan = dep.repoUsulanPembayaran.cariById(input.usulanId);
    if (!usulan) {
      return { ok: false, pesan: 'Usulan tidak ditemukan.' };
    }
    if (usulan.status !== 'diajukan') {
      return { ok: false, pesan: 'Usulan ini sudah diproses.' };
    }

    try {
      dep.transaksi.jalankanTransaksi(() => {
        dep.repoUsulanPembayaran.verifikasi(input.usulanId, input.aktor.id, input.waktu);
        const hasil = dep.keuangan.catatPembayaran({
          aktor: input.aktor,
          tagihanId: usulan.tagihan_id,
          tanggal: usulan.tanggal_bayar,
          nominal: usulan.nominal,
          metode: usulan.metode,
          sumber: 'wali',
          sebagaiCicilan: true,
          waktu: input.waktu,
        });
        if (!hasil.ok) {
          throw new Error(hasil.pesan ?? 'Pencatatan pembayaran gagal.');
        }
      });
    } catch (e) {
      // Transaksi di-rollback — usulan tetap diajukan.
      return { ok: false, pesan: e instanceof Error ? e.message : 'Verifikasi gagal.' };
    }

    return { ok: true, pesan: 'Pembayaran terverifikasi. Uang masuk telah dicatat.' };
  }

  /** Bendahara menolak dengan alasan wajib → status wali kembali BELUM BAYAR. */
  function tolakUsulan(input: TolakUsulanInput): HasilHandler<never> {
    if (!peranCukup(input.aktor, 'bendahara', 'pengurus')) {
      return { ok: false, pesan: 'Hanya bendahara dan admin yang boleh menolak pembayaran.' };
    }
    const alasan = (input.alasan ?? '').trim();
    if (!alasan) {
      return { ok: false, pesan: 'Alasan penolakan wajib diisi.' };
    }
    const usulan = dep.repoUsulanPembayaran.cariById(input.usulanId);
    if (!usulan) {
      return { ok: false, pesan: 'Usulan tidak ditemukan.' };
    }
    if (usulan.status !== 'diajukan') {
      return { ok: false, pesan: 'Usulan ini sudah diproses.' };
    }
    dep.repoUsulanPembayaran.tolak(input.usulanId, input.aktor.id, alasan, input.waktu);
    return { ok: true, pesan: `Pembayaran ditolak: ${alasan}` };
  }

  return { ajukanUsulan, verifikasiUsulan, tolakUsulan, namaFileBukti };
}
