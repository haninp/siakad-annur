# 06 — Migrasi dari Spreadsheet Lama

> **Status: draf.** Bagian "yang sudah terbaca" berasal dari pembacaan langsung dan sudah
> dapat dipakai. Bagian "pertanyaan terbuka" menunggu sesi dengan pemegang pengetahuan
> keuangan (prasyarat **P3**) — dan itu yang memblokir bagian keuangan pada `contracts`.

## Cakupan pembacaan

| Berkas                                             | Dibaca                                           | Catatan                                                           |
| -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| **04. DATABASE KEUANGAN TA 1446-1447 (2026-2027)** | 8 Agu 2026, ~656 rb karakter dari berkas ~1 MB   | Nama sheet **tidak** terbawa ekspor; tabel dipetakan lewat header |
| **03. Database Keuangan KBM ... 1446H-1447H**      | 8 Agu 2026, ~613 rb karakter dari berkas ~1,5 MB | Sama                                                              |

**Keduanya parsial.** Sebagian sheet kemungkinan tidak ikut terekspor — `MutasiBSI`,
`HALAQOH`, dan `is_bebas_spp` terlihat pada cuplikan pencarian Drive tetapi tidak pada isi
ekspor. Angka-angka di bawah menunjukkan **struktur dan tren**, bukan agregat bisnis.

## Temuan utama: tiap generasi berkas MULAI DARI NOL

Sebaran tahun pada tanggal transaksi (`dd/mm/yyyy`):

| Tahun    | File 03 | File 04 |
| -------- | ------: | ------: |
| 2023     |     324 |     324 |
| 2024     |      68 |      47 |
| **2025** | **422** |   **1** |
| 2026     |     144 |     325 |

**File 04 praktis tidak membawa data 2025** — satu tanggal, sementara 03 punya 422.
File 04 **tidak mewarisi** riwayat 03; ia mulai dari nol untuk 2026.

_(Angka 2023 yang identik di keduanya kemungkinan blok rujukan statis — master tanggal —
yang disalin turun-temurun, bukan transaksi.)_

### Konsekuensi: cakupan impor adalah RANTAI berkas, bukan berkas terakhir

Berhentinya sebuah berkas dipakai untuk entri baru **tidak** membuatnya usang sebagai
sumber riwayat. File 03 tetap satu-satunya tempat transaksi 2025 berada.

Mengimpor 04 saja berarti kehilangan satu tahun penuh riwayat keuangan — termasuk tunggakan
terbawa dari tahun sebelumnya, yang justru menentukan benar-tidaknya saldo awal tiap santri.

**Dugaan yang harus diperiksa:** pola ini berarti berkas **01** dan **02** kemungkinan
memegang riwayat 2023–2024. Keduanya ada di Drive:

| Berkas                                          | ID                                             | Terakhir diubah |
| ----------------------------------------------- | ---------------------------------------------- | --------------- |
| `01. Database Keuangan KBM Masjid An Nuur Limo` | `16Anl1Q93g5k4pT5Lr8faqlle0NwV8Qnz89N-nsxDrZI` | 23 Mei 2026     |
| `02. Sementara-Keuangan KBM ... 1445H-1446H`    | `1Z5snJ9T6lsnKsbmvsmZWcpeoM7XJ-1zaxlztd08al8o` | 23 Mei 2026     |

Sebelum importer ditulis, keduanya **wajib diperiksa dengan cara yang sama**: sebaran tahun
tanggal transaksi, untuk memastikan tidak ada periode yang tak terwakili berkas mana pun.

Ada juga kemungkinan **tumpang tindih** antar berkas (2024 muncul di 03 dan 04, 2026 muncul
di keduanya). Importer harus melakukan deduplikasi — kunci alaminya kemungkinan
`No Transaksi`, yang pada file 04 ditandai `Auto (Nomor UNIK)`.

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

| Istilah                            | 03  | 04  | Bacaan                                                    |
| ---------------------------------- | :-: | :-: | --------------------------------------------------------- |
| PROTA                              | ✅  | ✅  | Pola inti, bertahan lintas generasi                       |
| KERINGANAN                         | ✅  | ✅  | Pola inti                                                 |
| Cicilan                            | ✅  | ✅  | Pola inti                                                 |
| NISN                               | ✅  | ✅  | Pola inti                                                 |
| `Cek Abu ...` (kontrol empat mata) | ✅  | ✅  | Pola inti — **pertahankan**                               |
| Pengajar Diniyah / Umum            | ✅  | ✅  | Dua jalur kurikulum sudah lama ada                        |
| **TAYSIR**                         |  —  | ✅  | **Baru di 04** — integrasi yang hidup, bukan warisan mati |
| **Lebih Bayar**                    |  —  | ✅  | **Baru di 04** — penanganan lebih bayar relatif baru      |
| **Biaya PKBM**                     |  —  | ✅  | **Baru di 04** — afiliasi/pembiayaan PKBM relatif baru    |

Yang bertahan lintas generasi aman dijadikan skema. Yang baru muncul di 04 justru perlu
ditanyakan — kemunculannya berarti aturannya sedang terbentuk, bukan sudah mapan.

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

**Impor seluruh rantai berkas, bukan hanya yang terakhir.** Lihat temuan utama di atas:
tiap generasi mulai dari nol, sehingga riwayat tersebar di beberapa berkas. Deduplikasi
lewat `No Transaksi`.

**Impor entrinya, hitung ulang turunannya.**

Yang rusak adalah angka _turunan_ — Kartu Kendali, total tunggakan, laporan. Baris
transaksinya sendiri data entri dan kemungkinan besar masih sehat.

- Impor **baris transaksi saja**; tunggakan dan saldo dihitung ulang SIAKAD
- Saldo hasil impor ditandai `belum_direkonsiliasi`
- Spreadsheet lama **tidak dipensiunkan** — arsip baca-saja sampai rekonsiliasi selesai
- Rekonsiliasi dilakukan **setelah** sistem hidup: selisih antara hitungan SIAKAD dan Kartu
  Kendali lama **adalah hasil auditnya**

## Pertanyaan terbuka — untuk sesi P3

1. **TAYSIR** — masih hidup atau sudah ditinggalkan? Arah pertukaran data ke mana, dan field
   apa yang jadi kunci pencocokan? _(Baru muncul di 04, jadi kemungkinan besar masih hidup.)_
2. **Aturan penetapan besaran keringanan** — siapa memutuskan, atas dasar apa, berlaku berapa lama?
3. **Santri keluar di tengah tahun** — tagihan berjalan dihapus, ditagih penuh, atau prorata?
4. **Sisa dana PROTA** yang tidak teralokasi — dikembalikan ke donatur atau digulirkan?
5. **Awal tahun ajaran** — benarkah bergeser ke Juli, mengikuti deretan 15 periode itu?
6. **`Lebih Bayar` dan `Biaya PKBM`** baru muncul di 04 — aturannya sudah mapan atau masih
   dicoba-coba?
7. Kolom bertanda **`Khusus PROTA`** pada tabel transaksi — apa persisnya yang dicatat di sana?
