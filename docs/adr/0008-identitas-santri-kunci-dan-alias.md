# ADR 0008 — Identitas santri: kunci surrogate dan tabel alias nama

**Status:** diterima · 9 Agustus 2026

## Konteks

Sistem lama menunjuk santri dengan dua cara, dan keduanya rapuh.

**Lewat nama teks bebas.** Jurnal generasi 01 dan 02 mengidentifikasi transaksi lewat kolom
`Nama` yang diketik manual. Salah ketik menghasilkan transaksi tak bertuan.

**Lewat NIS.** Generasi 03 dan 04 memakai `NIS` berpola tahun-ajaran-masuk + urut
(`2627001`). Terlihat stabil — sampai terlihat bahwa master berkas 04 memuat kolom
`NIS CLONING` dan `No Induk (Baru)`. Keduanya jejak penomoran ulang yang pernah terjadi
atau direncanakan.

Yang lebih menentukan: berkas lama **sengaja memelihara beberapa varian nama untuk satu
santri**, lewat kolom `ASLI`, `Nama Santri Khusus Database Keuangan`, dan
`Master Nama SESUAI KTP`. Itu bukan kelalaian. Nama di kuitansi, di ijazah, dan di KTP memang
berbeda, dan ketiganya dibutuhkan untuk keperluan yang berbeda pula.

Bukti bahwa varian itu nyata, dari satu berkas yang sama:

```
AISYAH ALILATUL  HANIYAH  BANDU
AISYAH ALILLATUL HANIYYAH BANDU
```

Importer harus mencocokkan baris jurnal 01–02 — yang hanya menyebut nama — ke santri yang
benar. Tanpa tempat menyimpan varian nama, pencocokan itu mustahil dilakukan dengan jujur.

## Keputusan

**Kunci primer santri adalah ULID surrogate. `NIS` unik tapi boleh berubah. Varian nama
disimpan di tabel `santri_alias` tersendiri.**

- `santri.id` — ULID, tidak pernah berubah, tidak pernah dipakai ulang. Seluruh transaksi,
  nilai, dan absensi menunjuk ke sini.
- `santri.nis` — unik, terindeks, **boleh diperbarui**. Ia identitas administratif, bukan
  identitas basis data.
- `santri.nama_lengkap` — satu nama kanonik untuk ditampilkan.
- `santri_alias` — `(santri_id, nama, jenis, sumber)` dengan `jenis` salah satu dari
  `ktp` \| `keuangan` \| `panggilan` \| `ejaan_lama`, dan `sumber` mencatat berkas asalnya.

Pencocokan berbasis nama **hanya boleh terjadi di importer**, menghasilkan usulan yang
disetujui manusia — tidak pernah menjadi jalur tulis biasa.

## Konsekuensi

**Yang menjadi mungkin.** Nomor induk bisa dinomori ulang tanpa memutus satu pun transaksi.
Riwayat keuangan seorang santri tetap utuh melewati pergantian NIS, perbaikan ejaan, dan
perubahan nama setelah akta diperbaiki.

**Yang menjadi lebih mahal.** Setiap penulisan wajib melalui pencarian `santri_id` lebih
dulu; tidak ada jalan pintas menulis dengan berbekal nama. Ini disengaja.

**Yang harus dijaga.** `santri_alias` bisa tumbuh liar bila diisi otomatis dari tiap variasi
ketikan. Alias hanya boleh lahir dari impor berkas warisan atau dari penambahan yang
disetujui manusia — bukan dari tiap salah ketik yang lewat.

**Utang yang diakui.** `NISN` kosong seluruhnya pada data nyata dan ditandai
`update NISN 2026` sejak berkas 03. Kolomnya nullable. Ia tidak bisa dijadikan kunci apa pun
sampai benar-benar terisi.

## Alternatif yang ditolak

**`NIS` sebagai kunci primer.** Ditolak karena `NIS CLONING` dan `No Induk (Baru)` adalah
bukti langsung bahwa nomor ini pernah diganti. Kunci primer yang bisa berubah akan menular
ke seluruh tabel yang merujuknya.

**`NIK` sebagai kunci primer.** Ditolak dua kali. Ia kosong pada sebagian santri, dan ia data
pribadi anak yang menurut `AGENTS.md` tidak boleh keluar dari `packages/core` — kunci primer
justru muncul di mana-mana.

**Satu kolom nama tunggal.** Ditolak karena membuang informasi yang sudah dipelihara
bertahun-tahun oleh pengelola, dan membuat impor jurnal 01–02 tidak mungkin diperiksa.
