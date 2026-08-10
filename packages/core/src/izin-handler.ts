import { buatUlid, type UsulanIzin, type KanalLaporan, type JenisIzin } from '@siakad/contracts';
import type { RepoMasterKomposit, RepoMasterIdTunggal, RepoUsulanIzin } from '@siakad/db';
import type { Santri, SantriWali } from '@siakad/contracts';
import { bolehAjukanIzin, bolehBatalkanIzin, tanggalTerbaca } from './izin.js';

/**
 * Handler ajukanIzin dan batalkanIzin untuk `apps/bot-wali`.
 *
 * Izin peran ditegakkan di sini: wali hanya boleh mengajukan atau membatalkan
 * untuk santri yang tertaut padanya (ADR 0009, 0010; docs/02-roles-matrix.md).
 *
 * Handler menerima repository sebagai dependency — tidak membuka koneksi sendiri
 * supaya tetap testable dan tidak mengikat ke satu skenario runtime.
 */

export interface DepIzinHandler {
  readonly repoUsulan: RepoUsulanIzin;
  readonly repoSantri: RepoMasterIdTunggal<Santri>;
  readonly repoSantriWali: RepoMasterKomposit<SantriWali>;
}

export interface HasilHandler<T> {
  readonly ok: boolean;
  readonly pesan?: string;
  readonly data?: T;
}

export interface AjukanIzinInput {
  readonly santriId: string;
  readonly tanggal: string;
  readonly jenis: JenisIzin;
  readonly alasan: string | null;
  readonly waliId: string;
  readonly kanal: KanalLaporan;
  readonly waktu: string;
}

export interface BatalkanIzinInput {
  readonly usulanId: string;
  readonly waliId: string;
  readonly waktu: string;
}

function waliMemilikiSantri(dep: DepIzinHandler, santriId: string, waliId: string): boolean {
  const semua = dep.repoSantriWali.ambilSemua();
  return semua.some(
    (sw) => sw.santri_id === santriId && sw.wali_id === waliId && sw.aktif,
  );
}

export function buatHandlerIzin(dep: DepIzinHandler) {
  return {
    ajukanIzin(input: AjukanIzinInput): HasilHandler<UsulanIzin> {
      if (!waliMemilikiSantri(dep, input.santriId, input.waliId)) {
        return {
          ok: false,
          pesan:
            'Anda tidak terdaftar sebagai wali santri ini. ' +
            'Hubungi pengurus bila ada kesalahan data.',
        };
      }

      const santri = dep.repoSantri.ambil(input.santriId);
      if (santri === undefined) {
        return {
          ok: false,
          pesan: 'Data santri tidak ditemukan. Hubungi pengurus.',
        };
      }

      const riwayat = dep.repoUsulan.cariBySantriDanTanggal(input.santriId, input.tanggal);
      const keputusan = bolehAjukanIzin(santri.nama_lengkap, input.tanggal, riwayat);
      if (!keputusan.boleh) {
        return { ok: false, pesan: keputusan.pesan };
      }

      const usulan: UsulanIzin = {
        id: buatUlid(),
        santri_id: input.santriId,
        tanggal: input.tanggal,
        jenis: input.jenis,
        alasan: input.alasan,
        dilaporkan_oleh_wali_id: input.waliId,
        dicatat_oleh_wali_id: input.waliId,
        dicatat_oleh_pengajar_id: null,
        kanal: input.kanal,
        status: 'menunggu',
        ditanggapi_oleh_pengajar_id: null,
        dibatalkan_oleh_wali_id: null,
        waktu_tanggap: null,
        dibuat_pada: input.waktu,
      };

      dep.repoUsulan.ajukan(usulan);
      return {
        ok: true,
        pesan: `Izin ${santri.nama_lengkap} untuk ${tanggalTerbaca(input.tanggal)} sudah dikirim dan menunggu konfirmasi wali kelas.`,
        data: usulan,
      };
    },

    batalkanIzin(input: BatalkanIzinInput): HasilHandler<UsulanIzin> {
      const usulan = dep.repoUsulan.cariById(input.usulanId);
      if (usulan === undefined) {
        return { ok: false, pesan: 'Usulan tidak ditemukan.' };
      }

      if (usulan.dilaporkan_oleh_wali_id !== input.waliId) {
        return {
          ok: false,
          pesan: 'Anda hanya bisa membatalkan usulan yang Anda buat sendiri.',
        };
      }

      const santri = dep.repoSantri.ambil(usulan.santri_id);
      const namaSantri = santri?.nama_lengkap ?? 'anak Anda';

      const keputusan = bolehBatalkanIzin(namaSantri, usulan.tanggal, usulan);
      if (!keputusan.boleh) {
        return { ok: false, pesan: keputusan.pesan };
      }

      dep.repoUsulan.batalkan(input.usulanId, input.waliId, input.waktu);
      return {
        ok: true,
        pesan: `Izin ${namaSantri} untuk ${tanggalTerbaca(usulan.tanggal)} sudah dibatalkan.`,
      };
    },
  };
}

export type HandlerIzin = ReturnType<typeof buatHandlerIzin>;
