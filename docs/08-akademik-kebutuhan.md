# 08 — Kebutuhan Akademik dari Lapangan

> **Status: kebutuhan tercatat, belum dirancang ke `packages/contracts`.** Isinya berasal dari
> keterangan langsung pengelola pada 9 Agustus 2026 — bukan dari pembacaan berkas. Ini
> **penting**: `docs/06` dan `07` lahir dari data yang bisa diperiksa ulang, dokumen ini lahir
> dari percakapan. Karena itu setiap bagian di bawah menyebut apa yang sudah pasti dan apa yang
> masih perlu ditanyakan lagi.

Akademik adalah lahan kosong — tidak ada sistem akademik di Drive untuk dimigrasikan. Semua di
bawah ini dirancang dari awal, dan justru itu sebabnya kebutuhan aslinya harus dicatat sebelum
skema ditulis.

---

## Ringkasan: delapan kebutuhan

| #   | Kebutuhan                                                  | Yang sudah ada di model     | Yang baru                       |
| --- | ---------------------------------------------------------- | --------------------------- | ------------------------------- |
| 1   | Grup WA kelas dipindah ke Telegram                         | —                           | kanal, bukan tabel              |
| 2   | PR antar kelas terlihat semua pengajar, on-demand          | —                           | `tugas`                         |
| 3   | Pemisahan halaqah dan kelas belajar                        | **sudah lengkap**           | tidak ada                       |
| 4   | Sistem poin pelanggaran sampai SP                          | —                           | `pelanggaran`, `ambang_sanksi`  |
| 5   | Kanal info materi pertemuan berikutnya                     | `pengumuman` (terlalu umum) | `rencana_pertemuan`             |
| 6   | Nilai PR & latihan langsung ke wali                        | `nilai` (jenis kurang)      | perluasan `jenis`               |
| 7   | Wali melaporkan absen ke sistem, di-acknowledge wali kelas | `absensi`                   | `usulan_izin` + **konflik ADR** |
| 8   | Kabar absen yang masuk lewat jalur pribadi/lisan           | —                           | `kanal` + rekap tertunggak      |

---

## 1. Grup WA → grup Telegram

**Jawaban singkat: bisa, dan Telegram justru lebih cocok untuk keperluan ini.** Yang jadi
penghalang bukan Telegram, melainkan kesediaan orang berpindah aplikasi.

Yang membuatnya cocok:

- **Topik dalam satu grup.** Supergrup Telegram bisa dinyalakan mode forum, sehingga satu grup
  memuat utas terpisah per kelas. Bot bisa mengirim ke topik tertentu, jadi info kelas 3 tidak
  tenggelam di antara info kelas 5. Tidak perlu belasan grup.
- **Bot boleh jadi anggota grup** dan mengirim ke dalamnya. Di WhatsApp jalur resminya jauh
  lebih rumit dan berbiaya.
- **Anggota grup bisa sangat banyak**, jadi tidak akan kena batas.

Satu hal yang perlu dipahami sejak awal, dan ini menentukan seluruh sisa dokumen:

> **Grup Telegram bukan tempat penyimpanan.** Pesan di grup adalah percakapan, bukan data.
> Kalau laporan absen atau PR hanya hidup sebagai pesan grup, kita mengulang persis masalah
> spreadsheet lama: keterangan penting yang hanya ada di satu tempat yang tidak bisa
> ditanya-jawab, tidak bisa diaudit, dan hilang begitu tergulung riwayat obrolan.

Karena itu pembagiannya:

- **Grup** → obrolan manusia. Bertanya, berdiskusi, mengabari hal yang tidak perlu diingat sistem.
- **Bot** → apa pun yang harus diingat, dicari, atau dihitung nanti. Absen, PR, nilai, poin.

Kebutuhan nomor 7 menunjukkan pengelola sudah menyadari ini sendiri — keinginannya justru
memindahkan laporan absen **dari grup ke sistem**.

**Yang perlu diputuskan:** satu supergrup ber-topik untuk semua kelas, atau satu grup per kelas.
Saran: **satu supergrup ber-topik**, karena pengajar yang mengampu beberapa kelas tidak perlu
masuk banyak grup, dan kebutuhan nomor 2 (melihat PR kelas lain) jadi wajar secara sosial.

**Catatan teknis untuk implementasi nanti:** bot di dalam grup secara baku hanya melihat pesan
yang menyebutnya atau berupa perintah. Kalau bot perlu membaca seluruh percakapan, mode privasi
harus dimatikan lewat BotFather — dan itu keputusan privasi, bukan keputusan teknis. Sebaiknya
**jangan** dimatikan; biarkan bot hanya menerima yang sengaja dikirim kepadanya.

## 2. PR terlihat lintas kelas, on-demand

**Kebutuhannya jelas dan alasannya bagus:** pengajar ingin tahu apakah kelas sebelumnya sudah
memberi PR, supaya beban anak tidak menumpuk dalam sehari.

Entitas baru:

```
tugas    kelas · mapel · pengajar · tanggal_diberikan · tenggat
         · deskripsi · perkiraan_menit?
```

`perkiraan_menit` bersifat usulan — tanpa ada ukuran beban, "jangan terlalu memberatkan" tidak
bisa dibantu sistem, hanya bisa ditampilkan mentah.

**Ini melebarkan matriks izin, dan pelebarannya aman.** `docs/02-roles-matrix.md` membatasi
pengajar hanya membaca santri yang ia ampu. Kebutuhan ini meminta pengajar membaca **PR kelas
lain** — tapi `tugas` adalah data tingkat kelas, tidak memuat satu pun keterangan pribadi
santri. Jadi yang dilebarkan adalah pembacaan `tugas`, **bukan** pembacaan santri. Batas yang
sudah ada tidak tersentuh.

**Yang perlu diputuskan:** apakah wali juga boleh melihat daftar PR anaknya. Dugaan kuat: ya —
dan itu memang salah satu keluhan yang paling sering muncul di grup WA mana pun.

## 3. Halaqah dan kelas belajar — penjelasan ulang

Betul, ini sudah dibahas dan sudah tercatat di `docs/01-domain-model.md` serta
`skills/siakad-domain`. Ringkasannya, karena memang layak diulang:

**Santri berada di dua pengelompokan sekaligus, dan keduanya sejajar — bukan yang satu bagian
dari yang lain.**

|                       | **Kelas**                   | **Halaqah**                 |
| --------------------- | --------------------------- | --------------------------- |
| Untuk apa             | Pembelajaran diniyah & umum | Tahfidz (hafalan Al-Qur'an) |
| Penanggung jawab      | Wali kelas                  | Mudaris / mudarisah         |
| Anggotanya ditentukan | Jenjang dan tingkat         | Kemampuan hafalan           |
| Yang dicatat          | Nilai mapel, PR, latihan    | Setoran ziyadah & murojaah  |
| Tabel keanggotaan     | `santri_kelas`              | `santri_halaqah`            |

**Kenapa harus dipisah, bukan disatukan jadi "kelompok":**

1. **Orangnya berbeda.** Wali kelas tidak berwenang mencatat setoran hafalan; mudaris tidak
   berwenang memberi nilai mapel. Kalau keduanya satu tabel, aturan izin kehilangan tempat
   berpijak.
2. **Anggotanya tidak sama.** Halaqah dikelompokkan berdasarkan capaian hafalan, jadi satu
   halaqah bisa berisi santri dari beberapa kelas, dan satu kelas tersebar ke beberapa halaqah.
3. **Absensinya dua aliran.** `absensi` punya kolom `konteks` bernilai `kelas` atau `halaqah`.
   Seorang santri bisa `hadir` di halaqah tapi `alpa` di kelas pada hari yang sama, dan keduanya
   harus tercatat utuh. Satu angka kehadiran gabungan akan menyembunyikan justru yang perlu
   dilihat.
4. **Keanggotaan disimpan berjangka waktu** (`mulai`, `selesai`), bukan sebagai kolom di
   `santri`. Kalau ditaruh sebagai kolom, riwayat perpindahan tertimpa setiap kenaikan — dan
   pertanyaan "bagaimana capaian angkatan ini saat masih di halaqah sebelumnya" jadi mustahil
   dijawab.

**Yang belum diputuskan, dan muncul justru dari kebutuhan baru ini:** apakah poin pelanggaran
(nomor 4) berlaku juga di halaqah, atau hanya di kelas. Dan apakah mudaris berwenang mencatat
pelanggaran.

## 4. Sistem poin pelanggaran

```
jenis_pelanggaran   kode · nama · poin · kategori · aktif
pelanggaran         santri · jenis · tanggal · konteks (kelas|halaqah) · dicatat_oleh
                    · catatan
ambang_sanksi        poin · jenis_sanksi (peringatan|sp1|sp2|sp3) · beri_tahu_wali
```

**Poin berjalan santri TIDAK disimpan, ia dihitung dari `pelanggaran`.** Ini bukan preferensi
gaya — `AGENTS.md` melarangnya, dan sistem lama rusak persis karena angka turunan disimpan
terpisah dari sumbernya lalu menyimpang. Poin yang salah di sini berujung pada SP yang salah
untuk anak orang.

### Penyetelan ulang poin — terjawab, dan satu mekanisme menutup keduanya

Keterangan pengelola: _"sepertinya akan di-reset setiap tahun ajaran, atau terakumulasi namun
bisa di-reset sewaktu-waktu."_

Dua pilihan itu **tidak perlu dipilih sekarang**, karena satu mekanisme memenuhi keduanya:

```
reset_poin   santri_id? · tahun_ajaran_id? · berlaku_sejak · alasan · disetujui_oleh
```

Poin berjalan dihitung sebagai: **pagu awal dikurangi pelanggaran sejak titik reset terakhir
yang berlaku bagi santri itu.**

- **Reset tiap tahun ajaran** = satu baris `reset_poin` otomatis di awal tahun ajaran, dengan
  `santri_id` kosong (berlaku untuk semua).
- **Reset sewaktu-waktu** = satu baris manual, boleh untuk satu santri atau semua, dengan
  alasan dan penyetujunya tercatat.
- **Akumulasi tanpa reset** = tidak ada baris sama sekali.

Ini tetap mematuhi larangan menyimpan angka turunan: yang disimpan adalah **peristiwa reset**,
bukan saldo poin. Dan karena tiap reset menyimpan alasan serta siapa yang menyetujui, "poin
anak saya kok tiba-tiba pulih" selalu bisa dijawab.

**Yang masih perlu diputuskan:**

1. **Pagu poin awal berapa** — 100, atau lain.
2. **Apakah ada poin positif** yang memulihkan di tengah jalan? Tanpa jalan pemulihan, sistem
   poin hanya menghitung menuju hukuman. Catatan: reset **bukan** pengganti poin positif —
   reset menghapus riwayat, poin positif mengakui perbaikan.
3. **Siapa yang berwenang mencatat pelanggaran** — semua pengajar, hanya wali kelas, atau
   pengurus.
4. **SP diterbitkan otomatis atau perlu persetujuan manusia?** Saran kuat: **perlu persetujuan.**
   Sanksi yang terkirim otomatis ke wali karena ambang terlampaui akan salah pada kasus yang
   ada konteksnya, dan kepercayaan yang hilang karenanya sulit dipulihkan.

## 5. Kanal materi pertemuan berikutnya

Supaya wali bisa menyiapkan anak di rumah.

```
rencana_pertemuan   kelas · tanggal · mapel · materi · catatan_persiapan
                    · dibuat_oleh · diterbitkan
```

`pengumuman` yang sudah ada di model terlalu umum untuk ini — yang dibutuhkan terikat pada
kelas, tanggal, dan mapel, sehingga bisa dikirim otomatis ke wali kelas yang tepat dan bisa
ditanyakan ulang.

**Saran penyalurannya: pesan langsung dari `bot-wali`, bukan channel Telegram.** Alasannya
keanggotaan — channel tidak bisa dibatasi "hanya wali kelas 3", jadi setiap wali akan menerima
info semua kelas, dan lama-lama tidak dibaca sama sekali. Mengirim pesan bukan penulisan
basis data, jadi ini tidak melanggar sifat baca-saja `bot-wali`.

## 6. Nilai PR dan latihan langsung ke wali

Model sekarang punya `nilai` dengan `jenis` bernilai `formatif` atau `sumatif`. Kebutuhan ini
menuntut pembedaan yang lebih halus, karena PR dan latihan diperlakukan berbeda dari ujian:

```
nilai   ... jenis (pr|latihan|ulangan|ujian) · tugas_id? · tampil_ke_wali
```

**Yang perlu diputuskan, dan ini bukan detail kecil:** nilai PR tampil ke wali **seketika**,
atau setelah ditinjau?

Rapor sudah punya persetujuan wali kelas di matriks izin. Nilai harian tidak. Kalau seketika,
satu salah ketik langsung sampai ke orang tua — dan penjelasan menyusul selalu lebih mahal
daripada pencegahan. Saran: **tampil seketika, tapi dengan tenggang ubah dan pemberitahuan
bila nilai diperbaiki.** Tujuan kebutuhan ini adalah kesadaran orang tua atas perkembangan
anak, dan itu hilang kalau nilainya baru tampil sepekan kemudian.

## 7. Absen dilaporkan wali ke sistem — dan konflik yang harus diputuskan

Alur yang diminta:

```
wali memberi tahu  →  didistribusikan ke wali kelas & pengajar
                   →  wali kelas acknowledge
                   →  baru tercatat sebagai absensi
```

Alurnya sehat: yang menetapkan tetap manusia yang berwenang, dan wali tidak bisa menulis
kehadiran anaknya sendiri.

**Tapi ada satu benturan yang tidak bisa saya putuskan sendiri.**

`ADR 0005`, `docs/02-roles-matrix.md`, dan `AGENTS.md` semuanya menyatakan hal yang sama:
`apps/bot-wali` **tidak boleh meng-import satu pun handler tulis**, dan kemampuan tulis harus
**absen dari binary-nya** — diverifikasi lewat uji build, bukan dijaga runtime guard. Kebutuhan
ini meminta wali mengirimkan sesuatu yang harus tersimpan. Itu penulisan.

Dua jalan keluar, dan pilihannya keputusan Anda:

**A. Pengecualian sempit, dengan ADR baru.** `bot-wali` boleh menulis ke **tepat satu** tabel:

```
usulan_izin   santri · tanggal · jenis (sakit|izin) · alasan · diajukan_oleh
              · status (menunggu|diterima|ditolak) · ditanggapi_oleh · waktu_tanggap
```

`usulan_izin` bukan `absensi`. Ia tidak pernah memengaruhi kehadiran sampai wali kelas
menyetujui. Ujinya berubah dari "tidak ada simbol tulis" menjadi "tidak ada simbol tulis selain
`ajukanIzin`" — masih bisa diperiksa build, tapi invariannya melemah.

**B. `bot-wali` tetap benar-benar baca-saja.** Laporan wali diteruskan sebagai pesan Telegram
bertombol ke wali kelas; penulisan sepenuhnya terjadi di `bot-internal` saat tombol ditekan.
Tidak ada baris basis data yang lahir dari `bot-wali`.

Harganya: usulan yang tidak pernah ditanggapi **tidak berjejak sama sekali**. Wali sudah
mengabari, tidak ada yang menekan tombol, anak tercatat `alpa`, dan tidak ada catatan bahwa
kabar itu pernah masuk. Persis jenis kegagalan senyap yang jadi alasan proyek ini ada.

**Saran saya: A.** Nilai utama yang dijaga ADR 0005 adalah wali tidak bisa menyentuh data
akademik dan keuangan santri; menulis usulan miliknya sendiri yang belum berlaku tidak melanggar
nilai itu. Sedangkan kehilangan jejak usulan pada opsi B melanggar hal yang lebih pokok:
tidak boleh ada kabar penting yang hilang tanpa ada yang tahu.

### Satu rincian yang mudah terlewat

`absensi` punya `UNIQUE (santri, tanggal, konteks)` dengan `konteks` bernilai `kelas` atau
`halaqah`. Anak yang tidak masuk **tidak hadir di keduanya**. Jadi satu `usulan_izin` yang
disetujui harus melahirkan **dua** baris `absensi` — dan yang meng-acknowledge idealnya wali
kelas, padahal halaqah bukan wewenangnya.

Perlu diputuskan: apakah persetujuan wali kelas cukup untuk menutup keduanya, atau mudaris
harus menyetujui bagian halaqah secara terpisah. Saran: **cukup wali kelas**, dengan mudaris
diberi tahu — menuntut dua persetujuan untuk satu anak yang sakit akan membuat alurnya
ditinggalkan orang.

### Cara wali melapor: tombol dulu, chatbot sebagai jaring pengaman

Keterangan pengelola: harus **mudah** — tombol, atau sekadar mengabari dengan kalimat biasa
lalu chatbot yang merangkum.

### Aturan yang tidak boleh dilanggar: siapa dan kapan selalu eksplisit

**Satu wali bisa punya beberapa santri** — `wali_santri` memang n:m sejak `docs/01-domain-model.md`.
Karena itu:

> **`usulan_izin` tidak pernah sah tanpa `santri_id` dan `tanggal` yang dipilih secara eksplisit.**
> Keduanya tidak boleh disimpulkan dari siapa pengirimnya, dan tidak boleh ditebak dari kalimat.

Konsekuensinya menyebar ke seluruh alur:

- **Pemilihan santri selalu ditampilkan**, bahkan ketika wali hanya punya satu anak terdaftar.
  Menyembunyikan pilihan "karena anaknya cuma satu" akan salah pada hari seorang adik didaftarkan
  — dan salahnya senyap, karena izinnya tercatat untuk anak yang keliru.
- **Beberapa anak sekaligus dimungkinkan**: satu wali melaporkan dua anaknya sakit menghasilkan
  **dua baris** `usulan_izin`, bukan satu baris bercabang. Masing-masing di-_acknowledge_
  terpisah, karena bisa jadi kelas dan wali kelasnya berbeda.
- **Tanggal selalu dipilih**, bukan diasumsikan hari ini. "Besok tidak masuk" yang dikirim malam
  hari adalah kasus yang sangat biasa.
- **Kabar tidak hanya datang dari wali.** Pengampu absen yang diberi tahu lisan mengisi kolom
  yang sama persis; yang berbeda hanya `dilaporkan_oleh`, `dicatat_oleh`, dan `kanal`
  (lihat bagian 8). Bentuk datanya satu, pintu masuknya banyak.

Rancangan alurnya berlapis, dan lapisan pertama yang menanggung hampir seluruh beban:

**Lapis 1 — tombol.** Wali menekan `Anak saya tidak masuk`, lalu memilih **anak yang mana**
(selalu ditanyakan, bisa lebih dari satu), `Sakit` atau `Izin`, dan **tanggal**. Tidak ada yang
perlu diketik, tidak ada model yang dipanggil, dan hasilnya sudah terstruktur sejak awal.

**Lapis 2 — kalimat bebas.** Wali yang terlanjur mengetik
_"assalamualaikum ustadz, hari ini Ahmad demam tidak bisa masuk"_ tetap terlayani — tapi
**tetap melewati layar pemilihan yang sama**. Kalimatnya hanya mengisi nilai awal; santri dan
tanggal tetap dikonfirmasi dengan tombol sebelum dikirim.

### Setelah aturan di atas, pekerjaan model tinggal sedikit — dan itu temuan, bukan basa-basi

Begitu `santri_id` dan `tanggal` **wajib** dipilih lewat tombol, yang tersisa untuk model hanya:
menebak `sakit` atau `izin`, dan menyalin alasan. Tombol sudah mengerjakan yang pertama dengan
lebih benar, dan yang kedua tidak perlu model sama sekali — **kalimat wali bisa disimpan apa
adanya sebagai `alasan`** untuk dibaca wali kelas.

Ini artinya: **lapis 2 bisa dijalankan tanpa LLM sama sekali** — cukup tampilkan layar pemilihan
begitu wali mengirim pesan apa pun, dengan kalimatnya terbawa sebagai alasan. Nol biaya, nol
data keluar, nol ketidakpastian.

Saya sebutkan ini karena rancangan saya sebelumnya menaruh model di tempat yang ternyata sudah
ditangani tombol. **Keputusan tetap di tangan pengelola** — kalau ekstraksi tetap diinginkan
(misalnya supaya wali yang mengetik panjang tidak perlu menyentuh tombol sama sekali), pilihan
di bawah berlaku. Kalau tidak, seluruh bagian ini gugur dan alurnya jadi lebih sederhana.

### Kalau ekstraksi tetap dipakai: lewat Zen, bukan API vendor langsung

Keterangan pengelola: **tidak memakai Haiku; rencananya lewat Zen dengan model murah.** Ini
juga yang sudah tercatat sebagai prasyarat **P5** di `docs/TUGAS.md`.

Itu **sejalan dengan ADR 0006 (portabilitas, anti lock-in)**, dan menetapkan satu keharusan
desain:

> **`packages/core` memanggil LLM lewat satu antarmuka penyedia, bukan SDK vendor tertentu.**
> Mengganti model atau gateway harus jadi perubahan konfigurasi, bukan perubahan kode.

Tiga hal yang harus dijaga karena modelnya murah dan bisa berganti-ganti:

1. **Jangan bergantung pada jaminan bentuk keluaran.** Dukungan structured output berbeda-beda
   antar model dan gateway; model murah sering tidak menjaminnya. Karena itu **setiap keluaran
   divalidasi zod di `packages/contracts`**, dan yang tidak lolos ditolak — bukan diperbaiki
   dengan menebak. Validasi ini kode deterministik, jadi tetap di dalam batas `AGENTS.md`.
2. **Jangan kirim yang tidak perlu.** Prompt **tidak memuat daftar santri** dan tidak meminta
   nama, karena santri sudah ditentukan tombol. Yang dikirim hanya kalimat walinya.
3. **Perilaku saat model gagal harus jelas.** Gateway mati, kuota habis, atau keluaran tidak
   lolos validasi → **jatuh ke tombol**, bukan menggantung. Alur izin tidak boleh berhenti
   karena penyedia LLM sedang bermasalah.

**Yang tetap perlu dikoreksi apa pun modelnya:** ekstraksi dari kalimat bebas **tidak
deterministik**. Kalimat ambigu seperti _"besok Ahmad ada acara keluarga, mungkin tidak masuk"_
bisa salah dibaca. Hasilnya selalu **usulan**: wali mengonfirmasi, wali kelas meng-_acknowledge_,
dan **baru** kode deterministik menulis `absensi`. Persis batas di `AGENTS.md` — LLM tidak
pernah menulis ke basis data.

**Yang perlu diperiksa sebelum lapis 2 berbasis LLM dinyalakan:** kebijakan retensi data pada
Zen dan pada model yang dipilih. Kalimat wali memuat nama anak dan keterangan kesehatannya
walaupun sistem tidak membutuhkannya — data itu tetap ikut terkirim. Ini masuk keputusan
perlindungan data yang sudah menggantung di `STATE.md`.

## 8. Kabar yang masuk lewat jalur pribadi — dan jalan keluarnya

Keterangan pengelola, dan ini masalah paling menarik dari seluruh dokumen ini:

> Ada kasus pengampu absen langsung menerima informasi sementara wali kelas bahkan tidak,
> karena kedekatan personal wali santri dengan pengampu absen. Penyampaiannya pun tidak tertib,
> hanya verbal.

**Jangan lawan kanal informalnya — tangkap.** Melarang wali mengabari lewat jalur yang sudah
nyaman bagi mereka tidak akan berhasil; yang terjadi hanya kabarnya tetap lewat situ dan
sistemnya yang ditinggalkan. Yang bisa diperbaiki adalah memastikan kabar itu **meninggalkan
jejak**, dari mana pun masuknya.

Empat hal yang menyelesaikannya:

**1. Siapa pun yang berwenang boleh mencatatkan atas nama wali.** `usulan_izin` memisahkan tiga
peran yang selama ini tercampur:

```
usulan_izin   ... · dilaporkan_oleh (wali)   ⟵ sumber kabar
                  · dicatat_oleh   (siapa pun yang memasukkan)
                  · kanal (bot_wali | lisan | grup | telepon)
```

Pengampu absen yang diberi tahu secara lisan cukup menekan satu tombol: pilih santri, pilih
`Sakit`, kanal terisi `lisan` otomatis. **Satu ketukan, bukan satu formulir** — kalau lebih
berat dari memberitahu wali kelas lewat WhatsApp, tidak akan dipakai.

**2. Penyebaran otomatis, apa pun pintu masuknya.** Begitu baris `usulan_izin` lahir, wali kelas
dan pengajar hari itu langsung diberi tahu — tidak peduli kabarnya masuk lewat bot wali atau
diketikkan pengampu absen. **Ini yang menghapus masalahnya:** wali kelas tidak lagi bergantung
pada seseorang ingat meneruskan.

**3. Yang belum di-_acknowledge_ tidak menghilang.** Rekap harian pengampu absen menampilkan
tiga kelompok terpisah: sudah dikonfirmasi, **menunggu konfirmasi**, dan tanpa kabar sama
sekali. Anak yang walinya sudah mengabari tapi belum ada yang mengonfirmasi **tidak tercatat
`alpa`** — ia tampil sebagai "izin belum dikonfirmasi", yang beda artinya. Dengan begitu
rekapitulasi pengampu absen sekaligus jadi alat pemeriksa.

**4. Kanal dicatat, sehingga polanya terukur.** Kalau enam bulan lagi ternyata 40% kabar masih
masuk lisan, itu **angka**, bukan kesan. Tujuannya bukan menihilkan jalur lisan — tujuannya
supaya jalur lisan tidak lagi berarti kabarnya hilang.

### Acknowledge boleh tertunda, tapi tidak boleh menguap

Keterangan pengelola: wali kelas **harus** meng-_acknowledge_, boleh tertunda karena kesibukan,
dan pengampu absen sebaiknya hanya merekapitulasi.

- **Pengingat bertingkat.** Belum di-_ack_ sampai KBM mulai → wali kelas diingatkan. Sampai
  akhir hari → muncul di rekap sebagai tertunggak. Beberapa hari berturut-turut → pengurus tahu.
  Yang naik ke atas adalah **pola**, bukan tiap kejadian.
- **Wewenang cadangan, bukan pemindahan.** Kalau wali kelas berhalangan berhari-hari, pengurus
  boleh meng-_ack_ — tercatat sebagai `di-ack oleh pengurus`, bukan menyamar sebagai wali kelas.
  Tanpa jalan cadangan, wali kelas yang sakit seminggu membekukan absensi seluruh kelasnya.

> **Satu bagian keterangan yang belum jelas dan perlu dikonfirmasi:** kalimat "harapannya bisa
> di-ack oleh wali santri" — saya menafsirkannya sebagai **wali kelas**, karena maksud
> keseluruhannya adalah membebaskan pengampu absen dari pekerjaan meneruskan kabar. Kalau yang
> dimaksud memang **wali santri** yang mengonfirmasi sesuatu, alurnya berbeda dan bagian ini
> perlu ditulis ulang.

---

## Keputusan yang menggantung dari dokumen ini

Tidak ada yang bisa masuk `packages/contracts` sebelum ini dijawab. Nomor 1 dan 2 paling
mendesak karena memblokir bentuk tabel, sisanya memblokir aturan.

1. **Jalur tulis `bot-wali`** (bagian 7) — pengecualian sempit atau tetap baca-saja.
   **Butuh ADR.** Ini yang paling menentukan.
2. **Poin**: pagu awal, ada poin positif atau tidak, siapa yang berwenang mencatat, dan apakah
   SP otomatis. _(Penyetelan ulang sudah terjawab — lihat bagian 4.)_
3. **Nilai harian ke wali**: seketika atau setelah ditinjau.
4. **Poin dan pelanggaran di halaqah**: berlaku atau tidak, dan mudaris berwenang atau tidak.
5. **Izin satu hari menutup kelas dan halaqah sekaligus**, atau perlu dua persetujuan.
6. **Wali boleh melihat daftar PR** anaknya atau tidak.
7. **Bentuk grup Telegram**: satu supergrup ber-topik, atau satu grup per kelas.
8. **Daftar jenis pelanggaran beserta poinnya** — tabel seed, tidak memblokir skema, tapi
   memblokir peluncuran.
9. **Apakah lapis 2 perlu LLM sama sekali** — setelah santri dan tanggal wajib dipilih lewat
   tombol, pekerjaan model tinggal sedikit dan alurnya bisa jalan tanpa LLM. Kalau tetap
   dipakai: **retensi data pada Zen dan model yang dipilih** perlu diperiksa lebih dulu, karena
   kalimat wali memuat nama anak dan keterangan kesehatannya.
10. **Arti "di-ack oleh wali santri"** pada keterangan bagian 8 — ditafsirkan sebagai wali
    kelas; perlu konfirmasi.
