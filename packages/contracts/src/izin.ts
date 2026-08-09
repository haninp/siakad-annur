import { z } from 'zod';
import { Ulid } from './enum.js';
import type { Entitas, PetaKlasifikasi } from './klasifikasi.js';

/**
 * `usulan_izin` — satu-satunya tabel yang boleh ditulis `apps/bot-wali`.
 * Lihat ADR 0009; pagarnya ada di sana dan sebagiannya ditegakkan di sini.
 *
 * Ia **bukan** `absensi`. Tidak pernah memengaruhi kehadiran sampai wali kelas
 * meng-_acknowledge_, dan yang menulis `absensi` tetap `bot-internal`.
 */

const TanggalIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD');
const WaktuIso = z.string().datetime({ offset: true });

export const JenisIzin = z.enum(['sakit', 'izin']);
export type JenisIzin = z.infer<typeof JenisIzin>;

export const StatusUsulan = z.enum(['menunggu', 'diterima', 'ditolak', 'dibatalkan']);
export type StatusUsulan = z.infer<typeof StatusUsulan>;

/**
 * Dari mana kabarnya masuk. Dicatat supaya polanya terukur — tujuannya bukan
 * menihilkan jalur lisan, tapi memastikan jalur lisan tidak lagi berarti kabarnya
 * hilang. Lihat docs/08-akademik-kebutuhan.md bagian 8.
 */
export const KanalLaporan = z.enum(['bot_wali', 'lisan', 'grup', 'telepon']);
export type KanalLaporan = z.infer<typeof KanalLaporan>;

const bentukUsulanIzin = z.object({
  id: Ulid,
  /**
   * Wajib eksplisit — **tidak boleh disimpulkan dari pengirim**. Satu wali bisa
   * punya beberapa santri, dan menebak akan salah secara senyap.
   */
  santri_id: Ulid,
  /** Wajib eksplisit. "Besok tidak masuk" yang dikirim malam hari adalah kasus biasa. */
  tanggal: TanggalIso,
  jenis: JenisIzin,
  /** Kalimat pelapor apa adanya. Boleh kosong bila laporannya lewat tombol saja. */
  alasan: z.string().trim().min(1).nullable(),

  /** Sumber kabar — selalu wali, walaupun yang mengetikkan orang lain. */
  dilaporkan_oleh_wali_id: Ulid,
  /**
   * Siapa yang memasukkan. Dua kolom terpisah, bukan satu kolom polimorfik,
   * supaya integritas rujukan tetap ditegakkan basis data — prinsip yang sama
   * dengan tabel alias (ADR 0008).
   */
  dicatat_oleh_wali_id: Ulid.nullable(),
  dicatat_oleh_pengajar_id: Ulid.nullable(),
  kanal: KanalLaporan,

  status: StatusUsulan,
  ditanggapi_oleh_pengajar_id: Ulid.nullable(),
  /**
   * Pembatalan oleh pelapor. Terpisah dari `ditanggapi_oleh_pengajar_id` karena
   * yang membatalkan adalah wali, bukan pengajar — dan pemisahan itu sekaligus
   * yang menegakkan aturannya (lihat refine di bawah).
   */
  dibatalkan_oleh_wali_id: Ulid.nullable(),
  waktu_tanggap: WaktuIso.nullable(),
  dibuat_pada: WaktuIso,
});

export const UsulanIzin = bentukUsulanIzin
  .refine(
    (u) => (u.dicatat_oleh_wali_id === null) !== (u.dicatat_oleh_pengajar_id === null),
    'tepat satu dari dicatat_oleh_wali_id atau dicatat_oleh_pengajar_id harus terisi',
  )
  .refine(
    (u) =>
      u.status !== 'menunggu' ||
      (u.ditanggapi_oleh_pengajar_id === null &&
        u.dibatalkan_oleh_wali_id === null &&
        u.waktu_tanggap === null),
    'usulan yang masih menunggu tidak boleh punya penanggap, pembatal, atau waktu tanggap',
  )
  .refine(
    (u) =>
      !(u.status === 'diterima' || u.status === 'ditolak') ||
      (u.ditanggapi_oleh_pengajar_id !== null &&
        u.dibatalkan_oleh_wali_id === null &&
        u.waktu_tanggap !== null),
    'usulan yang diterima atau ditolak wajib mencatat pengajar penanggap dan waktunya',
  )
  /**
   * Pembatalan hanya sah selama belum di-_acknowledge_ wali kelas — dan itu
   * ditegakkan **bentuknya**, bukan sekadar dijaga alur: baris yang pernah
   * ditanggapi pengajar punya `ditanggapi_oleh_pengajar_id` terisi, sehingga
   * baris batal yang juga memuatnya tidak akan lolos.
   */
  .refine(
    (u) =>
      u.status !== 'dibatalkan' ||
      (u.dibatalkan_oleh_wali_id !== null &&
        u.ditanggapi_oleh_pengajar_id === null &&
        u.waktu_tanggap !== null),
    'usulan batal wajib mencatat wali pembatal dan waktunya, dan tidak boleh sudah ditanggapi pengajar',
  );
export type UsulanIzin = z.infer<typeof UsulanIzin>;

const klasifikasiUsulanIzin: PetaKlasifikasi<UsulanIzin> = {
  id: 'internal',
  santri_id: 'internal',
  /** Tanggal ketidakhadiran melekat pada keterangan kesehatan anak. */
  tanggal: 'sensitif',
  /** `sakit` adalah keterangan kesehatan anak di bawah umur. */
  jenis: 'sensitif',
  alasan: 'sensitif',
  dilaporkan_oleh_wali_id: 'internal',
  dicatat_oleh_wali_id: 'internal',
  dicatat_oleh_pengajar_id: 'internal',
  kanal: 'internal',
  status: 'internal',
  ditanggapi_oleh_pengajar_id: 'internal',
  dibatalkan_oleh_wali_id: 'internal',
  waktu_tanggap: 'internal',
  dibuat_pada: 'internal',
};

export const entitasUsulanIzin: Entitas<UsulanIzin> = {
  nama: 'usulan_izin',
  skema: UsulanIzin,
  kolom: Object.keys(bentukUsulanIzin.shape) as (keyof UsulanIzin & string)[],
  klasifikasi: klasifikasiUsulanIzin,
};

/** Satu-satunya tabel yang boleh disentuh handler tulis `bot-wali` (ADR 0010). */
export const TABEL_TULIS_BOT_WALI = 'usulan_izin';

export interface HandlerTulis {
  readonly nama: string;
  /** Harus selalu `usulan_izin`. Ini invarian yang sebenarnya dijaga. */
  readonly tabel: string;
  readonly operasi: 'sisip' | 'ubah';
}

/**
 * Daftar-putih handler tulis `apps/bot-wali` (ADR 0009, diperluas ADR 0010).
 *
 * Yang dijaga **bukan jumlahnya**, melainkan sasarannya: setiap handler di sini
 * hanya boleh menyentuh `usulan_izin`. Aturan berbasis hitungan akan tergerus
 * satu per satu; aturan berbasis sasaran tidak.
 *
 * Jumlahnya tetap diuji sebagai pemicu tinjauan — bukan sebagai larangan.
 */
export const HANDLER_TULIS_BOT_WALI: readonly HandlerTulis[] = [
  { nama: 'ajukanIzin', tabel: TABEL_TULIS_BOT_WALI, operasi: 'sisip' },
  { nama: 'batalkanIzin', tabel: TABEL_TULIS_BOT_WALI, operasi: 'ubah' },
];

export const DDL_IZIN = `
CREATE TABLE usulan_izin (
  id                           TEXT PRIMARY KEY,
  santri_id                    TEXT NOT NULL REFERENCES santri(id),
  tanggal                      TEXT NOT NULL,
  jenis                        TEXT NOT NULL CHECK (jenis IN ('sakit','izin')),
  alasan                       TEXT,
  dilaporkan_oleh_wali_id      TEXT NOT NULL REFERENCES wali(id),
  dicatat_oleh_wali_id         TEXT REFERENCES wali(id),
  dicatat_oleh_pengajar_id     TEXT REFERENCES pengajar(id),
  kanal                        TEXT NOT NULL
    CHECK (kanal IN ('bot_wali','lisan','grup','telepon')),
  status                       TEXT NOT NULL
    CHECK (status IN ('menunggu','diterima','ditolak','dibatalkan')),
  ditanggapi_oleh_pengajar_id  TEXT REFERENCES pengajar(id),
  dibatalkan_oleh_wali_id      TEXT REFERENCES wali(id),
  waktu_tanggap                TEXT,
  dibuat_pada                  TEXT NOT NULL,

  CHECK (
    (dicatat_oleh_wali_id IS NULL) <> (dicatat_oleh_pengajar_id IS NULL)
  ),
  -- Menunggu: belum ada yang menyentuh.
  CHECK (
    status <> 'menunggu'
    OR (ditanggapi_oleh_pengajar_id IS NULL
        AND dibatalkan_oleh_wali_id IS NULL
        AND waktu_tanggap IS NULL)
  ),
  -- Diterima / ditolak: wali kelas yang menutup.
  CHECK (
    status NOT IN ('diterima','ditolak')
    OR (ditanggapi_oleh_pengajar_id IS NOT NULL
        AND dibatalkan_oleh_wali_id IS NULL
        AND waktu_tanggap IS NOT NULL)
  ),
  -- Dibatalkan: wali yang menutup, DAN belum pernah di-ack pengajar.
  -- Ini yang menegakkan "batal hanya selama belum di-ack" di tingkat data.
  CHECK (
    status <> 'dibatalkan'
    OR (dibatalkan_oleh_wali_id IS NOT NULL
        AND ditanggapi_oleh_pengajar_id IS NULL
        AND waktu_tanggap IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_usulan_izin_menunggu
  ON usulan_izin(tanggal) WHERE status = 'menunggu';
`;

export const TABEL_IZIN: readonly string[] = ['usulan_izin'];
