import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { z } from 'zod';
import type { Entitas } from '@siakad/contracts';

/**
 * Helper dasar repository. Menangani konversi boolean SQLite (INTEGER 0/1)
 * ke/zod boolean, dan menyusun pernyataan SQL sederhana.
 */

type SkemaZod = z.ZodType<unknown>;
type Bentuk = Record<string, SkemaZod>;

function bentuk(entitas: Entitas<unknown>): Bentuk {
  return (entitas.skema as unknown as { shape: Bentuk }).shape;
}

function isBooleanSchema(skema: SkemaZod): boolean {
  if (skema instanceof z.ZodBoolean) return true;
  if (skema instanceof z.ZodNullable && skema.unwrap() instanceof z.ZodBoolean) {
    return true;
  }
  if (skema instanceof z.ZodDefault) {
    return isBooleanSchema(skema._def.innerType as SkemaZod);
  }
  return false;
}

/** Konversi nilai dari objek zod ke nilai yang bisa disimpan SQLite. */
export function keSql<T>(entitas: Entitas<T>, baris: Partial<T>): Record<string, SQLInputValue> {
  const shape = bentuk(entitas as Entitas<unknown>);
  const hasil: Record<string, SQLInputValue> = {};
  for (const kolom of entitas.kolom) {
    const nilai = (baris as Record<string, unknown>)[kolom];
    if (nilai === undefined) continue;
    if (isBooleanSchema(shape[kolom] as SkemaZod)) {
      hasil[kolom] = nilai === null ? null : nilai ? 1 : 0;
    } else {
      hasil[kolom] = nilai as SQLInputValue;
    }
  }
  return hasil;
}

/** Konversi baris SQLite ke objek yang sesuai skema zod. */
export function dariSql<T>(entitas: Entitas<T>, baris: Record<string, unknown>): T {
  const shape = bentuk(entitas as Entitas<unknown>);
  const hasil: Record<string, unknown> = {};
  for (const kolom of entitas.kolom) {
    const nilai = baris[kolom];
    if (isBooleanSchema(shape[kolom] as SkemaZod)) {
      hasil[kolom] = nilai === null ? null : nilai === 1 || nilai === true;
    } else {
      hasil[kolom] = nilai;
    }
  }
  return hasil as T;
}

export interface RepoDasar<T> {
  readonly sisip: (baris: T) => void;
  readonly ambilSemua: () => T[];
}

/** Repository untuk entitas master dengan kunci primer tunggal. */
export interface RepoMasterIdTunggal<T> extends RepoDasar<T> {
  readonly ambil: (id: string) => T | undefined;
  readonly perbarui: (id: string, perubahan: Partial<T>) => void;
  readonly hapus: (id: string) => void;
}

/** Repository untuk entitas master dengan kunci primer komposit. */
export interface RepoMasterKomposit<T> extends RepoDasar<T> {
  readonly ambil: (id: Record<string, string>) => T | undefined;
  readonly perbarui: (id: Record<string, string>, perubahan: Partial<T>) => void;
  readonly hapus: (id: Record<string, string>) => void;
}

export function buatRepoIdTunggal<T>(
  db: DatabaseSync,
  entitas: Entitas<T>,
  kolomId: keyof T & string,
): RepoMasterIdTunggal<T> {
  const kolom = entitas.kolom.join(', ');
  const placeholder = entitas.kolom.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${entitas.nama} (${kolom}) VALUES (${placeholder})`;
  const selectAllSql = `SELECT ${kolom} FROM ${entitas.nama}`;
  const selectOneSql = `SELECT ${kolom} FROM ${entitas.nama} WHERE ${kolomId} = ?`;
  const deleteSql = `DELETE FROM ${entitas.nama} WHERE ${kolomId} = ?`;

  return {
    sisip: (baris) => {
      const sqlValues = keSql(entitas, baris);
      const values = entitas.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },
    ambilSemua: () => {
      const rows = db.prepare(selectAllSql).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitas, r));
    },
    ambil: (id) => {
      const row = db.prepare(selectOneSql).get(id) as Record<string, unknown> | undefined;
      return row ? dariSql(entitas, row) : undefined;
    },
    perbarui: (id, perubahan) => {
      const sqlValues = keSql(entitas, perubahan);
      const keys = Object.keys(sqlValues);
      const sql = `UPDATE ${entitas.nama} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${kolomId} = ?`;
      const values = [...keys.map((k) => sqlValues[k]), id] as SQLInputValue[];
      db.prepare(sql).run(...values);
    },
    hapus: (id) => {
      db.prepare(deleteSql).run(id);
    },
  };
}

export function buatRepoKomposit<T>(
  db: DatabaseSync,
  entitas: Entitas<T>,
  kolomId: readonly (keyof T & string)[],
): RepoMasterKomposit<T> {
  const kolom = entitas.kolom.join(', ');
  const placeholder = entitas.kolom.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${entitas.nama} (${kolom}) VALUES (${placeholder})`;
  const selectAllSql = `SELECT ${kolom} FROM ${entitas.nama}`;

  const idWhere = () => kolomId.map((k) => `${k} = ?`).join(' AND ');
  const idValues = (id: Record<string, string>) => kolomId.map((k) => id[k] as string);

  const selectOneSql = `SELECT ${kolom} FROM ${entitas.nama} WHERE ${idWhere()}`;
  const deleteSql = `DELETE FROM ${entitas.nama} WHERE ${idWhere()}`;

  return {
    sisip: (baris) => {
      const sqlValues = keSql(entitas, baris);
      const values = entitas.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },
    ambilSemua: () => {
      const rows = db.prepare(selectAllSql).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitas, r));
    },
    ambil: (id) => {
      const row = db.prepare(selectOneSql).get(...idValues(id)) as
        | Record<string, unknown>
        | undefined;
      return row ? dariSql(entitas, row) : undefined;
    },
    perbarui: (id, perubahan) => {
      const sqlValues = keSql(entitas, perubahan);
      const keys = Object.keys(sqlValues);
      const sql = `UPDATE ${entitas.nama} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${idWhere()}`;
      const values = [...keys.map((k) => sqlValues[k]), ...idValues(id)] as SQLInputValue[];
      db.prepare(sql).run(...values);
    },
    hapus: (id) => {
      db.prepare(deleteSql).run(...idValues(id));
    },
  };
}
