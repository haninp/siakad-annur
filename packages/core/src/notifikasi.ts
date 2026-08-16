import type { RepoNotifikasi, TagihanPerluNotifikasi } from '@siakad/db';

/**
 * Notifikasi worker (RFC-011): tagihan yang baru terbit diberitahukan
 * proaktif ke wali terdaftar — tanpa wali harus membuka bot.
 *
 * Logika batch di sini (pola `terbitkanTagihanBulanan`); worker hanya
 * menyediakan fungsi kirim (fetch Telegram) dan interval. Aturan tidak
 * menyebar ke worker.
 */

export interface DepNotifikasi {
  readonly repoNotifikasi: RepoNotifikasi;
}

export interface KirimNotifikasiTerbitInput {
  /** Kirim satu pesan ke satu telegram_id; true bila sukses. */
  readonly kirim: (telegramId: number, teks: string) => Promise<boolean>;
  readonly waktu: string;
}

export interface HasilKirimNotifikasi {
  readonly tagihanDiproses: number;
  readonly pesanTerkirim: number;
  readonly gagal: number;
}

/** Pesan tagihan terbit — kosakata tegas, substantif (konvensi repo). */
export function teksNotifikasiTagihan(t: TagihanPerluNotifikasi): string {
  return (
    `📋 Tagihan ${t.komponen_nama} — ${t.periode} untuk ${t.santri_nama}\n` +
    `Rp ${t.nominal.toLocaleString('id-ID')}\n` +
    `Batas bayar: ${t.jatuh_tempo}\n\n` +
    `Bayar lewat bot: @rtq_annur_bot`
  );
}

export function buatHandlerNotifikasi(dep: DepNotifikasi) {
  /**
   * Satu putaran worker: semua tagihan 'terbit' yang belum dinotifikasi →
   * kirim ke wali TERDAFTAR anak tsb → tandai.
   *
   * Tagihan tanpa satu pun wali terdaftar TIDAK ditandai — begitu wali
   * mendaftar (M2), tagihan langsung terkirim pada putaran berikutnya.
   */
  async function kirimNotifikasiTerbit(input: KirimNotifikasiTerbitInput): Promise<HasilKirimNotifikasi> {
    const daftar = dep.repoNotifikasi.cariTagihanPerluNotifikasi();
    let pesanTerkirim = 0;
    let gagal = 0;

    for (const tagihan of daftar) {
      const penerima = dep.repoNotifikasi.cariWaliTerdaftar(tagihan.santri_id);
      if (penerima.length === 0) continue;

      const teks = teksNotifikasiTagihan(tagihan);
      for (const w of penerima) {
        const ok = await input.kirim(w.telegram_id, teks);
        if (ok) pesanTerkirim += 1;
        else gagal += 1;
      }
      dep.repoNotifikasi.tandaiNotifikasiTerbit(tagihan.tagihan_id, input.waktu);
    }

    return { tagihanDiproses: daftar.length, pesanTerkirim, gagal };
  }

  return { kirimNotifikasiTerbit, teksNotifikasiTagihan };
}
