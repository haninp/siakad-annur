# ADR 0007 — Google Sheets hanya punya dua peran

**Status:** diterima · 8 Agustus 2026

## Konteks

Pesantren sudah lama hidup di Google Sheets dan akan terus mengaksesnya dari Android.
Tapi spreadsheet yang ada sekarang menunjukkan bagaimana hal itu berakhir bila dibiarkan tumbuh:
disusun seadanya, hanya dipahami satu orang, dan mengandung ~5.269 sel rusak yang merambat
lewat lookup ke seluruh laporan turunan.

## Keputusan

Sheets tetap dipakai, tapi perannya dipisah tegas menjadi **dua, dan hanya dua**.

**1. Sheet Pola — masukan massal**

- Templat **diterbitkan kode**, bukan disusun orang (`npm run sheet:terbitkan`)
- Worker mengimpor berkala, memvalidasi, lalu menulis balik status per baris
- **Satu arah saja** — Sheet adalah formulir, bukan cermin database
- Baris gagal validasi ditolak utuh, tidak diimpor sebagian

**2. Sheet Laporan — keluaran**

- Diterbitkan sistem, **diproteksi**, tidak pernah disunting tangan
- Kalau angkanya keliru, yang diperbaiki datanya — bukan sheet-nya

**Tidak ada jenis ketiga.** Sheet kendali atau pemantauan yang dipelihara manual sengaja
tidak dibuat: begitu laporan terbit otomatis dan pertanyaan bisa diajukan ke agent, sheet
semacam itu berhenti dirawat dan berubah jadi sumber angka basi yang menyesatkan.

## Sheets adalah jalur pengecualian

Operasional harian lewat Telegram. Sheets hanya untuk **entri massal** dan **koreksi angka**
yang tidak bisa ditempuh alur normal.

Koreksi angka menuntut pengawasan paling ketat di seluruh sistem, karena ia mengubah data
keuangan di luar alur biasa. Aturannya meminjam kontrol empat mata yang sudah berjalan di
pesantren (`Cek Abu Sahlah` / `Cek Abu Husain` pada mutasi bank):

1. Sheet koreksi **tidak pernah menulis langsung** — ia menghasilkan usulan
2. Setiap usulan wajib memuat **alasan**
3. Usulan harus **disetujui orang kedua**; pengusul tidak bisa menyetujui usulannya sendiri
4. Nilai **sebelum dan sesudah** tersimpan permanen di `audit_log`
5. Ringkasan seluruh koreksi masuk laporan pekanan — koreksi tidak boleh sunyi

## Konsekuensi

- Templat yang dihasilkan kode mencegah lahirnya kembali spreadsheet yang hanya dipahami satu orang
- Uji: hapus seluruh Sheet Pola, jalankan `sheet:terbitkan`, templat harus lahir kembali utuh
- Uji: menyunting sel di Sheet Laporan harus ditolak
