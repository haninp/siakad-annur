import { buatUlid, type Tagihan } from '@siakad/contracts';
import type {
  RepoMasterIdTunggal,
  RepoMasterKomposit,
  RepoTagihan,
  RepoTarifKomponen,
} from '@siakad/db';
import type {
  Santri,
  KomponenBiaya,
  TahunAjaran,
  Pendaftaran,
  Rombel,
} from '@siakad/contracts';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';
import {
  apakahPeriodeBerlaku,
  cariTarifBerlaku,
  hitungJatuhTempoDefault,
  type LookupTarif,
} from './keuangan.js';
import { formatPeriode, formatRupiah } from './format.js';

/**
 * Handler keuangan untuk `apps/bot-internal`.
 *
 * Aktor pengurus/admin menerima peran sebagai input (tabel `pengguna_telegram`
 * belum ada). Penegakan peran cukup hidup di `core`, bukan di bot.
 *
 * Handler menerima repository sebagai dependency — tidak membuka koneksi sendiri,
 * tetap testable. Aturan murni di `keuangan.ts`, format di `format.ts`.
 */

export interface DepKeuangan {
  readonly repoTagihan: RepoTagihan;
  readonly repoTarifKomponen: RepoTarifKomponen;
  readonly repoKomponenBiaya: RepoMasterIdTunggal<KomponenBiaya>;
  readonly repoSantri: RepoMasterIdTunggal<Santri>;
  readonly repoPendaftaran: RepoMasterKomposit<Pendaftaran>;
  readonly repoRombel: RepoMasterIdTunggal<Rombel>;
  readonly repoTahunAjaran: RepoMasterIdTunggal<TahunAjaran>;
}

export interface TerbitkanTagihanInput {
  readonly aktor: Aktor;
  readonly santriId: string;
  readonly komponenBiayaId: string;
  readonly tahunAjaranId: string;
  readonly periode: string;
  readonly skemaPeriode: 'masehi' | 'hijriah';
  readonly jatuhTempo?: string;
  readonly waktu: string;
}

function lookupDariRepo(repo: RepoTarifKomponen): LookupTarif {
  return {
    cariAktif: (tahunAjaranId, komponenBiayaId, jalur, marhalah, tingkat) =>
      repo.cariAktif(tahunAjaranId, komponenBiayaId, jalur, marhalah, tingkat),
    cariUmum: (tahunAjaranId, komponenBiayaId) =>
      repo.cariUmum(tahunAjaranId, komponenBiayaId),
  };
}

export function buatHandlerKeuangan(dep: DepKeuangan) {
  return {
    terbitkanTagihan(input: TerbitkanTagihanInput): HasilHandler<Tagihan> {
      if (!peranCukup(input.aktor, 'pengurus')) {
        return {
          ok: false,
          pesan: 'Hanya pengurus dan admin yang boleh menerbitkan tagihan.',
        };
      }

      const santri = dep.repoSantri.ambil(input.santriId);
      if (santri === undefined) {
        return { ok: false, pesan: 'Data santri tidak ditemukan.' };
      }

      const komponen = dep.repoKomponenBiaya.ambil(input.komponenBiayaId);
      if (komponen === undefined) {
        return { ok: false, pesan: 'Komponen biaya tidak ditemukan.' };
      }

      const tahunAjaran = dep.repoTahunAjaran.ambil(input.tahunAjaranId);
      if (tahunAjaran === undefined) {
        return { ok: false, pesan: 'Tahun ajaran tidak ditemukan.' };
      }

      const pendaftaran = dep.repoPendaftaran.ambil({
        santri_id: input.santriId,
        tahun_ajaran_id: input.tahunAjaranId,
      });
      if (pendaftaran === undefined) {
        return {
          ok: false,
          pesan: `${santri.nama_lengkap} belum terdaftar pada tahun ajaran ${tahunAjaran.kode}.`,
        };
      }

      const rombel = dep.repoRombel.ambil(pendaftaran.rombel_id);
      if (rombel === undefined) {
        return { ok: false, pesan: `Kelas ${santri.nama_lengkap} tidak ditemukan.` };
      }

      const periodeBerlaku = apakahPeriodeBerlaku({
        kodeKomponen: komponen.kode,
        skemaPeriode: input.skemaPeriode,
        periode: input.periode,
        tanggalMasuk: pendaftaran.tanggal_masuk,
        tanggalKeluar: pendaftaran.tanggal_keluar,
        tahunAjaranSelesai: tahunAjaran.selesai,
      });
      if (!periodeBerlaku) {
        const kapan = formatPeriode(input.periode, input.skemaPeriode);
        return {
          ok: false,
          pesan:
            `${santri.nama_lengkap} tidak terdaftar KBM pada ${kapan}. ` +
            `Periksa tanggal masuk dan keluarnya.`,
        };
      }

      const duplikat = dep.repoTagihan.cariBySantriDanPeriode(input.santriId, input.periode);
      const sudahAda = duplikat.some((t) => t.komponen_biaya_id === input.komponenBiayaId);
      if (sudahAda) {
        const kapan = formatPeriode(input.periode, input.skemaPeriode);
        return {
          ok: false,
          pesan: `Tagihan ${komponen.nama} untuk ${santri.nama_lengkap} pada ${kapan} sudah ada.`,
        };
      }

      const tarif = cariTarifBerlaku(lookupDariRepo(dep.repoTarifKomponen), {
        tahunAjaranId: input.tahunAjaranId,
        komponenBiayaId: input.komponenBiayaId,
        jalur: rombel.jalur,
        marhalah: rombel.marhalah,
        tingkat: rombel.tingkat,
      });
      if (tarif === undefined) {
        return {
          ok: false,
          pesan:
            `Tarif ${komponen.nama} untuk tahun ajaran ${tahunAjaran.kode} belum ditetapkan. ` +
            `Hubungi admin untuk mengisi tarif.`,
        };
      }

      const jatuhTempo =
        input.jatuhTempo ??
        (komponen.kode === 'spp' && input.skemaPeriode === 'masehi'
          ? hitungJatuhTempoDefault(input.periode)
          : pendaftaran.tanggal_masuk);

      const tagihan: Tagihan = {
        id: buatUlid(),
        santri_id: input.santriId,
        tahun_ajaran_id: input.tahunAjaranId,
        komponen_biaya_id: input.komponenBiayaId,
        periode: input.periode,
        skema_periode: input.skemaPeriode,
        jatuh_tempo: jatuhTempo,
        nominal: tarif.nominal,
        prorata_mulai: komponen.kode === 'spp' ? pendaftaran.tanggal_masuk : null,
        status: 'terbit',
      };

      dep.repoTagihan.sisip(tagihan);

      const kapan = formatPeriode(input.periode, input.skemaPeriode);
      return {
        ok: true,
        pesan:
          `Tagihan ${komponen.nama} untuk ${santri.nama_lengkap}, ${kapan}, ` +
          `sebesar ${formatRupiah(tarif.nominal)} sudah diterbitkan.`,
        data: tagihan,
      };
    },
  };
}

export type HandlerKeuangan = ReturnType<typeof buatHandlerKeuangan>;