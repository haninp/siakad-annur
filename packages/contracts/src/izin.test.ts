import { describe, expect, it } from 'vitest';
import { HANDLER_TULIS_BOT_WALI, TABEL_TULIS_BOT_WALI, UsulanIzin } from './izin.js';

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
  dibatalkan_oleh_wali_id: null,
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

describe('pembatalan usulan izin (ADR 0010)', () => {
  const dibatalkan = {
    ...usulanBaru,
    status: 'dibatalkan',
    dibatalkan_oleh_wali_id: ULID_C,
    waktu_tanggap: '2026-08-09T22:40:00+07:00',
  };

  it('wali boleh membatalkan usulannya sendiri', () => {
    expect(UsulanIzin.safeParse(dibatalkan).success).toBe(true);
  });

  it('pembatalan wajib mencatat siapa yang membatalkan', () => {
    expect(UsulanIzin.safeParse({ ...dibatalkan, dibatalkan_oleh_wali_id: null }).success).toBe(
      false,
    );
  });

  /**
   * Inti ADR 0010: syarat "hanya selama belum di-ack" ditegakkan **bentuk data**,
   * bukan urutan alur. Baris yang pernah ditanggapi pengajar tidak bisa berubah
   * jadi batal, walau ada kode yang keliru mencobanya.
   */
  it('usulan yang sudah di-ack wali kelas tidak bisa dibatalkan', () => {
    const sudahDiAck = { ...dibatalkan, ditanggapi_oleh_pengajar_id: ULID_A };
    expect(UsulanIzin.safeParse(sudahDiAck).success).toBe(false);
  });

  it('pembatal dan penanggap tidak boleh tertukar perannya', () => {
    // Wali tidak bisa muncul sebagai penanggap pada usulan yang diterima.
    const keliru = {
      ...usulanBaru,
      status: 'diterima',
      ditanggapi_oleh_pengajar_id: ULID_A,
      dibatalkan_oleh_wali_id: ULID_C,
      waktu_tanggap: '2026-08-10T06:30:00+07:00',
    };
    expect(UsulanIzin.safeParse(keliru).success).toBe(false);
  });

  it('usulan yang masih menunggu tidak boleh punya pembatal', () => {
    expect(
      UsulanIzin.safeParse({ ...usulanBaru, dibatalkan_oleh_wali_id: ULID_C }).success,
    ).toBe(false);
  });
});

describe('daftar-putih handler tulis bot wali (ADR 0009, diperluas 0010)', () => {
  /**
   * Invarian yang sebenarnya dijaga: **sasarannya**, bukan jumlahnya. Aturan
   * berbasis hitungan tergerus satu per satu; aturan berbasis sasaran tidak.
   */
  it('setiap handler hanya menyentuh usulan_izin', () => {
    for (const handler of HANDLER_TULIS_BOT_WALI) {
      expect(handler.tabel).toBe(TABEL_TULIS_BOT_WALI);
    }
  });

  it('tidak ada handler yang menyentuh absensi, nilai, atau keuangan', () => {
    const terlarang = ['absensi', 'nilai', 'tagihan', 'pembayaran', 'mukafaah'];
    const sasaran = HANDLER_TULIS_BOT_WALI.map((h) => h.tabel);
    for (const tabel of terlarang) {
      expect(sasaran).not.toContain(tabel);
    }
  });

  /** Pemicu tinjauan, bukan larangan — penambahan harus memaksa orang membaca ADR 0010. */
  it('jumlahnya masih dua; penambahan menuntut tinjauan ADR 0010', () => {
    expect(HANDLER_TULIS_BOT_WALI).toHaveLength(2);
  });

  it('memuat ajukanIzin dan batalkanIzin', () => {
    expect(HANDLER_TULIS_BOT_WALI.map((h) => h.nama)).toEqual(['ajukanIzin', 'batalkanIzin']);
  });
});
