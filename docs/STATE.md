# STATE — kondisi terkini

> Diperbarui di akhir setiap sesi. Berkas ini yang dibaca lebih dulu oleh agent berikutnya,
> apa pun mereknya. STATE yang basi lebih berbahaya daripada tidak ada, karena ia dipercaya.

**Terakhir diperbarui:** 18 Agustus 2026, sesi RFC-013

---

## Yang baru selesai

**1.18 — Perlindungan data pribadi di tampilan chat (RFC-013).** Tiga lapisan:
(1) `formatNamaTampil` di core — nama wali ditampilkan sebagai kunyah →
panggilan → nama lengkap, satu fungsi untuk kedua bot; daftar wali di bot
internal (`/undang`, pemilih) menyertakan pembeda alami NIS anak
(`Ummu Aisyah · anak 2627005`) kala alias kembar. (2) Helper tampilan
`escapeMarkdownV2` + `spoil` di core (siap dipakai fitur yang merender
tanggal lahir/NIK kelak; alur reveal + `audit_log` sengaja menyusul bersama
trigger pertamanya). (3) **Reconfirmation registrasi**: `/start <kode>`
sekarang memvalidasi kode tanpa menghubungkan (`periksaUndangan`), lalu
menanyakan salah satu nama lengkap anak milik wali — cocok case-insensitive
persis setelah trim (`konfirmasiUndangan`); 3× salah → arahkan hubungi
pengurus, kode TIDAK hangus (proteksi, bukan hukuman). Semua aturan di core,
state percobaan in-memory di bot (pola `stateBayar`). Seed `simulasi-ulang`
memuat alias kunyah/panggilan untuk 4 wali dummy. 21 test baru (384 total).
`docs/rfcs/rfc-013-perlindungan-data-tampilan.md`. Catatan: dev DB perlu
`npm run db:ulang && node data/simulasi-ulang.ts` + restart bot agar alias
dan alur barunya berlaku di uji live.

**1.17 — Reminder worker: kalender hijriah & jatuh tempo (RFC-012).** Loop
`apps/worker` kini menjalankan tiga job: notifikasi terbit (RFC-011), reminder
jatuh tempo H-3/H-1 ke wali terdaftar (`notifikasi_jatuh_tempo`, masing-masing
tahap sekali), dan reminder bulan hijriah provisional yang mulai ≤3 hari ke
pengurus (`diingatkan_pada` di `kalender_hijriah`, migrasi 9) dengan perintah
`/setujui <tahun>-<bulan>` di bot internal (memakai `setujuiBulanHijriah` yang
sudah ada). Handoff 0013 (reminder kalender hijriah) ditutup — P1 terpenuhi dan
fondasinya jadi nyata. `docs/rfcs/rfc-012-reminder-worker.md`.

**1.16 — Worker notifikasi tagihan terbit (RFC-011).** `apps/worker` kini
daemon nyata: tiap 60 detik memeriksa tagihan status 'terbit' yang belum
dinotifikasi, lalu mengirim pesan proaktif ke wali TERDAFTAR
(`pengguna_telegram`) via bot wali — "📋 Tagihan SPP Bulanan — 2026-08 untuk
{nama} Rp 450.000, batas bayar …". Jejak di tabel `notifikasi_terbit`
(migrasi 8) — idempoten, anti-spam. Tagihan tanpa wali terdaftar TIDAK
ditandai: begitu wali mendaftar (M2), tagihan terkirim pada putaran berikutnya
(memudahkan uji). `npm run worker:notifikasi` (loop) / `--sekali` (uji).
`docs/rfcs/rfc-011-worker-notifikasi-tagihan.md`.

**1.15 — Pencarian santri di bot internal (RFC-010).** Tombol `🔍 Cari santri`
di menu utama + perintah `/cari <nis|nama>`. Urutan hasil: NIS persis → nama
mengandung → NIS diawali (maks 10). Satu hasil langsung menampilkan status
tagihan (semua komponen + saldo, format RFC-007); banyak hasil jadi tombol
pilihan. View detail santri (`santri:detail`) punya area aksi yang siap
diperluas dengan aksi tulis kelak. `docs/rfcs/rfc-010-pencarian-santri.md`.

**1.14 — Registrasi wali sungguhan (RFC-009).** Pengurus membuat undangan via
`/undang` di bot internal (pilih wali → kode sekali pakai `undang-XXXXXX`),
wali mendaftar sendiri di bot wali dengan `/start <kode>` — tanpa menyentuh
konfigurasi. Bot internal menampilkan **link deep link penuh**
(`https://t.me/rtq_annur_bot?start=<kode>`) — wali cukup mengetuk link dari
WhatsApp/chat apa pun, Telegram terbuka dan pendaftaran selesai otomatis.
`/undang` kini menampilkan **daftar undangan yang menunggu** + tombol `❌ Cabut`
(revoke); kode yang sudah dipakai otomatis hilang dari daftar. Migrasi 7
(`dipakai_pada`/`dicabut_pada`): kode bekas tetap tersimpan sehingga link yang
sudah dipakai/dicabut memberi pesan berbeda ("sudah digunakan" / "sudah
dibatalkan pengurus" / "tidak dikenal"). `hubungkan` dipaksakan sekali pakai di
SQL (guard `undangan_kode`
+ `aktif` + `telegram_id IS NULL`); satu telegram_id tidak bisa dipakai akun
lain (anti-hijack). `waliUntuk()` membaca `pengguna_telegram` sebagai sumber
kebenaran; `DEV_WALI_BINDING` tinggal fallback pengembangan. Handler core
`buatUndangan` (admin/pengurus) + `gunakanUndangan` (mandiri) + 15 test baru
(repo & core). `docs/rfcs/rfc-009-undangan-registrasi-wali.md`.

**1.13 — Alur verifikasi pembayaran (RFC-008).** Wali submit bukti via bot wali
(💳 Bayar tagihan: pilih anak → tagihan → metode → cash wajib nama penerima →
foto bukti → kirim), bendahara verifikasi/tolak via bot internal (💳 Usulan
pembayaran: daftar → lihat bukti → ✅ verifikasi = uang masuk / ❌ tolak wajib
alasan), wali dapat notifikasi. `usulan_pembayaran` + `pengguna_telegram`
(migrasi 6), core handler + 12 test, 313 test total. Bukti tidak disimpan
di disk (cukup file_id Telegram). `BENDAHARA_TELEGRAM_IDS` di `.env`.

**1.12 — Klarifikasi tampilan tagihan (RFC-007).** `formatStatusPembayaran`
menampilkan nominal jelas di kepala, SUDAH BAYAR dengan daftar "berapa & kapan"
per pembayaran, BAYAR SEBAGIAN dengan sudah/sisa/batas, dan kelebihan bayar
tampil sebagai `Saldo: Rp …`. DB dev di-reset & disimulasi ulang
(`data/simulasi-ulang.ts`): santri #1 lunas penuh, santri #2 bayar lebih
(kelebihan Rp 50.000 → Saldo).

**1.11 — Bot wali ringkasan agregat (RFC-006).** `/start` menampilkan status
bulan berjalan untuk SEMUA anak sekaligus (per komponen, kosakata tegas),
tombol `📋 Detail tagihan` → pilih anak → rincian lengkap. Dua menu lama yang
overlap (`Tagihan anak` & `Status bulan ini`) digabung menjadi satu alur.

**1.10 — Kosakata status tegas + hirarki menu (RFC-005).** `statusPembayaran` +
`formatStatusPembayaran` di `packages/core` (6 test). Bot wali menampilkan
SUDAH BAYAR / BAYAR SEBAGIAN / BELUM BAYAR / DIBATALKAN + detail (nominal, total &
tanggal bayar, jatuh tempo). Bot internal: hirarki `Keuangan → Santri → komponen
(SPP/Uang Modul/Uang Gedung)` — daftar komponen dinamis dari `komponen_biaya`;
rekap & piutang per komponen; `/rekap` & `/piutang` perintah teks baru.

**1.9 — Bot wali baca-saja (RFC-004).** `apps/bot-wali` jalan: `/start`, menu
`📋 Tagihan anak` & `📊 Status bulan ini`, pemilih santri, rincian tagihan + saldo
lebih bayar. **Nol handler tulis di-import** (lebih ketat dari minimum ADR 0009/0010).
Binding dev via `DEV_WALI_TELEGRAM_IDS` → wali dengan tautan aktif terbanyak
(pengganti: `pengguna_telegram` + deep link undangan). `npm run bot:wali`.

**1.8 — Pengurus = monitoring; tagihan = back office (RFC-003).** `terbitkanTagihanBulanan`
di `packages/core` (batch idempoten, 3 test) + `npm run tagihan:terbitkan` (jalur
back office, nanti cron di worker). Menu bot internal berubah: `📋 Status santri` ·
`📊 Rekap bulan ini` · `💰 Piutang`; `/tagihan` dihapus, `/terbitkan` admin-only.
`docs/02-roles-matrix.md` diperbarui. Token P1 bot wali valid; tagihan 2026-08
sudah diterbitkan via back office (2 santri, Rp 900.000).

**1.7 — Menu tombol (button card) di bot internal (RFC-002).** `docs/rfcs/rfc-002-menu-tombol-bot-internal.md`
disetujui & diimplementasikan: inline keyboard untuk seluruh alur — menu utama
(`📋 Status tagihan` · `🧾 Terbitkan SPP` · `💰 Bayar`), pemilih santri, konfirmasi
sebelum tulis, nominal cepat (150k/250k/450k). Desain stateless: state di `callback_data`,
satu pesan diedit sepanjang alur. Perintah teks RFC-001 tetap jalan sebagai fallback
(termasuk nominal custom). Build + lint + 280 test hijau.

**1.6 — Bot internal minimal uji coba keuangan (RFC-001).** `docs/rfcs/rfc-001-bot-internal-minimal.md`
disetujui & diimplementasikan: grammY 1.45 + `packages/bot` (`buatBot` dengan penanganan
galat terpusat) + `apps/bot-internal` dengan empat perintah — `/start`, `/tagihan <nis>`,
`/bayar <nis> <nominal>`, `/status <nis>`. Whitelist admin via `ADMIN_TELEGRAM_IDS` di
`.env` (ID Hani 144666620); izin tetap lewat `buatHandlerKeuangan` di `core`. Token P1
terisi di `.env` (gitignored). `npm run bot:internal` untuk menjalankan. Build + lint +
280 test hijau. Bot berjalan long-polling di mesin pengembangan.

**1.5 — `kalender_hijriah` + seed dari myQuran + verifikasi manual.** Ditambahkan
entitas, DDL, migrasi v5, repository `repoKalenderHijriah`, pure rule
`cariBulanHijriahPadaTanggal`, dan handler `setujuiBulanHijriah`. Script
`npm run hijriah:isi` mengisi tabel dari myQuran (`method=islamic-umalqura`)
dengan retry pada rate limit; `npm run hijriah:periksa` mencetak bulan yang
masih `provisional=1`. ADR 0013 mencatat pengecualian sementara terhadap
ADR 0004 (sumber PDF Kemenag) dan memilih `islamic-umalqura` setelah menemukan
anomali pada method `standar`. Bot reminder otomatis ditunda karena P1 belum
terpenuhi — catatan ada di `docs/handoff/0013-bot-reminder-kalender-hijriah.md`.
Test: 280 test hijau.

**1.4e — `packages/core`: lebih bayar + migration v4.**

**1.4d — `packages/core`: `alokasiProta` + transaksi.** `DukunganTransaksi`
didefinisikan di `contracts`, diimplementasikan `buatDukunganTransaksi` di `db`.
`keuangan-handler.ts` menambah `alokasiProta`: mengurangi `prota.sisa`, mencatat
`pembayaran` sumber PROTA, menyimpan `alokasi_prota`, dan menandai lunas bila
outstanding habis — semua dalam satu transaksi.

**1.4c — `packages/core`: `tetapkanKeringanan`.**

**1.4b — `packages/core`: `catatPembayaran` + cicilan.**

**1.4a — `packages/core`: `terbitkanTagihan` + aturan murni keuangan.**

**1.3 — `packages/db`: repository untuk 9 tabel keuangan.** `repo-keuangan.ts`
mencakup `akun_keuangan` (PK INTEGER khusus), `komponen_biaya`, `tarif_komponen`,
`tagihan`, `keringanan`, `pembayaran`, `prota`, `alokasi_prota`, dan `lebih_bayar`.
Method khusus: `cariByKode`, `cariAktif`/`cariUmum` tanpa fallback, transisi terminal
`tagihan` (`tandaiLunas`/`batalkan` dari `terbit` saja), `kurangiSisa` PROTA, serta
penghitungan total pembayaran dan saldo lebih bayar.

**1.2 — `packages/contracts`: skema keuangan.** Sembilan tabel: `akun_keuangan`,
`komponen_biaya`, `tarif_komponen`, `tagihan`, `keringanan`, `pembayaran`, `prota`,
`alokasi_prota`, `lebih_bayar`. DDL SQLite STRICT dengan CHECK constraints, klasifikasi
data pribadi lengkap, dan test zod + DDL. Migrasi versi 3. Actor `disetujui_oleh` dan
`dicatat_oleh` sengaja tanpa FK karena `pengguna_telegram` menyusul.

**1.1 — `packages/core`: handler `ajukanIzin` / `batalkanIzin`.** Penegakan izin peran di
satu tempat: wali hanya bisa mengajukan/membatalkan untuk santri yang tertaut padanya,
ditegakkan lewat `santri_wali.aktif`. Handler menerima repository sebagai dependency,
mengembalikan pesan substantif ke wali, dan memakai aturan `bolehAjukanIzin`/
`bolehBatalkanIzin` yang sudah ada.

**1.0 — repository `packages/db` untuk master data dan `usulan_izin`.** 14 repository
master data (id tunggal & komposit) plus `RepoUsulanIzin` dengan method `ajukan`,
`batalkan`, `tanggap`, `cariMenunggu`, dan `cariBySantri`. Helper otomatis mengonversi
boolean zod ke INTEGER SQLite 0/1 dan kembali.

**Jawaban P3 — sesi pemegang pengetahuan keuangan.** Sembilan pertanyaan di ujung
`docs/06-migrasi-legacy.md` terjawab: TAYSIR ditangguhkan/berpotensi dihentikan, keringanan
murni kebijakan pengurus, keluar di tengah tahun tidak refund, sisa PROTA digulirkan, tahun
ajaran mengikuti kalender nasional, lebih bayar dipotong tagihan berikutnya, NISN dilengkapi
belakangan. Dua pertanyaan (kolom `Khusus PROTA` dan sheet arsip 2023) ditunda. Hasilnya
masuk ke `docs/06-migrasi-legacy.md`.

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

**RFC-014 — Peran Bendahara (laporan keuangan + verifikasi).** Spec disetujui
(`docs/rfcs/rfc-014-peran-bendahara.md`). Fondasi selesai: `repo-laporan.ts`
(db, agregat SQL) + `laporan.ts` (core, izin bendahara/pengurus + validasi
periode) — build hijau. Tersisa: export core index, test laporan, gate peran di
bot-internal (`peranUntuk`, menu `📊 Laporan keuangan` + `/laporan`), matriks
peran docs/02, ritual selesai + commit + deploy + push. Detail:
`docs/handoff/0015-rfc014-bendahara.md`.

## Langkah berikutnya

**Fase 1 OLTP keuangan selesai.** Seluruh sub-tugas 1.0–1.5 sudah di-commit.

Tugas berikutnya yang sudah tercatat:

- **Fase 2 — akademik**: rancang skema capaian hafalan, nilai, poin, PR, dan
  laporan absen setelah kebutuhan lapangan di `docs/08-akademik-kebutuhan.md`
  dikonfirmasi ulang.
- **Bot reminder kalender_hijriah**: otomatis mengingatkan pengurus tiap awal
  bulan Hijriah. Menunggu **P1** (token bot Telegram). Detail di
  `docs/handoff/0013-bot-reminder-kalender-hijriah.md`.
- **Re-seed dari PDF Kemenag** begitu **P4** tersedia; baris `sumber='kemenag'`
  otomatis `provisional=0`.

Dua hal keuangan masih ditunda: makna kolom `Khusus PROTA` dan nasib sheet arsip
Juli–Agustus 2023.

Rujukan statis `quran_surah` dan `quran_juz_batas` tetap bisa di-seed kapan saja — data publik,
tidak menunggu apa pun.

## Keputusan yang menggantung

1. **P3 — sesi dengan pemegang pengetahuan keuangan.** Terjawab sebagian besar pada
   10 Agustus 2026. Yang masih terbuka: makna kolom `Khusus PROTA` dan nasib sheet arsip
   Juli–Agustus 2023. Bagian keuangan pada `contracts` sudah tidak lagi diblokir penuh.
2. **Perlindungan data**: tampilan chat sudah diamankan (RFC-013). Yang masih
   menggantung: bentuk persetujuan wali, retensi data alumni, akses wali setelah
   santri keluar, penanggung jawab data. **NIK terisi nyata** di master berkas 04 —
   alur reveal + `audit_log` dibangun bersama fitur pertama yang menampilkannya
   (keputusan RFC-013 butir 5).
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
