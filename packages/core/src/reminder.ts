import type { KalenderHijriah } from '@siakad/contracts';
import type { RepoKalenderHijriah, RepoNotifikasi, TagihanPerluNotifikasi } from '@siakad/db';

/**
 * Reminder worker (RFC-012): kalender hijriah (verifikasi pengurus) dan
 * jatuh tempo tagihan (H-3/H-1 ke wali). Logika batch di core — worker hanya
 * menyediakan fungsi kirim dan interval (pola RFC-011).
 */

export interface DepReminder {
  readonly repoNotifikasi: RepoNotifikasi;
  readonly repoKalenderHijriah: RepoKalenderHijriah;
}

export interface KirimReminderInput {
  readonly kirim: (telegramId: number, teks: string) => Promise<boolean>;
  readonly waktu: string;
}

export interface HasilReminder {
  readonly itemDiproses: number;
  readonly pesanTerkirim: number;
  readonly gagal: number;
}

/** Pesan reminder kalender hijriah ke pengurus (RFC-012). */
export function teksReminderHijriah(k: KalenderHijriah): string {
  const bulanDuaDigit = String(k.bulan_hijriah).padStart(2, '0');
  return (
    `🕌 Bulan ${k.nama_bulan} ${k.tahun_hijriah} H akan dimulai ${k.tanggal_mulai_masehi}.\n` +
    `Data masih provisional. Verifikasi: /setujui ${k.tahun_hijriah}-${bulanDuaDigit}`
  );
}

/** Pesan reminder jatuh tempo ke wali (RFC-012). */
export function teksReminderJatuhTempo(t: TagihanPerluNotifikasi, tahap: 'h3' | 'h1'): string {
  const label = tahap === 'h3' ? '3 hari lagi' : 'BESOK';
  return (
    `⏰ Jatuh tempo ${label}: Tagihan ${t.komponen_nama} — ${t.periode} untuk ${t.santri_nama}\n` +
    `Rp ${t.nominal.toLocaleString('id-ID')}\n` +
    `Batas bayar: ${t.jatuh_tempo}\n\n` +
    `Bayar lewat bot: @rtq_annur_bot`
  );
}

export function buatHandlerReminder(dep: DepReminder) {
  /**
   * Reminder kalender hijriah: baris provisional yang belum diingatkan dan
   * akan dimulai dalam `dalamHari` ke depan → kirim ke `pengurusIds`.
   * Tanpa satu pun pengurus, tidak ditandai (menunggu P6/grup).
   */
  async function kirimReminderHijriah(
    input: KirimReminderInput & { readonly pengurusIds: readonly number[]; readonly dalamHari: number; readonly hariIni: string },
  ): Promise<HasilReminder> {
    const sampai = new Date(new Date(`${input.hariIni}T00:00:00+07:00`).getTime() + input.dalamHari * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const daftar = dep.repoKalenderHijriah.cariPerluDiingatkan(input.hariIni, sampai);
    if (input.pengurusIds.length === 0) {
      return { itemDiproses: daftar.length, pesanTerkirim: 0, gagal: 0 };
    }

    let pesanTerkirim = 0;
    let gagal = 0;
    for (const k of daftar) {
      const teks = teksReminderHijriah(k);
      for (const id of input.pengurusIds) {
        const ok = await input.kirim(id, teks);
        if (ok) pesanTerkirim += 1;
        else gagal += 1;
      }
      dep.repoKalenderHijriah.tandaiDiingatkan(k.tahun_hijriah, k.bulan_hijriah, input.waktu);
    }
    return { itemDiproses: daftar.length, pesanTerkirim, gagal };
  }

  /**
   * Reminder jatuh tempo: tagihan 'terbit' yang jatuh temponya H-3 atau H-1
   * dari `hariIni` → kirim ke wali terdaftar → tandai tahap. Tagihan tanpa
   * wali terdaftar tidak ditandai (pola RFC-011).
   */
  async function kirimReminderJatuhTempo(
    input: KirimReminderInput & { readonly hariIni: string },
  ): Promise<HasilReminder> {
    let itemDiproses = 0;
    let pesanTerkirim = 0;
    let gagal = 0;

    for (const [tahap, tambahHari] of [
      ['h3', 3],
      ['h1', 1],
    ] as const) {
      const daftar = dep.repoNotifikasi.cariTagihanJatuhTempo(input.hariIni, tambahHari, tahap);
      itemDiproses += daftar.length;
      for (const tagihan of daftar) {
        const penerima = dep.repoNotifikasi.cariWaliTerdaftar(tagihan.santri_id);
        if (penerima.length === 0) continue;
        const teks = teksReminderJatuhTempo(tagihan, tahap);
        for (const w of penerima) {
          const ok = await input.kirim(w.telegram_id, teks);
          if (ok) pesanTerkirim += 1;
          else gagal += 1;
        }
        dep.repoNotifikasi.tandaiJatuhTempo(tagihan.tagihan_id, tahap, input.waktu);
      }
    }

    return { itemDiproses, pesanTerkirim, gagal };
  }

  return { kirimReminderHijriah, kirimReminderJatuhTempo, teksReminderHijriah, teksReminderJatuhTempo };
}
