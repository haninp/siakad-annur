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

## Ringkasan: tujuh kebutuhan

| #   | Kebutuhan                                            | Yang sudah ada di model    | Yang baru        |
| --- | ---------------------------------------------------- | -------------------------- | ---------------- |
| 1   | Grup WA kelas dipindah ke Telegram                   | —                          | kanal, bukan tabel |
| 2   | PR antar kelas terlihat semua pengajar, on-demand    | —                          | `tugas`          |
| 3   | Pemisahan halaqah dan kelas belajar                  | **sudah lengkap**          | tidak ada        |
| 4   | Sistem poin pelanggaran sampai SP                    | —                          | `pelanggaran`, `ambang_sanksi` |
| 5   | Kanal info materi pertemuan berikutnya               | `pengumuman` (terlalu umum) | `rencana_pertemuan` |
| 6   | Nilai PR & latihan langsung ke wali                  | `nilai` (jenis kurang)     | perluasan `jenis` |
| 7   | Wali melaporkan absen ke sistem, di-acknowledge wali kelas | `absensi`            | `usulan_izin` + **konflik ADR** |

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

| | **Kelas** | **Halaqah** |
| --- | --- | --- |
| Untuk apa | Pembelajaran diniyah & umum | Tahfidz (hafalan Al-Qur'an) |
| Penanggung jawab | Wali kelas | Mudaris / mudarisah |
| Anggotanya ditentukan | Jenjang dan tingkat | Kemampuan hafalan |
| Yang dicatat | Nilai mapel, PR, latihan | Setoran ziyadah & murojaah |
| Tabel keanggotaan | `santri_kelas` | `santri_halaqah` |

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

**Yang perlu diputuskan sebelum ini bisa ditulis:**

1. **Poin awal berapa, dan dikurangi sampai batas mana?** "Poin dikurangi" menyiratkan ada
   pagu awal — 100, atau lain.
2. **Kapan poin disetel ulang?** Tiap semester, tiap tahun ajaran, atau tidak pernah. Ini
   menentukan apakah pelanggaran kelas 1 masih membebani anak di kelas 5.
3. **Apakah ada poin positif** yang memulihkan? Tanpa jalan pemulihan, sistem poin hanya
   menghitung menuju hukuman.
4. **Siapa yang berwenang mencatat pelanggaran** — semua pengajar, hanya wali kelas, atau
   pengurus.
5. **SP diterbitkan otomatis atau perlu persetujuan manusia?** Saran kuat: **perlu persetujuan.**
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

---

## Keputusan yang menggantung dari dokumen ini

Tidak ada yang bisa masuk `packages/contracts` sebelum ini dijawab. Nomor 1 dan 2 paling
mendesak karena memblokir bentuk tabel, sisanya memblokir aturan.

1. **Jalur tulis `bot-wali`** (bagian 7) — pengecualian sempit atau tetap baca-saja.
   **Butuh ADR.** Ini yang paling menentukan.
2. **Poin**: pagu awal, kapan disetel ulang, ada poin positif atau tidak, siapa yang berwenang
   mencatat, dan apakah SP otomatis.
3. **Nilai harian ke wali**: seketika atau setelah ditinjau.
4. **Poin dan pelanggaran di halaqah**: berlaku atau tidak, dan mudaris berwenang atau tidak.
5. **Izin satu hari menutup kelas dan halaqah sekaligus**, atau perlu dua persetujuan.
6. **Wali boleh melihat daftar PR** anaknya atau tidak.
7. **Bentuk grup Telegram**: satu supergrup ber-topik, atau satu grup per kelas.
8. **Daftar jenis pelanggaran beserta poinnya** — tabel seed, tidak memblokir skema, tapi
   memblokir peluncuran.
