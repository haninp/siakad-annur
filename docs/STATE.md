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

**0.9e — ADR 0010, pembatalan usulan izin.** Wali boleh membatalkan selama belum di-_ack_
wali kelas. Syaratnya ditegakkan **CHECK bentuk data**, bukan urutan alur: baris batal yang
memuat `ditanggapi_oleh_pengajar_id` tidak akan lolos. Invarian `bot-wali` sekaligus berpindah
dari **hitungan handler** ke **sasaran tabel** — batas berbasis hitungan tergerus satu per
satu, batas berbasis sasaran tidak.

**Aturan bisnis pertama di `packages/core`.** `bolehAjukanIzin` dan `bolehBatalkanIzin`,
dengan batas **3 kali** batal-lalu-ajukan-ulang per anak per tanggal. Pesan penolakannya
diuji: wajib menyebut nama anak dan tanggal terbaca, wajib memuat arahan langkah berikutnya,
dan **dilarang memuat** nama tabel, nama kolom, atau istilah teknis.

**`packages/db` — runner migrasi.** Memakai `node:sqlite` bawaan Node, tanpa dependensi
native. Runner menolak berjalan bila migrasi yang sudah diterapkan disunting atau dihapus dari
daftar; migrasi yang gagal dibatalkan seluruhnya. `bukaBasisData()` jadi satu-satunya pintu
koneksi supaya pragma tidak bisa terlupakan.

**Tiga koreksi skema yang ketahuan saat menjelajahi basis data.** `hubungan` pada
`santri_wali` kehilangan nilai **`asuh`** — padahal `docs/01` menetapkannya sejak awal dan
**PROTA bergantung padanya**. Kolom `aktif` pada `santri_wali` dan `pengajar` juga hilang,
begitu pula `wali.alamat`. Keempatnya sudah ada di `docs/01`, terlewat di `docs/07`, dan kini
diperbaiki. Migrasi 1 disunting langsung — sah **hanya selama belum ada data sungguhan**;
`npm run db:ulang` untuk membangun ulang basis data pengembangan.

**Intervensi langsung ke basis data ditetapkan sebagai tindakan luar biasa** (`AGENTS.md`).
Menyunting lewat ekstensi editor melewati zod dan — yang lebih menentukan — tidak
meninggalkan jejak di `audit_log`. Tiga syarat: cadangkan (`npm run db:cadangkan`), hentikan
container, tulis apa yang diubah di `docs/handoff/`. `.vscode/extensions.json` menyarankan
`qwtel.sqlite-viewer` (baca-saja) dan `alexcvzz.vscode-sqlite` (menjalankan SQL).

**Infrastruktur Docker (ADR 0011).** `infra/Dockerfile` multi-stage + `infra/compose.yaml`.
RENCANA.md sudah menetapkan "Docker sejak hari pertama" sejak awal, tapi `docs/` dan `adr/`
diam soal itu dan `infra/` kosong — jadi keputusannya praktis tidak pernah berlaku. Sudah
diuji sungguhan di Colima aarch64: build, migrasi di container, dan pembacaan dari host.

## Sedang dikerjakan

Tidak ada. Sesi berhenti di batas tugas yang bersih.

## Langkah berikutnya

**Repository di `packages/db`** — pembacaan dan penulisan `usulan_izin` serta master data,
di atas runner yang sudah ada. Setelah itu `packages/core`: penegakan izin peran, dan
`ajukanIzin` / `batalkanIzin` sebagai handler yang boleh di-import `bot-wali`.

Semua itu jalan **tanpa menunggu keputusan siapa pun**. Yang menunggu: bagian keuangan
(P3) dan seluruh daftar di bawah.

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
4. _(Jalur tulis `bot-wali`, pembatalan, dan batas pengulangannya sudah terjawab — ADR 0009
   dan 0010. Tidak ada yang menggantung di jalur izin absen.)_
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
- **Bind mount SQLite di macOS menembus filesystem tervirtualisasi** (Docker Desktop maupun
  Colima). Penguncian berkas dan `fsync` di sana tidak sekuat filesystem asli, sementara
  SQLite bergantung pada keduanya — terlebih mode WAL. Diterima untuk basis data pengembangan
  yang bisa dibangun ulang; **jangan** untuk data sungguhan. Lihat ADR 0011.
- **`node:sqlite` menyalakan kunci asing secara baku** — berbeda dari SQLite mentah dan
  `better-sqlite3` yang mematikannya. Jangan menyalin asumsi dari pustaka lain. `bukaBasisData()`
  tetap menyetelnya eksplisit supaya tidak bergantung pada default yang tidak kita kendalikan.
