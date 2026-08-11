import { buatUlid, type Tagihan } from '@siakad/contracts';
import type {
  RepoMasterIdTunggal,
  RepoMasterKomposit,
  RepoTagihan,
  RepoTarifKomponen,
  RepoKeringanan,
  RepoPembayaran,
  RepoProta,
  RepoAlokasiProta,
  RepoLebihBayar,
  RepoPemakaianLebihBayar,
} from '@siakad/db';
import type {
  Santri,
  KomponenBiaya,
  TahunAjaran,
  Pendaftaran,
  Rombel,
  Pembayaran,
  Keringanan,
  AlokasiProta,
  LebihBayar,
  PemakaianLebihBayar,
  MetodePembayaran,
  SumberPembayaran,
} from '@siakad/contracts';
import type { Aktor, HasilHandler } from './aktor.js';
import { peranCukup } from './aktor.js';
import type { DukunganTransaksi } from '@siakad/contracts';
import {
  apakahPeriodeBerlaku,
  cariTarifBerlaku,
  cicilanBerikutnya,
  hitungJatuhTempoDefault,
  hitungKeringananEffektif,
  hitungOutstanding,
  keringananEfektif,
  MAKS_CICILAN,
  type LookupTarif,
} from './keuangan.js';
import { formatPeriode, formatRupiah, tanggalDariWaktu } from './format.js';

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
  readonly repoKeringanan: RepoKeringanan;
  readonly repoPembayaran: RepoPembayaran;
  readonly repoProta: RepoProta;
  readonly repoAlokasiProta: RepoAlokasiProta;
  readonly repoLebihBayar: RepoLebihBayar;
  readonly repoPemakaianLebihBayar: RepoPemakaianLebihBayar;
  readonly transaksi: DukunganTransaksi;
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

export interface CatatPembayaranInput {
  readonly aktor: Aktor;
  readonly tagihanId: string;
  readonly tanggal: string;
  readonly nominal: number;
  readonly metode: MetodePembayaran;
  readonly sumber: SumberPembayaran;
  /** true bila pembayaran ini adalah bagian dari cicilan (akan diisi cicilan_ke). */
  readonly sebagaiCicilan: boolean;
  readonly waktu: string;
}

export interface TetapkanKeringananInput {
  readonly aktor: Aktor;
  readonly tagihanId: string;
  readonly nominal: number | null;
  readonly persentase: number | null;
  readonly alasan: string;
  readonly waktu: string;
}

export interface AlokasiProtaInput {
  readonly aktor: Aktor;
  readonly protaId: string;
  readonly tagihanId: string;
  readonly nominal: number;
  readonly waktu: string;
}

export interface TerapkanLebihBayarInput {
  readonly aktor: Aktor;
  readonly tagihanId: string;
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

    catatPembayaran(input: CatatPembayaranInput): HasilHandler<Pembayaran> {
      if (!peranCukup(input.aktor, 'pengurus')) {
        return {
          ok: false,
          pesan: 'Hanya pengurus dan admin yang boleh mencatat pembayaran.',
        };
      }

      if (input.nominal <= 0) {
        return { ok: false, pesan: 'Nominal pembayaran harus lebih dari nol.' };
      }

      const tagihan = dep.repoTagihan.ambil(input.tagihanId);
      if (tagihan === undefined) {
        return { ok: false, pesan: 'Tagihan tidak ditemukan.' };
      }

      if (tagihan.status === 'lunas') {
        return { ok: false, pesan: 'Tagihan ini sudah lunas. Tidak ada pembayaran lagi.' };
      }
      if (tagihan.status === 'dibatalkan') {
        return { ok: false, pesan: 'Tagihan ini sudah dibatalkan. Tidak bisa menerima pembayaran.' };
      }

      const santri = dep.repoSantri.ambil(tagihan.santri_id);
      const namaSantri = santri?.nama_lengkap ?? 'santri';

      const komponen = dep.repoKomponenBiaya.ambil(tagihan.komponen_biaya_id);
      const namaKomponen = komponen?.nama ?? 'tagihan';

      const keringanan = dep.repoKeringanan.cariByTagihan(input.tagihanId);
      const sudahBayar = dep.repoPembayaran.hitungTotalByTagihan(input.tagihanId);
      const outstanding = hitungOutstanding({
        nominal: tagihan.nominal,
        keringanan,
        sudahBayar,
      });

      const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);

      if (outstanding === 0) {
        return {
          ok: false,
          pesan: `Tagihan ${namaKomponen} ${namaSantri} untuk ${kapan} sudah lunas. Tidak ada yang perlu dibayar.`,
        };
      }

      // Overpayment: bayar outstanding penuh, sisanya jadi lebih bayar (1.4e).
      if (input.nominal > outstanding) {
        const kelebihan = input.nominal - outstanding;
        try {
          const pembayaran = dep.transaksi.jalankanTransaksi(() => {
            const pembayaran: Pembayaran = {
              id: buatUlid(),
              tagihan_id: input.tagihanId,
              tanggal: input.tanggal,
              nominal: outstanding,
              metode: input.metode,
              sumber: input.sumber,
              cicilan_ke: null,
              dicatat_oleh: input.aktor.id,
              waktu: input.waktu,
            };
            dep.repoPembayaran.sisip(pembayaran);

            const lebihBayar: LebihBayar = {
              id: buatUlid(),
              santri_id: tagihan.santri_id,
              nominal: kelebihan,
              asal_pembayaran_id: pembayaran.id,
              waktu: input.waktu,
            };
            dep.repoLebihBayar.tambahSaldo(lebihBayar);

            return pembayaran;
          });

          dep.repoTagihan.tandaiLunas(input.tagihanId);

          return {
            ok: true,
            pesan:
              `Pembayaran ${namaKomponen} ${namaSantri} untuk ${kapan} ` +
              `sebesar ${formatRupiah(input.nominal)} sudah dicatat. ` +
              `Tagihan lunas. Kelebihan ${formatRupiah(kelebihan)} disimpan sebagai saldo.`,
            data: pembayaran,
          };
        } catch {
          return {
            ok: false,
            pesan: 'Gagal mencatat pembayaran. Coba lagi atau hubungi pengurus.',
          };
        }
      }

      const pembayaranLalu = dep.repoPembayaran.cariByTagihan(input.tagihanId);
      const nomorCicilan = input.sebagaiCicilan ? cicilanBerikutnya(pembayaranLalu) : null;
      if (nomorCicilan !== null && nomorCicilan > MAKS_CICILAN) {
        return {
          ok: false,
          pesan: `Cicilan untuk tagihan ${namaKomponen} ${namaSantri} sudah mencapai batas ${MAKS_CICILAN} kali.`,
        };
      }

      const pembayaran: Pembayaran = {
        id: buatUlid(),
        tagihan_id: input.tagihanId,
        tanggal: input.tanggal,
        nominal: input.nominal,
        metode: input.metode,
        sumber: input.sumber,
        cicilan_ke: nomorCicilan,
        dicatat_oleh: input.aktor.id,
        waktu: input.waktu,
      };

      dep.repoPembayaran.sisip(pembayaran);

      const totalSetelah = sudahBayar + input.nominal;
      const outstandingSetelah = hitungOutstanding({
        nominal: tagihan.nominal,
        keringanan,
        sudahBayar: totalSetelah,
      });

      if (outstandingSetelah <= 0) {
        dep.repoTagihan.tandaiLunas(input.tagihanId);
      }

      const pesanLunas = outstandingSetelah <= 0 ? ' Tagihan sudah lunas.' : '';
      const pesanSisa =
        outstandingSetelah > 0 ? ` Sisa tagihan ${formatRupiah(outstandingSetelah)}.` : '';

      return {
        ok: true,
        pesan:
          `Pembayaran ${namaKomponen} ${namaSantri} untuk ${kapan} ` +
          `sebesar ${formatRupiah(input.nominal)} sudah dicatat.` +
          pesanLunas +
          pesanSisa,
        data: pembayaran,
      };
    },

    tetapkanKeringanan(input: TetapkanKeringananInput): HasilHandler<Keringanan> {
      if (!peranCukup(input.aktor, 'pengurus')) {
        return {
          ok: false,
          pesan: 'Hanya pengurus dan admin yang boleh menetapkan keringanan.',
        };
      }

      if (input.nominal === null && input.persentase === null) {
        return {
          ok: false,
          pesan: 'Isi nominal atau persentase keringanan.',
        };
      }

      if (input.nominal !== null && input.nominal <= 0) {
        return { ok: false, pesan: 'Nominal keringanan harus lebih dari nol.' };
      }
      if (input.persentase !== null && (input.persentase <= 0 || input.persentase > 100)) {
        return { ok: false, pesan: 'Persentase keringanan harus antara 1 sampai 100.' };
      }

      const tagihan = dep.repoTagihan.ambil(input.tagihanId);
      if (tagihan === undefined) {
        return { ok: false, pesan: 'Tagihan tidak ditemukan.' };
      }

      if (tagihan.status !== 'terbit') {
        return {
          ok: false,
          pesan: `Keringanan hanya bisa ditetapkan pada tagihan yang masih terbit.`,
        };
      }

      const santri = dep.repoSantri.ambil(tagihan.santri_id);
      const namaSantri = santri?.nama_lengkap ?? 'santri';
      const komponen = dep.repoKomponenBiaya.ambil(tagihan.komponen_biaya_id);
      const namaKomponen = komponen?.nama ?? 'tagihan';

      const keringananLalu = dep.repoKeringanan.cariByTagihan(input.tagihanId);
      const efektifLalu = hitungKeringananEffektif(keringananLalu, tagihan.nominal);
      const efektifBaru = keringananEfektif(input.nominal, input.persentase, tagihan.nominal);

      if (efektifLalu + efektifBaru > tagihan.nominal) {
        const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);
        return {
          ok: false,
          pesan:
            `Total keringanan untuk ${namaKomponen} ${namaSantri} pada ${kapan} ` +
            `tidak boleh melebihi ${formatRupiah(tagihan.nominal)}. ` +
            `Sisa ruang keringanan: ${formatRupiah(tagihan.nominal - efektifLalu)}.`,
        };
      }

      const keringanan: Keringanan = {
        id: buatUlid(),
        tagihan_id: input.tagihanId,
        nominal: input.nominal,
        persentase: input.persentase,
        alasan: input.alasan,
        disetujui_oleh: input.aktor.id,
        waktu: input.waktu,
      };

      dep.repoKeringanan.sisip(keringanan);

      const sudahBayar = dep.repoPembayaran.hitungTotalByTagihan(input.tagihanId);
      const outstandingSetelah = hitungOutstanding({
        nominal: tagihan.nominal,
        keringanan: [...keringananLalu, keringanan],
        sudahBayar,
      });

      if (outstandingSetelah <= 0) {
        dep.repoTagihan.tandaiLunas(input.tagihanId);
      }

      const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);
      const pesanLunas = outstandingSetelah <= 0 ? ' Tagihan sudah lunas.' : '';
      const pesanSisa =
        outstandingSetelah > 0 ? ` Sisa tagihan ${formatRupiah(outstandingSetelah)}.` : '';

      return {
        ok: true,
        pesan:
          `Keringanan ${namaKomponen} ${namaSantri} untuk ${kapan} ` +
          `sebesar ${formatRupiah(efektifBaru)} sudah ditetapkan.` +
          pesanLunas +
          pesanSisa,
        data: keringanan,
      };
    },

    alokasiProta(input: AlokasiProtaInput): HasilHandler<{ pembayaran: Pembayaran; alokasi: AlokasiProta }> {
      if (!peranCukup(input.aktor, 'pengurus')) {
        return {
          ok: false,
          pesan: 'Hanya pengurus dan admin yang boleh mengalokasikan PROTA.',
        };
      }

      if (input.nominal <= 0) {
        return { ok: false, pesan: 'Nominal alokasi PROTA harus lebih dari nol.' };
      }

      const tagihan = dep.repoTagihan.ambil(input.tagihanId);
      if (tagihan === undefined) {
        return { ok: false, pesan: 'Tagihan tidak ditemukan.' };
      }
      if (tagihan.status !== 'terbit') {
        return {
          ok: false,
          pesan: 'PROTA hanya bisa dialokasikan ke tagihan yang masih terbit.',
        };
      }

      const prota = dep.repoProta.ambil(input.protaId);
      if (prota === undefined) {
        return { ok: false, pesan: 'Dana PROTA tidak ditemukan.' };
      }

      const santri = dep.repoSantri.ambil(tagihan.santri_id);
      const namaSantri = santri?.nama_lengkap ?? 'santri';
      const komponen = dep.repoKomponenBiaya.ambil(tagihan.komponen_biaya_id);
      const namaKomponen = komponen?.nama ?? 'tagihan';

      const keringanan = dep.repoKeringanan.cariByTagihan(input.tagihanId);
      const sudahBayar = dep.repoPembayaran.hitungTotalByTagihan(input.tagihanId);
      const outstanding = hitungOutstanding({
        nominal: tagihan.nominal,
        keringanan,
        sudahBayar,
      });

      if (input.nominal > outstanding) {
        const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);
        return {
          ok: false,
          pesan:
            `Nominal alokasi PROTA melebihi sisa tagihan ${namaKomponen} ${namaSantri} ` +
            `untuk ${kapan}. Sisa tagihan ${formatRupiah(outstanding)}.`,
        };
      }

      if (input.nominal > prota.sisa) {
        return {
          ok: false,
          pesan:
            `Sisa dana PROTA untuk ${namaSantri} tidak mencukupi. ` +
            `Tersisa ${formatRupiah(prota.sisa)}, diminta ${formatRupiah(input.nominal)}.`,
        };
      }

      try {
        const hasil = dep.transaksi.jalankanTransaksi(() => {
          const pembayaran: Pembayaran = {
            id: buatUlid(),
            tagihan_id: input.tagihanId,
            tanggal: tanggalDariWaktu(input.waktu),
            nominal: input.nominal,
            metode: 'tunai',
            sumber: 'prota',
            cicilan_ke: null,
            dicatat_oleh: input.aktor.id,
            waktu: input.waktu,
          };
          dep.repoPembayaran.sisip(pembayaran);

          const alokasi: AlokasiProta = {
            id: buatUlid(),
            prota_id: input.protaId,
            tagihan_id: input.tagihanId,
            nominal: input.nominal,
            waktu: input.waktu,
          };
          dep.repoAlokasiProta.sisip(alokasi);

          dep.repoProta.kurangiSisa(input.protaId, input.nominal);

          return { pembayaran, alokasi };
        });

        const outstandingSetelah = hitungOutstanding({
          nominal: tagihan.nominal,
          keringanan,
          sudahBayar: sudahBayar + input.nominal,
        });
        if (outstandingSetelah <= 0) {
          dep.repoTagihan.tandaiLunas(input.tagihanId);
        }

        const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);
        const pesanLunas = outstandingSetelah <= 0 ? ' Tagihan sudah lunas.' : '';
        const pesanSisa =
          outstandingSetelah > 0 ? ` Sisa tagihan ${formatRupiah(outstandingSetelah)}.` : '';

        return {
          ok: true,
          pesan:
            `PROTA untuk ${namaKomponen} ${namaSantri} periode ${kapan} ` +
            `sebesar ${formatRupiah(input.nominal)} sudah dialokasikan.` +
            pesanLunas +
            pesanSisa,
          data: hasil,
        };
      } catch {
        return {
          ok: false,
          pesan: 'Gagal mengalokasikan PROTA. Dana PROTA mungkin sudah terpakai di proses lain.',
        };
      }
    },

    terapkanLebihBayar(input: TerapkanLebihBayarInput): HasilHandler<Pembayaran> {
      if (!peranCukup(input.aktor, 'pengurus')) {
        return {
          ok: false,
          pesan: 'Hanya pengurus dan admin yang boleh menerapkan saldo lebih bayar.',
        };
      }

      const tagihan = dep.repoTagihan.ambil(input.tagihanId);
      if (tagihan === undefined) {
        return { ok: false, pesan: 'Tagihan tidak ditemukan.' };
      }
      if (tagihan.status !== 'terbit') {
        return {
          ok: false,
          pesan: 'Saldo lebih bayar hanya bisa dipotong ke tagihan yang masih terbit.',
        };
      }

      const santri = dep.repoSantri.ambil(tagihan.santri_id);
      const namaSantri = santri?.nama_lengkap ?? 'santri';
      const komponen = dep.repoKomponenBiaya.ambil(tagihan.komponen_biaya_id);
      const namaKomponen = komponen?.nama ?? 'tagihan';

      const saldo = dep.repoLebihBayar.hitungSaldo(tagihan.santri_id);
      if (saldo <= 0) {
        return {
          ok: false,
          pesan: `${namaSantri} tidak memiliki saldo lebih bayar.`,
        };
      }

      const keringanan = dep.repoKeringanan.cariByTagihan(input.tagihanId);
      const sudahBayar = dep.repoPembayaran.hitungTotalByTagihan(input.tagihanId);
      const outstanding = hitungOutstanding({
        nominal: tagihan.nominal,
        keringanan,
        sudahBayar,
      });

      if (outstanding <= 0) {
        return {
          ok: false,
          pesan: `Tagihan ${namaKomponen} ${namaSantri} sudah lunas. Tidak ada yang perlu dipotong.`,
        };
      }

      const nominal = Math.min(saldo, outstanding);

      try {
        const pembayaran = dep.transaksi.jalankanTransaksi(() => {
          const pembayaran: Pembayaran = {
            id: buatUlid(),
            tagihan_id: input.tagihanId,
            tanggal: tanggalDariWaktu(input.waktu),
            nominal,
            metode: 'tunai',
            sumber: 'lainnya',
            cicilan_ke: null,
            dicatat_oleh: input.aktor.id,
            waktu: input.waktu,
          };
          dep.repoPembayaran.sisip(pembayaran);

          const pemakaian: PemakaianLebihBayar = {
            id: buatUlid(),
            santri_id: tagihan.santri_id,
            tagihan_id: input.tagihanId,
            nominal,
            waktu: input.waktu,
          };
          dep.repoPemakaianLebihBayar.sisip(pemakaian);

          return pembayaran;
        });

        const outstandingSetelah = hitungOutstanding({
          nominal: tagihan.nominal,
          keringanan,
          sudahBayar: sudahBayar + nominal,
        });
        if (outstandingSetelah <= 0) {
          dep.repoTagihan.tandaiLunas(input.tagihanId);
        }

        const kapan = formatPeriode(tagihan.periode, tagihan.skema_periode);
        const pesanLunas = outstandingSetelah <= 0 ? ' Tagihan sudah lunas.' : '';
        const pesanSisa =
          outstandingSetelah > 0 ? ` Sisa tagihan ${formatRupiah(outstandingSetelah)}.` : '';

        return {
          ok: true,
          pesan:
            `Saldo lebih bayar ${namaSantri} sebesar ${formatRupiah(nominal)} ` +
            `dipotong untuk ${namaKomponen} ${kapan}.${pesanLunas}${pesanSisa}`,
          data: pembayaran,
        };
      } catch {
        return {
          ok: false,
          pesan: 'Gagal menerapkan saldo lebih bayar. Coba lagi atau hubungi pengurus.',
        };
      }
    },
  };
}

export type HandlerKeuangan = ReturnType<typeof buatHandlerKeuangan>;