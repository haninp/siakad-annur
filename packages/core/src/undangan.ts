import { randomBytes } from 'node:crypto';
import { buatUlid, type PenggunaTelegram, type Wali } from '@siakad/contracts';
import type { RepoMasterIdTunggal, RepoPenggunaTelegram } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Alur undangan & registrasi wali (RFC-009): pengurus membuat kode sekali
 * pakai untuk wali tertentu, wali memakainya sendiri via `/start <kode>` —
 * tanpa menyentuh konfigurasi. Menggantikan binding dev (`DEV_WALI_BINDING`)
 * sebagai jalur pendaftaran sungguhan.
 *
 * Amandemen (migrasi 7): kode bekas tetap tersimpan — link yang sudah dipakai
 * atau dicabut dikenali dan diberi pesan berbeda; pengurus bisa mencabut
 * undangan dan melihat daftar yang masih menunggu.
 *
 * Izin hidup di sini (AGENTS.md: izin hanya di core). Keamanan:
 * - Kode sekali pakai dipaksakan di SQL (`hubungkan`), bukan sekadar alur.
 * - Satu telegram_id hanya bisa terikat satu akun aktif (anti-hijack).
 */

export interface DepUndangan {
  readonly repoPenggunaTelegram: RepoPenggunaTelegram;
  readonly repoWali: RepoMasterIdTunggal<Wali>;
}

export interface BuatUndanganInput {
  readonly aktor: Aktor;
  readonly waliId: string;
  readonly waktu: string;
}

export interface GunakanUndanganInput {
  readonly telegramId: number;
  readonly kode: string;
  readonly waktu: string;
}

export interface CabutUndanganInput {
  readonly aktor: Aktor;
  readonly undanganId: string;
  readonly waktu: string;
}

/** Format kode: `undang-` + 6 karakter (alfanumerik tanpa I/O/0/1 — mudah diketik). */
const POLA_KODE = /^undang-[A-Z0-9]{6}$/;

function kodeBaru(): string {
  const abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const acak = randomBytes(6);
  let kode = '';
  for (let i = 0; i < 6; i++) {
    const byte = acak[i] ?? 0;
    kode += abjad[byte % abjad.length] ?? '';
  }
  return `undang-${kode}`;
}

export function buatHandlerUndangan(dep: DepUndangan) {
  /** Pengurus membuat undangan untuk wali tertentu (sekali pakai). */
  function buatUndangan(input: BuatUndanganInput): HasilHandler<PenggunaTelegram> {
    if (!peranCukup(input.aktor, 'admin', 'pengurus')) {
      return { ok: false, pesan: 'Hanya pengurus yang boleh membuat undangan.' };
    }
    const wali = dep.repoWali.ambil(input.waliId);
    if (!wali) {
      return { ok: false, pesan: 'Wali tidak ditemukan.' };
    }

    const sudah = dep.repoPenggunaTelegram.cariByWaliId(input.waliId);
    if (sudah?.telegram_id != null) {
      return { ok: false, pesan: `${wali.nama_lengkap} sudah terdaftar di bot wali.` };
    }
    if (sudah?.undangan_kode && !sudah.dipakai_pada && !sudah.dicabut_pada) {
      return { ok: false, pesan: `${wali.nama_lengkap} sudah punya undangan yang belum dipakai.` };
    }

    let kode = kodeBaru();
    for (let percobaan = 0; percobaan < 5 && dep.repoPenggunaTelegram.cariStatusByKode(kode); percobaan++) {
      kode = kodeBaru();
    }
    if (dep.repoPenggunaTelegram.cariStatusByKode(kode)) {
      return { ok: false, pesan: 'Gagal membuat kode unik. Coba lagi.' };
    }

    const pengguna: PenggunaTelegram = {
      id: buatUlid(),
      telegram_id: null,
      peran: 'wali',
      wali_id: input.waliId,
      undangan_kode: kode,
      aktif: true,
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: input.waktu,
    };
    dep.repoPenggunaTelegram.sisip(pengguna);
    return {
      ok: true,
      pesan: `Undangan untuk ${wali.nama_lengkap}: ${kode}`,
      data: pengguna,
    };
  }

  /** Wali memakai kode → telegram_id terhubung, kode hangus. */
  function gunakanUndangan(input: GunakanUndanganInput): HasilHandler<PenggunaTelegram> {
    const kode = (input.kode ?? '').trim();
    if (!POLA_KODE.test(kode)) {
      return { ok: false, pesan: 'Kode undangan tidak dikenal. Minta link baru ke pengurus.' };
    }
    const sudahDipakai = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (sudahDipakai) {
      return {
        ok: false,
        pesan: 'Nomor Telegram ini sudah terdaftar untuk wali lain. Hubungi pengurus bila ini keliru.',
      };
    }
    // Bedakan status link: bekas (sudah dipakai) vs dicabut vs tidak dikenal.
    const status = dep.repoPenggunaTelegram.cariStatusByKode(kode);
    if (status) {
      if (status.dipakai_pada) {
        return { ok: false, pesan: 'Link undangan ini sudah digunakan.' };
      }
      if (status.dicabut_pada || !status.aktif) {
        return { ok: false, pesan: 'Link undangan ini sudah dibatalkan pengurus.' };
      }
    } else {
      return { ok: false, pesan: 'Kode undangan tidak dikenal. Minta link baru ke pengurus.' };
    }
    const undangan = dep.repoPenggunaTelegram.cariByUndanganKode(kode);
    if (!undangan) {
      return { ok: false, pesan: 'Link undangan ini tidak bisa dipakai. Minta link baru ke pengurus.' };
    }
    try {
      dep.repoPenggunaTelegram.hubungkan(undangan.id, kode, input.telegramId, input.waktu);
    } catch {
      return { ok: false, pesan: 'Link undangan ini tidak bisa dipakai. Minta link baru ke pengurus.' };
    }
    const terhubung = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (!terhubung) {
      return { ok: false, pesan: 'Pendaftaran gagal. Coba lagi.' };
    }
    return { ok: true, pesan: 'Pendaftaran berhasil. Selamat datang!', data: terhubung };
  }

  /** Pengurus mencabut undangan yang belum dipakai (revoke). */
  function cabutUndangan(input: CabutUndanganInput): HasilHandler<never> {
    if (!peranCukup(input.aktor, 'admin', 'pengurus')) {
      return { ok: false, pesan: 'Hanya pengurus yang boleh mencabut undangan.' };
    }
    try {
      dep.repoPenggunaTelegram.cabut(input.undanganId, input.waktu);
    } catch (e) {
      return { ok: false, pesan: e instanceof Error ? e.message : 'Pencabutan gagal.' };
    }
    return { ok: true, pesan: 'Undangan dicabut. Link tidak bisa dipakai lagi.' };
  }

  /** Daftar undangan yang masih menunggu dipakai (list pengurus). */
  function daftarUndangan(input: { aktor: Aktor }): HasilHandler<PenggunaTelegram[]> {
    if (!peranCukup(input.aktor, 'admin', 'pengurus')) {
      return { ok: false, pesan: 'Hanya pengurus yang bisa melihat daftar undangan.' };
    }
    const daftar = dep.repoPenggunaTelegram.cariMenunggu();
    return { ok: true, pesan: `${daftar.length} undangan menunggu dipakai.`, data: daftar };
  }

  return { buatUndangan, gunakanUndangan, cabutUndangan, daftarUndangan };
}
