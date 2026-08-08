---
name: siakad-domain
description: Glosarium pesantren, aturan bisnis, matriks peran, dan konvensi kalender SIAKAD An-Nuur. Baca sebelum menyentuh skema, aturan izin, perhitungan keuangan, atau apa pun yang menyebut santri, wali, halaqah, SPP, mukafaah, PROTA, ziyadah, murojaah, marhalah, atau tahun ajaran.
---

# Domain SIAKAD An-Nuur

Istilah di repo ini datang dari pesantren, bukan dari perangkat lunak. Salah menerjemahkan
istilahnya berarti salah memodelkan aturannya.

## Glosarium

| Istilah                 | Arti                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| **Marhalah**            | Jenjang: `ra_paud`, `mi_banin`, `mi_banat`                                 |
| **Halaqah**             | Kelompok tahfidz, dibimbing seorang mudaris/mudarisah                      |
| **Mudaris / mudarisah** | Pengajar tahfidz pada sebuah halaqah                                       |
| **Kelas**               | Kelompok pembelajaran diniyah & umum, dipegang wali kelas                  |
| **Ziyadah**             | Setoran hafalan **baru**                                                   |
| **Murojaah**            | Setoran **pengulangan** hafalan yang sudah dikuasai                        |
| **Mukafaah**            | Imbalan bulanan pengajar — berperiode **Hijriah**                          |
| **SPP**                 | Iuran bulanan santri — berperiode **Masehi**                               |
| **PROTA**               | Program Orang Tua Asuh — donatur menanggung biaya santri asuhnya           |
| **Keringanan**          | Potongan biaya bagi wali yang mengajukan                                   |
| **Diniyah / umum**      | Dua jalur mata pelajaran; `umum` yang bermuara ke e-Rapor PKBM             |
| **PKBM**                | Lembaga induk pendidikan kesetaraan                                        |
| **Kartu Kendali**       | Kartu tagihan per santri pada sistem lama — **jangan ditiru**, lihat bawah |

## Aturan yang mudah salah

### Santri berada di dua pengelompokan sekaligus

Kelas (diniyah & umum) dan halaqah (tahfidz), dengan penanggung jawab berbeda. Absensi pun
dua aliran: `konteks` bernilai `kelas` atau `halaqah`. Seorang santri bisa `hadir` di
halaqah tapi `alpa` di kelas pada hari yang sama, dan keduanya harus tercatat utuh.

### Orang tua asuh BUKAN peran tersendiri

Ia **wali biasa** dengan `jenis_hubungan = 'asuh'`. Anak asuhnya sekadar santri yang tertaut
padanya. `jenis_hubungan` murni label deskriptif — **bukan sumbu izin**. Jangan pernah
membuat profil izin kedua untuknya.

PROTA adalah sisi keuangan dari hubungan yang sama: donatur membayar, dananya dialokasikan
ke SPP santri asuhnya. Satu setoran donatur bisa dialokasikan ke beberapa santri dan
beberapa bulan, jadi butuh tabel alokasi — bukan satu kolom.

### Ziyadah dan murojaah mengukur hal berbeda

Ziyadah = capaian bertambah. Murojaah = kedisiplinan menjaga. **Murojaah tidak menambah
capaian kumulatif.** Justru murojaah yang biasanya bermasalah, dan sama sekali tidak
terlihat bila hanya capaian yang dicatat.

### Dua kalender, dua sisi buku

| Aspek                           | Kalender                                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| Seluruh stempel waktu tersimpan | **Masehi** (ISO, Asia/Jakarta)                                         |
| Periode tagihan SPP             | **Masehi**                                                             |
| Periode mukafaah                | **Hijriah**                                                            |
| Tampilan ke wali                | **Keduanya**, Masehi dulu: _"Rabu, 12 Agustus 2026 (27 Safar 1448 H)"_ |

**Konversi Hijriah lewat tabel `kalender_hijriah`, tidak pernah lewat rumus.** Kalender
Kemenag adalah hisab MABIMS + sidang isbat; tidak ada varian ICU yang cocok di semua bulan.
Bulan yang menunggu isbat bertanda `provisional` — laporan yang menyentuhnya menampilkan
Masehi saja.

### Data lama punya dua skema periode

Hijriah sampai ~Maret 2026, Masehi sejak April 2026 (`1. April 2026` … `15. Juni 2027`,
lima belas periode karena masa transisi). Importer wajib menangani keduanya dan menyimpan
`skema_periode` per baris. **Jangan normalkan periode transisi menjadi 12** — itu akan
menghilangkan atau menggandakan tagihan nyata.

### Aturan keuangan yang tidak terdokumentasi di mana pun sebelumnya

- **Cicilan sampai 6 kali** per tagihan
- **Prorata dari bulan mulai KBM**; santri masuk tengah tahun tidak ditagih penuh
- **Lebih bayar** disimpan sebagai saldo kredit
- **Kontrol empat mata** pada mutasi bank — dipertahankan, bukan dihapus karena "sudah ada sistem"
- **Tunai ~4 dari 10 penerimaan** — mutasi bank tidak pernah mencakup seluruh pemasukan

## Kesalahan sistem lama yang tidak boleh diulang

**Angka turunan disimpan terpisah dari sumbernya.** Kartu Kendali menyimpan tunggakan
sebagai kolom, lalu menyimpang dari jumlah transaksi sebenarnya — dan tidak ada yang bisa
menentukan mana yang benar. Pembacaan menemukan ~5.269 sel rusak yang merambat lewat lookup.

Karena itu: **tunggakan, saldo, capaian hafalan, dan progres juz tidak pernah disimpan.**
Semuanya dihitung dari transaksinya di lapisan OLAP.

**Santri dikenali lewat nama teks bebas.** Salah ketik menghasilkan transaksi tak bertuan.
Di SIAKAD, transaksi **wajib** mengacu `santri_id`; nama hanya tampilan.

## Matriks peran

Ringkas — lengkapnya di `docs/02-roles-matrix.md`.

| Peran      | Kemampuan                                                                         |
| ---------- | --------------------------------------------------------------------------------- |
| `admin`    | Penuh; kelola pengguna & pemetaan `telegram_id`                                   |
| `pengurus` | Baca semua; data master, keuangan, undangan; tanya-jawab agent                    |
| `pengajar` | Tulis **hanya** untuk kelompok yang diampu (mudaris/pengampu mapel/wali kelas)    |
| `wali`     | Baca-saja, **semua santri yang tertaut padanya**, tanpa membedakan jenis hubungan |

**Izin hanya ditegakkan di `packages/core`.** Bot dan MCP server sama-sama memanggilnya.

## Bahasa

Nama tabel, kolom, dan seluruh pesan pengguna memakai **Bahasa Indonesia**. Tipe dan nama
fungsi boleh Inggris.

Pesan ke pengguna ditulis substantif, bukan teknis — sebut apa yang salah dan apa yang harus
dilakukan, sebut nama santri bukan ID. Penggunanya bukan orang teknis, dan pesan yang tidak
bisa ditindaklanjuti berarti sistem berhenti sampai developer sempat menengok.
