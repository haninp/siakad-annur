/**
 * Pipa analitik (RFC-018) — orkestrasi bronze → silver → gold secara idempoten.
 * Skala kecil: bangun ulang penuh tiap jalan (tanpa incremental state, ADR 0002).
 */
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { bangunBronze } from './bronze.js';
import { bangunSilver } from './silver.js';
import { bangunGold } from './gold.js';

export interface KonfigurasiPipeline {
  readonly lokasiDb?: string; // SQLite OLTP (default SIAKAD_DB / data/sqlite/siakad.db)
  readonly akarParquet?: string; // default data/parquet
  readonly lokasiDuck?: string; // file gudang DuckDB (default data/db/analitik.duckdb)
  readonly snapshot?: string; // ISO UTC (default sekarang)
}

export interface HasilPipeline {
  readonly snapshot: string;
  readonly bronze: string[];
  readonly silver: string[];
  readonly gold: string[];
}

export async function jalankanPipelineAnalitik(kfg: KonfigurasiPipeline = {}): Promise<HasilPipeline> {
  const snapshot = kfg.snapshot ?? new Date().toISOString();
  const akarParquet = kfg.akarParquet ?? 'data/parquet';
  const lokasiDb = kfg.lokasiDb ?? process.env.SIAKAD_DB ?? 'data/sqlite/siakad.db';
  const lokasiDuck = kfg.lokasiDuck ?? 'data/db/analitik.duckdb';
  mkdirSync(path.dirname(lokasiDuck), { recursive: true });

  const bronze = await bangunBronze({ lokasiDb, akarParquet, snapshot });
  const silver = await bangunSilver({ akarParquet, lokasiDuck, snapshot });
  const gold = await bangunGold({ lokasiDuck });

  return { snapshot, bronze: bronze.ditulis, silver: silver.tabel, gold: gold.mart };
}