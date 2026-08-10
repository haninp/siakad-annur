# ADR 0012 — Keputusan keuangan dari sesi P3

**Status:** diterima · 10 Agustus 2026

## Konteks

Bagian keuangan pada `packages/contracts` dan `packages/core` diblokir oleh daftar pertanyaan
di ujung `docs/06-migrasi-legacy.md`. Pertanyaan itu muncul karena beberapa pola keuangan
(PROTA, KERINGANAN, Lebih Bayar, TAYSIR, NISN) baru hadir di berkas 02–04, bukan sejak
berkas 01, sehingga aturannya belum bisa dibekukan hanya dari pembacaan data.

Sesi P3 dengan pemegang pengetahuan keuangan menyelesaikan sebagian besar pertanyaan. Dokumen
ini menangkap keputusannya sebagai aturan bisnis yang mengikat, sehingga perancangan skema
dan handler keuangan punya fondasi yang tidak lagi bergantung pada ingatan sesi.

## Keputusan

### 1. TAYSIR tidak diintegrasikan

TAYSIR saat ini **ditangguhkan**. Bila SIAKAD berjalan, TAYSIR kemungkinan besar dihentikan
(`terminated`).

Konsekuensinya: tidak ada tabel, akun, atau alur impor untuk TAYSIR. Jika suatu hari kebijakan
berubah, ia diperlakukan sebagai fitur baru, bukan migrasi warisan.

### 2. Keringanan adalah kebijakan pengurus

Keringanan murni berasal dari **kebijakan pengurus** dengan mempertimbangkan kondisi keuangan
wali santri. Bisa juga diawali oleh **permintaan resmi wali santri ke pengurus**.

Konsekuensinya: keringanan bukan hak otomatis, tidak ada algoritma yang menentukan besarannya,
dan setiap keputusan keringanan harus mencatat dasar pertimbangan serta persetujuan pengurus.

### 3. Keluar di tengah tahun: tidak refund

Jika santri keluar di tengah tahun ajaran:

- tagihan yang **belum dihapuskan** **masih ditagih**;
- uang yang **sudah dibayarkan** **tidak dikembalikan**.

Konsekuensinya: sistem tidak memerlukan mekanisme pengembalian dana (refund) untuk kasus ini.
Tagihan yang belum dihapuskan tetap menjadi piutang. Keputusan ini mengikat baik untuk SPP
maupun komponen biaya lain.

### 4. Sisa PROTA digulirkan, bukan dikembalikan ke donatur

Sisa dana PROTA yang tidak teralokasikan **tidak dikembalikan ke donatur**, melainkan
**disimpan untuk kebutuhan PROTA periode selanjutnya**.

Konsekuensinya: dana PROTA diperlakukan sebagai dana bergulir antar periode. Sistem harus
mencatat saldo PROTA yang tersedia dan mengalokasikannya ke periode berikutnya.

### 5. Tahun ajaran mengikuti kalender akademik nasional

Awal tahun ajaran mengikuti **kalender akademik nasional**: **Juli–Juni**.

Konsekuensinya: periode tagihan utama adalah Juli sampai Juni. Periode transisi
April–Juni 2026 yang terlihat di berkas 04 adalah sisa tahun lama, bukan pola rutin.

### 6. Lebih bayar dipotong ke tagihan berikutnya

Lebih bayar (saldo kredit santri) **dipotong untuk tagihan berikutnya**, tidak dikembalikan
tunai.

Konsekuensinya: lebih bayar tidak perlu diuangkan kembali ke wali. Sistem menjadikannya
kredit yang mengurangi tagihan periode mendatang.

### 7. NISN dilengkapi belakangan

NISN boleh **kosong untuk sementara** dan akan dilengkapi belakangan. Tidak menghalangi
go-live.

Konsekuensinya: kolom `nisn` pada `santri` bersifat nullable. Validasi format NISN tetap
berlaku bila terisi, tapi kekosongan tidak memblokir proses akademik maupun keuangan.

## Yang masih terbuka

Dua pertanyaan P3 belum terjawab dan tidak menghalangi go-live, tapi menunda keputusan impor:

1. **Makna kolom `Khusus PROTA`** pada tabel transaksi — butuh contoh entri nyata atau sesi
tindak lanjut.
2. **Nasib sheet arsip Juli–Agustus 2023** yang disalin identik ke keempat berkas — di-skip
dulu hingga ada arahan lebih lanjut.

## Konsekuensi

Skema keuangan yang akan dibangun (`akun_keuangan`, `komponen_biaya`, `tagihan`, `pembayaran`,
`prota`, `keringanan`, dsb.) mengasumsikan ketujuh keputusan di atas. Perubahan pada salah
satunya setelah skema dibekukan akan memerlukan revisi signifikan pada handler dan laporan.

Pesan ke pengguna untuk kasus-kasus di atas harus ditulis substantif: sebut nama santri,
periode, dan langkah berikutnya yang bisa diambil wali — bukan istilah teknis seperti
"refund", "kredit", atau nama tabel.
