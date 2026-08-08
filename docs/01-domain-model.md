# 01 — Model Domain

Bentuk resmi ada di `packages/contracts`. Dokumen ini menjelaskan _mengapa_ bentuknya
begitu — bagian yang tidak terbaca dari skema.

## Glosarium

| Istilah                 | Arti                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| **Marhalah**            | Jenjang: RA-PAUD, MI Banin, MI Banat                             |
| **Halaqah**             | Kelompok tahfidz, dibimbing seorang mudaris/mudarisah            |
| **Mudaris / mudarisah** | Pengajar tahfidz pada sebuah halaqah                             |
| **Ziyadah**             | Setoran hafalan **baru**                                         |
| **Murojaah**            | Setoran **pengulangan** hafalan yang sudah dikuasai              |
| **Mukafaah**            | Imbalan bulanan pengajar — berperiode **Hijriah**                |
| **SPP**                 | Iuran bulanan santri — berperiode **Masehi**                     |
| **PROTA**               | Program Orang Tua Asuh — donatur menanggung biaya santri asuhnya |
| **Keringanan**          | Potongan biaya bagi wali yang mengajukan                         |
| **Kartu Kendali**       | Kartu tagihan per santri pada sistem lama                        |

## Identitas

```
santri        nis · nisn · nik · nama · marhalah · tempat_lahir · tanggal_lahir · jenis_kelamin · status
wali          id · nik · nama · nama_kuniah · no_hp · alamat
wali_santri   wali_id · santri_id · jenis_hubungan · aktif
pengajar      id · no_induk · nama · aktif
pengguna_telegram  telegram_id · peran · entitas_id
```

**`wali_santri` adalah n:m, dan itu disengaja.** Seorang wali bisa punya beberapa santri;
seorang santri bisa punya ayah, ibu, sekaligus orang tua asuh.

`jenis_hubungan` (`ayah` / `ibu` / `wali` / `asuh`) **murni label deskriptif, bukan sumbu
izin.** Orang tua asuh adalah wali biasa — anak asuhnya sekadar santri yang tertaut
padanya. Tidak ada peran terpisah, tidak ada profil izin kedua.

## Akademik

```
tahun_ajaran   kode "2026/2027" · mulai · selesai · aktif
marhalah       kode (ra_paud|mi_banin|mi_banat)
kelas          tahun_ajaran · marhalah · nama · fase · wali_kelas
halaqah        tahun_ajaran · nama · mudaris
santri_kelas   santri · kelas · mulai · selesai
santri_halaqah santri · halaqah · mulai · selesai
mata_pelajaran kode · nama · jalur (diniyah|umum) · marhalah?
kalender_akademik  tanggal · jenis (kbm|libur|ujian)
```

**Santri berada di dua pengelompokan sekaligus**: kelas untuk pembelajaran diniyah & umum,
halaqah untuk tahfidz. Penanggung jawabnya orang berbeda.

**Keanggotaan disimpan sebagai tabel berjangka waktu, bukan kolom pada `santri`.** Kalau
`kelas_id` ditaruh sebagai kolom, riwayat perpindahan tertimpa setiap kenaikan kelas — dan
pertanyaan seperti _"bagaimana capaian angkatan ini saat masih di Paket A"_ jadi mustahil
dijawab. Kedua tabel ini menjadi sumber SCD Type 2 di lapisan OLAP.

**`kalender_akademik` bukan pelengkap.** Tanpa daftar hari KBM dan libur, sistem tidak bisa
membedakan santri yang mangkir dari hari yang memang tidak ada kegiatan, dan seluruh angka
kehadiran kehilangan makna.

## Aktivitas

```
absensi       santri · tanggal · konteks (halaqah|kelas) · ref · status · dicatat_oleh
              UNIQUE (santri, tanggal, konteks)
setoran       santri · halaqah · mudaris · tanggal · jenis (ziyadah|murojaah)
              · surah_no · ayat_mulai · ayat_selesai · kualitas
nilai         santri · mata_pelajaran · kelas · tanggal · jenis (formatif|sumatif) · nilai · deskripsi
perkembangan  santri · tanggal · aspek · observasi        ⟵ PAUD, naratif
```

Status absensi: `hadir` / `sakit` / `izin` / `alpa`.

**Ziyadah dan murojaah dibedakan** karena mengukur hal berbeda: yang pertama capaian yang
bertambah, yang kedua kedisiplinan menjaga. Justru yang kedua yang biasanya bermasalah,
dan tak terlihat sama sekali bila hanya capaian yang dicatat.

## Keuangan

```
jenis_tagihan  kode · nama · aktif        (SPP, pendaftaran, uang gedung, sarpras, rapor, modul, PKBM)
tagihan        santri · jenis · bulan_spp (bulan Masehi) · jatuh_tempo · nominal
               · prorata_mulai · keringanan · skema_periode
pembayaran     tagihan · tanggal · nominal · metode (transfer|tunai) · sumber (wali|orang_tua_asuh)
               · cicilan_ke
alokasi_prota  donatur · santri · periode · nominal
saldo_kredit   santri · nominal        ⟵ lebih bayar
mutasi_bank    tanggal · nominal · arah · diperiksa_oleh_1 · diperiksa_oleh_2
mukafaah       pengajar · periode_hijriah · nominal
```

Aturan yang ditemukan dari sistem lama, dan tidak terdokumentasi di mana pun sebelumnya:

- **Cicilan sampai 6 kali** per tagihan
- **Prorata dari bulan mulai KBM** — santri yang masuk di tengah tahun tidak ditagih penuh
- **Lebih bayar** disimpan sebagai saldo kredit, bukan diabaikan
- **Kontrol empat mata** pada mutasi bank oleh dua pemeriksa bernama — dipertahankan,
  bukan dihapus karena "sudah ada sistem"
- **Dua skema periode** hidup berdampingan di data lama: Hijriah (sampai ~Maret 2026) dan
  Masehi (April 2026 dan sesudahnya). `skema_periode` menyimpan asal-usul tiap baris agar
  tetap dapat ditelusuri saat rekonsiliasi.
- **Tunai ~4 dari 10 penerimaan** — mutasi bank tidak pernah mencakup seluruh pemasukan

## Rujukan statis

```
quran_surah      nomor (1–114) · nama · nama_latin · jumlah_ayat
quran_juz_batas  juz · surah_mulai · ayat_mulai · surah_selesai · ayat_selesai
kalender_hijriah bulan_hijriah · tanggal_mulai_masehi · provisional
```

Tabel kecil tapi menopang banyak: validasi rentang ayat, capaian kumulatif, deteksi
milestone (selesai surah/juz) yang memicu notifikasi ke wali, dan konversi tanggal untuk
mukafaah.

## Lintas

```
audit_log     aktor · aksi · entitas · nilai_sebelum · nilai_sesudah · waktu · asal
undangan      kode · santri · jenis_hubungan · kadaluarsa · maks_pakai · terpakai · dicabut
pengumuman    judul · isi · sasaran · waktu_terbit
```

## Yang sengaja TIDAK disimpan

Tunggakan · saldo tagihan · capaian hafalan · progres juz.

Semuanya **dihitung dari transaksinya** di lapisan OLAP. Sistem lama rusak persis karena
angka turunan disimpan terpisah dari sumbernya lalu menyimpang, tanpa ada yang bisa
menentukan mana yang benar.
