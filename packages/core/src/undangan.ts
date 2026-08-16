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
    if (sudah?.undangan_kode) {
      return { ok: false, pesan: `${wali.nama_lengkap} sudah punya undangan yang belum dipakai.` };
    }

    let kode = kodeBaru();
    for (let percobaan = 0; percobaan < 5 && dep.repoPenggunaTelegram.cariByUndanganKode(kode); percobaan++) {
      kode = kodeBaru();
    }
    if (dep.repoPenggunaTelegram.cariByUndanganKode(kode)) {
      return { ok: false, pesan: 'Gagal membuat kode unik. Coba lagi.' };
    }

    const pengguna: PenggunaTelegram = {
      id: buatUlid(),
      telegram_id: null,
      peran: 'wali',
      wali_id: input.waliId,
      undangan_kode: kode,
      aktif: true,
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
      return {
        ok: false,
        pesan: 'Kode undangan tidak dikenal atau sudah dipakai. Minta kode baru ke pengurus.',
      };
    }
    const sudahDipakai = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (sudahDipakai) {
      return {
        ok: false,
        pesan: 'Nomor Telegram ini sudah terdaftar untuk wali lain. Hubungi pengurus bila ini keliru.',
      };
    }
    const undangan = dep.repoPenggunaTelegram.cariByUndanganKode(kode);
    if (!undangan) {
      return {
        ok: false,
        pesan: 'Kode undangan tidak dikenal atau sudah dipakai. Minta kode baru ke pengurus.',
      };
    }
    try {
      dep.repoPenggunaTelegram.hubungkan(undangan.id, kode, input.telegramId);
    } catch {
      return {
        ok: false,
        pesan: 'Kode undangan tidak dikenal atau sudah dipakai. Minta kode baru ke pengurus.',
      };
    }
    const terhubung = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (!terhubung) {
      return { ok: false, pesan: 'Pendaftaran gagal. Coba lagi.' };
    }
    return { ok: true, pesan: 'Pendaftaran berhasil. Selamat datang!', data: terhubung };
  }

  return { buatUndangan, gunakanUndangan };
}
