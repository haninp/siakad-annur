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
      u.status === 'menunggu'
        ? u.ditanggapi_oleh_pengajar_id === null && u.waktu_tanggap === null
        : u.ditanggapi_oleh_pengajar_id !== null && u.waktu_tanggap !== null,
    'usulan yang sudah ditanggapi wajib mencatat penanggap dan waktunya, dan sebaliknya',
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
  waktu_tanggap: 'internal',
  dibuat_pada: 'internal',
};

export const entitasUsulanIzin: Entitas<UsulanIzin> = {
  nama: 'usulan_izin',
  skema: UsulanIzin,
  kolom: Object.keys(bentukUsulanIzin.shape) as (keyof UsulanIzin & string)[],
  klasifikasi: klasifikasiUsulanIzin,
};

/**
 * Daftar-putih handler tulis `apps/bot-wali`. Berisi **satu** nama (ADR 0009).
 *
 * Penambahan kedua bukan perubahan kecil — ia menandakan invariannya sudah tidak
 * menahan apa-apa, dan menuntut ADR baru. Uji memeriksa **jumlahnya**, bukan hanya
 * isinya, supaya penambahan tidak lolos tanpa disadari.
 */
export const HANDLER_TULIS_BOT_WALI: readonly string[] = ['ajukanIzin'];

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
  waktu_tanggap                TEXT,
  dibuat_pada                  TEXT NOT NULL,

  CHECK (
    (dicatat_oleh_wali_id IS NULL) <> (dicatat_oleh_pengajar_id IS NULL)
  ),
  CHECK (
    (status = 'menunggu'
      AND ditanggapi_oleh_pengajar_id IS NULL AND waktu_tanggap IS NULL)
    OR
    (status <> 'menunggu'
      AND ditanggapi_oleh_pengajar_id IS NOT NULL AND waktu_tanggap IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_usulan_izin_menunggu
  ON usulan_izin(tanggal) WHERE status = 'menunggu';
`;

export const TABEL_IZIN: readonly string[] = ['usulan_izin'];
