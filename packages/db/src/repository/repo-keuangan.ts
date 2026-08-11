import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  entitasAkunKeuangan,
  entitasAlokasiProta,
  entitasKeringanan,
  entitasKomponenBiaya,
  entitasLebihBayar,
  entitasPembayaran,
  entitasProta,
  entitasTagihan,
  entitasTarifKomponen,
  type AkunKeuangan,
  type AlokasiProta,
  type Keringanan,
  type KomponenBiaya,
  type LebihBayar,
  type Pembayaran,
  type Prota,
  type StatusTagihan,
  type Tagihan,
  type TarifKomponen,
} from '@siakad/contracts';
import {
  buatRepoIdTunggal,
  dariSql,
  keSql,
  type RepoMasterIdTunggal,
} from './helper.js';

/**
 * Repository keuangan — 9 tabel hasil sesi P3 dan ADR 0012.
 *
 * Prinsip:
 * - Angka turunan (saldo, total, sisa) dihitung, bukan disimpan.
 * - `akun_keuangan` memakai kunci primer INTEGER, jadi punya repo khusus.
 * - Transisi status `tagihan` (lunas/dibatalkan) bersifat terminal: hanya bisa
 *   dari `terbit`, dan tidak ada jalan keluar. Koreksi = tagihan baru.
 * - Repo tidak mengandung aturan bisnis fallback tarif; itu tugas core (1.4).
 */

// ── akun_keuangan ───────────────────────────────────────────────────────────

const TABEL_AKUN = entitasAkunKeuangan.nama;
const KOLOM_AKUN = entitasAkunKeuangan.kolom.join(', ');

export interface RepoAkunKeuangan {
  readonly sisip: (baris: AkunKeuangan) => void;
  readonly ambilSemua: () => AkunKeuangan[];
  readonly ambil: (kode: number) => AkunKeuangan | undefined;
  readonly perbarui: (kode: number, perubahan: Partial<AkunKeuangan>) => void;
  readonly hapus: (kode: number) => void;
}

export function repoAkunKeuangan(db: DatabaseSync): RepoAkunKeuangan {
  const insertSql = `INSERT INTO ${TABEL_AKUN} (${KOLOM_AKUN}) VALUES (${entitasAkunKeuangan.kolom
    .map(() => '?')
    .join(', ')})`;
  const selectAllSql = `SELECT ${KOLOM_AKUN} FROM ${TABEL_AKUN}`;
  const selectOneSql = `SELECT ${KOLOM_AKUN} FROM ${TABEL_AKUN} WHERE kode = ?`;
  const deleteSql = `DELETE FROM ${TABEL_AKUN} WHERE kode = ?`;

  return {
    sisip: (baris) => {
      const sqlValues = keSql(entitasAkunKeuangan, baris);
      const values = entitasAkunKeuangan.kolom.map((k) => sqlValues[k]) as SQLInputValue[];
      db.prepare(insertSql).run(...values);
    },
    ambilSemua: () => {
      const rows = db.prepare(selectAllSql).all() as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasAkunKeuangan, r));
    },
    ambil: (kode) => {
      const row = db.prepare(selectOneSql).get(kode) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasAkunKeuangan, row) : undefined;
    },
    perbarui: (kode, perubahan) => {
      const sqlValues = keSql(entitasAkunKeuangan, perubahan);
      const keys = Object.keys(sqlValues);
      if (keys.length === 0) return;
      const sql = `UPDATE ${TABEL_AKUN} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE kode = ?`;
      const values = [...keys.map((k) => sqlValues[k]), kode] as SQLInputValue[];
      db.prepare(sql).run(...values);
    },
    hapus: (kode) => {
      db.prepare(deleteSql).run(kode);
    },
  };
}

// ── komponen_biaya ─────────────────────────────────────────────────────────

export interface RepoKomponenBiaya extends RepoMasterIdTunggal<KomponenBiaya> {
  /** Cari komponen berdasarkan kode stabil (misalnya 'spp'). */
  readonly cariByKode: (kode: string) => KomponenBiaya | undefined;
}

export function repoKomponenBiaya(db: DatabaseSync): RepoKomponenBiaya {
  const dasar = buatRepoIdTunggal(db, entitasKomponenBiaya, 'id');
  const kolom = entitasKomponenBiaya.kolom.join(', ');
  const tabel = entitasKomponenBiaya.nama;
  const selectByKode = `SELECT ${kolom} FROM ${tabel} WHERE kode = ?`;

  return {
    ...dasar,
    cariByKode: (kode) => {
      const row = db.prepare(selectByKode).get(kode) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasKomponenBiaya, row) : undefined;
    },
  };
}

// ── tarif_komponen ─────────────────────────────────────────────────────────

export interface RepoTarifKomponen extends RepoMasterIdTunggal<TarifKomponen> {
  /**
   * Cari tarif yang cocok persis. NULL di parameter artinya NULL di kolom.
   * Fallback spesifik → umum adalah tugas core (1.4), bukan repo.
   */
  readonly cariAktif: (
    tahunAjaranId: string,
    komponenBiayaId: string,
    jalur: string | null,
    marhalah: string | null,
    tingkat: number | null,
  ) => TarifKomponen | undefined;

  /** Cari tarif umum untuk tahun ajaran dan komponen (semua penyempitan NULL). */
  readonly cariUmum: (tahunAjaranId: string, komponenBiayaId: string) => TarifKomponen | undefined;
}

export function repoTarifKomponen(db: DatabaseSync): RepoTarifKomponen {
  const dasar = buatRepoIdTunggal(db, entitasTarifKomponen, 'id');
  const kolom = entitasTarifKomponen.kolom.join(', ');
  const tabel = entitasTarifKomponen.nama;

  return {
    ...dasar,
    cariAktif: (tahunAjaranId, komponenBiayaId, jalur, marhalah, tingkat) => {
      const conditions = ['tahun_ajaran_id = ?', 'komponen_biaya_id = ?', 'aktif = ?'];
      const values: SQLInputValue[] = [tahunAjaranId, komponenBiayaId, 1];

      if (jalur === null) {
        conditions.push('jalur IS NULL');
      } else {
        conditions.push('jalur = ?');
        values.push(jalur);
      }
      if (marhalah === null) {
        conditions.push('marhalah IS NULL');
      } else {
        conditions.push('marhalah = ?');
        values.push(marhalah);
      }
      if (tingkat === null) {
        conditions.push('tingkat IS NULL');
      } else {
        conditions.push('tingkat = ?');
        values.push(tingkat);
      }

      const sql = `SELECT ${kolom} FROM ${tabel} WHERE ${conditions.join(' AND ')}`;
      const row = db.prepare(sql).get(...values) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasTarifKomponen, row) : undefined;
    },
    cariUmum: (tahunAjaranId, komponenBiayaId) => {
      const sql = `SELECT ${kolom} FROM ${tabel} WHERE tahun_ajaran_id = ? AND komponen_biaya_id = ? AND jalur IS NULL AND marhalah IS NULL AND tingkat IS NULL AND aktif = 1`;
      const row = db
        .prepare(sql)
        .get(tahunAjaranId, komponenBiayaId) as Record<string, unknown> | undefined;
      return row ? dariSql(entitasTarifKomponen, row) : undefined;
    },
  };
}

// ── tagihan ────────────────────────────────────────────────────────────────

export interface RepoTagihan extends RepoMasterIdTunggal<Tagihan> {
  readonly cariBySantri: (santriId: string) => Tagihan[];
  readonly cariBySantriDanPeriode: (santriId: string, periode: string) => Tagihan[];
  readonly cariByStatus: (status: StatusTagihan) => Tagihan[];
  /** Tandai lunas hanya dari status `terbit`. */
  readonly tandaiLunas: (id: string) => void;
  /** Batalkan hanya dari status `terbit`. */
  readonly batalkan: (id: string) => void;
}

export function repoTagihan(db: DatabaseSync): RepoTagihan {
  const dasar = buatRepoIdTunggal(db, entitasTagihan, 'id');
  const kolom = entitasTagihan.kolom.join(', ');
  const tabel = entitasTagihan.nama;

  const selectBySantri = `SELECT ${kolom} FROM ${tabel} WHERE santri_id = ? ORDER BY jatuh_tempo DESC`;
  const selectBySantriDanPeriode = `SELECT ${kolom} FROM ${tabel} WHERE santri_id = ? AND periode = ? ORDER BY jatuh_tempo DESC`;
  const selectByStatus = `SELECT ${kolom} FROM ${tabel} WHERE status = ? ORDER BY jatuh_tempo DESC`;

  return {
    ...dasar,
    cariBySantri: (santriId) => {
      const rows = db.prepare(selectBySantri).all(santriId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasTagihan, r));
    },
    cariBySantriDanPeriode: (santriId, periode) => {
      const rows = db
        .prepare(selectBySantriDanPeriode)
        .all(santriId, periode) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasTagihan, r));
    },
    cariByStatus: (status) => {
      const rows = db.prepare(selectByStatus).all(status) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasTagihan, r));
    },
    tandaiLunas: (id) => {
      const sql = `UPDATE ${tabel} SET status = 'lunas' WHERE id = ? AND status = 'terbit'`;
      const hasil = db.prepare(sql).run(id);
      if (hasil.changes === 0) {
        throw new Error('Tagihan tidak ditemukan atau sudah tidak bisa ditandai lunas');
      }
    },
    batalkan: (id) => {
      const sql = `UPDATE ${tabel} SET status = 'dibatalkan' WHERE id = ? AND status = 'terbit'`;
      const hasil = db.prepare(sql).run(id);
      if (hasil.changes === 0) {
        throw new Error('Tagihan tidak ditemukan atau sudah tidak bisa dibatalkan');
      }
    },
  };
}

// ── keringanan ─────────────────────────────────────────────────────────────

export interface RepoKeringanan extends RepoMasterIdTunggal<Keringanan> {
  readonly cariByTagihan: (tagihanId: string) => Keringanan[];
}

export function repoKeringanan(db: DatabaseSync): RepoKeringanan {
  const dasar = buatRepoIdTunggal(db, entitasKeringanan, 'id');
  const kolom = entitasKeringanan.kolom.join(', ');
  const tabel = entitasKeringanan.nama;
  const selectByTagihan = `SELECT ${kolom} FROM ${tabel} WHERE tagihan_id = ? ORDER BY waktu DESC`;

  return {
    ...dasar,
    cariByTagihan: (tagihanId) => {
      const rows = db.prepare(selectByTagihan).all(tagihanId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasKeringanan, r));
    },
  };
}

// ── pembayaran ─────────────────────────────────────────────────────────────

export interface RepoPembayaran extends RepoMasterIdTunggal<Pembayaran> {
  readonly cariByTagihan: (tagihanId: string) => Pembayaran[];
  /** Total pembayaran untuk satu tagihan; 0 bila belum ada pembayaran. */
  readonly hitungTotalByTagihan: (tagihanId: string) => number;
}

export function repoPembayaran(db: DatabaseSync): RepoPembayaran {
  const dasar = buatRepoIdTunggal(db, entitasPembayaran, 'id');
  const kolom = entitasPembayaran.kolom.join(', ');
  const tabel = entitasPembayaran.nama;
  const selectByTagihan = `SELECT ${kolom} FROM ${tabel} WHERE tagihan_id = ? ORDER BY waktu DESC`;
  const sumSql = `SELECT COALESCE(SUM(nominal), 0) AS total FROM ${tabel} WHERE tagihan_id = ?`;

  return {
    ...dasar,
    cariByTagihan: (tagihanId) => {
      const rows = db.prepare(selectByTagihan).all(tagihanId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasPembayaran, r));
    },
    hitungTotalByTagihan: (tagihanId) => {
      const row = db.prepare(sumSql).get(tagihanId) as { total: number } | undefined;
      return row?.total ?? 0;
    },
  };
}

// ── prota ──────────────────────────────────────────────────────────────────

export interface RepoProta extends RepoMasterIdTunggal<Prota> {
  readonly cariBySantri: (santriId: string) => Prota[];
  readonly cariByPeriode: (periode: string) => Prota[];
  /**
   * Kurangi sisa dana. Hanya berhasil bila sisa masih cukup.
   * Bila sisa tidak cukup, throw error.
   */
  readonly kurangiSisa: (id: string, nominal: number) => void;
}

export function repoProta(db: DatabaseSync): RepoProta {
  const dasar = buatRepoIdTunggal(db, entitasProta, 'id');
  const kolom = entitasProta.kolom.join(', ');
  const tabel = entitasProta.nama;
  const selectBySantri = `SELECT ${kolom} FROM ${tabel} WHERE santri_id = ? ORDER BY periode DESC`;
  const selectByPeriode = `SELECT ${kolom} FROM ${tabel} WHERE periode = ? ORDER BY periode DESC`;

  return {
    ...dasar,
    cariBySantri: (santriId) => {
      const rows = db.prepare(selectBySantri).all(santriId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasProta, r));
    },
    cariByPeriode: (periode) => {
      const rows = db.prepare(selectByPeriode).all(periode) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasProta, r));
    },
    kurangiSisa: (id, nominal) => {
      const sql = `UPDATE ${tabel} SET sisa = sisa - ? WHERE id = ? AND sisa >= ?`;
      const hasil = db.prepare(sql).run(nominal, id, nominal);
      if (hasil.changes === 0) {
        throw new Error('PROTA tidak ditemukan atau sisa tidak cukup');
      }
    },
  };
}

// ── alokasi_prota ──────────────────────────────────────────────────────────

export interface RepoAlokasiProta extends RepoMasterIdTunggal<AlokasiProta> {
  readonly cariByProta: (protaId: string) => AlokasiProta[];
  readonly cariByTagihan: (tagihanId: string) => AlokasiProta[];
}

export function repoAlokasiProta(db: DatabaseSync): RepoAlokasiProta {
  const dasar = buatRepoIdTunggal(db, entitasAlokasiProta, 'id');
  const kolom = entitasAlokasiProta.kolom.join(', ');
  const tabel = entitasAlokasiProta.nama;
  const selectByProta = `SELECT ${kolom} FROM ${tabel} WHERE prota_id = ? ORDER BY waktu DESC`;
  const selectByTagihan = `SELECT ${kolom} FROM ${tabel} WHERE tagihan_id = ? ORDER BY waktu DESC`;

  return {
    ...dasar,
    cariByProta: (protaId) => {
      const rows = db.prepare(selectByProta).all(protaId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasAlokasiProta, r));
    },
    cariByTagihan: (tagihanId) => {
      const rows = db.prepare(selectByTagihan).all(tagihanId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasAlokasiProta, r));
    },
  };
}

// ── lebih_bayar ────────────────────────────────────────────────────────────

export interface RepoLebihBayar extends RepoMasterIdTunggal<LebihBayar> {
  readonly cariBySantri: (santriId: string) => LebihBayar[];
  /** Saldo lebih bayar satu santri; 0 bila belum ada. */
  readonly hitungSaldo: (santriId: string) => number;
  /** Sisip baris lebih bayar baru. */
  readonly tambahSaldo: (baris: LebihBayar) => void;
}

export function repoLebihBayar(db: DatabaseSync): RepoLebihBayar {
  const dasar = buatRepoIdTunggal(db, entitasLebihBayar, 'id');
  const kolom = entitasLebihBayar.kolom.join(', ');
  const tabel = entitasLebihBayar.nama;
  const selectBySantri = `SELECT ${kolom} FROM ${tabel} WHERE santri_id = ? ORDER BY waktu DESC`;
  const sumSql = `SELECT COALESCE(SUM(nominal), 0) AS total FROM ${tabel} WHERE santri_id = ?`;

  return {
    ...dasar,
    cariBySantri: (santriId) => {
      const rows = db.prepare(selectBySantri).all(santriId) as Record<string, unknown>[];
      return rows.map((r) => dariSql(entitasLebihBayar, r));
    },
    hitungSaldo: (santriId) => {
      const row = db.prepare(sumSql).get(santriId) as { total: number } | undefined;
      return row?.total ?? 0;
    },
    tambahSaldo: (baris) => {
      dasar.sisip(baris);
    },
  };
}
