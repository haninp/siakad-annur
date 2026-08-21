import { z } from 'zod';

/**
 * Modul absensi santri (Fase 2 akademik) — mendukung tool tren_absen_santri (RFC-016).
 * Data kehadiran per hari per santri. Ditulis oleh kode deterministik (bukan LLM).
 */
export const StatusAbsensi = z.enum(['hadir', 'izin', 'sakit', 'alpa']);
export type StatusAbsensi = z.infer<typeof StatusAbsensi>;

export const Absensi = z.object({
  id: z.string(),
  santri_id: z.string(),
  /** Tanggal kehadiran, YYYY-MM-DD. */
  tanggal: z.string(),
  status: StatusAbsensi,
  keterangan: z.string().nullable(),
  dicatat_oleh: z.string(),
  waktu: z.string(),
});
export type Absensi = z.infer<typeof Absensi>;

/** DDL absensi — migrasi v11 (Fase 2 akademik). */
export const DDL_ABSENSI = `
CREATE TABLE absensi (
  id            TEXT PRIMARY KEY,
  santri_id     TEXT NOT NULL REFERENCES santri(id),
  tanggal       TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('hadir','izin','sakit','alpa')),
  keterangan    TEXT,
  dicatat_oleh  TEXT NOT NULL,
  waktu         TEXT NOT NULL,
  UNIQUE (santri_id, tanggal)
) STRICT;
`;

/** Tabel yang dibuat oleh DDL_ABSENSI. */
export const TABEL_ABSENSI: readonly string[] = ['absensi'];
