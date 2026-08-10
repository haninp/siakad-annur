# 06 — Migrasi dari Spreadsheet Lama

> **Status: draf; P3 terjawab sebagian.** Keempat berkas rantai (01–04) sudah dibaca. Bagian
> "yang sudah terbaca" berasal dari pembacaan langsung dan sudah dapat dipakai — **dengan
> batas metode di bawah**. Jawaban sesi P3 dicatat di bagian bawah; dua pertanyaan masih
> terbuka (no. 7 dan 8), dan satu keputusan akademik nasional perlu diterjemahkan ke periode
> tagihan. Bagian keuangan pada `contracts` sudah tidak lagi diblokir penuh oleh P3.

## Cakupan pembacaan

Keempat berkas rantai sudah dibaca lewat ekspor MCP Google Drive:

| Berkas                                           | ID Drive                                       | Ukuran | Dibaca     |
| ------------------------------------------------ | ---------------------------------------------- | ------ | ---------- |
| `01. Database Keuangan KBM Masjid An Nuur Limo`  | `16Anl1Q93g5k4pT5Lr8faqlle0NwV8Qnz89N-nsxDrZI` | 786 KB | 9 Agu 2026 |
| `02. Sementara-Keuangan KBM ... 1445H-1446H`     | `1Z5snJ9T6lsnKsbmvsmZWcpeoM7XJ-1zaxlztd08al8o` | 1,5 MB | 9 Agu 2026 |
| `03. Database Keuangan KBM ... 1446H-1447H`      | `14_t7WKQntdaXUWeoYpcL7AL0ldsTmJVcbFtp46-wdNw` | 1,5 MB | 9 Agu 2026 |
| `04. DATABASE KEUANGAN TA 1446-1447 (2026-2027)` | `1aBZYsIgNl14j6IsWFd5hHKozVt7YXF84ex9NQDOacpo` | 1,0 MB | 9 Agu 2026 |

### Batas metode — baca ini sebelum memercayai angka mana pun di bawah

Ekspor MCP tidak membawa nama sheet, jadi tabel dipetakan lewat baris header. Lebih penting:
**ekspor bersifat cuplikan renggang, bukan potongan awal.** Buktinya jurnal warisan 2023
yang muncul di keempat berkas: kolom `No` berjalan **63 sampai 220** tetapi hanya **78 baris**
yang terbawa. Ada lubang di tengahnya.

Konsekuensinya keras: **rentang tanggal di bawah adalah batas bawah, bukan cakupan sebenarnya.**
Ekspor ini bisa membuktikan sebuah periode _ada_ di suatu berkas; ia **tidak bisa** membuktikan
sebuah periode _tidak ada_. Kesimpulan final tentang cakupan menunggu akses Sheets API
(prasyarat **P2**).

Satu jebakan pencarian yang mahal: **ekspor markdown meng-escape garis bawah** (`is\_bebas\_spp`),
sehingga pencarian `is_bebas_spp` mengembalikan nol padahal kolomnya ada. Buang backslash
lebih dulu sebelum mencari apa pun yang bernama snake_case.

Setelah dikoreksi: blok berformat EMIS (`nism`, `nisn`, `nik`, … `is_locked`, `is_bebas_spp`,
`spp_khusus`) **ada, dan hanya di berkas 04**. Sheet `MutasiBSI` tetap nihil di keempat ekspor;
`HALAQOH` hanya muncul di 01 dan 02. Statusnya: belum terverifikasi, bukan tidak ada.

## Koreksi: sebaran tahun versi lama tidak mengukur transaksi

Revisi dokumen sebelumnya memuat tabel sebaran tahun untuk 03 dan 04 yang dihitung dengan
mencocokkan pola `dd/mm/yyyy` **ke seluruh isi ekspor**. Pembacaan 01 dan 02 membongkar apa
yang sebenarnya ikut terhitung di sana:

| Sumber tanggal dalam ekspor      | Sifat                                    | Contoh sumbangan         |
| -------------------------------- | ---------------------------------------- | ------------------------ |
| Sheet log add-on Document Studio | **Bukan transaksi** — jejak cetak berkas | 164× 2023 + 47× 2024     |
| Jurnal warisan 2023              | Transaksi, tapi **disalin ke 4 berkas**  | 156 (78 baris × 2 kolom) |
| Cuplikan header `MUTASI ... BSI` | Contoh baris, bukan data                 | 4× 2023                  |
| Kolom tanggal lahir santri       | **Data pribadi**, bukan transaksi        | seluruh tahun 2013–2018  |
| Kartu Kendali & mutasi bank      | Turunan / rekening, bukan jurnal         | ratusan                  |

Angka `324` untuk tahun 2023 yang identik di 02, 03, dan 04 kini terjelaskan seluruhnya:
`4 + 156 + 164 = 324`. Itu **boilerplate warisan**, bukan "blok master tanggal" seperti
diduga sebelumnya.

Dan angka `47` untuk 2024 di file 04 **seluruhnya** berasal dari log Document Studio —
nol transaksi. Tabel lama membandingkan derau, bukan data.

## Sebaran tanggal transaksi yang sebenarnya

Dihitung dari kolom `Tanggal Transaksi` / `TGL Transaksi` pada blok jurnal saja:

| Berkas | Jurnal aktif — bulan terbaca | Baris | `No` | `No Transaksi`  |
| ------ | ---------------------------- | ----: | ---- | --------------- |
| **01** | Juli 2023                    |    51 | 1–51 | 451081 – 451089 |
| **02** | Maret–April 2024             |    75 | 1–75 | 453631 – 454229 |
| **03** | Februari–Maret 2025          |    66 | 1–67 | 457061 – 458035 |
| **04** | Januari–Mei 2026             |    68 | 1–68 | 461331 – 461651 |

Ditambah **satu jurnal warisan Juli–Agustus 2023** (78 baris, `No` 63–220) yang hadir
**identik baris-per-baris di keempat berkas** — sudah diperiksa: sama persis, bukan mirip.

### Dua hal yang berubah dari kesimpulan lama

**1. "Tiap generasi mulai dari nol" perlu diperhalus.** Yang benar: tiap berkas memulai
**jurnal aktif** yang baru untuk periodenya sendiri, sementara **satu sheet arsip 2023
ikut disalin turun-temurun**. Jadi pewarisan memang terjadi — hanya saja yang diwariskan
sheet arsip lama, bukan jurnal tahun sebelumnya.

**2. Kesimpulan pokoknya tetap berdiri, malah menguat.** Tiap berkas memegang periode yang
tidak dipegang berkas lain: 01→2023, 02→2024, 03→2025, 04→2026. **Cakupan impor adalah
rantai berkas 01–04, bukan berkas terakhir.** Mengimpor 04 saja berarti membuang tiga tahun
riwayat — termasuk tunggakan terbawa yang menentukan benar-tidaknya saldo awal tiap santri.

### Kabar baik: `No Transaksi` adalah deret global

Rentang `No Transaksi` naik monoton lintas generasi dan **tidak saling tumpang tindih**:
451xxx (2023) → 453xxx (2024) → 457xxx (2025) → 461xxx (2026).

Artinya penomoran berjalan lintas berkas, bukan diulang per berkas. Ini membuat
**deduplikasi lewat `No Transaksi` aman** — dan satu-satunya duplikasi nyata yang ditemukan
(sheet arsip 2023 di keempat berkas) justru persis yang akan ditangkapnya.

## Kerusakan bertambah antar generasi

| Sinyal              |   File 03 |   File 04 |       Perubahan |
| ------------------- | --------: | --------: | --------------: |
| `#N/A`              |     4.286 |     4.695 |            +409 |
| `#VALUE!`           |       379 |       404 |             +25 |
| `#REF!`             |       110 |       170 |             +60 |
| **Total sel rusak** | **4.775** | **5.269** | **+494 (+10%)** |

Ini bukan keadaan yang stabil. Setiap tahun ajaran baru **mewarisi kerusakan lama lalu
menambah kerusakan baru**. Karena Kartu Kendali dan seluruh laporan adalah turunan lewat
lookup, kekeliruannya merambat ke angka yang dibaca orang untuk mengambil keputusan.

Arahnya bukan menuju kegagalan yang kentara, melainkan **kesalahan yang senyap** — angka
tetap tampil, sebagian keliru, dan tidak ada yang bisa memeriksa yang mana.

## Peralihan skema periode terkonfirmasi

| Berkas | Skema Hijriah                | Skema Masehi                                      |
| ------ | ---------------------------- | ------------------------------------------------- |
| **03** | 12 periode (`1.` … `12.`)    | **tidak ada**                                     |
| **04** | 12 periode (masih tersimpan) | **15 periode**, `1. April 2026` … `15. Juni 2027` |

File 03 murni Hijriah; file 04 memuat keduanya. Ini membuktikan **peralihan terjadi pada
generasi 04**, sekitar April 2026 — bukan sekadar penamaan yang tidak konsisten.

Deretan baru berjumlah **15, bukan 12** — indikasi masa transisi: April–Juni 2026 menutup
ekor tahun lama, lalu Juli 2026–Juni 2027 menjadi tahun ajaran penuh yang selaras dengan
kalender sekolah Indonesia.

**Konsekuensi importer:** tangani kedua skema, simpan `skema_periode` per baris, dan
**jangan normalkan periode transisi menjadi 12** — itu akan menghilangkan atau menggandakan
tagihan nyata.

## Apa yang baru, apa yang bertahan

Angka = jumlah kemunculan istilah dalam ekspor. Pembacaan 01 dan 02 **memundurkan** beberapa
pola yang sebelumnya disangka warisan lama:

| Istilah                            |  01 |  02 |  03 |  04 | Bacaan                                                                                             |
| ---------------------------------- | --: | --: | --: | --: | -------------------------------------------------------------------------------------------------- |
| `Cek Abu ...` (kontrol empat mata) |   2 |   2 |   2 |   2 | **Benar-benar pola inti** — ada sejak 01. Pertahankan                                              |
| Cicilan                            |   3 |   9 |   5 |   4 | **Benar-benar pola inti** — ada sejak 01                                                           |
| Mukafaah                           |   8 |   8 |   9 |   8 | Pola inti                                                                                          |
| Ta'awun / TAAWUN                   |  14 |  10 |  65 |   7 | Pola inti                                                                                          |
| Tunggakan                          |  96 | 179 | 225 | 266 | Pola inti — porsinya membesar tiap generasi                                                        |
| Pengajar Diniyah / Umum            |   2 |   2 |   1 |   1 | Dua jalur kurikulum sudah lama ada                                                                 |
| **PROTA**                          |   — |   1 |  25 |  13 | **Bukan warisan lama.** Muncul di 02 sebagai "ALOKASI TAAWUN PROTA", matang di 03                  |
| **KERINGANAN**                     |   — |   1 |   4 |  15 | **Bukan warisan lama.** Muncul di 02, tumbuh terus                                                 |
| **NISN**                           |   — |   — |   8 |  16 | **Baru di 03**, dan di sana ditandai `update NISN 2026` — masih backfill                           |
| **Lebih Bayar**                    |   — |   — |   2 |  62 | Di 03 **hanya legenda kode warna**; jadi besaran yang dikelola baru di 04                          |
| **TAYSIR**                         |   — |   — |   — |   2 | Baru di 04                                                                                         |
| **Biaya PKBM**                     |   — |   — |   — |  33 | Baru di 04 — komponen biaya sejajar SPP, Pendaftaran, Uang Gedung, Sarpras, Modul/Buku/ATK, Raport |

**Yang berubah dari bacaan sebelumnya:** PROTA, KERINGANAN, dan NISN sempat dicatat sebagai
"pola inti yang bertahan lintas generasi". Ternyata ketiganya **absen di berkas 01**. Umurnya
dua sampai tiga tahun, bukan sejak awal — jadi aturannya belum tentu mapan dan **tetap perlu
ditanyakan**, tidak boleh langsung dibekukan jadi skema.

Yang benar-benar aman dibekukan hanya yang hadir sejak 01: kontrol empat mata, cicilan,
mukafaah, ta'awun, tunggakan, dan dua jalur pengajar.

## Silsilah kolom jurnal — ada dua skema, bukan satu

Patahan besar terjadi antara **02 dan 03**, bukan 03→04:

| Generasi  | Identitas santri di jurnal                    | Akun                                    | Ciri khas                                         |
| --------- | --------------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| **01–02** | `Nama`, `No Induk`, `Kelas`, `Banin/Ra/Banat` | `Akun Transaksi` (satu kolom)           | `Terbilang`, `cetak/belum`, kolom Document Studio |
| **03–04** | `NAMA`, `ORANG TUA`, `NIS`, `KELAS`           | `AKUN MASUK` + `AKUN KELUAR` (terpisah) | `NILAI PROTA`, `Cicilan ke - (Max 6)`             |

Perbedaan 03→04 hanya penghalusan: `Tanggal Transaksi` → `TGL Transaksi`, tambahan
`khusus entri PROTA`, `Jika Akun Masuk SPP atau PROTA`, `AKUN KELUAR (KHUSUS CATAT PENGELUARAN)`,
dan satu kolom mati bernama `DELL`.

Beberapa hal khas per generasi yang perlu dicatat importer:

- **`Tunggakan` sebagai kolom jurnal hanya ada di 01.** Angka turunan disimpan di baris
  transaksi — persis anti-pola yang dilarang ADR. Jangan diimpor; hitung ulang.
- **`Nama Bapak` dan `NILAI TAAWUN` hanya ada di 02**, lalu hilang.
- **Kolom Document Studio (`File Status`, `File Link`) hanya di 01** — cetak kuitansi lewat
  add-on adalah kebiasaan generasi pertama.
- **`Bulan SPP` berganti isi**: di 04 memuat label Hijriah (`9. Jumadil Akhir 1447 H`)
  sementara `Bulan Masehi (Transaksi)` berdiri sendiri.

**Konsekuensi importer:** siapkan **dua pemetaan kolom**, satu untuk 01–02 dan satu untuk
03–04. Satu pemetaan tunggal akan menggeser kolom secara diam-diam — dan pergeseran kolom
pada data keuangan tidak menghasilkan galat, hanya angka yang salah.

## Struktur yang ditemukan (file 04)

| Tabel                | Peran                                | Catatan                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`             | Master data                          | ~8 tabel tak berhubungan berdampingan horizontal: bulan, tanggal, santri (Banin/Banat/RA terpisah), mudaris, dropdown, biaya, konsep pemasukan-pengeluaran, plus blok berformat **EMIS** (`nism, nisn, nik, …, is_locked, is_bebas_spp, spp_khusus`) |
| Transaksi            | Jurnal pemasukan **dan** pengeluaran | ~31 kolom, hanya ~8 dientri. Sheet menandai sendiri asal kolom: `Entri` / `Auto` / `Khusus PROTA`. Ada kolom mati (`DELL`) dan penolong format (`Bulan Alfa`, `No Based TGL`)                                                                        |
| Kartu Kendali        | Kartu tagihan per santri             | Pos biaya ganda (tagihan vs terbayar) + `TOTAL TUNGGAKAN` + flag bantuan pendidikan                                                                                                                                                                  |
| Potensi              | Referensi & proyeksi                 | Potensi SPP per marhalah & kelas, realisasi, persentase penagihan                                                                                                                                                                                    |
| Kendali all / online | Laporan                              | Murni turunan — **menjadi obsolete** begitu laporan terbit otomatis                                                                                                                                                                                  |

Blok EMIS di `master` adalah **hadiah**: bentuk ekspor yang dibutuhkan kementerian sudah
terlihat, tinggal dipetakan.

## Aturan bisnis yang terbaca

Semua ini tersimpul dari anotasi kolom dan isi data, tidak terdokumentasi di mana pun:

1. **Cicilan sampai 6 kali** (`Cicilan ke - (Max 6)`)
2. **Prorata dari bulan mulai KBM**; `0 = belum masuk atau keluar KBM`
3. **Lebih bayar** perlu dimodelkan sebagai saldo kredit
4. **PROTA = Program Orang Tua Asuh** — dana donatur dialokasikan menutup SPP santri asuhnya
5. **Kontrol empat mata** pada mutasi bank oleh dua pemeriksa bernama
6. **Keringanan** lewat flag bantuan pendidikan + `is_bebas_spp` / `spp_khusus`
7. Marhalah riil: **RA-PAUD, MI Banin, MI Banat**; SPP PAUD 100rb, RA 150rb
8. **Tunai signifikan** — Transfer Bank 82 berbanding Cash 52 pada data terbaca, sekitar
   4 dari 10 penerimaan tunai
9. Rasio penagihan **sangat timpang** antar kelompok — persentase yang muncul tersebar
   dari 30% sampai 94%

## Kerapuhan yang harus diselesaikan, bukan diwarisi

- **Santri dikenali lewat nama teks bebas**; NIS hanya hasil lookup. Salah ketik →
  transaksi tak bertuan. Di SIAKAD, transaksi **wajib** mengacu `santri_id`
- Master santri terpecah tiga (Banin/Banat/RA) dengan penomoran terpisah
- Kolom turunan bercampur kolom entri dalam satu tabel
- Penggunaan sel merge masif membuat data tidak terbaca mesin

## Strategi migrasi

**Impor seluruh rantai berkas, bukan hanya yang terakhir.** Tiap berkas memegang periode yang
tidak dipegang berkas lain (01→2023, 02→2024, 03→2025, 04→2026), sehingga riwayat tersebar.
Deduplikasi lewat `No Transaksi`, yang sudah terbukti sebagai deret global lintas berkas.

**Pakai dua pemetaan kolom** — 01–02 dan 03–04 memakai tata kolom yang berbeda. Lihat
"Silsilah kolom jurnal" di atas.

**Impor entrinya, hitung ulang turunannya.**

Yang rusak adalah angka _turunan_ — Kartu Kendali, total tunggakan, laporan. Baris
transaksinya sendiri data entri dan kemungkinan besar masih sehat.

- Impor **baris transaksi saja**; tunggakan dan saldo dihitung ulang SIAKAD
- Saldo hasil impor ditandai `belum_direkonsiliasi`
- Spreadsheet lama **tidak dipensiunkan** — arsip baca-saja sampai rekonsiliasi selesai
- Rekonsiliasi dilakukan **setelah** sistem hidup: selisih antara hitungan SIAKAD dan Kartu
  Kendali lama **adalah hasil auditnya**

## Pertanyaan terbuka — untuk sesi P3

Diperbarui setelah pembacaan 01 dan 02. Beberapa pertanyaan berubah bentuk karena umur tiap
pola sudah diketahui — yang ditanyakan sekarang bukan lagi "apakah ada", melainkan "kapan
dan mengapa berubah", yang jauh lebih mudah dijawab manusia.

1. **TAYSIR** — masih hidup atau sudah ditinggalkan? Arah pertukaran data ke mana, dan field
   apa yang jadi kunci pencocokan? _(Baru muncul di 04, jadi kemungkinan besar masih hidup.)_
2. **Keringanan mulai dipakai sekitar berkas 02 (2024)** — apa yang memicunya, siapa yang
   memutuskan besarannya, atas dasar apa, dan berlaku berapa lama?
3. **Santri keluar di tengah tahun** — tagihan berjalan dihapus, ditagih penuh, atau prorata?
4. **PROTA juga baru mulai di 02** dan matang di 03. Bagaimana aturannya sekarang, dan sisa
   dana yang tidak teralokasi — dikembalikan ke donatur atau digulirkan?
5. **Awal tahun ajaran** — deretan 15 periode di 04 menunjukkan pergeseran ke Juli. Kapan
   diputuskan, dan apakah periode transisi April–Juni 2026 ditagih seperti bulan biasa?
6. **`Lebih Bayar`** sudah ada di 03 tapi hanya sebagai kode warna status, lalu jadi besaran
   yang dikelola di 04. Apa yang berubah — mulai dikembalikan tunai, atau dipotong tagihan
   berikutnya? **`Biaya PKBM`** yang benar-benar baru di 04: siapa yang menanggung, dan
   apakah dikenakan ke semua santri?
7. Kolom bertanda **`Khusus PROTA`** pada tabel transaksi — apa persisnya yang dicatat di sana?
8. **Sheet arsip Juli–Agustus 2023 disalin utuh ke keempat berkas.** Disengaja sebagai
   rujukan saldo awal, atau sisa salin-tempel yang terbawa? Jawabannya menentukan apakah ia
   diimpor sekali atau diabaikan sama sekali.
9. **`NISN` masih kosong** di master berkas 04 dan ditandai `update NISN 2026` sejak berkas 03.
    Apakah pengisiannya sedang berjalan, dan dari sumber mana?

## Jawaban P3 — 10 Agustus 2026

Berdasarkan sesi dengan pemegang pengetahuan keuangan:

1. **TAYSIR** — saat ini **ditangguhkan**. Kalau SIAKAD berjalan, TAYSIR kemungkinan besar
   dihentikan (`terminated`), sehingga **tidak perlu diintegrasikan** ke sistem baru.
2. **KERINGANAN** — murni **kebijakan pengurus** dengan mempertimbangkan kondisi keuangan
   wali santri. Bisa juga diawali dari **permintaan resmi wali santri ke pengurus**.
3. **Santri keluar di tengah tahun** — tagihan yang belum dihapuskan **masih ditagih**, dan
   **uang yang sudah dibayarkan tidak dikembalikan**.
4. **PROTA** — sisa dana yang tidak teralokasi **tidak dikembalikan ke donatur**, melainkan
   **disimpan untuk kebutuhan PROTA periode selanjutnya**.
5. **Awal tahun ajaran** — mengikuti **kalender akademik nasional** (Juli–Juni).
6. **Lebih Bayar** — dipotong untuk **tagihan berikutnya**, tidak dikembalikan tunai.
7. **Kolom `Khusus PROTA`** — **belum bisa dijawab**. Perlu sesi tindak lanjut atau contoh
   entri nyata untuk memahami isinya.
8. **Sheet arsip Juli–Agustus 2023** — **di-skip dulu**; keputusan impor ditunda hingga ada
   arahan lebih lanjut.
9. **NISN** — akan **dilengkapi belakangan**; kolom ini boleh kosong untuk sementara dan
   tidak menghalangi go-live.

### Yang tidak lagi perlu ditanyakan

- Apakah `No Transaksi` bisa dipakai deduplikasi — **sudah terjawab: bisa**, deretnya global
  dan tidak tumpang tindih antar berkas.
- Apakah 01 dan 02 memegang periode yang tak terwakili — **sudah terjawab: ya**, 2023 dan 2024.
