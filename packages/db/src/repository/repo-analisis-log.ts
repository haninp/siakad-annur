import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';

/**
 * Repository `analisis_log` (RFC-016) — jejak append-only tiap permintaan analisis:
 * siapa, tool, parameter (JSON), dan hasil (JSON). Transparansi & bahan "promosi ke menu".
 */
export interface BarisAnalisisLog {
  readonly id: string;
  readonly aktor_id: string;
  readonly tool: string;
  readonly parameter: string;
  readonly hasil: string;
  readonly waktu: string;
}

export interface RepoAnalisisLog {
  readonly catat: (b: {
    aktorId: string;
    tool: string;
    parameter: unknown;
    hasil: unknown;
    waktu: string;
  }) => void;
  readonly cariByAktor: (aktorId: string) => BarisAnalisisLog[];
}

export function repoAnalisisLog(db: DatabaseSync): RepoAnalisisLog {
  return {
    catat: (b) => {
      db.prepare(
        `INSERT INTO analisis_log (id, aktor_id, tool, parameter, hasil, waktu)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(buatUlid(), b.aktorId, b.tool, JSON.stringify(b.parameter), JSON.stringify(b.hasil), b.waktu);
    },
    cariByAktor: (aktorId) => {
      return db
        .prepare(
          `SELECT id, aktor_id, tool, parameter, hasil, waktu
           FROM analisis_log WHERE aktor_id = ? ORDER BY waktu DESC`,
        )
        .all(aktorId) as unknown as BarisAnalisisLog[];
    },
  };
}
