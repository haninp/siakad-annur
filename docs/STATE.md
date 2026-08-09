# STATE — kondisi terkini

> Diperbarui di akhir setiap sesi. Berkas ini yang dibaca lebih dulu oleh agent berikutnya,
> apa pun mereknya. STATE yang basi lebih berbahaya daripada tidak ada, karena ia dipercaya.

**Terakhir diperbarui:** 9 Agustus 2026

---

## Yang baru selesai

**0.8b — pembacaan berkas 01 dan 02, dan koreksi metode.** Keempat berkas rantai kini sudah
dibaca. Hasilnya di `docs/06-migrasi-legacy.md`.

**Desain master data.** `docs/07-master-data.md` dan `docs/adr/0008` — sembilan entitas master
diturunkan dari isi nyata berkas, bukan dari perancangan di atas kertas.

**Kebutuhan akademik dari lapangan.** `docs/08-akademik-kebutuhan.md` — delapan kebutuhan
hasil keterangan langsung pengelola. **Sumbernya percakapan, bukan berkas.**

Sebelumnya (Fase 0 tugas 0.1–0.8) sudah selesai dan ter-commit: struktur monorepo, AGENTS.md
sebagai sumber instruksi tunggal, ritual sesi, dokumen `00`–`05`, tujuh ADR, dua skill fondasi.

**0.10 — `packages/contracts`.** Empat belas entitas master identitas dan akademik: skema zod,
tipe, DDL SQLite `STRICT`, klasifikasi data pribadi berbasis metadata, dan `hitungStatusYatim`
sebagai fungsi turunan. 58 test hijau.

**0.9d — ADR 0009, jalur tulis sempit `bot-wali`.** Diputuskan: pengecualian sempit.
`bot-wali` boleh menulis ke **satu** tabel (`usulan_izin`) lewat **satu** handler
(`ajukanIzin`). `AGENTS.md`, `docs/02-roles-matrix.md`, dan ADR 0005 ikut diperbarui.
`usulan_izin` sudah ada di `contracts` beserta DDL dan aturan bentuknya.

## Sedang dikerjakan

Tidak ada. Sesi berhenti di batas tugas yang bersih.

## Langkah berikutnya

**`packages/db`** — runner migrasi di atas `DDL_MASTER_DATA` + `DDL_IZIN`, lalu repository.
Setelah itu `packages/core`: penegakan izin, dan `ajukanIzin` sebagai satu-satunya handler
tulis yang boleh di-import `bot-wali`.

Bagian keuangan `contracts` (`akun_keuangan`, `komponen_biaya`) tetap menunggu 0.9.

Rujukan statis `quran_surah` dan `quran_juz_batas` tetap bisa di-seed kapan saja — data publik,
tidak menunggu apa pun.

## Keputusan yang menggantung

1. **P3 — sesi dengan pemegang pengetahuan keuangan.** Daftar pertanyaan di ujung
   `docs/06-migrasi-legacy.md` sudah **diperbarui jadi sembilan** dan dipertajam: dua
   pertanyaan lama sudah terjawab sendiri oleh pembacaan 01/02, beberapa lain berubah dari
   "apakah ada" menjadi "kapan dan mengapa berubah". Ditambah pertanyaan **kode akun 8, 9, 10**
   yang tidak terbaca di ekspor. Ini memblokir bagian keuangan pada `contracts`, dan hanya itu.
2. **Perlindungan data**: bentuk persetujuan wali, retensi data alumni, akses wali setelah
   santri keluar, penanggung jawab data. Sekarang lebih mendesak — `NIK` **terisi nyata** di
   master berkas 04, bukan risiko hipotetis.
3. **Akademik**: daftar mapel per jalur & marhalah, skala nilai diniyah, aspek akhlak,
   hari & jam KBM. **Tidak memblokir** — keempatnya tabel seed, diisi lewat Sheet Pola.
4. **Pembatalan usulan izin oleh wali** — belum dirancang. Membiarkan wali mengubah barisnya
   sendiri melanggar pagar ADR 0009, jadi bentuknya perlu diputuskan tersendiri (kemungkinan
   sebagai sisipan baru, bukan pengubahan). _(Jalur tulis `bot-wali` sendiri sudah terjawab
   — lihat ADR 0009.)_
5. **Sepuluh keputusan akademik lain** dari `docs/08-akademik-kebutuhan.md`: pagu poin, poin
   positif, nilai harian tampil seketika atau setelah ditinjau, poin di halaqah, izin satu hari
   menutup dua konteks, wali boleh melihat PR, bentuk grup Telegram, dan apakah ekstraksi kalimat bebas perlu LLM sama
   sekali (kalau ya: retensi data pada Zen).
   _(Penyetelan ulang poin sudah terjawab: satu tabel `reset_poin` menutup pilihan "reset tiap
   tahun ajaran" maupun "akumulasi dengan reset sewaktu-waktu".)_

## Temuan penting dari pembacaan data lama

- **Rantai berkas terkonfirmasi**: 01 memegang 2023, 02 memegang 2024, 03 memegang 2025,
  04 memegang 2026. Tiap berkas memulai jurnal aktif sendiri, tapi **satu sheet arsip
  Juli–Agustus 2023 disalin identik ke keempatnya**. Cakupan impor tetap rantai penuh 01–04.
- **`No Transaksi` adalah deret global** lintas berkas (451xxx→453xxx→457xxx→461xxx), tidak
  tumpang tindih. Deduplikasi lewat kolom ini aman.
- **Ada DUA skema kolom jurnal**, patah antara **02 dan 03** — bukan 03 dan 04 seperti diduga.
  Importer butuh dua pemetaan; satu pemetaan tunggal akan menggeser kolom secara diam-diam.
- **Marhalah `Mutawashitoh` ada dan berisi santri** (kelas 7 dan 8). `docs/06` sebelumnya hanya
  mencatat RA-PAUD, MI Banin, MI Banat.
- **PROTA, KERINGANAN, dan NISN absen di berkas 01.** Sebelumnya dicatat sebagai pola warisan
  lama; ternyata umurnya dua sampai tiga tahun. Aturannya belum tentu mapan — jangan dibekukan
  jadi skema tanpa bertanya.
- Yang benar-benar hadir sejak 01 dan aman dibekukan: kontrol empat mata, cicilan, mukafaah,
  ta'awun, tunggakan, dua jalur pengajar.

## Yang perlu diketahui

- **Rencana lengkap ada di `docs/RENCANA.md`.** Bila berbeda dengan `docs/00`–`07` atau
  `docs/adr/`, **yang terakhir yang berlaku**; RENCANA.md dokumen asal, bukan sumber kebenaran.
- **Akademik adalah lahan kosong** — tidak ada sistem akademik di Drive. Dirancang dari awal.
  Kebutuhan lapangannya kini tercatat di `docs/08-akademik-kebutuhan.md`: PR lintas kelas,
  sistem poin sampai SP, kanal materi pertemuan berikutnya, nilai harian ke wali, dan laporan
  absen oleh wali. **Sumbernya percakapan, bukan berkas** — jadi tidak bisa diperiksa ulang
  seperti `docs/06` dan `07`; konfirmasi ulang sebelum dibekukan jadi skema.
- **LLM diakses lewat Zen (prasyarat P5), bukan SDK vendor langsung.** Sejalan dengan ADR 0006:
  `packages/core` harus memanggil lewat satu antarmuka penyedia, dan setiap keluaran divalidasi
  zod — model murah sering tidak menjamin bentuk keluaran.
- Prasyarat eksternal (token bot, service account, PDF kalender Kemenag, akun LLM) belum
  disiapkan. Hanya **P3** yang menghambat Fase 0; **P2** kini juga membatasi karena ekspor MCP
  tidak cukup untuk memastikan cakupan tanggal.

## Jebakan yang ditemukan

- **Ekspor MCP Google Sheets adalah cuplikan renggang, bukan potongan awal.** Buktinya: satu
  sheet menunjukkan kolom `No` berjalan 63–220 tetapi hanya 78 baris terbawa. Akibatnya
  ekspor bisa membuktikan sebuah periode **ada**, tapi **tidak pernah** membuktikan sebuah
  periode tidak ada. Jangan menarik kesimpulan negatif dari ekspor ini.

- **Ekspor markdown meng-escape garis bawah** (`is\_bebas\_spp`). Mencari `is_bebas_spp`
  mengembalikan nol padahal kolomnya ada — dan itu sempat masuk dokumen sebagai temuan palsu.
  Buang backslash lebih dulu sebelum mencari apa pun yang bernama snake_case.

- **Menghitung pola tanggal ke seluruh isi ekspor menghasilkan angka yang menyesatkan.**
  Yang ikut terhitung: log add-on Document Studio, tanggal lahir santri, dan boilerplate
  warisan. Hitung dari kolom jurnal saja.

- **Tiap generasi berkas memulai jurnal aktif dari nol.** Berhentinya sebuah berkas dipakai
  untuk entri baru tidak membuatnya usang sebagai sumber riwayat.

- `vitest` 2.x membawa 5 kerentanan (1 kritis) lewat vite/esbuild. Sudah dinaikkan ke 4.x.
  **Jangan turunkan kembali.**
- Sheet `MutasiBSI` nihil di keempat ekspor; `HALAQOH` hanya muncul di 01 dan 02. Blok
  berformat EMIS **ada, dan hanya di berkas 04**.
- Node 26 menjalankan TypeScript tanpa flag; `--experimental-strip-types` tidak diperlukan.
