import { z } from 'zod';
import type { RepoAbsensi, RepoUsulanIzin } from '@siakad/db';
import { StatusAbsensi as StatusZod } from '@siakad/contracts';
import type { Santri, StatusAbsensi } from '@siakad/contracts';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';

/**
 * Modul absensi santri (Fase 2 akademik).
 * - Pencatatan deterministik (LLM tidak menulis DB).
 * - Pencatat: superadmin/admin/pengajar.
 * - `daftarKehadiranHari` memberi tampilan daftar santri + status hari ini + ada/tidaknya
 *   permohonan izin wali (utk tombol "ack izin" saat absensi).
 */
const SkemaCatat = z.object({
  santri_id: z.string().min(1),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: StatusZod,
  keterangan: z.string().max(200).nullable().optional(),
});

export interface DependensiAbsensi {
  readonly repoAbsensi: RepoAbsensi;
  readonly repoSantri: { readonly ambilSemua: () => Santri[] };
  readonly repoUsulanIzin: RepoUsulanIzin;
}

export interface CatatAbsensiInput {
  readonly aktor: Aktor;
  readonly santri_id: string;
  readonly tanggal: string;
  readonly status: StatusAbsensi;
  readonly keterangan?: string | null;
  readonly waktu: string;
}

/** Baris tampilan utk satu santri pada absensi hari tertentu. */
export interface BarisKehadiran {
  readonly santri_id: string;
  readonly nis: string;
  readonly nama: string;
  /** status hari itu; null = belum diabsen. */
  readonly status: StatusAbsensi | null;
  /** true bila ada permohonan izin wali (menunggu/diterima) utk tanggal tsb → tombol ack izin. */
  readonly adaIzinWali: boolean;
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

  function daftarKehadiranHari(input: { aktor: Aktor; tanggal: string }): HasilHandler<BarisKehadiran[]> {
    if (!peranCukup(input.aktor, 'superadmin', 'admin', 'pengajar')) {
      return { ok: false, pesan: 'Hanya superadmin, admin, dan pengajar yang boleh mengakses absensi.' };
    }
    const santri = dep.repoSantri.ambilSemua().filter((s) => s.status === 'aktif');
    const baris: BarisKehadiran[] = santri.map((s) => {
      const hariIni = dep.repoAbsensi.cariBySantriRentang(s.id, input.tanggal, input.tanggal);
      const usulan = dep.repoUsulanIzin.cariBySantriDanTanggal(s.id, input.tanggal);
      return {
        santri_id: s.id,
        nis: s.nis,
        nama: s.nama_lengkap,
        status: hariIni.length > 0 ? (hariIni[0]?.status ?? null) : null,
        adaIzinWali: usulan.some((u) => u.status === 'menunggu' || u.status === 'diterima'),
      };
    });
    return { ok: true, pesan: `${baris.length} santri untuk tanggal ${input.tanggal}.`, data: baris };
  }

  return { catatAbsensi, daftarKehadiranHari };
}