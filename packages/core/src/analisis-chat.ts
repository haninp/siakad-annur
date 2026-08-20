import { z } from 'zod';
import type { RepoAnalisisLog, RepoLaporan } from '@siakad/db';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Chat analisis terpagar (RFC-016) — lapisan DETERMINISTIK dulu.
 *
 * LLM TIDAK pernah menyentuh database; ia (nanti) hanya memilih tool lalu merangkai
 * jawaban dari JSON. Di sini tool dieksekusi: agrerat di SQL, scope peran di-enforce
 * di core (superadmin/admin/bendahara), dan setiap permintaan dicatat di `analisis_log`.
 */

const Periode = z.string().regex(/^\d{4}-\d{2}$/);
const SkemaRingkasan = z.object({ periode: Periode });
const SkemaTrenSpp = z.object({
  santri_id: z.string().min(1),
  mulai: Periode,
  selesai: Periode,
});

export type ToolAnalisis = 'ringkasan_laporan' | 'tren_pembayaran_spp';
export type HasilAnalisis = Record<string, unknown> | unknown[];

export interface DependensiAnalisis {
  readonly repoLaporan: RepoLaporan;
  readonly repoAnalisisLog: RepoAnalisisLog;
}

export interface AnalisisToolInput {
  readonly aktor: Aktor;
  readonly tool: ToolAnalisis;
  readonly parameter: unknown;
  readonly waktu: string;
}

export function buatHandlerAnalisis(dep: DependensiAnalisis) {
  function eksekusi(tool: ToolAnalisis, parameter: unknown): HasilAnalisis {
    switch (tool) {
      case 'ringkasan_laporan': {
        const p = SkemaRingkasan.parse(parameter);
        const komponen = dep.repoLaporan.laporanPerKomponen(p.periode).map((r) => ({
          komponen: r.komponen,
          terbit: r.terbit,
          masuk: r.masuk,
          sisa: r.terbit - r.masuk,
        }));
        const ring = dep.repoLaporan.ringkasan(p.periode);
        return {
          periode: p.periode,
          komponen,
          ringkasan: { terbit: ring.terbit, masuk: ring.masuk, sisa: ring.terbit - ring.masuk },
        };
      }
      case 'tren_pembayaran_spp': {
        const p = SkemaTrenSpp.parse(parameter);
        return {
          santri_id: p.santri_id,
          rentang: [p.mulai, p.selesai],
          baris: dep.repoLaporan.trenSpp(p.santri_id, p.mulai, p.selesai),
        };
      }
    }
  }

  /** Jalankan satu tool analisis — penegak izin terakhir tetap core (AGENTS.md). */
  function analisisTool(input: AnalisisToolInput): HasilHandler<HasilAnalisis> {
    if (!peranCukup(input.aktor, 'superadmin', 'admin', 'bendahara')) {
      return { ok: false, pesan: 'Hanya superadmin, admin, dan bendahara yang boleh memakai analisis.' };
    }
    let data: HasilAnalisis;
    try {
      data = eksekusi(input.tool, input.parameter);
    } catch (e) {
      const pesan = e instanceof Error ? e.message.replace(/^[A-Za-z]+Error:\s*/, '') : 'Parameter tidak valid.';
      return { ok: false, pesan: `Permintaan tidak valid: ${pesan}` };
    }
    dep.repoAnalisisLog.catat({
      aktorId: input.aktor.id,
      tool: input.tool,
      parameter: input.parameter,
      hasil: data,
      waktu: input.waktu,
    });
    return { ok: true, pesan: 'Analisis siap.', data };
  }

  return { analisisTool };
}
