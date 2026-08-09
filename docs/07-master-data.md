# 07 — Desain Struktur Master Data

> **Status: rancangan untuk diimplementasikan di `packages/contracts` (tugas 0.10).**
> Seluruh bentuk di bawah diturunkan dari isi nyata berkas warisan yang sudah dibaca
> (lihat `docs/06-migrasi-legacy.md`), bukan dari perancangan di atas kertas. Nama kolom
> spreadsheet dikutip apa adanya agar pemetaan importer bisa diperiksa orang lain.

Master data = entitas rujukan yang dipakai berulang oleh transaksi. Ia dirancang lebih dulu
karena setiap keputusan keuangan dan akademik menunjuk ke sini. Bagian keuangan yang masih
menunggu sesi P3 **tidak memblokir** dokumen ini — yang diblokir hanya aturan tagihan, bukan
bentuk entitasnya.

---

## Prinsip yang mengikat seluruh desain

**1. Kunci primer selalu surrogate, tidak pernah bawaan dunia nyata.**

Bukti dari data: kolom `NIS CLONING`, `No Induk (Baru)`, dan `Master Nama SESUAI KTP` ada di
master berkas 04. Ketiganya jejak penomoran ulang dan pencocokan identitas yang pernah
terjadi. Nomor yang pernah diganti sekali akan diganti lagi.

**2. Nama bukan pengenal, dan sistem lama sudah membuktikannya.**

Di dalam satu berkas yang sama, santri yang sama tertulis dua cara:

```
AISYAH ALILATUL  HANIYAH  BANDU     (kolom DATA DROPDOWN)
AISYAH ALILLATUL HANIYYAH BANDU     (kolom "Nama Santri Khusus Database Keuangan")
```

Berkas lama bahkan **memelihara tiga varian nama sekaligus** — `ASLI`,
`Nama Santri Khusus Database Keuangan`, dan `Master Nama SESUAI KTP` — karena nama di kuitansi,
di ijazah, dan di KTP memang berbeda dan ketiganya dibutuhkan. Itu kebutuhan nyata, bukan
kekacauan yang harus dibuang. Karena itu ada tabel `santri_alias`.

**3. Angka turunan tidak masuk master.** Tidak ada kolom tunggakan, saldo, atau total
di entitas mana pun di dokumen ini. Berkas 01 menyimpan `Tunggakan` di baris jurnal dan itu
salah satu sumber kerusakannya.

**4. Kosakata terkendali, bukan teks bebas.** Data lama menulis hal yang sama dengan banyak
cara: `RA - Tingkat A` dan `RA - KELAS A`, `BANIN - Ibtidaiyyah` dan `BANIN - IBTIDAIYYAH`.
Setiap dimensi di bawah punya daftar nilai tertutup.

**5. Data pribadi ditandai di skema, bukan diingat-ingat.** Tiap kolom sensitif diberi
penanda klasifikasi agar penyaring di `packages/core` bisa bekerja dari metadata, bukan dari
daftar nama kolom yang ditulis manual dan pasti akan ketinggalan.

---

## Peta entitas

```
                    ┌──────────────┐
                    │ tahun_ajaran │
                    └──────┬───────┘
                           │
    ┌──────────┐     ┌─────┴──────┐     ┌──────────┐
    │  jalur   │────▶│   rombel   │◀────│ marhalah │
    └──────────┘     └─────┬──────┘     └──────────┘
                           │
   ┌────────────┐    ┌─────┴──────┐    ┌─────────────┐
   │santri_alias│───▶│   santri   │───▶│ pendaftaran │
   └────────────┘    └─────┬──────┘    └─────────────┘
                           │
                    ┌──────┴───────┐
                    │  santri_wali │───▶┌──────┐
                    └──────────────┘    │ wali │
                                        └──────┘
   ┌──────────┐   ┌───────────────┐   ┌──────────────────┐
   │ pengajar │   │ akun_keuangan │   │ komponen_biaya   │
   └──────────┘   └───────────────┘   └──────────────────┘
```

---

## 1. `santri`

Sumber: blok master berkas 04 kolom 2–19, disilangkan dengan blok berformat EMIS
(kolom 121–153) yang **hanya ada di berkas 04** dan merupakan bentuk yang diminta kementerian.

| Kolom            | Tipe        | Asal di sheet     | Catatan                                                   |
| ---------------- | ----------- | ----------------- | --------------------------------------------------------- |
| `id`             | ULID        | —                 | Kunci primer. Tidak pernah berubah, tidak pernah dipakai ulang |
| `nis`            | text unik   | `NIS`             | Bermakna: 4 digit tahun ajaran masuk + 3 digit urut (`2627001`). **Boleh berubah** |
| `nisn`           | text? unik  | `NISN`            | **Kosong seluruhnya** di data nyata; ditandai `update NISN 2026` sejak berkas 03 |
| `nik`            | text?       | `NIK` / `nik`     | 16 digit. **Data pribadi anak** — lihat klasifikasi di bawah |
| `nama_lengkap`   | text        | `Nama Santri`     | Nama kanonik. Varian lain masuk `santri_alias`             |
| `jenis_kelamin`  | enum        | `JENIS KELAMIN`   | `laki_laki` \| `perempuan`                                 |
| `tempat_lahir`   | text        | `TEMPAT`          |                                                            |
| `tanggal_lahir`  | date        | `TGL LAHIR`       | Di sheet dua format berbeda: `25 Oktober 2021` dan `16/08/2018`. Importer harus menerima keduanya |
| `alamat`         | text?       | `alamat`          |                                                            |
| `desa_kelurahan` | text?       | `desa_kelurahan`  | Dekomposisi wilayah mengikuti bentuk EMIS —                |
| `kecamatan`      | text?       | `kecamatan`       | supaya ekspor kementerian tidak perlu mengurai teks bebas  |
| `kabupaten`      | text?       | `kabupaten`       |                                                            |
| `provinsi`       | text?       | `provinsi`        |                                                            |
| `kode_pos`       | text?       | `kode_pos`        |                                                            |
| `status`         | enum        | `status`          | `aktif` \| `lulus` \| `keluar` \| `pindah`                 |
| `anak_ke`        | int?        | `anak_ke`         |                                                            |
| `jumlah_saudara` | int?        | `jumlah_saudara`  |                                                            |

**Yang sengaja tidak diambil:** `NIS CLONING` (duplikat `NIS`), `UPDATE DATABASE?` (catatan
kerja — isinya benar-benar `Rizki : Update Tanggal 19 Mei 2026`), `Nomor Induk` (duplikat
`NIS` dengan nama lain), `file_kk` / `file_akte` / `file_ijazah` (kosong; jadi lampiran
tersendiri bila kelak dipakai).

## 2. `santri_alias`

Karena satu santri punya beberapa nama sah dan importer harus bisa mencocokkan baris jurnal
lama yang hanya menyebut nama.

| Kolom       | Tipe | Catatan                                                                    |
| ----------- | ---- | -------------------------------------------------------------------------- |
| `santri_id` | ULID | →`santri.id`                                                               |
| `nama`      | text |                                                                            |
| `jenis`     | enum | `ktp` \| `keuangan` \| `panggilan` \| `ejaan_lama`                          |
| `sumber`    | enum | `berkas_01` … `berkas_04` \| `manual` — supaya asal-usul tiap alias terlacak |

Ini yang membuat impor jurnal 01–02 mungkin sama sekali: generasi itu menunjuk santri
**lewat nama**, bukan nomor induk.

## 3. `wali` dan `santri_wali`

Data lama menyimpan wali sebagai kolom di baris santri (`NAMA BAPAK`, `NO HP`, `NAMA IBU`,
`NO HP`). Itu tidak bisa dipertahankan: satu wali kerap punya beberapa anak di pesantren,
dan pada model lama nomor HP-nya tersimpan berkali-kali lalu menyimpang.

`wali`

| Kolom          | Tipe | Asal                                        | Catatan                        |
| -------------- | ---- | ------------------------------------------- | ------------------------------ |
| `id`           | ULID | —                                           |                                |
| `nama`         | text | `NAMA BAPAK` / `NAMA IBU`                   | Data nyata memuat kunyah dalam kurung: `HARDIANTO (ABU IBRAHIM)` |
| `no_hp`        | text? | `NO HP`                                    | Kunci pencocokan akun Telegram |
| `status_hidup` | enum | `status_ayah` / `Status Ibu`                | `hidup` \| `wafat`             |

`santri_wali`

| Kolom            | Tipe | Catatan                                                             |
| ---------------- | ---- | ------------------------------------------------------------------- |
| `santri_id`      | ULID | →`santri.id`                                                        |
| `wali_id`        | ULID | →`wali.id`                                                          |
| `hubungan`       | enum | `ayah` \| `ibu` \| `wali`                                           |
| `penanggung_biaya` | bool | Dari `yg_membiayai_sekolah` (nilai nyata: `Orang Tua`)             |
| `penerima_notifikasi` | bool | Menentukan siapa yang di-broadcast bot wali                     |

**Status hidup orang tua bukan sekadar keterangan.** Nilainya nyata (`Masih Hidup` /
`Telah Meninggal`) dan menentukan status yatim — yang berkaitan langsung dengan keringanan.
Karena itu ia data sensitif sekaligus data operasional.

## 4. Dimensi akademik: `jalur`, `marhalah`, `rombel`

Data lama mencampur ketiganya dalam satu teks (`BANIN - Mutawashitoh`, `RA - Tingkat A`).
Dipisah tiga karena ketiganya berubah dengan irama berbeda.

- **`jalur`** — `banin` \| `banat` \| `ra_paud`
  Menentukan pemisahan santri putra/putri yang di sistem lama diwujudkan sebagai tiga sheet
  master terpisah dengan penomoran sendiri-sendiri.

- **`marhalah`** — `paud` \| `ra` \| `ibtidaiyyah` \| `mutawashitoh`

  > **Koreksi terhadap `docs/06`**: dokumen itu mencatat marhalah riil hanya
  > "RA-PAUD, MI Banin, MI Banat". **`Mutawashitoh` juga ada, dan berisi santri.** Ia muncul
  > di berkas 03 dan 04 (`BANIN - Mutawashitoh`, `BANAT - MUTAWASHITOH`) dan punya kelas
  > sendiri: nilai `7 (TUJUH)` muncul 23 kali dan `8 (DELAPAN)` 32 kali, terkait langsung ke
  > baris `BANIN - Mutawashitoh`. Skema yang hanya mengenal RA dan Ibtidaiyyah akan menolak
  > santri yang nyata ada.

- **`rombel`** — kelas nyata tempat santri belajar, milik satu `tahun_ajaran`.
  Nilai nyata, dengan jumlah kemunculan di berkas 03 + 04:

  | Marhalah     | Rombel                                                            |
  | ------------ | ----------------------------------------------------------------- |
  | PAUD         | `PA - PAUD`                                                       |
  | RA           | `RA - Tingkat A` / `RA - KELAS A`, `RA - Tingkat B`               |
  | Ibtidaiyyah  | `1 (SATU)` 153× · `2 (DUA)` 117× · `3 (TIGA)` 81× · `4 (EMPAT)` 122× · `5 (LIMA)` 134× · `6 (ENAM)` 38× |
  | Mutawashitoh | `7 (TUJUH)` 23× · `8 (DELAPAN)` 32×                               |

  Dua penulisan untuk rombel RA yang sama (`Tingkat A` dan `KELAS A`) adalah contoh persis
  mengapa dimensi ini butuh daftar nilai tertutup.

## 5. `pendaftaran`

Menghubungkan santri ke rombel **per tahun ajaran**. Inilah yang membuat pertanyaan
"kelas berapa dia waktu itu" bisa dijawab — pada model lama, kelas ditimpa setiap kenaikan
sehingga riwayatnya hilang.

| Kolom            | Tipe | Catatan                                        |
| ---------------- | ---- | ---------------------------------------------- |
| `santri_id`      | ULID |                                                |
| `tahun_ajaran_id`| ULID |                                                |
| `rombel_id`      | ULID |                                                |
| `tanggal_masuk`  | date | Dasar prorata SPP                              |
| `tanggal_keluar` | date? | Aturan tagihannya **menunggu P3 pertanyaan 3** |
| `status`         | enum | `aktif` \| `naik` \| `tinggal` \| `keluar` \| `lulus` |

## 6. `pengajar`

Sumber: blok `MASTER NAMA SANTRI, MUDARIS, MUDARISAH` berkas 04, kolom 51–57.

| Kolom              | Tipe | Asal                    | Catatan                                     |
| ------------------ | ---- | ----------------------- | ------------------------------------------- |
| `id`               | ULID | —                       |                                             |
| `no_induk`         | text | `No Induk Pengajar`     |                                             |
| `nama`             | text | `Nama Mudaris/Mudarisah`|                                             |
| `jalur_kurikulum`  | enum | `Pengajar Diniyah` / `Pengajar Umum` | Dua kolom terpisah di sheet; hadir sejak berkas 01 |
| `wali_kelas_rombel_id` | ULID? | `Wali Kelas`       |                                             |

Mukafaah pengajar berperiode Hijriah — lihat ADR 0004. Besarannya bukan master data, ia
transaksi.

## 7. `akun_keuangan`

Bagan akun yang sudah dipakai, dikutip dari kolom `Akun Masuk` berkas 04:

| Kode | Nama               | Terbaca di ekspor |
| ---: | ------------------ | ----------------- |
|    1 | SPP                | ✅                |
|    2 | UANG PENDAFTARAN   | ✅                |
|    3 | UANG GEDUNG        | ✅                |
|    4 | SARPRAS            | ✅                |
|    5 | RAPORT             | ✅                |
|    6 | MODUL              | ✅                |
|    7 | PEMASUKAN LAIN     | ✅                |
| 8–10 | **tidak terbaca**  | ❌ — ekspor renggang, kodenya tidak muncul |
|   11 | PROTA              | ✅                |
|   12 | SUMBANGAN KBM      | ✅                |

Kode 8, 9, dan 10 **harus ditanyakan**, bukan ditebak. Menomori ulang akan memutus rujukan
seluruh jurnal lama.

Alokasi pengeluaran yang terbaca: `Mukafaah Pengajar`, `Mukafaah Pengelola`, `Mukafaah Mudir`,
`Operasional (kebersihan, listrik, dll)`, `Perbaikan Gedung`, `Pembelian Tanah`, `Bangku`,
`Papan Tulis`, `Konsumsi Pertemuan Wali Santri`, `Tausiah Ust Tamu`, `Transport pengajar`,
`Biaya lainnya`.

## 8. `komponen_biaya`

Terbaca dari header Kartu Kendali berkas 04: SPP, Biaya Pendaftaran, Biaya Uang Gedung,
Biaya Sarana Prasarana, Biaya Modul/Buku/ATK (Banin-Banat-RA), Biaya Raport, **Biaya PKBM**.

Besarannya berbeda per marhalah (SPP PAUD Rp100.000, RA Rp150.000) dan berubah tiap tahun
ajaran, jadi tarif disimpan berversi per `tahun_ajaran`, bukan sebagai satu angka.

`Biaya PKBM` baru muncul di berkas 04 — bentuk kolomnya jelas, aturannya belum
(**P3 pertanyaan 6**).

## 9. `tahun_ajaran` dan periode

Bentuknya sudah ditetapkan ADR 0004 dan diperkuat temuan berkas 04: ada **15 periode Masehi**
(`01. APRIL` … `15. JUNI`) untuk masa peralihan, berdampingan dengan skema Hijriah 12 periode.
Master data hanya menyimpan definisi periodenya; penentuan tagihan bukan urusan dokumen ini.

---

## Klasifikasi data pribadi

Dipakai `packages/core` untuk menyaring sebelum data keluar. Penanda melekat pada definisi
kolom di `packages/contracts`, sehingga penyaring bekerja dari metadata — kolom baru yang
lupa didaftarkan akan tertahan, bukan lolos diam-diam.

| Tingkat        | Kolom                                                                 | Aturan                                                             |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **terlarang**  | `santri.nik`, `wali.nik`, `no_kk`, nomor rekening                     | **Tidak pernah** keluar dari `core`. Tidak ke prompt, tidak ke Sheet, tidak ke log |
| **sensitif**   | `tanggal_lahir`, `alamat`, `no_hp`, `wali.status_hidup`, status yatim  | Hanya ke pihak yang berhak menurut matriks peran; tidak pernah ke prompt LLM |
| **internal**   | `nis`, `nisn`, `nama_lengkap`, `rombel`                               | Boleh ke pengurus dan pengajar; ke wali hanya untuk anaknya sendiri |
| **publik**     | `marhalah`, `jalur`, nama rombel                                      | Bebas                                                               |

Ini data anak di bawah umur dan UU PDP berlaku — lihat `AGENTS.md`. `NIK` **terisi nyata**
di berkas 04 (10 dari 11 baris contoh), jadi ini bukan risiko hipotetis.

---

## Yang masih menggantung

Tidak ada satu pun yang memblokir penulisan skema; semuanya tabel seed atau kolom opsional.

1. **Kode akun 8, 9, 10** — tidak terbaca di ekspor. Perlu dibuka langsung di Sheet atau
   ditanyakan. Menebak berarti memutus rujukan jurnal lama.
2. **`NISN` kosong seluruhnya** dan ditandai `update NISN 2026`. Kolomnya dibuat nullable;
   pengisiannya urusan operasional (**P3 pertanyaan 9**).
3. **`status_ibu` kosong** padahal `status_ayah` terisi. Belum jelas tidak pernah didata atau
   memang tidak ada yang wafat.
4. **Daftar mapel, skala nilai diniyah, aspek akhlak, jam KBM** — masih kosong seperti dicatat
   `STATE.md`. Semuanya tabel seed lewat Sheet Pola, tidak memblokir.
5. **Batas rombel Ibtidaiyyah dan Mutawashitoh** — berapa kelas masing-masing, dan apakah
   Mutawashitoh sudah punya rombel sendiri atau masih gabung.
