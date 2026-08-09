import { describe, expect, it } from 'vitest';
import { HANDLER_TULIS_BOT_WALI, UsulanIzin } from './izin.js';

const ULID_A = '01JRZ8QK7M4N2P5V9X3B6C8D0E';
const ULID_B = '01JRZ8QK7M4N2P5V9X3B6C8D0F';
const ULID_C = '01JRZ8QK7M4N2P5V9X3B6C8D0G';

const usulanBaru = {
  id: ULID_A,
  santri_id: ULID_B,
  tanggal: '2026-08-10',
  jenis: 'sakit',
  alasan: 'demam sejak semalam',
  dilaporkan_oleh_wali_id: ULID_C,
  dicatat_oleh_wali_id: ULID_C,
  dicatat_oleh_pengajar_id: null,
  kanal: 'bot_wali',
  status: 'menunggu',
  ditanggapi_oleh_pengajar_id: null,
  waktu_tanggap: null,
  dibuat_pada: '2026-08-09T22:15:00+07:00',
};

describe('UsulanIzin', () => {
  it('menerima usulan baru dari bot wali', () => {
    expect(UsulanIzin.safeParse(usulanBaru).success).toBe(true);
  });

  it('menerima kabar lisan yang dicatatkan pengampu absen atas nama wali', () => {
    // Jangan lawan kanal informalnya — tangkap. Yang berbeda hanya siapa yang
    // mencatat dan lewat kanal apa; bentuk datanya sama persis.
    const lisan = {
      ...usulanBaru,
      dicatat_oleh_wali_id: null,
      dicatat_oleh_pengajar_id: ULID_A,
      kanal: 'lisan',
    };
    expect(UsulanIzin.safeParse(lisan).success).toBe(true);
  });

  it('menolak bila pencatatnya tidak jelas', () => {
    const kosong = { ...usulanBaru, dicatat_oleh_wali_id: null, dicatat_oleh_pengajar_id: null };
    expect(UsulanIzin.safeParse(kosong).success).toBe(false);
  });

  it('menolak bila dicatat dua pihak sekaligus', () => {
    const dua = { ...usulanBaru, dicatat_oleh_pengajar_id: ULID_A };
    expect(UsulanIzin.safeParse(dua).success).toBe(false);
  });

  it('santri_id dan tanggal wajib — tidak boleh disimpulkan dari pengirim', () => {
    const { santri_id, ...tanpaSantri } = usulanBaru;
    void santri_id;
    expect(UsulanIzin.safeParse(tanpaSantri).success).toBe(false);

    const { tanggal, ...tanpaTanggal } = usulanBaru;
    void tanggal;
    expect(UsulanIzin.safeParse(tanpaTanggal).success).toBe(false);
  });

  it('usulan yang masih menunggu tidak boleh punya penanggap', () => {
    const janggal = { ...usulanBaru, ditanggapi_oleh_pengajar_id: ULID_A };
    expect(UsulanIzin.safeParse(janggal).success).toBe(false);
  });

  it('usulan yang diterima wajib mencatat penanggap dan waktunya', () => {
    const tanpaJejak = { ...usulanBaru, status: 'diterima' };
    expect(UsulanIzin.safeParse(tanpaJejak).success).toBe(false);

    const lengkap = {
      ...usulanBaru,
      status: 'diterima',
      ditanggapi_oleh_pengajar_id: ULID_A,
      waktu_tanggap: '2026-08-10T06:30:00+07:00',
    };
    expect(UsulanIzin.safeParse(lengkap).success).toBe(true);
  });

  it('alasan boleh kosong — laporan lewat tombol saja tetap sah', () => {
    expect(UsulanIzin.safeParse({ ...usulanBaru, alasan: null }).success).toBe(true);
  });
});

describe('daftar-putih handler tulis bot wali (ADR 0009)', () => {
  /**
   * Yang dijaga bukan isinya saja, tapi **jumlahnya**. Penambahan kedua menandakan
   * invariannya sudah tidak menahan apa-apa dan menuntut ADR baru — uji ini yang
   * memastikan penambahan itu tidak lolos tanpa disadari.
   */
  it('berisi tepat satu handler', () => {
    expect(HANDLER_TULIS_BOT_WALI).toHaveLength(1);
  });

  it('handler itu adalah ajukanIzin', () => {
    expect(HANDLER_TULIS_BOT_WALI).toEqual(['ajukanIzin']);
  });
});
