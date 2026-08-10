import type { DatabaseSync } from 'node:sqlite';
import {
  entitasKurikulum,
  entitasMapel,
  entitasPendaftaran,
  entitasPengajar,
  entitasPengajarAlias,
  entitasRombel,
  entitasSantri,
  entitasSantriAlias,
  entitasSantriWali,
  entitasSkalaNilai,
  entitasSkalaNilaiButir,
  entitasTahunAjaran,
  entitasWali,
  entitasWaliAlias,
  type Kurikulum,
  type Mapel,
  type Pendaftaran,
  type Pengajar,
  type PengajarAlias,
  type Rombel,
  type Santri,
  type SantriAlias,
  type SantriWali,
  type SkalaNilai,
  type SkalaNilaiButir,
  type TahunAjaran,
  type Wali,
  type WaliAlias,
} from '@siakad/contracts';
import {
  buatRepoIdTunggal,
  buatRepoKomposit,
  type RepoMasterIdTunggal,
  type RepoMasterKomposit,
} from './helper.js';

/** 01. santri */
export function repoSantri(db: DatabaseSync): RepoMasterIdTunggal<Santri> {
  return buatRepoIdTunggal(db, entitasSantri, 'id');
}

/** 02. wali */
export function repoWali(db: DatabaseSync): RepoMasterIdTunggal<Wali> {
  return buatRepoIdTunggal(db, entitasWali, 'id');
}

/** 03. pengajar */
export function repoPengajar(db: DatabaseSync): RepoMasterIdTunggal<Pengajar> {
  return buatRepoIdTunggal(db, entitasPengajar, 'id');
}

/** 04. santri_wali */
export function repoSantriWali(db: DatabaseSync): RepoMasterKomposit<SantriWali> {
  return buatRepoKomposit(db, entitasSantriWali, ['santri_id', 'wali_id', 'hubungan']);
}

/** 05. santri_alias */
export function repoSantriAlias(db: DatabaseSync): RepoMasterKomposit<SantriAlias> {
  return buatRepoKomposit(db, entitasSantriAlias, ['santri_id', 'nama', 'jenis']);
}

/** 06. wali_alias */
export function repoWaliAlias(db: DatabaseSync): RepoMasterKomposit<WaliAlias> {
  return buatRepoKomposit(db, entitasWaliAlias, ['wali_id', 'nama', 'jenis']);
}

/** 07. pengajar_alias */
export function repoPengajarAlias(db: DatabaseSync): RepoMasterKomposit<PengajarAlias> {
  return buatRepoKomposit(db, entitasPengajarAlias, ['pengajar_id', 'nama', 'jenis']);
}

/** 08. tahun_ajaran */
export function repoTahunAjaran(db: DatabaseSync): RepoMasterIdTunggal<TahunAjaran> {
  return buatRepoIdTunggal(db, entitasTahunAjaran, 'id');
}

/** 09. rombel */
export function repoRombel(db: DatabaseSync): RepoMasterIdTunggal<Rombel> {
  return buatRepoIdTunggal(db, entitasRombel, 'id');
}

/** 10. pendaftaran */
export function repoPendaftaran(db: DatabaseSync): RepoMasterKomposit<Pendaftaran> {
  return buatRepoKomposit(db, entitasPendaftaran, ['santri_id', 'tahun_ajaran_id']);
}

/** 11. skala_nilai */
export function repoSkalaNilai(db: DatabaseSync): RepoMasterIdTunggal<SkalaNilai> {
  return buatRepoIdTunggal(db, entitasSkalaNilai, 'id');
}

/** 12. skala_nilai_butir */
export function repoSkalaNilaiButir(db: DatabaseSync): RepoMasterKomposit<SkalaNilaiButir> {
  return buatRepoKomposit(db, entitasSkalaNilaiButir, ['skala_nilai_id', 'kode']);
}

/** 13. mapel */
export function repoMapel(db: DatabaseSync): RepoMasterIdTunggal<Mapel> {
  return buatRepoIdTunggal(db, entitasMapel, 'id');
}

/** 14. kurikulum */
export function repoKurikulum(db: DatabaseSync): RepoMasterKomposit<Kurikulum> {
  return buatRepoKomposit(db, entitasKurikulum, [
    'tahun_ajaran_id',
    'marhalah',
    'mapel_id',
    'tingkat',
  ]);
}
