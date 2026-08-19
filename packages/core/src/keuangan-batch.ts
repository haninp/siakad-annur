import { buatHandlerKeuangan, type DepKeuangan } from './keuangan-handler.js';

/**
 * Penerbitan tagihan bulanan — pekerjaan back office (RFC-003).
 *
 * Pengurus tidak menerbitkan tagihan; back office yang menjalankan ini:
 * script `npm run tagihan:terbitkan` sekarang, cron di `apps/worker` nanti.
 *
 * Idempoten: santri yang sudah punya tagihan pada periode yang sama dilewati
 * (predikat `sudahAda`). Tanpa predikat, handler akan menolak duplikat dan
 * dihitung sebagai `gagal`.
 */

export interface OpsiTerbitkanBulanan {
  readonly santri: readonly { id: string; nama_lengkap: string }[];
  readonly komponenBiayaId: string;
  readonly tahunAjaranId: string;
  readonly periode: string;
  readonly actorId: string;
  /** Predikat opsional: apakah santri sudah punya tagihan pada periode ini? */
  readonly sudahAda?: (santriId: string) => boolean;
}

export interface HasilTerbitkanBulanan {
  readonly periode: string;
  readonly diterbitkan: number;
  readonly sudahAda: number;
  readonly gagal: number;
  readonly rincian: readonly string[];
}

export function terbitkanTagihanBulanan(
  dep: DepKeuangan,
  opsi: OpsiTerbitkanBulanan,
): HasilTerbitkanBulanan {
  const handler = buatHandlerKeuangan(dep);
  const rincian: string[] = [];
  let diterbitkan = 0;
  let sudahAda = 0;
  let gagal = 0;

  for (const s of opsi.santri) {
    if (opsi.sudahAda?.(s.id)) {
      sudahAda += 1;
      continue;
    }
    const hasil = handler.terbitkanTagihan({
      aktor: { peran: 'bendahara', id: opsi.actorId },
      santriId: s.id,
      komponenBiayaId: opsi.komponenBiayaId,
      tahunAjaranId: opsi.tahunAjaranId,
      periode: opsi.periode,
      skemaPeriode: 'masehi',
      waktu: new Date().toISOString(),
    });
    if (hasil.ok) {
      diterbitkan += 1;
      rincian.push(`${s.nama_lengkap}: ${hasil.pesan}`);
    } else {
      gagal += 1;
      rincian.push(`${s.nama_lengkap}: ${hasil.pesan}`);
    }
  }

  return { periode: opsi.periode, diterbitkan, sudahAda, gagal, rincian };
}
