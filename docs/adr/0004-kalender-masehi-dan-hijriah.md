# ADR 0004 — Masehi untuk tagihan, Hijriah untuk mukafaah

**Status:** diterima · 8 Agustus 2026

## Konteks

Pesantren hidup di dua kalender sekaligus. **Mukafaah pengajar mengikuti siklus Hijriah**;
**wali berpenghasilan per bulan Masehi**.

Pembacaan spreadsheet lama menemukan **dua skema periode SPP hidup berdampingan** dalam
berkas yang sama:

| Skema          | Rentang                                    | Jumlah |
| -------------- | ------------------------------------------ | ------ |
| Lama — Hijriah | `1. Syawal 1446 H` → `12. Ramadhan 1447 H` | 12     |
| Baru — Masehi  | `1. April 2026` → `15. Juni 2027`          | **15** |

Peralihan terjadi sekitar April 2026. Deretan baru berjumlah 15, bukan 12 — indikasi masa
transisi menuju tahun ajaran Juli–Juni.

## Keputusan

| Aspek                             | Kalender                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Seluruh stempel waktu tersimpan   | **Masehi** (ISO, Asia/Jakarta)                                               |
| Periode tagihan SPP (`bulan_spp`) | **Masehi** — dikonfirmasi pengurus dan terverifikasi di data                 |
| Periode mukafaah                  | **Hijriah**                                                                  |
| Tampilan ke wali                  | **Keduanya**, Masehi lebih dulu: _"Rabu, 12 Agustus 2026 (27 Safar 1448 H)"_ |

**Konversi Hijriah lewat tabel, bukan rumus.** Kalender Hijriah Kemenag adalah hasil hisab
MABIMS ditambah sidang isbat — tidak ada varian ICU (`islamic-umalqura`, `islamic-civil`,
`islamic-tbla`) yang cocok di semua bulan, dan tidak ada rumus yang menghasilkannya.

Tabel `kalender_hijriah` di-seed dari PDF tahunan Ditjen Bimas Islam. Tidak ada API resmi.

## Beban pemeliharaan lebih ringan dari kelihatannya

**Sidang isbat hanya digelar untuk tiga bulan** — Ramadan, Syawal, Dzulhijjah. Sembilan
bulan lainnya sudah pasti sejak kalender tahunan terbit.

- **Sekali setahun** — seed dari PDF Kemenag
- **Tiga kali setahun** — konfirmasi hasil isbat lewat `/kalender`
- Tanggal sidang bisa diprediksi, jadi **bot yang mengingatkan**, bukan admin yang memantau
- Bulan yang menunggu isbat ditandai `provisional`; laporan yang menyentuhnya memakai
  tanggal Masehi saja sampai dikonfirmasi

## Sisa persoalan: 12 periode versus 12,37

Tahun Hijriah 354,4 hari, Masehi 365,2 — selisih **3,07%**. Karena SPP ditagih 12 kali per
tahun Masehi sementara mukafaah dibayar 12 kali per tahun Hijriah (setara 12,37 kali per
tahun Masehi), **periode biaya lebih banyak 3% daripada periode pendapatan**.

Ini bukan cacat yang harus diperbaiki sistem — bisa saja sudah diperhitungkan dalam
penetapan tarif. Yang perlu sistem lakukan hanya **membuatnya terlihat**, sesuatu yang
mustahil di spreadsheet lama:

- Laporan menyajikan pendapatan dan mukafaah pada sumbu waktu Masehi yang sama
- Sekitar sekali tiap 2,7 tahun akan ada bulan Masehi berisi **dua siklus mukafaah**;
  sistem memberi tahu pengurus dua bulan sebelumnya agar arus kasnya disiapkan

Kejadian pertama diperkirakan **Oktober 2027**, lalu Juli 2030, April 2033, Desember 2035.
Deteksi wajib berjalan di atas tabel Kemenag yang nyata — hitungan tabular bisa meleset
±1 hari, dan untuk kasus yang menempel di tanggal 1 atau 31 selisih itu membalikkan jawaban.

Perhatikan pembalikannya: pergeseran kalender berpindah dari sisi **tagihan wali** ke sisi
**pembayaran mukafaah**, dan di sana jauh lebih ringan — yang terdampak satu pihak yang bisa
merencanakan, bukan ratusan keluarga.

## Konsekuensi untuk migrasi

Importer **wajib menangani kedua skema** dan memetakannya ke satu garis waktu:

- Transaksi berlabel Hijriah (sampai ~Maret 2026) dipetakan lewat `kalender_hijriah`
- Transaksi berlabel Masehi (April 2026 dan sesudahnya) dipakai apa adanya
- **Periode transisi 15 bulan disimpan apa adanya**, tidak dinormalkan paksa jadi 12 —
  memaksakan keseragaman akan menghilangkan atau menggandakan tagihan nyata
- `tagihan.skema_periode` menyimpan asal-usul tiap baris agar tetap dapat ditelusuri saat
  rekonsiliasi
