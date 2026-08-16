import type { DatabaseSync } from 'node:sqlite';
import { buatUlid } from '@siakad/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bukaBasisData, DAFTAR_MIGRASI, jalankanMigrasi } from '../index.js';
import { repoNotifikasi } from './repo-notifikasi.js';

/**
 * Repository notifikasi (RFC-011): tagihan terbit yang belum dinotifikasi,
 * wali terdaftar penerima, dan penandaan idempoten.
 */

let db: DatabaseSync;

beforeEach(() => {
  db = bukaBasisData({ lokasi: ':memory:' });
  jalankanMigrasi(db, DAFTAR_MIGRASI);
});

/** Seed minimal: akun/komponen/TA dibagi (idempoten), santri+wali unik tiap panggilan. */
let urutanSantri = 0;
function seedDasar(telegramId: number | null): { santriId: string; komponen: string; ta: string } {
  urutanSantri += 1;
  const nis = `26270${urutanSantri}`;
  const komponen = 'kmp-spp';
  const ta = 'ta-2026-2027';
  const santriId = buatUlid(1_000_000_000_004);
  const waliId = buatUlid(1_000_000_000_005);

  db.prepare(`INSERT OR IGNORE INTO akun_keuangan (kode, nama, arah, aktif) VALUES (1, 'Kas', 'masuk', 1)`).run();
  db.prepare(
    `INSERT OR IGNORE INTO komponen_biaya (id, kode, nama, akun_keuangan_kode, aktif)
     VALUES (?, 'spp', 'SPP Bulanan', 1, 1)`,
  ).run(komponen);
  db.prepare(
    `INSERT OR IGNORE INTO tahun_ajaran (id, kode, mulai, selesai, aktif)
     VALUES (?, '2026-2027', '2026-07-01', '2027-06-30', 1)`,
  ).run(ta);
  db.prepare(
    `INSERT INTO santri (id, nis, nisn, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
       alamat, desa_kelurahan, kecamatan, kabupaten, provinsi, kode_pos, status, anak_ke, jumlah_saudara)
     VALUES (?, ?, NULL, NULL, 'Aidah', 'perempuan', 'Jakarta', '2021-10-25',
       NULL, NULL, NULL, NULL, NULL, NULL, 'aktif', NULL, NULL)`,
  ).run(santriId, nis);
  db.prepare(
    `INSERT INTO wali (id, nik, nama_lengkap, no_hp, alamat, status_hidup)
     VALUES (?, NULL, 'Bapak Contoh', NULL, NULL, 'hidup')`,
  ).run(waliId);
  db.prepare(
    `INSERT INTO santri_wali (santri_id, wali_id, hubungan, penanggung_biaya, penerima_notifikasi, aktif)
     VALUES (?, ?, 'ayah', 1, 1, 1)`,
  ).run(santriId, waliId);
  db.prepare(
    `INSERT INTO pengguna_telegram (id, telegram_id, peran, wali_id, undangan_kode, aktif, dibuat_pada)
     VALUES (?, ?, 'wali', ?, NULL, 1, '2026-08-16T08:00:00+07:00')`,
  ).run(buatUlid(1_000_000_000_006), telegramId, waliId);
  return { santriId, komponen, ta };
}

function sisipTagihan(
  id: string,
  santriId: string,
  komponen: string,
  ta: string,
  status: string,
): void {
  db.prepare(
    `INSERT INTO tagihan (id, santri_id, tahun_ajaran_id, komponen_biaya_id, periode,
       skema_periode, jatuh_tempo, nominal, prorata_mulai, status)
     VALUES (?, ?, ?, ?, '2026-08', 'masehi', '2026-09-10', 450000, NULL, ?)`,
  ).run(id, santriId, ta, komponen, status);
}

describe('cariTagihanPerluNotifikasi', () => {
  it('hanya tagihan terbit yang belum dinotifikasi', () => {
    const a = seedDasar(144666620);
    const b = seedDasar(177782856);
    const c = seedDasar(null);
    const perlu = buatUlid(2_000_000_000_001);
    const sudah = buatUlid(2_000_000_000_002);
    const lunas = buatUlid(2_000_000_000_003);
    sisipTagihan(perlu, a.santriId, a.komponen, a.ta, 'terbit');
    sisipTagihan(sudah, b.santriId, b.komponen, b.ta, 'terbit');
    sisipTagihan(lunas, c.santriId, c.komponen, c.ta, 'lunas');
    const repo = repoNotifikasi(db);
    repo.tandaiNotifikasiTerbit(sudah, 'w');

    const daftar = repo.cariTagihanPerluNotifikasi();
    expect(daftar.map((t) => t.tagihan_id)).toEqual([perlu]);
    expect(daftar[0]?.komponen_nama).toBe('SPP Bulanan');
    expect(daftar[0]?.santri_nama).toBe('Aidah');
    expect(daftar[0]?.nominal).toBe(450000);
  });
});

describe('cariWaliTerdaftar', () => {
  it('mengembalikan wali yang terdaftar di pengguna_telegram', () => {
    const { santriId } = seedDasar(144666620);
    const wali = repoNotifikasi(db).cariWaliTerdaftar(santriId);
    expect(wali).toEqual([{ telegram_id: 144666620, wali_nama: 'Bapak Contoh' }]);
  });

  it('wali tanpa telegram_id tidak muncul', () => {
    const { santriId } = seedDasar(null);
    expect(repoNotifikasi(db).cariWaliTerdaftar(santriId)).toEqual([]);
  });
});

describe('tandaiNotifikasiTerbit', () => {
  it('idempoten — tandai dua kali tidak menggandakan', () => {
    const { santriId, komponen, ta } = seedDasar(144666620);
    const tagihanId = buatUlid(2_000_000_000_001);
    sisipTagihan(tagihanId, santriId, komponen, ta, 'terbit');
    const repo = repoNotifikasi(db);

    repo.tandaiNotifikasiTerbit(tagihanId, 'w1');
    repo.tandaiNotifikasiTerbit(tagihanId, 'w2');

    expect(repo.cariTagihanPerluNotifikasi()).toHaveLength(0);
    const baris = db
      .prepare(`SELECT dikirim_pada FROM notifikasi_terbit WHERE tagihan_id = ?`)
      .get(tagihanId) as { dikirim_pada: string };
    expect(baris.dikirim_pada).toBe('w1');
  });
});

describe('cariTagihanJatuhTempo & tandaiJatuhTempo (RFC-012)', () => {
  it('hanya tagihan terbit yang jatuh temponya H-3/H-1 dan belum ditandai', () => {
    const a = seedDasar(144666620); // santri untuk h3
    const b = seedDasar(177782856); // santri untuk h1
    const c = seedDasar(null); // santri untuk bukan-jendela
    const h3 = buatUlid(2_000_000_000_011);
    const h1 = buatUlid(2_000_000_000_012);
    const bukan = buatUlid(2_000_000_000_013);
    sisipTagihan(h3, a.santriId, a.komponen, a.ta, 'terbit');
    sisipTagihan(h1, b.santriId, b.komponen, b.ta, 'terbit');
    sisipTagihan(bukan, c.santriId, c.komponen, c.ta, 'terbit');
    // Untuk H-3/H-1 perlu jatuh_tempo spesifik — ubah via SQL
    db.prepare(`UPDATE tagihan SET jatuh_tempo = '2026-08-19' WHERE id = ?`).run(h3);
    db.prepare(`UPDATE tagihan SET jatuh_tempo = '2026-08-17' WHERE id = ?`).run(h1);
    db.prepare(`UPDATE tagihan SET jatuh_tempo = '2026-09-01' WHERE id = ?`).run(bukan);
    const repo = repoNotifikasi(db);

    const daftarH3 = repo.cariTagihanJatuhTempo('2026-08-16', 3, 'h3');
    expect(daftarH3.map((t) => t.tagihan_id)).toEqual([h3]);
    expect(repo.cariTagihanJatuhTempo('2026-08-16', 1, 'h1').map((t) => t.tagihan_id)).toEqual([h1]);

    repo.tandaiJatuhTempo(h3, 'h3', 'w');
    expect(repo.cariTagihanJatuhTempo('2026-08-16', 3, 'h3')).toHaveLength(0);
    // tahap h1 untuk tagihan yang sama tetap bisa
    expect(repo.cariTagihanJatuhTempo('2026-08-18', 1, 'h1').map((t) => t.tagihan_id)).toEqual([h3]);
  });
});
