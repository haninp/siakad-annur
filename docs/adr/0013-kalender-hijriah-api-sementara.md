# ADR 0013 — Kalender Hijriah dari API sementara

**Status:** diterima · 11 Agustus 2026  
**Memperbarui:** ADR 0004 — Masehi untuk tagihan, Hijriah untuk mukafaah

## Konteks

ADR 0004 menetapkan bahwa tabel `kalender_hijriah` **di-seed dari PDF tahunan Ditjen Bimas Islam** karena kalender Hijriah Indonesia adalah hasil hisab MABIMS ditambah sidang isbat — tidak ada rumus yang menghasilkannya. Prasyarat P4 (PDF Kalender Hijriah Kemenag) belum tersedia, sementara sistem sudah butuh tabel ini untuk:

- Menentukan periode mukafaah pengajar yang berbasis bulan Hijriah.
- Mengonversi label Hijriah pada data lama saat impor.
- Menampilkan tanggal ganda ke wali: _"Rabu, 12 Agustus 2026 (27 Safar 1448 H)"_.

Kami menilai dua API publik: Aladhan (`api.aladhan.com`) dan myQuran (`api.myquran.com/v3`). Dari lingkungan pengembangan ini:

- Aladhan tidak bisa dijangkau (TLS error).
- myQuran stabil (uptime 203 hari, respons < 0,2 s, trafik jutaan hit/bulan), berbasis Indonesia, dan punya endpoint Hijriah↔Masehi.

Namun uji cepat menunjukkan **anomali pada myQuran method `standar`**:

| Arah | Input | Output `standar` | Output `islamic-umalqura` |
| --- | --- | --- | --- |
| Masehi → Hijri | `2026-08-14` | **2 Rabiulawal** (1 Rabiulawal hilang) | — |
| Hijri → Masehi | `1448-03-01` | **30 Safar** (bukan 1 Rabiulawal) | ✅ 1 Rabiulawal |

Karena itu method yang dipakai adalah **`islamic-umalqura`**, yang dua arahnya konsisten pada contoh di atas.

## Keputusan

1. **Sumber otoritatif tetap PDF Kemenag.** Begitu P4 terpenuhi, `kalender_hijriah` di-seed ulang dari PDF dan baris-barisnya ditandai `sumber='kemenag'`, `provisional=0`.

2. **Sampai P4 tersedia, myQuran `islamic-umalqura` dipakai sebagai input awal.** Setiap baris yang berasal dari API diberi `sumber='myquran'` dan `provisional=1`.

3. **Verifikasi bulanan oleh pengurus.** Bot mengirim reminder saat sebuah bulan Hijriah akan dimulai; pengurus menjalankan `/setujui {tahun}-{bulan}` bila hasil sidang isbat cocok. Baris yang disetujui berubah menjadi `provisional=0` dengan jejak `disetujui_oleh` dan `disetujui_pada`.

4. **Tiga bulan isbat — Ramadan, Syawal, Dzulhijjah — wajib disetujui.** Sembilan bulan lainnya boleh tetap `provisional=1` dari API hingga P4, tetapi ketiga bulan ini rentan hasil sidang.

## Konsekuensi

- `kalender_hijriah` punya kolom `provisional`, `sumber`, `disetujui_oleh`, dan `disetujui_pada`.
- Laporan mukafaah yang menyentuh baris `provisional=1` tetap boleh jalan, tetapi UI mencetak peringatan.
- Begitu P4 datang, seed script cukup diubah sumbernya dan baris `sumber='kemenag'` otomatis `provisional=0`.
- ADR 0004 tidak dibatalkan; ADR ini hanya pengecualian operasional sementara.
