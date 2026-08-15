import { z } from 'zod';
import { Ulid } from './enum.js';
import type { Entitas, PetaKlasifikasi } from './klasifikasi.js';
import { MetodePembayaran } from './keuangan.js';

/**
 * Skema verifikasi pembayaran (RFC-008).
 *
 * - `usulan_pembayaran` — klaim pembayaran dari wali, dengan bukti (file_id
 *   Telegram, TIDAK disimpan di disk — keputusan Hani). Status: diajukan →
 *   terverifikasi | ditolak. `pembayaran` (kas) hanya terisi saat terverifikasi
 *   (accrual: tahapan tercatat).
 * - `pengguna_telegram` — pemetaan telegram_id ↔ peran ↔ wali (prasyarat
 *   notifikasi push & pemetaan peran; menggantikan binding dev).
 */

const Teks = z.string().trim().min(1);
const WaktuIso = z.string().datetime({ offset: true });

// ── usulan_pembayaran ───────────────────────────────────────────────────────

export const StatusUsulanPembayaran = z.enum(['diajukan', 'terverifikasi', 'ditolak']);
export type StatusUsulanPembayaran = z.infer<typeof StatusUsulanPembayaran>;

export const UsulanPembayaran = z.object({
  id: Ulid,
  tagihan_id: Ulid,
  wali_id: Ulid,
  santri_id: Ulid,
  nominal: z.number().int().positive(),
  /** Tanggal bayar yang diklaim wali (dipakai akuntansi & nama bukti). */
  tanggal_bayar: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD'),
  metode: MetodePembayaran,
  /** Wajib diisi bila metode `tunai` — ditegakkan di core (RFC-008). */
  nama_penerima: Teks.nullable(),
  /** Telegram file_id bukti — bukti tidak disimpan di disk. */
  bukti_file_id: Teks,
  /** MIME bukti (mis. image/jpeg) untuk forward & konvensi nama Drive. */
  bukti_tipe: Teks,
  catatan: Teks.nullable(),
  status: StatusUsulanPembayaran,
  diverifikasi_oleh: z.string().trim().min(1).nullable(),
  diverifikasi_waktu: WaktuIso.nullable(),
  /** Wajib diisi bila status `ditolak` (CHECK di DDL). */
  alasan_penolakan: Teks.nullable(),
  diajukan_pada: WaktuIso,
});
export type UsulanPembayaran = z.infer<typeof UsulanPembayaran>;

const klasifikasiUsulanPembayaran: PetaKlasifikasi<UsulanPembayaran> = {
  id: 'publik',
  tagihan_id: 'publik',
  wali_id: 'publik',
  santri_id: 'publik',
  nominal: 'publik',
  tanggal_bayar: 'publik',
  metode: 'publik',
  nama_penerima: 'publik',
  bukti_file_id: 'publik',
  bukti_tipe: 'publik',
  catatan: 'publik',
  status: 'publik',
  diverifikasi_oleh: 'publik',
  diverifikasi_waktu: 'publik',
  alasan_penolakan: 'publik',
  diajukan_pada: 'publik',
};

export const entitasUsulanPembayaran: Entitas<UsulanPembayaran> = {
  nama: 'usulan_pembayaran',
  skema: UsulanPembayaran,
  kolom: [
    'id',
    'tagihan_id',
    'wali_id',
    'santri_id',
    'nominal',
    'tanggal_bayar',
    'metode',
    'nama_penerima',
    'bukti_file_id',
    'bukti_tipe',
    'catatan',
    'status',
    'diverifikasi_oleh',
    'diverifikasi_waktu',
    'alasan_penolakan',
    'diajukan_pada',
  ],
  klasifikasi: klasifikasiUsulanPembayaran,
};

// ── pengguna_telegram ───────────────────────────────────────────────────────

export const PeranPenggunaTelegram = z.enum(['wali', 'bendahara', 'pengurus', 'pengajar', 'admin']);
export type PeranPenggunaTelegram = z.infer<typeof PeranPenggunaTelegram>;

export const PenggunaTelegram = z.object({
  id: Ulid,
  /** Diisi saat wali/pengguna menghubungkan via /start (undangan). */
  telegram_id: z.number().int().positive().nullable(),
  peran: PeranPenggunaTelegram,
  wali_id: Ulid.nullable(),
  /** Kode undangan (mis. `undang-XXXX`) — satu kali pakai. */
  undangan_kode: Teks.nullable(),
  aktif: z.boolean(),
  dibuat_pada: WaktuIso,
});
export type PenggunaTelegram = z.infer<typeof PenggunaTelegram>;

const klasifikasiPenggunaTelegram: PetaKlasifikasi<PenggunaTelegram> = {
  id: 'publik',
  telegram_id: 'publik',
  peran: 'publik',
  wali_id: 'publik',
  undangan_kode: 'publik',
  aktif: 'publik',
  dibuat_pada: 'publik',
};

export const entitasPenggunaTelegram: Entitas<PenggunaTelegram> = {
  nama: 'pengguna_telegram',
  skema: PenggunaTelegram,
  kolom: ['id', 'telegram_id', 'peran', 'wali_id', 'undangan_kode', 'aktif', 'dibuat_pada'],
  klasifikasi: klasifikasiPenggunaTelegram,
};

// ── DDL ─────────────────────────────────────────────────────────────────────

export const DDL_VERIFIKASI_PEMBAYARAN: string = `
CREATE TABLE usulan_pembayaran (
  id                 TEXT PRIMARY KEY,
  tagihan_id         TEXT NOT NULL REFERENCES tagihan(id),
  wali_id            TEXT NOT NULL REFERENCES wali(id),
  santri_id          TEXT NOT NULL REFERENCES santri(id),
  nominal            INTEGER NOT NULL CHECK (nominal > 0),
  tanggal_bayar      TEXT NOT NULL,
  metode             TEXT NOT NULL CHECK (metode IN ('tunai','transfer','qris')),
  nama_penerima      TEXT,
  bukti_file_id      TEXT NOT NULL,
  bukti_tipe         TEXT NOT NULL,
  catatan            TEXT,
  status             TEXT NOT NULL CHECK (status IN ('diajukan','terverifikasi','ditolak')),
  diverifikasi_oleh  TEXT,
  diverifikasi_waktu TEXT,
  alasan_penolakan   TEXT,
  diajukan_pada      TEXT NOT NULL,
  CHECK ((status = 'ditolak') = (alasan_penolakan IS NOT NULL)),
  CHECK ((status = 'diajukan') = (diverifikasi_oleh IS NULL))
) STRICT;

CREATE TABLE pengguna_telegram (
  id             TEXT PRIMARY KEY,
  telegram_id    INTEGER UNIQUE,
  peran          TEXT NOT NULL CHECK (peran IN ('wali','bendahara','pengurus','pengajar','admin')),
  wali_id        TEXT REFERENCES wali(id),
  undangan_kode  TEXT UNIQUE,
  aktif          INTEGER NOT NULL CHECK (aktif IN (0,1)),
  dibuat_pada    TEXT NOT NULL
) STRICT;
`;

export const TABEL_VERIFIKASI_PEMBAYARAN: readonly string[] = ['usulan_pembayaran', 'pengguna_telegram'];
