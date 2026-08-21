import { z } from 'zod';
import type { RepoAbsensi } from '@siakad/db';
import { StatusAbsensi as StatusZod } from '@siakad/contracts';
import type { StatusAbsensi } from '@siakad/contracts';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Modul absensi santri (Fase 2 akademik). Pencatatan deterministik (LLM tidak menulis DB —
 * kelakukan jalur tulis bebas LLM di AGENTS.md). Yang bisa mencatat: superadmin/admin/pengajar.
 */
const SkemaCatat = z.object({
  santri_id: z.string().min(1),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: StatusZod,
  keterangan: z.string().max(200).nullable().optional(),
});

export interface DependensiAbsensi {
  readonly repoAbsensi: RepoAbsensi;
}

export interface CatatAbsensiInput {
  readonly aktor: Aktor;
  readonly santri_id: string;
  readonly tanggal: string;
  readonly status: StatusAbsensi;
  readonly keterangan?: string | null;
  readonly waktu: string;
}

export function buatHandlerAbsensi(dep: DependensiAbsensi) {
  function catatAbsensi(input: CatatAbsensiInput): HasilHandler<never> {
    if (!peranCukup(input.aktor, 'superadmin', 'admin', 'pengajar')) {
      return { ok: false, pesan: 'Hanya superadmin, admin, dan pengajar yang boleh mencatat kehadiran.' };
    }
    const p = SkemaCatat.safeParse({
      santri_id: input.santri_id,
      tanggal: input.tanggal,
      status: input.status,
      keterangan: input.keterangan ?? null,
    });
    if (!p.success) return { ok: false, pesan: 'Data kehadiran tidak valid.' };
    dep.repoAbsensi.catat({
      santriId: p.data.santri_id,
      tanggal: p.data.tanggal,
      status: p.data.status,
      keterangan: p.data.keterangan ?? null,
      dicatatOleh: input.aktor.id,
      waktu: input.waktu,
    });
    return { ok: true, pesan: `Kehadiran "${p.data.status}" utk ${p.data.tanggal} tercatat.` };
  }

  return { catatAbsensi };
}
