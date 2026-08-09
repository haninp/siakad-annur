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
kekacauan yang harus dibuang. Karena itu ada tabel alias tersendiri untuk santri, wali, dan
pengajar — dan kunyah tinggal di sana, bukan di dalam kolom nama.

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
              ┌──────────▶│ tahun_ajaran │◀──────────┐
              │           └──────┬───────┘           │
              │                  │                   │
   ┌──────────┴───┐        ┌─────┴──────┐      ┌─────┴─────┐
   │  kurikulum   │        │   rombel   │      │ komponen_ │
   └──────┬───────┘        └─────┬──────┘      │   biaya   │
          │                      │             └───────────┘
   ┌──────┴───────┐        ┌─────┴───────┐
   │    mapel     │        │ pendaftaran │
   └──────┬───────┘        └─────┬───────┘
          │                      │
   ┌──────┴───────┐        ┌─────┴──────┐    ┌──────────────┐
   │ skala_nilai  │        │   santri   │───▶│ santri_alias │
   └──────────────┘        └─────┬──────┘    └──────────────┘
                                 │
                          ┌──────┴───────┐   ┌──────┐   ┌────────────┐
                          │  santri_wali │──▶│ wali │──▶│ wali_alias │
                          └──────────────┘   └──────┘   └────────────┘

   ┌──────────┐──▶┌────────────────┐      ┌───────────────┐
   │ pengajar │   │ pengajar_alias │      │ akun_keuangan │
   └──────────┘   └────────────────┘      └───────────────┘
```

`jalur` dan `marhalah` adalah enum, bukan tabel — nilainya tertutup dan tidak berumur.

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

## 2. Alias nama — `santri_alias`, `wali_alias`, `pengajar_alias`

Tiga tabel berbentuk sama, satu untuk tiap entitas orang. Bentuknya identik sehingga lahir
dari satu skema zod yang sama, tetapi kunci asingnya terpisah supaya integritas rujukan tetap
ditegakkan basis data — bukan oleh kolom `jenis_entitas` yang tidak bisa diperiksa siapa pun.

| Kolom      | Tipe | Catatan                                                                     |
| ---------- | ---- | ---------------------------------------------------------------------------- |
| `<x>_id`   | ULID | →`santri.id` / `wali.id` / `pengajar.id`                                     |
| `nama`     | text |                                                                              |
| `jenis`    | enum | `ktp` \| `kunyah` \| `keuangan` \| `panggilan` \| `ejaan_lama`               |
| `sumber`   | enum | `berkas_01` … `berkas_04` \| `manual` — supaya asal-usul tiap alias terlacak |

**Mengapa tidak disatukan jadi satu tabel `orang`.** Sudah diperiksa di data: dari 100 nama
wali dan 24 nama pengajar, **irisannya nol**. Tidak ada wali yang sekaligus pengajar, jadi
penyatuan hanya menambah lapisan tanpa menyelesaikan apa pun.

### Kunyah adalah alias, dan kadang ia satu-satunya nama

Sesuai keputusan: kunyah **tidak** disimpan sebagai kolom tersendiri, melainkan sebagai baris
alias `jenis = 'kunyah'`. Data lama menaruhnya di dalam kolom nama dengan tanda kurung, dengan
penulisan yang tidak konsisten — dan untuk orang yang sama:

```
HARDIANTO (ABU IBRAHIM)          berkas 04
Hardianto ( Abu Ibrohim Inoac )  berkas lain
TRI LAKSANA ADI (ABU HUSAIN)  /  Tri Laksana Adi (Abu Husein)
```

Importer memisahkan isi kurung menjadi baris alias, dan nama di luar kurung menjadi
`nama_lengkap`. Ada 27 baris berbentuk begini.

**Tapi ada kasus sebaliknya, dan ini yang menentukan desain.** Sebagian pengajar tercatat
**hanya** dengan kunyah, tanpa nama lain di berkas mana pun:

| Nama tercatat     | Peran         | No induk  |
| ----------------- | ------------- | --------- |
| `ABU AUFA UKASAH` | MUDARIS BANIN | `2301001` |
| `UMMU ZAHRO`      | MUDARIS BANAT | `2302004` |

Ditambah `UMMU SAHLA`, `UMMU NISRINA`, `UMMU HUDZAIFAH`, `UMMU HANIFAH`, `UMMU AIMAN`,
`ABU ZAKI`, `ABU HUDZAIFAH QOMAR`, `ABU HAURA RIZKI`, dan lainnya.

Karena itu **`nama_lengkap` diisi kunyah bila memang itu satu-satunya yang diketahui**, dan
baris alias `jenis = 'kunyah'` tetap dibuat menunjuk nilai yang sama. Aturannya: alias
melengkapi nama kanonik, tidak menggantikannya, dan tidak pernah ada orang tanpa
`nama_lengkap`. Memaksakan nama legal yang tidak diketahui hanya akan melahirkan kolom kosong
atau nama karangan.

Kontrol empat mata pun memakai kunyah (`Cek Abu Sahlah`, `Cek Abu Husain`) — di lingkungan ini
kunyah adalah nama panggilan kerja, bukan julukan sampingan.

Tabel alias ini juga yang membuat impor jurnal 01–02 mungkin sama sekali: generasi itu
menunjuk santri **lewat nama**, bukan nomor induk.

## 3. `wali` dan `santri_wali`

Data lama menyimpan wali sebagai kolom di baris santri (`NAMA BAPAK`, `NO HP`, `NAMA IBU`,
`NO HP`). Itu tidak bisa dipertahankan: satu wali kerap punya beberapa anak di pesantren,
dan pada model lama nomor HP-nya tersimpan berkali-kali lalu menyimpang.

`wali`

| Kolom          | Tipe  | Asal                         | Catatan                                                         |
| -------------- | ----- | ---------------------------- | ---------------------------------------------------------------- |
| `id`           | ULID  | —                            |                                                                  |
| `nik`          | text? | —                            | 16 digit. **Data pribadi — klasifikasi `terlarang`.** Nullable: belum didata di sheet mana pun |
| `nama_lengkap` | text  | `NAMA BAPAK` / `NAMA IBU`    | Kunyah dipisahkan ke `wali_alias`, tidak disimpan dalam kurung   |
| `no_hp`        | text? | `NO HP`                      | Kunci pencocokan akun Telegram                                   |
| `status_hidup` | enum  | `status_ayah` / `Status Ibu` | `hidup` \| `wafat` \| `tidak_diketahui`                          |

`santri_wali`

| Kolom                 | Tipe | Catatan                                                        |
| --------------------- | ---- | -------------------------------------------------------------- |
| `santri_id`           | ULID | →`santri.id`                                                   |
| `wali_id`             | ULID | →`wali.id`                                                     |
| `hubungan`            | enum | `ayah` \| `ibu` \| `wali`                                      |
| `penanggung_biaya`    | bool | Dari `yg_membiayai_sekolah` (nilai nyata: `Orang Tua`)         |
| `penerima_notifikasi` | bool | Menentukan siapa yang di-broadcast bot wali                    |

**Mengapa `wali` punya `nik`.** Ekspor EMIS meminta data orang tua, dan berkas warisan sudah
menyediakan `nik` untuk santri tapi tidak untuk walinya. Kolomnya disiapkan sekarang supaya
pendataan berikutnya tidak menuntut migrasi skema — tapi **nullable**, karena mengisinya
mensyaratkan pengumpulan data pribadi orang dewasa yang punya persyaratan persetujuannya
sendiri (lihat "keputusan yang menggantung" di `STATE.md`).

### Status yatim dihitung, tidak disimpan

Sesuai keputusan: **`status_ibu` diperlakukan persis seperti `status_ayah`** — kolom yang sama
bentuknya, aturan yang sama, di tabel `wali` yang sama. Tidak ada perlakuan khusus untuk
salah satunya.

Status keyatiman diturunkan dari keduanya, **tidak disimpan sebagai kolom**:

| Ayah    | Ibu     | Status         |
| ------- | ------- | -------------- |
| hidup   | hidup   | —              |
| wafat   | hidup   | `yatim`        |
| hidup   | wafat   | `piatu`        |
| wafat   | wafat   | `yatim_piatu`  |

Ini konsisten dengan larangan menyimpan angka turunan (`AGENTS.md`): kalau status disimpan
terpisah dari `wali.status_hidup`, keduanya akan menyimpang — dan yang menyimpang di sini
adalah dasar pemberian keringanan.

Nilai `tidak_diketahui` sengaja dibedakan dari `hidup`. Di data nyata `status_ibu` **kosong
seluruhnya** sementara `status_ayah` terisi. Memperlakukan kosong sebagai "masih hidup" akan
diam-diam menghapus status piatu seorang santri; memperlakukannya sebagai "wafat" akan
mengarang keringanan. Keduanya salah, jadi ketidaktahuan dicatat apa adanya dan status
keyatiman berstatus belum pasti sampai didata.

**Ini data sensitif sekaligus data operasional** — dipakai untuk keringanan, jadi tidak bisa
sekadar disembunyikan, tapi juga tidak boleh ikut ke prompt LLM mana pun.

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

| Kolom                  | Tipe  | Asal                                 | Catatan                                                    |
| ---------------------- | ----- | ------------------------------------ | ----------------------------------------------------------- |
| `id`                   | ULID  | —                                    |                                                             |
| `no_induk`             | text  | `No Induk Pengajar`                  | Berpola tahun + urut (`2301001`, `2302004`)                 |
| `nik`                  | text? | —                                    | 16 digit. **Klasifikasi `terlarang`.** Nullable             |
| `nama_lengkap`         | text  | `Nama Mudaris/Mudarisah`             | Boleh berisi kunyah bila itu satu-satunya nama yang diketahui |
| `jalur_kurikulum`      | enum  | `Pengajar Diniyah` / `Pengajar Umum` | Dua kolom terpisah di sheet; hadir sejak berkas 01          |
| `jalur`                | enum  | `MUDARIS BANIN` / `MUDARIS BANAT`    | `banin` \| `banat` \| `ra_paud`                             |
| `wali_kelas_rombel_id` | ULID? | `Wali Kelas`                         |                                                             |

**Mengapa `pengajar` punya `nik`.** Mukafaah adalah pembayaran berulang kepada orang dewasa;
pelaporannya cepat atau lambat menuntut identitas resmi. Sama seperti `wali`: kolomnya
disiapkan, nullable, dan diklasifikasikan `terlarang` sejak awal — bukan ditambahkan belakangan
setelah terlanjur ada yang menyalinnya ke tempat yang salah.

Mukafaah pengajar berperiode Hijriah — lihat ADR 0004. Besarannya bukan master data, ia
transaksi.

## 7. Kurikulum: `mapel`, `kurikulum`, `skala_nilai`

Daftar mapelnya sendiri **belum diketahui** — `STATE.md` mencatatnya sebagai keputusan yang
menggantung, dan tidak ada sistem akademik di Drive untuk dibaca. Karena itu yang dirancang di
sini adalah **wadahnya**, dan wadah itu dibuat supaya daftar mapel bisa diisi, diubah, dan
berbeda antar jalur maupun antar tahun **tanpa mengubah skema sama sekali**.

Aturan yang dipegang: **tidak ada satu pun nama mapel yang hidup di dalam skema.** Semuanya
baris data. Skema yang menyebut `tahfidz` atau `matematika` di dalam enum akan menuntut migrasi
setiap kali pesantren mengubah kurikulumnya — dan pesantren memang mengubahnya.

### `mapel` — katalog datar

| Kolom             | Tipe  | Catatan                                                              |
| ----------------- | ----- | -------------------------------------------------------------------- |
| `id`              | ULID  |                                                                      |
| `kode`            | text unik | Dipakai di Sheet dan ekspor, stabil walau namanya diperbaiki      |
| `nama`            | text  |                                                                      |
| `nama_arab`       | text? | Mapel diniyah kerap punya nama Arab yang dipakai di rapor            |
| `jalur_kurikulum` | enum  | `diniyah` \| `umum` — pembagian yang sudah ada sejak berkas 01       |
| `jenis_penilaian` | enum  | `angka` \| `predikat` \| `hafalan` \| `deskriptif`                   |
| `skala_nilai_id`  | ULID? | →`skala_nilai.id`; kosong bila `jenis_penilaian = hafalan`           |
| `aktif`           | bool  | Mapel yang tidak lagi diajarkan **dinonaktifkan, tidak dihapus** — nilai lama tetap punya rujukan |

Empat `jenis_penilaian` itu bukan hiasan; keempatnya benar-benar berbeda cara hidupnya:
`angka` bernilai 0–100, `predikat` bernilai simbolik (mumtaz, jayyid jiddan, …), `hafalan`
diukur sebagai capaian juz/halaman lewat `quran_surah` dan `quran_juz_batas` — bukan skor —
dan `deskriptif` untuk aspek akhlak yang dinilai dengan kalimat.

### `kurikulum` — di sinilah fleksibilitasnya

Menghubungkan mapel ke **marhalah pada satu tahun ajaran**. Satu baris = "mapel ini diajarkan
di marhalah ini, tahun ini".

| Kolom             | Tipe  | Catatan                                                          |
| ----------------- | ----- | ----------------------------------------------------------------- |
| `tahun_ajaran_id` | ULID  |                                                                   |
| `marhalah`        | enum  | `paud` \| `ra` \| `ibtidaiyyah` \| `mutawashitoh`                 |
| `mapel_id`        | ULID  |                                                                   |
| `tingkat`         | int?  | Bila mapel hanya untuk kelas tertentu (mis. hanya kelas 4–6)      |
| `urutan`          | int   | Urutan tampil di rapor                                            |
| `jam_per_pekan`   | int?  |                                                                   |
| `kkm`             | int?  | Batas ketuntasan, bila `jenis_penilaian = angka`                  |

Karena kuncinya memuat `tahun_ajaran_id`, **mengubah kurikulum tahun depan tidak menyentuh
kurikulum tahun ini** — dan rapor lama tetap bisa dicetak ulang persis seperti aslinya. Ini
alasan utama tabel ini dipisah dari `mapel`.

Penugasan pengajar ke mapel per rombel (`pengampu`) menyusul bersama modul akademik; bentuknya
`(rombel_id, mapel_id, pengajar_id)` dan tidak mengubah apa pun di atas.

### `skala_nilai` dan `skala_nilai_butir`

Supaya skala nilai diniyah — yang **masih terbuka** menurut `STATE.md` — bisa ditetapkan
sebagai data seed lewat Sheet Pola, bukan sebagai perubahan kode.

`skala_nilai`: `id`, `nama`, `jenis` (`angka` \| `predikat`), `nilai_min?`, `nilai_max?`

`skala_nilai_butir`: `skala_nilai_id`, `kode`, `label`, `label_arab?`, `urutan`,
`batas_bawah?`, `batas_atas?`

Dengan ini skala Arab dan skala angka 0–100 hidup berdampingan tanpa saling memaksa, dan
menambah skala baru cukup dengan menambah baris.

## 8. `akun_keuangan`

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

## 9. `komponen_biaya`

Terbaca dari header Kartu Kendali berkas 04: SPP, Biaya Pendaftaran, Biaya Uang Gedung,
Biaya Sarana Prasarana, Biaya Modul/Buku/ATK (Banin-Banat-RA), Biaya Raport, **Biaya PKBM**.

Besarannya berbeda per marhalah (SPP PAUD Rp100.000, RA Rp150.000) dan berubah tiap tahun
ajaran, jadi tarif disimpan berversi per `tahun_ajaran`, bukan sebagai satu angka.

`Biaya PKBM` baru muncul di berkas 04 — bentuk kolomnya jelas, aturannya belum
(**P3 pertanyaan 6**).

## 10. `tahun_ajaran` dan periode

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
| **terlarang**  | `santri.nik`, `wali.nik`, `pengajar.nik`, `no_kk`, nomor rekening      | **Tidak pernah** keluar dari `core`. Tidak ke prompt, tidak ke Sheet, tidak ke log |
| **sensitif**   | `tanggal_lahir`, `alamat`, `no_hp`, `wali.status_hidup`, status yatim/piatu | Hanya ke pihak yang berhak menurut matriks peran; tidak pernah ke prompt LLM |
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
   memang tidak ada yang wafat — dan selama itu belum jelas, status piatu tidak bisa dipastikan
   untuk siapa pun. Nilainya dicatat `tidak_diketahui`, bukan ditebak jadi `hidup`.
4. **Isi daftar mapel, skala nilai diniyah, aspek akhlak, jam KBM** — masih kosong seperti
   dicatat `STATE.md`. **Wadahnya sudah ada** (bagian 7), jadi pengisiannya adalah data seed
   lewat Sheet Pola dan tidak menuntut perubahan skema. Tidak memblokir.
5. **`nik` wali dan pengajar** sengaja nullable dan belum didata di sheet mana pun.
   Pengumpulannya menyangkut persetujuan orang dewasa — masuk keputusan perlindungan data
   yang masih menggantung di `STATE.md`, bukan sekadar pekerjaan entri.
6. **Batas rombel Ibtidaiyyah dan Mutawashitoh** — berapa kelas masing-masing, dan apakah
   Mutawashitoh sudah punya rombel sendiri atau masih gabung.
