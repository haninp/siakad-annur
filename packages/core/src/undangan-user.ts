import { randomBytes } from 'node:crypto';
import { buatUlid, type PenggunaTelegram } from '@siakad/contracts';
import type { RepoPenggunaTelegram } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Undangan USER untuk staf internal (RFC-015) — konsep menyalin undangan wali
 * (RFC-009/013) tetapi tertaut ROLE, bukan `wali_id`. Superadmin membuat undangan
 * dengan peran (admin/bendahara/pengajar), calon user memakainya via `/start <kode>`
 * di bot internal → terdaftar di `pengguna_telegram` dengan peran itu.
 *
 * Superadmin TIDAK bisa diundang — penetapannya lewat env (`SUPERADMIN_TELEGRAM_IDS`),
 * trust root yang di luar mekanisme sistem (percakapan RFC-015).
 */

export type PeranUndanganUser = 'admin' | 'bendahara' | 'pengajar';
const PERAN_UNDANGAN: readonly PeranUndanganUser[] = ['admin', 'bendahara', 'pengajar'];

export interface DependensiUndanganUser {
  readonly repoPenggunaTelegram: RepoPenggunaTelegram;
}

export interface BuatUndanganUserInput {
  readonly aktor: Aktor;
  readonly peran: PeranUndanganUser;
  readonly waktu: string;
}

export interface GunakanUndanganUserInput {
  readonly kode: string;
  readonly telegramId: number;
  readonly waktu: string;
}

export interface CabutUndanganUserInput {
  readonly aktor: Aktor;
  readonly undanganId: string;
  readonly waktu: string;
}

/** Format kode sama dengan undangan wali: `undang-XXXXXX` (mudah diketik). */
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

export function buatHandlerUndanganUser(dep: DependensiUndanganUser) {
  /** Superadmin membuat undangan untuk satu peran (sekali pakai). */
  function buatUndanganUser(input: BuatUndanganUserInput): HasilHandler<PenggunaTelegram> {
    if (!peranCukup(input.aktor, 'superadmin')) {
      return { ok: false, pesan: 'Hanya superadmin yang boleh mengundang user.' };
    }
    if (!PERAN_UNDANGAN.includes(input.peran)) {
      return { ok: false, pesan: 'Peran tidak valid untuk diundang.' };
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
      peran: input.peran,
      wali_id: null,
      undangan_kode: kode,
      aktif: true,
      dipakai_pada: null,
      dicabut_pada: null,
      dibuat_pada: input.waktu,
    };
    dep.repoPenggunaTelegram.sisip(pengguna);
    return {
      ok: true,
      pesan: `Undangan dibuat untuk peran ${input.peran}: ${kode}`,
      data: pengguna,
    };
  }

  /** Calon user memakai kode → telegram_id terhubung, kode hangus. */
  function gunakanUndanganUser(input: GunakanUndanganUserInput): HasilHandler<PenggunaTelegram> {
    const kode = (input.kode ?? '').trim();
    if (!POLA_KODE.test(kode)) {
      return { ok: false, pesan: 'Kode undangan tidak dikenal. Minta link baru ke superadmin.' };
    }
    const sudahDipakai = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (sudahDipakai) {
      return { ok: false, pesan: 'Nomor Telegram ini sudah terdaftar. Hubungi superadmin bila ini keliru.' };
    }

    const status = dep.repoPenggunaTelegram.cariStatusByKode(kode);
    if (!status) {
      return { ok: false, pesan: 'Kode undangan tidak dikenal. Minta link baru ke superadmin.' };
    }
    if (status.peran === 'wali') {
      return { ok: false, pesan: 'Kode ini untuk wali santri, bukan user internal.' };
    }
    if (status.dipakai_pada) {
      return { ok: false, pesan: 'Link undangan ini sudah digunakan.' };
    }
    if (status.dicabut_pada || !status.aktif) {
      return { ok: false, pesan: 'Link undangan ini sudah dibatalkan superadmin.' };
    }
    try {
      dep.repoPenggunaTelegram.hubungkan(status.id, kode, input.telegramId, input.waktu);
    } catch {
      return { ok: false, pesan: 'Link undangan ini tidak bisa dipakai. Minta link baru ke superadmin.' };
    }
    const user = dep.repoPenggunaTelegram.cariByTelegramId(input.telegramId);
    if (!user) {
      return { ok: false, pesan: 'Pendaftaran gagal. Coba lagi.' };
    }
    return { ok: true, pesan: `Terdaftar sebagai ${user.peran}. Silakan kirim /start.`, data: user };
  }

  /** Superadmin mencabut undangan user yang belum dipakai (revoke). */
  function cabutUndanganUser(input: CabutUndanganUserInput): HasilHandler<never> {
    if (!peranCukup(input.aktor, 'superadmin')) {
      return { ok: false, pesan: 'Hanya superadmin yang boleh mencabut undangan.' };
    }
    try {
      dep.repoPenggunaTelegram.cabut(input.undanganId, input.waktu);
    } catch (e) {
      return { ok: false, pesan: e instanceof Error ? e.message : 'Pencabutan gagal.' };
    }
    return { ok: true, pesan: 'Undangan user dicabut. Link tidak bisa dipakai lagi.' };
  }

  /** Superadmin melihat daftar undangan user yang menunggu dipakai. */
  function daftarUndanganUser(input: { aktor: Aktor }): HasilHandler<PenggunaTelegram[]> {
    if (!peranCukup(input.aktor, 'superadmin')) {
      return { ok: false, pesan: 'Hanya superadmin yang bisa melihat daftar undangan user.' };
    }
    const daftar = dep.repoPenggunaTelegram.cariMenungguUser();
    return { ok: true, pesan: `${daftar.length} undangan user menunggu dipakai.`, data: daftar };
  }

  return { buatUndanganUser, gunakanUndanganUser, cabutUndanganUser, daftarUndanganUser };
}
