> **Asal berkas.** Ini rencana lengkap hasil sesi perancangan 8 Agustus 2026, disalin ke
> dalam repo agar tidak hidup di direktori khusus satu vendor — sesuai ADR 0006.
>
> `docs/00`–`06` dan `docs/adr/` adalah sarinya, dan **itu yang berlaku** bila keduanya
> berbeda. Dokumen ini disimpan untuk hal-hal yang belum sempat disarikan: rincian fitur
> agent, tabel biaya model, kerangka akademik, dan pembenaran yang lebih panjang.

---

# SIAKAD An-Nuur — Struktur Project Portabel + Agent Pembantu Operasional

## Context

Pesantren An-Nuur Limo menjalankan operasional akademik & keuangan sepenuhnya di Google
Sheets — folder `My Drive/SIAKAD-ANNUR` baru berisi dua shortcut spreadsheet keuangan
(`03. Database Keuangan KBM ... 1446H-1447H`, `04. DATABASE KEUANGAN TA 1446-1447`).
Dipilih karena semua pengguna mengakses dari Android dan sudah terbiasa dengan Sheets.
Kelemahannya: tidak ada relasi antar entitas, tidak ada kontrol akses per-peran, dan rawan
bentrok saat banyak orang menulis bersamaan.

Tujuan: memindahkan **sumber kebenaran** ke database yang benar, input harian lewat
**Telegram bot**, sambil **tetap mempertahankan Sheets sebagai permukaan baca** agar tidak
ada perubahan kebiasaan pengguna.

**Risiko yang ditemukan saat perencanaan, dan paling mendesak dari seluruh dokumen ini:**
kedua spreadsheet keuangan disusun seadanya, **hanya dipahami satu orang**, dan pembacaan
langsung menemukan **~5.269 sel rusak** (`#N/A`, `#VALUE!`, `#REF!`) yang merambat lewat
lookup ke Kartu Kendali dan seluruh laporan turunan (rincian di Bagian 9).

Arahnya bukan menuju kegagalan yang kentara, melainkan menuju **kesalahan yang senyap**:
angka tetap tampil, sebagian keliru, dan tidak ada yang bisa memeriksa yang mana — karena
satu-satunya orang yang memahami strukturnya juga satu-satunya yang bisa mengauditnya.

Karena itu pekerjaan ini lebih dekat ke **penyelamatan daripada peningkatan**. Pembacaan
spreadsheet lama dinaikkan ke Fase 0, dikerjakan bersama orang tersebut selagi masih ada,
dan hasilnya dokumen — bukan sekadar skrip impor.

Dua kendala lain yang membentuk rencana ini:

1. **Portabilitas.** Pengembangan memakai Claude Code dan opencode **bergantian** (opencode
   lebih murah), dan repo tidak boleh terkunci pada format project satu vendor.
2. **Keterbatasan personil pengurus.** Ini alasan utama LLM masuk ke sistem — bukan sebagai
   hiasan, tapi untuk memikul pekerjaan yang saat ini tidak ada orangnya.

---

## Prinsip

**Anti lock-in**

1. Pengetahuan hidup sebagai markdown biasa (`docs/`, `AGENTS.md`); pekerjaan hidup sebagai
   npm script — bisa dijalankan manusia tanpa agent sama sekali.
2. Folder vendor (`.claude/`, `.opencode/`) hanya adapter tipis, tanpa konten unik.
3. **Uji-hapus:** `rm -rf .claude/` harus tidak mengurangi kemampuan repo.

**Batas LLM** 4. **LLM tidak pernah menulis ke database.** Setiap perubahan data lewat kode deterministik,
dengan persetujuan manusia bila berasal dari usulan LLM. 5. **Angka datang dari tool, kalimat datang dari model.** LLM tidak menghitung apa pun —
ia merangkai narasi di sekitar angka yang sudah dihitung SQL. Ditegakkan secara mekanis.

**Ramah organisasi tanpa tim IT** 6. **Hanya dua permukaan administrasi: Telegram dan Google Sheets.** Tidak ada terminal,
tidak ada SQL, tidak ada panel selain Metabase untuk menjelajah data. Siapa pun yang
paham substansi datanya harus bisa menjalankan seluruh operasional tanpa bantuan teknis. 7. **Sistem melapor sendiri, dalam bahasa substantif.** Kegagalan tidak berhenti di log —
ia jadi pesan Telegram yang menyebut _apa_ yang salah dan _apa_ yang harus dilakukan,
bukan pesan galat teknis. Lihat Bagian 9.

---

## Keputusan

| Topik                              | Keputusan                                                                                        | Alasan                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lokasi repo                        | `~/Projects/siakad-annur`                                                                        | Folder Drive terus-menerus sync; `.git/` + `node_modules/` rawan korup. Drive tetap dipakai murni sebagai _data layer_ lewat API.                                                                                                                                                       |
| Bahasa                             | TypeScript / Node v26                                                                            | Sudah terpasang. grammY, `googleapis`, `@duckdb/node-api`, MCP SDK matang di TS.                                                                                                                                                                                                        |
| Store transaksional                | SQLite (WAL), `data/sqlite/siakad.db`                                                            | Volume satu pesantren, nol biaya hosting. WAL = banyak pembaca + satu penulis.                                                                                                                                                                                                          |
| Store analitik                     | **DuckDB sebagai gudang data berlapis (bronze/silver/gold) dengan star schema + SCD2**           | Bukan sekadar mesin query di atas tabel OLTP. Skema OLTP menyimpan keadaan sekarang; sejarah ditimpa saat santri naik kelas atau tarif berubah. Lapisan OLAP yang memulihkannya. Lihat Bagian 3.                                                                                        |
| Permukaan baca                     | Sheets (auto-publish) + Metabase (Docker)                                                        | Sheets untuk wali/pengurus dari Android. Metabase diarahkan ke snapshot Parquet, bukan SQLite live.                                                                                                                                                                                     |
| Topologi bot                       | Dua bot terpisah: internal & wali                                                                | Wali secara fisik tidak punya jalur ke perintah internal.                                                                                                                                                                                                                               |
| Deploy                             | Docker sejak hari pertama, jalan lokal dulu                                                      | Pindah ke VPS nanti = ganti host, tanpa ubah kode.                                                                                                                                                                                                                                      |
| Skala                              | 100–150 santri                                                                                   | Kecil — memperkuat pilihan SQLite dan membuat biaya LLM dapat diabaikan.                                                                                                                                                                                                                |
| Jenjang                            | `paud`, `paket_a` (setara SD), `paket_b` (setara SMP); `paket_c` disiapkan di enum               | Menginduk ke **PKBM**, jadi memakai nomenklatur resmi pendidikan kesetaraan sejak awal — bukan "SD/SMP" — agar cocok saat data dipasok ke Dapodik.                                                                                                                                      |
| Hubungan dengan sistem kementerian | SIAKAD **memasok**, bukan menggantikan Dapodik / e-Rapor                                         | Lihat Bagian 6.                                                                                                                                                                                                                                                                         |
| Kalender                           | **Masehi untuk seluruh stempel waktu**; Hijriah pendamping di laporan                            | Penyimpanan, kunci, dan query waktu memakai Masehi (ISO, Asia/Jakarta).                                                                                                                                                                                                                 |
| **Periode tagihan SPP**            | **Bulan Masehi** (`bulan_spp` = `2026-08`) — dikonfirmasi pengurus **dan** terverifikasi di data | Sejak ~April 2026 pesantren memakai penomoran Masehi; skema Hijriah lama masih tersimpan di berkas yang sama. Importer wajib menangani keduanya. Lihat Bagian 10.                                                                                                                       |
| **Mukafaah pengajar**              | **Bulan Hijriah**                                                                                | Ritme yang berbeda dari sisi pendapatan; selisihnya dibahas di Bagian 10.                                                                                                                                                                                                               |
| Sumber Hijriah                     | **Tabel `kalender_hijriah` di-seed dari kalender Kemenag**                                       | Kalender Kemenag hasil hisab + sidang isbat, **tidak bisa dihitung dengan rumus**. Karena siklus penagihan mengikutinya, tabel ini **menopang keuangan** — bukan sekadar kosmetik laporan. Ia naik jadi komponen kritis.                                                                |
| Batas agent                        | `packages/mcp-server` — tool baca-saja, ber-scope peran                                          | Protokol terbuka, milik sendiri. Melayani agent operasional **dan** coding agent saat development.                                                                                                                                                                                      |
| Runtime agent                      | `packages/agent` — loop sendiri, ~300 baris TS                                                   | Client OpenAI-compatible ke opencode Zen. Bot & cron sudah kita punya, jadi Hermes tidak menambah apa pun selain container Python kelima.                                                                                                                                               |
| Gateway — development              | **opencode Go**, $10/bln                                                                         | Jatah pakai $60 atas 18 model open-weight. Untuk coding lewat opencode; nilai 6x lipat.                                                                                                                                                                                                 |
| Gateway — runtime                  | **opencode Zen** pay-as-you-go, **akun terpisah**                                                | Isolasi, bukan harga: kalau runtime menumpang jatah Go, sesi coding boros bisa menghabiskan cap $12/5jam dan laporan pengurus gagal terkirim. Produksi tidak boleh berebut kuota dengan development. Keduanya OpenAI-compatible, jadi ditukar ke OpenRouter/Nous/lokal cukup lewat env. |

**Konversi Hijriah mengikuti Kemenag.** Tidak ada API resmi — Ditjen Bimas Islam
menerbitkan Kalender Hijriah Indonesia sebagai **PDF tahunan**, berbasis kriteria MABIMS
(tinggi hilal 3°, elongasi 6,4°). Tidak ada varian ICU (`islamic-umalqura`, `islamic-civil`,
`islamic-tbla`) yang cocok di semua bulan, dan tidak ada rumus yang menghasilkannya.

Namun bebannya jauh lebih ringan dari kelihatannya: **sidang isbat hanya digelar untuk tiga
bulan — Ramadan, Syawal, Dzulhijjah.** Sembilan bulan lainnya mengikuti hisab yang sudah
pasti sejak kalender tahunan terbit dan tidak bergeser. Jadi ini bukan pekerjaan bulanan:

- **Sekali setahun** — `scripts/seed-hijriah.ts` mengisi `kalender_hijriah` dari PDF Kemenag
- **Tiga kali setahun** — admin mengonfirmasi hasil sidang isbat lewat `/kalender`
- Tanggal sidang isbat bisa diprediksi (akhir Sya'ban, akhir Ramadan, akhir Dzulqa'dah),
  jadi **bot yang mengingatkan admin**, bukan admin yang harus memantau
- Bulan yang menunggu konfirmasi isbat ditandai **provisional**; laporan yang menyentuhnya
  memakai tanggal Masehi saja sampai dikonfirmasi
- Tanggal di luar rentang tabel ditandai perkiraan, bukan ditampilkan seolah pasti

Format tampilan ke wali: **"Rabu, 12 Agustus 2026 (27 Safar 1448 H)"** — Masehi dulu,
Hijriah dalam kurung.

### Mengapa SQLite tetap dipilih meski cakupan meluas

Yang bertambah pada rencana ini adalah **keluasan fitur**, bukan volume data maupun
konkurensi — dan hanya dua hal terakhir itulah yang mematahkan SQLite.

Beban pada 150 santri: absensi ~37.500 baris/tahun, setoran hafalan ~18.000, nilai ~24.000,
keuangan ~3.600, rapor ~3.000, audit log ~90.000 — **total ~180.000 baris/tahun**. Setelah
10 tahun sekitar 1,8 juta baris, berkas 300–500 MB. Batas praktis SQLite ada di ratusan
juta baris: kelonggaran ~2 orde besaran.

Konkurensi puncak: ~10 pengajar entri absensi pagi hari, sekitar 1–5 tulis/detik tersebar
beberapa menit. SQLite WAL menangani ribuan tulis/detik di SSD: kelonggaran ~3 orde besaran.

Alasan penentunya justru non-teknis dan kembali ke kendala utama pesantren — **keterbatasan
personil**. Basis data satu berkas di-backup dengan menyalin file, dipulihkan dengan
menyalinnya kembali, dan diperiksa dengan viewer SQLite apa pun. Postgres menukar itu
dengan container tambahan, `pg_dump`, dan pemulihan yang menuntut orang paham Postgres.

**Harga yang dibayar, dan penanganannya:**

| Keterbatasan                         | Penanganan                                                           |
| ------------------------------------ | -------------------------------------------------------------------- |
| Sebagian migrasi butuh rebuild-table | Migrasi ditulis sebagai SQL polos + uji migrasi di setiap rilis      |
| Tidak ada tipe ENUM native           | `CHECK constraint` di DB + zod di batas aplikasi                     |
| Satu penulis pada satu waktu         | WAL + `busy_timeout`; bot-wali baca-saja, jadi penulis nyata hanya 2 |
| Semua container wajib satu host      | Diterima — tidak ada kebutuhan multi-host di skala ini               |

**Pemicu meninjau ulang** (ditulis di ADR sejak awal): cabang/lokasi kedua, kebutuhan akses
dari beberapa host, atau tulis bersamaan yang menetap di puluhan per detik. Akses DB
disembunyikan di balik repository `packages/db` dengan SQL portabel, sehingga perpindahan
tetap pekerjaan terbatas — bukan penulisan ulang.

---

## Struktur Repo

```
~/Projects/siakad-annur/
├── AGENTS.md                  # ⭐ sumber kebenaran instruksi agent (standar terbuka)
├── CLAUDE.md                  # dua baris: "ikuti AGENTS.md" — tanpa konten unik
├── .opencode/  .claude/       # adapter tipis; .claude/skills → symlink ke /skills
├── skills/                    # SKILL.md format terbuka (agentskills.io)
├── docs/
│   ├── STATE.md               # ⭐ di mana pekerjaan berhenti & apa berikutnya
│   ├── 00-overview.md         # tujuan, ruang lingkup, glosarium pesantren
│   ├── 01-domain-model.md     # entitas + relasi
│   ├── 02-roles-matrix.md     # peran × aksi → izin
│   ├── 03-data-flow.md        # SQLite → DuckDB → Sheets/Metabase
│   ├── 04-onboarding.md       # alur undangan wali
│   ├── 05-agent-boundary.md   # kontrak MCP + aturan grounding
│   └── adr/
├── packages/
│   ├── contracts/             # zod schema + tipe TS + DDL  ⟵ FONDASI
│   ├── core/                  # aturan bisnis + penegakan izin (satu-satunya tempat)
│   ├── db/                    # migrasi SQLite + repository
│   ├── analytics/             # gudang data OLAP: sql/{bronze,silver,gold} + pipeline
│   ├── drive/                 # googleapis: Sheets publisher, Drive backup
│   ├── bot/                   # kerangka grammY bersama
│   ├── mcp-server/            # batas agent — tool baca-saja, ber-scope peran
│   └── agent/                 # loop LLM: client OpenAI-compatible + grounding guard
├── apps/
│   ├── bot-internal/          # pengurus/pengajar/admin (token A)
│   ├── bot-wali/              # wali (token B) — baca-saja
│   └── worker/                # snapshot, publish Sheets, backup, ringkasan berkala
├── infra/                     # Dockerfile multi-stage + compose (2 bot, worker, metabase)
├── scripts/                   # seed, import spreadsheet lama
└── data/                      # sqlite/ duckdb/ parquet/ exports/  (gitignored)
```

`packages/agent` berisi kode sendiri, bukan SDK vendor — model provider hanya URL + kunci
di env. Tidak ada container Hermes.

### Model domain (ringkas; lengkap di `docs/01-domain-model.md`)

- **Identitas**: `santri`, `wali`, `pengajar`, `pengguna_telegram` (`telegram_id` → peran + entitas)
- **Relasi wali**: `wali_santri` — n:m, kolom `jenis_hubungan` (`ayah`/`ibu`/`wali`/`asuh`) **murni label deskriptif, bukan sumbu izin**
- **Undangan**: `undangan` — lihat Bagian 3
- **Identitas resmi**: `nisn`, `nik`, `no_induk_pkbm` pada `santri` — agar data siap dipasok ke Dapodik/Verval PD tanpa entri ulang
- **Akademik** (rancangan penuh di Bagian 12): `tahun_ajaran` · `marhalah` (`ra_paud`/`mi_banin`/`mi_banat`) · `fase` (Kurikulum Merdeka A–D) · `kelas` (+ wali kelas) · `halaqah` (+ mudaris) · `santri_kelas` · `santri_halaqah` · `mata_pelajaran` (dengan `jalur`: `diniyah`/`umum`) · `jadwal` · `kalender_akademik` (hari KBM & libur)
- **Aktivitas**: `absensi` (grain santri × tanggal × `konteks` halaqah/kelas) · `setoran` (`jenis` ziyadah/murojaah + surah + rentang ayat + kualitas) · `nilai` (formatif/sumatif) · `perkembangan` (observasi naratif PAUD)
- **Rujukan**: `quran_surah` (114 surah, jumlah ayat, batas juz) — statis, menopang validasi rentang ayat, capaian kumulatif, dan deteksi milestone
- **Rapor pesantren**: `rapor` (santri, tahun ajaran, semester, status) + `rapor_nilai` (per mapel: nilai + deskripsi capaian) + `rapor_hafalan` + `rapor_akhlak` + `rapor_catatan`
- **TKA**: `tryout_tka` (santri, mapel, tanggal, skor, rincian per-kompetensi)
- **Kalender**: `kalender_hijriah` (awal bulan Hijriah → tanggal Masehi, seed Kemenag, flag `provisional`)

`jenjang` menentukan modul mana yang berlaku: PAUD memakai `perkembangan` (observasi
naratif) alih-alih nilai angka; Paket A/B memakai `mata_pelajaran` + `nilai`. Hafalan
berlaku di semua jenjang dengan target berbeda.

- **Keuangan** (dibentuk dari temuan Bagian 9): `jenis_tagihan` (SPP, pendaftaran, uang gedung, sarpras, rapor, modul, PKBM) · `tagihan` (dengan `bulan_spp` **bulan Masehi**, `jatuh_tempo`, `prorata_mulai`, `keringanan`) · `pembayaran` (banyak per tagihan — cicilan sampai 6×, dengan `sumber`: wali / orang tua asuh) · `alokasi_prota` · `saldo_kredit` (lebih bayar) · `mutasi_bank` (dua kolom pemeriksa) · `kas` · `mukafaah` (periode **Hijriah**)
- **Lintas**: `pengumuman`, `audit_log` (siapa, kapan, dari mana)

### Matriks peran

| Peran        | Kemampuan                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------- |
| **admin**    | Penuh; kelola pengguna & pemetaan `telegram_id`                                              |
| **pengurus** | Baca semua; kelola data master, keuangan, undangan wali; semua fitur agent                   |
| **pengajar** | Tulis absensi/nilai/setoran **hanya** kelas/halaqah yang diampu; draft narasi rapor kelasnya |
| **wali**     | Baca-saja, **semua santri yang tertaut padanya** — tanpa perbedaan perlakuan                 |

Program orang tua asuh tidak memerlukan peran tersendiri: orang tua asuh **adalah** wali,
dan anak asuhnya sekadar santri yang tertaut padanya. Satu wali bisa punya kombinasi anak
kandung dan anak asuh dalam satu daftar yang sama.

Penegakan izin hanya ada di `packages/core`. Bot dan MCP server sama-sama memanggilnya.

---

## Bagian 1 — Bekerja Bergantian Antara Claude Code & opencode

Agent dipilih berdasarkan **ketersediaan saat itu**, bukan berdasarkan pembagian tugas.
Konsekuensinya: setiap sesi bisa dimulai oleh agent mana pun, dalam keadaan tanpa ingatan
apa pun dari sesi sebelumnya. Repo harus menanggung seluruh konteks itu sendiri.

### Dua berkas yang menanggung serah terima

- **`AGENTS.md`** — satu-satunya sumber instruksi. Dibaca opencode secara native;
  `CLAUDE.md` hanya berisi arahan membacanya. Tidak ada instruksi yang hanya hidup di
  satu format vendor.
- **`docs/STATE.md`** — kondisi terkini, ditulis dengan template tetap: apa yang baru
  selesai, apa yang sedang dikerjakan (dan sampai mana), langkah berikutnya, keputusan
  yang menggantung, dan jebakan yang baru ditemukan.
- **`docs/TUGAS.md`** — backlog berurutan dengan status dan **tanda bobot** `[ringan]` /
  `[berat]`. Agent yang sedang tersedia mengambil item teratas yang cocok, tanpa perlu
  bertanya. Tugas `[berat]` (pemodelan OLAP, aturan izin, skema) sebaiknya diambil saat
  model kuat tersedia; `[ringan]` (handler, migrasi, boilerplate) aman untuk siapa saja.

### Dua perintah yang menjaga ritual

```
npm run mulai    # cetak STATE.md + TUGAS.md teratas + git log terakhir + status test
npm run selesai  # build + lint + test, lalu ingatkan memperbarui STATE.md
```

`npm run mulai` membuat orientasi jadi satu perintah, bukan penelusuran. `npm run selesai`
membuat "selesai" punya arti yang sama bagi kedua agent.

### Aturan

1. **Test sebagai kontrak, bukan ingatan.** Selesai = build, lint, dan test hijau. Agent
   pengganti tidak perlu mempercayai narasi apa pun — ia menjalankan test.
2. **Satu tugas = satu commit yang meninggalkan repo dalam keadaan hijau.** Pergantian
   agent di tengah jalan jadi murah.
3. **Nol perkakas eksklusif.** Semua alur kerja jadi npm script — jalan di Claude Code,
   opencode, maupun terminal biasa.
4. **Keputusan arsitektur masuk `docs/adr/`, bukan hanya ke dalam percakapan.** Percakapan
   hilang saat sesi berganti; ADR tidak.
5. **Sesi berakhir dengan STATE.md diperbarui.** Sesi yang berakhir tanpa itu meninggalkan
   pekerjaan yang harus dibongkar ulang oleh agent berikutnya.

---

## Bagian 2 — Aliran Data

```
OLTP  Telegram ──► bot handler ──► core (izin) ──► SQLite     [deterministik, tanpa LLM]
                                                      │
                                                      ▼  worker, tiap malam
OLAP  bronze (Parquet) ──► silver (dim_* SCD2 + fact_*) ──► gold (mart_*)
                                                                │
                                    ┌───────────────────────────┼──────────────┐
                                    ▼                           ▼              ▼
                              Sheets (publish)             Metabase       mcp-server
                                                                               │
                                                             packages/agent ◄──┘  [baca-saja]
                                                                   │
                                              ├──► ringkasan berkala ──► grup pengurus
                                              └──► jawaban / draft ──► bot-internal

[dev] Claude Code / opencode ──MCP──► mcp-server ──► core (izin) ──► gold
```

Pemisahan OLTP/OLAP bukan sekadar soal performa: SQLite menyimpan keadaan sekarang,
lapisan OLAP menyimpan sejarahnya. Rinciannya di Bagian 3.

`packages/mcp-server` mengekspos tool baca bertipe — `rekap_absensi`, `progres_hafalan`,
`tunggakan_syahriah`, `cari_santri` — masing-masing menerima identitas pemanggil dan
melewatkannya ke `core` untuk penyaringan per-peran. **Tidak ada tool tulis, tidak ada tool
SQL bebas.** Model tidak pernah menyusun query mentah ke data santri.

---

## Bagian 3 — Lapisan OLAP (dipisahkan sejak awal)

**Masalah yang diselesaikan.** Menjalankan DuckDB langsung di atas tabel OLTP bukan lapisan
analitik — itu mesin query berbeda dengan model data yang sama. Skema OLTP menyimpan
_keadaan sekarang_: santri naik kelas, tarif syahriah berubah tiap tahun, pengajar berganti
halaqah — semuanya ditimpa di tempat. Setelah tertimpa, pertanyaan seperti _"bagaimana
kehadiran angkatan ini saat masih di Paket A?"_ atau _"tunggakan naik karena tarif berubah
atau karena kepatuhan menurun?"_ tidak bisa dijawab, secanggih apa pun mesin query-nya.

**Prinsipnya: pemodelan yang serius, orkestrasi yang sepele.** Dua keputusan terpisah —
skala Anda mengizinkan yang kedua tetap sederhana.

### Bronze — ekspor mentah

| Jenis tabel                                                             | Strategi                                                            | Alasan                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| Fakta (absensi, setoran, nilai, pembayaran)                             | Ekspor inkremental ke Parquet per bulan, tidak pernah ditulis ulang | Append-only; sudah kekal sejak lahir            |
| Mutable (santri, kelas, `jenis_tagihan`, status tagihan, `wali_santri`) | Snapshot harian                                                     | Sumber bahan SCD2; kecil sekali (ratusan baris) |

Biaya penyimpanan **~25 MB/tahun** — sejarah satu dekade penuh sekitar 250 MB di Drive.

### Silver — star schema

- **Fakta**: `fact_absensi` (grain: santri × sesi), `fact_setoran`, `fact_nilai`,
  `fact_tagihan`, `fact_pembayaran`, `fact_tryout_tka`
- **Dimensi SCD Type 2** persis di tempat yang berubah: `dim_santri` (kelas, jenjang, status),
  `dim_jenis_tagihan` (tarif per tahun ajaran), `dim_pengajar`
- **Dimensi statis**: `dim_mapel`, `dim_kelas`, `dim_wali`
- **`dim_waktu`**: tanggal Masehi **dan** Hijriah dimaterialisasi sekali dari tabel Kemenag,
  bukan dihitung ulang tiap query

`dim_waktu` yang memuat Hijriah membuka analisis yang mustahil kalau waktu hanya disimpan
Masehi — misalnya membandingkan kehadiran selama Ramadan dengan bulan biasa. Untuk
pesantren itu pertanyaan yang wajar.

### Gold — mart

Tabel pra-agregasi yang dibaca laporan Sheets, Metabase, `mcp-server`, dan agent:
`mart_kehadiran_bulanan`, `mart_progres_hafalan`, `mart_keuangan_santri`,
`mart_ringkasan_pekanan`, `mart_kesiapan_tka`.

Agent **hanya** membaca gold — bukan silver, bukan OLTP. Itu yang membuat aturan
"angka dari tool, kalimat dari model" bisa ditegakkan: angkanya sudah dihitung SQL.

### Pipeline — sengaja dibuat bodoh

Pada ~180.000 baris/tahun, **bangun ulang penuh tiap malam** selesai dalam hitungan detik.
Tidak ada incremental state, tidak ada watermark, tidak ada drift — idempoten karena
konstruksinya, bukan karena dijaga. Kompleksitas ditaruh di pemodelan, bukan orkestrasi.

Transformasi ditulis sebagai **berkas SQL polos** dijalankan runner TypeScript kecil yang
mengurutkan berdasarkan dependensi. **Tanpa dbt**: mesin incremental dan state-nya tidak
terpakai di skala ini, dan itu berarti menambah Python ke stack yang sudah diputuskan
TypeScript-saja. Lineage tetap dapat dihasilkan dari berkas SQL tersebut.

```
packages/analytics/
├── sql/
│   ├── bronze/   # muat parquet → tabel staging
│   ├── silver/   # dim_*, fact_*  (SCD2 di sini)
│   └── gold/     # mart_*
├── src/
│   ├── snapshot.ts   # SQLite → Parquet (inkremental + snapshot)
│   ├── pipeline.ts   # runner: urutan dependensi, idempoten, logging
│   └── query.ts      # API baca untuk mcp-server & agent (gold saja)
└── tests/            # uji kualitas data
```

### Uji kualitas data

Karena keluarannya masuk laporan ke wali dan berkas ke kementerian, pipeline gagal keras
bila salah satu tidak terpenuhi: tidak ada fakta yatim (FK ke dimensi selalu ketemu),
tidak ada duplikat pada grain tiap fakta, tepat satu baris SCD2 aktif per entitas,
`SUM(pembayaran) <= tagihan` per santri, tidak ada santri aktif di dua kelas sekaligus,
dan jumlah baris fakta tidak pernah menyusut antar-jalan.

---

## Bagian 4 — Onboarding Wali via Deep Link Telegram

Seluruh pengelolaan lewat Telegram, tanpa panel admin terpisah.

1. Pengurus di bot-internal: `/undang` → cari santri → pilih jenis hubungan
2. Bot membalas **pesan siap-teruskan** berisi nama santri + link
   `https://t.me/AnnuurWaliBot?start=<kode>` — tinggal forward ke WhatsApp/Telegram
3. Wali klik → bot-wali menerima `/start <kode>` → tautan dibuat otomatis → konfirmasi
4. Bot-internal memberi tahu pengurus: _"Kode untuk Ahmad Fauzi dipakai oleh @username (Budi S.)"_ + tombol **Cabut**

Deep link Telegram membawa payload sampai 64 karakter (`A-Za-z0-9_-`), jadi token acak
128-bit (22 karakter base64url) muat dengan lega.

**Tabel `undangan`**: `kode` · `santri_id` · `jenis_hubungan` · `dibuat_oleh` · `dibuat_pada`
· `kadaluarsa_pada` (default 7 hari) · `maks_pakai` (default 1) · `jumlah_terpakai` · `dicabut_pada`

**Satu wali, banyak santri** — ditangani alami: saat `/start <kode>` masuk, bot memeriksa
apakah `telegram_id` sudah terdaftar sebagai wali. Belum → buat record `wali` lalu tautkan.
Sudah → **tambahkan tautan santri baru** ke wali yang sama. Wali dengan 3 anak (kandung
maupun asuh) cukup menerima 3 link dan mengklik ketiganya. Sebaliknya satu santri bisa
punya ayah, ibu, dan orang tua asuh — masing-masing undangan terpisah.

Untuk pasangan ayah+ibu yang ingin satu link, `maks_pakai` disetel 2.

**Keamanan.** Link ini kredensial bawa-siapa-pun — memang itu yang diminta demi kemudahan,
dikendalikan empat lapis murah: sekali pakai + kadaluarsa 7 hari; token 128-bit tak
tertebak; notifikasi ke pengurus saat ditukarkan lengkap dengan identitas penukar; bisa
dicabut kapan saja.

**Perintah pengelolaan (bot-internal):** `/undang` · `/undangan` (daftar belum terpakai &
kadaluarsa) · `/cabut <kode>` · `/wali <santri>` · `/lepas`

---

## Bagian 5 — Irama Notifikasi

Dua audiens dengan aturan berbeda. Menyamakannya adalah cara tercepat membuat wali
berhenti membaca pesan pesantren.

### Pengurus — mingguan

Ringkasan berkala tiap Senin pagi ke grup internal. Mereka memang butuh gambaran rutin,
dan grup internal memang tempatnya.

### Wali — diam adalah default

Bot wali **tidak mengirim apa pun pada hari biasa**. Kalau seorang wali menerima pesan,
artinya betul-betul ada sesuatu. Keheningan itulah yang menjaga pesannya tetap dibaca.

| Jenis                 | Kapan                                                    | Frekuensi wajar                           |
| --------------------- | -------------------------------------------------------- | ----------------------------------------- |
| **Kejadian**          | Alpa tanpa keterangan (dikirim sore), sakit, izin pulang | Hanya bila terjadi — mayoritas hari sunyi |
| **Milestone hafalan** | Selesai juz atau surah                                   | Jarang per anak                           |
| **Tagihan**           | Saat terbit + satu pengingat **H-5**                     | Maksimal 2 per siklus                     |
| **Rekap bulanan**     | Akhir bulan — absensi, hafalan, nilai/perkembangan       | 1×/bulan                                  |
| **Tarik sendiri**     | `/anak` di bot-wali, kapan saja                          | Sesuka wali                               |

Milestone hafalan bukan hiasan: wali yang hanya dihubungi ketika anaknya bermasalah akan
berhenti membuka pesan. Kabar baik yang sesekali datang itu yang menjaga kanalnya hidup.

**Dua aturan teknis yang menegakkan janji di atas:**

1. Maksimal **satu pesan push per anak per hari** — beberapa kejadian digabung jadi satu.
2. Wali dengan beberapa anak menerima **satu pesan gabungan**, bukan satu per anak.

Ditambah `/notifikasi` di bot-wali untuk menyetel sendiri jenis mana yang ingin diterima.

Rekap bulanan wali memakai format tanggal ganda: **"Rabu, 12 Agustus 2026 (27 Safar 1448 H)"**.

---

## Bagian 6 — Batas Sistem terhadap Dapodik, e-Rapor & TKA

Sebagai lembaga yang menginduk ke PKBM, pesantren terikat pada beberapa sistem kementerian
yang **sudah menjadi sumber kebenaran resmi**: Dapodik/EMIS untuk data peserta didik,
Verval PD untuk NISN, e-Rapor kesetaraan untuk rapor, dan TKA untuk pemetaan mutu.

**SIAKAD punya rapor sendiri, dan datanya dirancang siap dipakai e-Rapor.**

Rapor pesantren memuat hal-hal yang memang tidak ada di e-Rapor — hafalan, akhlak, ibadah
praktis — sehingga tetap perlu dibuat. Yang dihindari bukan membuat rapor, melainkan
_membangun ulang format e-Rapor_: itu target bergerak yang mengikuti kebijakan kementerian.

Jadi pemisahannya: **satu kali entri di SIAKAD, dua keluaran.**

1. **Rapor pesantren** — lengkap, untuk wali: nilai mapel, hafalan, akhlak, catatan wali kelas
2. **Ekspor e-Rapor** — subset field yang sudah dipetakan ke struktur e-Rapor kesetaraan, siap disalin

Kolom `rapor_nilai` sengaja memuat _nilai_ **dan** _deskripsi capaian_ per mapel, karena
itulah dua hal yang diminta e-Rapor. Struktur ini yang membuat ekspor jadi pemetaan
sederhana, bukan penulisan ulang.

| Sistem             | Sumber kebenaran | Peran SIAKAD                                                          |
| ------------------ | ---------------- | --------------------------------------------------------------------- |
| Dapodik / EMIS     | Kementerian      | Menyimpan `nisn`/`nik`/`no_induk_pkbm`; ekspor data siap-unggah       |
| Verval PD          | Kementerian      | Menandai santri yang NISN-nya belum valid agar tidak terlewat         |
| e-Rapor kesetaraan | Kementerian      | Rapor SIAKAD dirancang agar nilai + deskripsi capaiannya siap disalin |
| TKA                | Kementerian      | Mencatat hasil tryout, memetakan kesiapan literasi & numerasi         |

Yang tersisa untuk SIAKAD justru bagian yang tidak ditangani sistem mana pun: operasional
harian — absensi, setoran hafalan, keuangan, dan komunikasi dengan wali.

### Persiapan TKA (disiapkan, dibangun belakangan)

TKA menguji Bahasa Indonesia (literasi), Matematika (numerasi), plus tiga mapel pilihan,
dan **bukan penentu kelulusan** melainkan pemetaan mutu. Karena itu nilainya bagi pesantren
ada pada _diagnostik_, bukan pada skor.

Model data disiapkan sejak Fase 1 (`tryout_tka`: santri, mapel, tanggal, skor, rincian
per-kompetensi) supaya tidak perlu migrasi belakangan, tapi fitur dibangun di Fase 5.
Ini pasangan yang sangat cocok untuk LLM: _"santri mana yang perlu penguatan numerasi
menjelang TKA"_ — pertanyaan yang berguna justru saat personil terbatas.

---

## Bagian 7 — Agent Pembantu Operasional

Empat fitur, semuanya menghasilkan **teks**, tidak satu pun menulis ke database.

| Fitur                   | Pemicu                            | Keluaran                                                                                        | Persetujuan                            |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Ringkasan berkala**   | Cron mingguan (worker)            | Narasi kondisi pesantren ke grup pengurus                                                       | — (baca-saja)                          |
| **Tanya-jawab laporan** | Pengurus bertanya di bot-internal | Jawaban + angka + link Sheet                                                                    | — (baca-saja)                          |
| **Draft pesan ke wali** | `/pesanmassal` di bot-internal    | Draft personal per-wali                                                                         | **Wajib** — pengurus review lalu kirim |
| **Draft isi rapor**     | `/rapor <kelas>` (pengajar)       | Deskripsi capaian per mapel + catatan wali kelas, disusun dari nilai harian + absensi + hafalan | **Wajib** — pengajar edit & setujui    |

**Ringkasan berkala** adalah fitur dengan dampak terbesar untuk tim kecil, karena tidak
menuntut pengurus ingat untuk bertanya. Contoh keluaran: _"Pekan ini 3 santri absen lebih
dari 3x (nama), tunggakan syahriah naik 12% menjadi Rp X, 5 santri belum setoran 2 pekan."_

**Draft pesan massal** menyasar pekerjaan yang diam-diam paling menghabiskan waktu:
mengirim pengingat tagihan ke puluhan wali, masing-masing dengan nama dan angka berbeda.
Draft disiapkan sekaligus, pengurus membaca dan menekan kirim. **Tidak ada auto-blast** —
pengiriman selalu tindakan manusia, dan dieksekusi kode deterministik.

### Pengaman grounding — "angka dari tool, kalimat dari model"

Untuk sistem yang memegang nilai santri dan uang pesantren, satu angka karangan sudah
cukup merusak kepercayaan. Tiga lapis:

1. **LLM tidak pernah berhitung.** `packages/analytics` menghitung seluruh agregat lewat
   SQL dan menyerahkannya sebagai JSON terstruktur. Prompt melarang aritmetika.
2. **Pemeriksaan pasca-generasi.** Setiap angka dalam teks keluaran dicocokkan dengan
   angka pada JSON masukan. Ada angka yang tidak bersumber dari sana → keluaran ditolak
   dan dibangkitkan ulang, atau jatuh ke template statis. Ini pemeriksaan regex sederhana
   dan menangkap persis kegagalan yang paling berbahaya.
3. **Nama dan identitas dari slot template**, bukan dari teks model.

Kalau LLM tidak tersedia atau gagal grounding, sistem **tetap mengirim laporan** dalam
format tabel polos. Fitur LLM memperbaiki keterbacaan; ia tidak pernah jadi titik gagal.

### Pilihan model per fitur

Volume runtime SIAKAD sangat kecil. Pada skala ini, menghemat model untuk fitur
jarang-pakai justru mengorbankan kualitas demi selisih beberapa sen. Karena itu:
**model bagus di semua tempat, hemat hanya di satu fitur yang benar-benar bulk.**

| Fitur               | Model             | Harga /1M (in/out) | Volume             | Perkiraan biaya | Alasan                                                                                                      |
| ------------------- | ----------------- | ------------------ | ------------------ | --------------- | ----------------------------------------------------------------------------------------------------------- |
| Ringkasan berkala   | Claude Sonnet 5   | $2 / $10           | 4×/bln             | ~$0.10/bln      | Dibaca pengurus untuk mengambil keputusan; prosa Indonesia & kepatuhan instruksi terbaik                    |
| Tanya-jawab laporan | GPT 5.6 Luna      | $0.20 / $1.20      | ~100/bln           | ~$0.12/bln      | Yang dibutuhkan tool-calling andal, bukan prosa indah; 10x lebih murah                                      |
| Draft pesan massal  | DeepSeek V4 Flash | $0.14 / $0.28      | ~130 wali × 4      | ~$0.08/bln      | Satu-satunya beban bulk; output pendek, berpola, direview manusia                                           |
| Rekap bulanan wali  | DeepSeek V4 Flash | $0.14 / $0.28      | 150 santri × 1/bln | ~$0.03/bln      | Sama: bulk, pendek, berpola                                                                                 |
| Draft isi rapor     | Claude Sonnet 5   | $2 / $10           | 150 santri × 2/thn | ~$1.05/semester | Tulisan tentang seorang anak, dibaca orang tuanya dan disalin ke e-Rapor — kualitas paling berharga di sini |

**Total runtime ≈ $0.50/bulan** pada skala 150 santri.

Pengembangan loop agent memakai model gratis (Big Pickle / DeepSeek V4 Flash Free) agar
iterasi prompt tidak membakar kredit.

**Pemicu naik kelas model:** tanya-jawab laporan dinaikkan ke Claude Sonnet 5 bila mulai
sering salah memilih tool MCP atau salah menyusun argumennya.

Harga dan nama model di atas dari dokumentasi opencode Zen per Agustus 2026 dan belum
diuji pada data pesantren berbahasa Indonesia — anggap titik awal.

### Portabilitas

Model ditentukan **per fitur** lewat env (`AGENT_BASE_URL`, `AGENT_API_KEY`, lalu
`AGENT_MODEL_RINGKASAN`, `AGENT_MODEL_TANYA`, `AGENT_MODEL_PESAN`, `AGENT_MODEL_REKAP`,
`AGENT_MODEL_RAPOR`).
Mengganti model atau pindah ke OpenRouter, Nous Portal, maupun model lokal tidak menyentuh
satu baris kode pun.

---

## Bagian 8 — Operasi oleh Tim Tanpa IT

Pesantren tidak punya staf IT. Rancangan yang menuntut orang menjalankan perintah,
membaca log, atau memperbaiki container tidak akan bertahan — ia akan berhenti dipakai
diam-diam. Karena itu setiap tugas berulang di bawah ini punya jalur yang bisa ditempuh
orang yang paham datanya tapi bukan orang teknis.

### Peta tugas

| Tugas                                 | Frekuensi           | Pelaku           | Caranya                                   |
| ------------------------------------- | ------------------- | ---------------- | ----------------------------------------- |
| Absensi, nilai, setoran hafalan       | Harian              | Pengajar         | Telegram                                  |
| Catat pembayaran                      | Harian              | Pengurus         | Telegram                                  |
| Undang wali                           | Sesekali            | Pengurus         | `/undang`                                 |
| **Tambah santri baru (massal)**       | Awal tahun          | Pengurus         | **Sheet Pola "Data Santri"**              |
| **Ubah tarif syahriah, kelas, mapel** | Tahunan             | Pengurus         | **Sheet Pola**                            |
| Perbarui kalender Hijriah             | 1× + 3× isbat/tahun | Admin            | `/kalender`, dipandu langkah demi langkah |
| Susun & terbitkan rapor               | Semesteran          | Pengajar         | `/rapor`                                  |
| Backup                                | Otomatis tiap malam | —                | Laporan mingguan ke pengurus              |
| Pulihkan data                         | Darurat             | Admin            | Salin satu berkas; panduan satu halaman   |
| Pantau kesehatan sistem               | Otomatis            | —                | Heartbeat harian + `/status`              |
| Tambah jenis laporan baru             | Jarang              | Pengurus sendiri | Metabase (GUI) atau tanya ke agent        |
| Ubah aturan bisnis / skema            | Jarang              | Developer        | Kode                                      |

Hanya baris terakhir yang benar-benar membutuhkan developer.

### Dua jenis Sheet, dan hanya dua

Google Sheets tetap dipakai, tapi perannya dipisah tegas. Menggabungkannya adalah asal-usul
spreadsheet yang tumbuh liar dan akhirnya hanya dipahami satu orang.

**1. Sheet Pola — masukan massal**

Memaksa 150 santri masuk lewat percakapan Telegram adalah siksaan. Untuk data massal,
permukaan yang tepat justru yang sudah mereka kuasai: spreadsheet.

- Sheet input berpola tetap: Data Santri, Wali, Kelas, Mapel, Tarif
- **Templatnya diterbitkan sistem, bukan disusun orang** — header, dropdown, validasi, dan
  kolom status semuanya dihasilkan kode (`npm run sheet:terbitkan`). Manusia hanya mengisi
  baris. Ini yang mencegah lahirnya kembali spreadsheet yang hanya dipahami satu orang.
- Worker mengimpor berkala, memvalidasi, lalu **menulis balik status per baris**:
  _"Baris 47 — NIK sudah dipakai santri lain (Ahmad Fauzi)"_
- **Satu arah saja.** Sheet adalah formulir, bukan cermin database. Sinkronisasi dua arah
  selalu berakhir dengan konflik yang tak seorang pun bisa selesaikan.
- Baris gagal validasi ditolak utuh, tidak diimpor sebagian

**2. Sheet Laporan — keluaran, sepenuhnya dihasilkan**

- Diterbitkan sistem, **tidak pernah disunting tangan**, dan diproteksi agar tidak bisa
- Kalau angkanya keliru, yang diperbaiki datanya — bukan sheet-nya

Alasan proteksi ini bukan formalitas: bila manusia menyunting sheet yang juga ditulisi
sistem, suntingannya tertimpa pada jalan berikutnya. Sekali itu terjadi, orang berhenti
mempercayai angkanya — dan seluruh lapisan pelaporan kehilangan gunanya.

**Tidak ada jenis ketiga.** Sheet kendali atau pemantauan yang dipelihara manual sengaja
tidak dibuat: begitu laporan terbit otomatis dan pertanyaan bisa diajukan ke agent, sheet
semacam itu berhenti dirawat dan berubah jadi sumber angka basi yang menyesatkan.

### Sheets adalah jalur pengecualian, bukan jalur rutin

Penggunaan Sheets dibatasi pada dua keperluan: **entri massal** dan **koreksi angka** yang
tidak bisa ditempuh alur normal — misalnya karena model bisnis berubah di tengah jalan.
Operasional harian tetap lewat Telegram.

**Koreksi angka menuntut pengawasan paling ketat di seluruh sistem**, karena ia mengubah
data keuangan di luar alur biasa. Aturannya, meminjam kontrol empat mata yang sudah
berjalan di pesantren (`Cek Abu Sahlah` / `Cek Abu Husain` pada mutasi bank):

1. Sheet koreksi **tidak pernah menulis langsung** ke database — ia menghasilkan _usulan koreksi_
2. Setiap usulan wajib memuat **alasan**; tanpa alasan, ditolak
3. Usulan harus **disetujui orang kedua** lewat Telegram — pengusul tidak bisa menyetujui usulannya sendiri
4. Nilai **sebelum dan sesudah** tersimpan permanen di `audit_log`, tidak bisa dihapus
5. Ringkasan seluruh koreksi bulan berjalan masuk ke laporan pekanan pengurus — koreksi tidak boleh sunyi

Konsekuensinya disengaja: koreksi manual jadi mungkin, tapi tidak pernah mudah dan tidak
pernah tidak terlihat.

### Sistem yang mengurus dirinya sendiri

| Risiko                     | Penanganan otomatis                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container mati             | `restart: unless-stopped` + healthcheck; watchdog memberi tahu Telegram bahwa layanan sudah dinyalakan ulang                                        |
| Rilis baru butuh migrasi   | Migrasi jalan saat container start, didahului backup otomatis; gagal → rollback + pesan Telegram                                                    |
| Backup tidak pernah teruji | **Uji pulih otomatis mingguan** — pulihkan ke instans sementara, jalankan `integrity_check`, laporkan _"Backup 8 Agustus terbukti bisa dipulihkan"_ |
| Uji kualitas data gagal    | Laporan tertunda, pengurus diberi tahu **beserta nama santri yang bermasalah** dan cara memperbaikinya                                              |
| Kredensial habis/keliru    | `/diagnosa` menyebut kredensial mana yang bermasalah dalam bahasa biasa                                                                             |
| Tabel Hijriah mau habis    | Peringatan 60 hari sebelumnya; pengingat otomatis menjelang tiap sidang isbat                                                                       |

### Aturan bahasa

Setiap pesan yang bisa sampai ke pengguna ditulis substantif, bukan teknis.

> ❌ `SQLITE_CONSTRAINT: UNIQUE constraint failed: santri.nik`
> ✅ _"NIK 3276… sudah dipakai santri lain (Ahmad Fauzi). Periksa baris 47 di Sheet Data Santri."_

> ❌ `pipeline failed at silver/dim_santri.sql: duplicate active SCD2 row`
> ✅ _"Laporan pekanan tertunda: 3 santri terdaftar di dua kelas sekaligus (Ahmad, Fatimah, Yusuf). Perbaiki di Sheet Data Santri, lalu ketik /ulangi."_

Ini bukan kosmetik. Pesan yang tidak bisa ditindaklanjuti pengurus berarti sistem berhenti
sampai developer sempat menengok — dan itulah cara sistem kecil mati perlahan.

---

## Bagian 9 — Temuan Pembacaan Spreadsheet Lama

Dibaca 8 Agustus 2026 dari file **04. DATABASE KEUANGAN TA 1446-1447 (2026-2027)**.
_Cakupan: ekspor ~656 rb karakter dari berkas ~1 MB, kemungkinan belum seluruhnya; nama
sheet tidak terbawa ekspor sehingga tabel dipetakan lewat header. File 03 belum dibaca._

### Struktur yang ditemukan

| Tabel                       | Peran                                | Catatan                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master`                    | Master data                          | Memuat ~8 tabel tak berhubungan berdampingan horizontal: bulan, tanggal, santri (Banin/Banat/RA terpisah), mudaris, dropdown, biaya, konsep pemasukan-pengeluaran, **plus blok berformat EMIS** (`nism, nisn, nik, …, is_locked, is_bebas_spp, spp_khusus`). Ada jejak **"INTEGRASI TAYSIR"** |
| Transaksi                   | Jurnal pemasukan **dan** pengeluaran | ~31 kolom, hanya ~8 dientri. Sheet menandai sendiri asal kolom: `Entri` / `Auto` / `Khusus PROTA`. Ada kolom mati (`DELL`) dan penolong format (`Bulan Alfa`, `No Based TGL`)                                                                                                                 |
| Kartu Kendali               | Kartu tagihan per santri             | Pos biaya ganda (tagihan vs terbayar) + `TOTAL TUNGGAKAN` + flag bantuan pendidikan                                                                                                                                                                                                           |
| Potensi / pembayaran lain   | Referensi & proyeksi                 | Potensi SPP per marhalah & kelas, realisasi, persentase penagihan (~70%)                                                                                                                                                                                                                      |
| MutasiBSI                   | Rekonsiliasi bank                    | Kolom `Cek Abu Sahlah` & `Cek Abu Husain`                                                                                                                                                                                                                                                     |
| Kendali all / online        | Laporan                              | Murni turunan — **inilah yang menjadi obsolete** begitu laporan terbit otomatis                                                                                                                                                                                                               |
| autoCrat, CetakKartuKendali | Cetak kartu                          | Add-on + pivot                                                                                                                                                                                                                                                                                |

### Aturan bisnis yang tidak terdokumentasi di mana pun

Semua ini terbaca dari anotasi kolom dan isi data, bukan dari dokumen:

1. **Dua skema periode SPP hidup berdampingan** — lama berlabel Hijriah (`1. Syawal 1446 H` … `12. Ramadhan 1447 H`), baru berlabel Masehi (`1. April 2026` … `15. Juni 2027`). Peralihan terjadi ~April 2026; deretan baru berjumlah 15 karena masa transisi. Rincian & konsekuensi migrasinya di Bagian 10
2. **Cicilan sampai 6 kali** per tagihan (`Cicilan ke - (Max 6)`)
3. **Prorata dari bulan mulai KBM**; `0 = belum masuk atau keluar KBM`
4. **Lebih Bayar** — saldo kredit santri harus dimodelkan
5. **PROTA = Program Orang Tua Asuh** — dana donatur yang dialokasikan menutup SPP santri asuhnya. Ini sisi keuangan dari `jenis_hubungan = 'asuh'`: keduanya hal yang sama dilihat dari dua arah
6. **Kontrol empat mata** pada mutasi bank oleh dua pemeriksa bernama
7. **Keringanan** lewat flag bantuan pendidikan + `is_bebas_spp` / `spp_khusus`
8. Jenjang riil: **RA-PAUD, MI Banin, MI Banat** — bukan `paket_a`/`paket_b`. SPP PAUD 100rb, RA 150rb
9. **`Biaya PKBM`** sudah menjadi pos biaya tersendiri

### Kondisi data — kerusakan yang sudah terjadi

Hasil hitung atas ekspor file 04 (parsial, sudah diratakan — angka menunjukkan **struktur**,
bukan agregat bisnis):

| Sinyal              | Jumlah     |
| ------------------- | ---------- |
| `#N/A`              | **4.695**  |
| `#VALUE!`           | 404        |
| `#REF!`             | 170        |
| **Total sel rusak** | **~5.269** |
| Sel `[merged]`      | 7.105      |

**Kecenderungannya bukan menuju kegagalan, melainkan menuju kesalahan yang senyap** — dan
itu sebabnya berbahaya. `#N/A` sebanyak itu berarti lookup gagal di mana-mana; karena Kartu
Kendali dan seluruh laporan kendali adalah **turunan lewat lookup**, kegagalannya merambat
ke angka yang dibaca orang untuk mengambil keputusan. Spreadsheet tidak akan mogok — ia
terus menampilkan angka, sebagian keliru, tanpa ada cara memeriksa yang mana.

Digabung dengan pengetahuan yang hanya dipegang satu orang, hasilnya sistem yang tidak
dapat diaudit siapa pun selain orang itu. Berkas ini terakhir diubah **8 Agustus 2026** —
pekerjaan sedang berjalan di atas fondasi yang sudah retak.

**Karena itu migrasi ini lebih dekat ke penyelamatan daripada peningkatan**, dan rekonsiliasi
saat impor bukan formalitas: sebagian angka lama memang sudah salah, dan selisihnya harus
dijelaskan satu per satu, bukan diratakan.

### Kerapuhan struktural yang harus diselesaikan, bukan diwarisi

- **Santri dikenali lewat nama** (entri teks bebas); NIS hanya hasil lookup. Salah ketik → transaksi tak bertuan. Di SIAKAD, transaksi **wajib** mengacu ke `santri_id`; nama hanya tampilan
- Master santri terpecah tiga (Banin/Banat/RA) dengan penomoran terpisah
- Kolom turunan bercampur kolom entri dalam satu tabel
- Penggunaan sel merge yang masif membuat data tidak terbaca mesin

### Temuan operasional

- **Tunai masih signifikan** — Transfer Bank 82 berbanding Cash 52 dalam data terbaca. Sekitar 4 dari 10 pembayaran tunai, sehingga sistem **tidak boleh mengandaikan mutasi bank mencakup seluruh penerimaan**. Jalur tunai perlu pencatatan dan rekonsiliasi tersendiri
- **Rasio penagihan sangat timpang** — persentase yang muncul tersebar dari 30% sampai 94%. Bila ini rasio per marhalah, ada kelompok yang tertagih hampir penuh dan ada yang sepertiga. Ini pertanyaan pertama yang layak diajukan ke agent begitu data bersih

### Dampak pada rencana

- `jenjang` disesuaikan ke istilah yang benar-benar dipakai (RA-PAUD, MI Banin, MI Banat), dengan pemetaan ke nomenklatur kesetaraan untuk keperluan ekspor
- `tagihan` perlu `bulan_hijriah`, `prorata_mulai`, `keringanan`, dan relasi satu-ke-banyak ke `pembayaran` (cicilan)
- Perlu tabel `saldo_kredit` untuk lebih bayar
- Alur rekonsiliasi bank mempertahankan **dua pemeriksa** — kontrol internal yang sudah berjalan tidak boleh hilang karena digantikan sistem
- Blok EMIS di `master` adalah **hadiah**: bentuk ekspor yang dibutuhkan sudah terlihat, tinggal dipetakan

### PROTA — Program Orang Tua Asuh

Menutup lingkaran dengan Bagian 4: orang tua asuh adalah **wali** dengan
`jenis_hubungan = 'asuh'`, dan PROTA adalah sisi keuangannya. Dampak skema:

- `pembayaran.sumber` — `wali` | `orang_tua_asuh` | `lainnya`
- `alokasi_prota` — satu setoran donatur dapat dialokasikan ke beberapa santri dan beberapa bulan; butuh relasi alokasi tersendiri, bukan sekadar kolom
- Laporan yang lahir dari ini: berapa santri tersponsori, berapa dana PROTA masuk versus teralokasi, dan santri mana yang sponsornya akan habis
- Wali kandung tetap melihat tagihan anaknya lunas tanpa perlu tahu identitas donatur — kecuali pesantren memutuskan sebaliknya

### TAYSIR — titik integrasi yang ditandai, bukan diabaikan

Jejak "INTEGRASI TAYSIR" di sheet `master` menunjukkan ada sistem lain yang pernah atau
masih bertukar data. **Ditandai sebagai integrasi terbuka**: sebelum skema `contracts`
dikunci, perlu dipastikan apakah TAYSIR masih hidup, arah pertukarannya ke mana, dan
field apa yang menjadi kunci pencocokan. Kalau ternyata mati, dicatat mati — supaya tidak
ada yang menghidupkannya kembali karena mengira ia masih dipakai.

### Yang masih harus ditanyakan ke pemegang pengetahuan

Status **TAYSIR** · aturan penetapan besaran **keringanan** · perlakuan santri yang keluar
di tengah tahun · apakah sisa dana PROTA yang tidak teralokasi dikembalikan atau digulirkan

---

## Bagian 10 — Benturan Kalender Hijriah vs Masehi

**Dikonfirmasi pengurus (8 Agustus 2026): tagihan SPP memakai kalender Masehi.**
Mukafaah pengajar tetap mengikuti siklus Hijriah.

Konsekuensi pertama, dan melegakan: **persoalan "dua tagihan dalam satu bulan Masehi tidak
ada.** Dengan 12 tagihan per tahun Masehi, jumlahnya selalu tepat 12 dan tidak pernah
bergeser. Seluruh mekanisme deteksi & peringatan untuk itu **dibatalkan** — tidak perlu
dibangun.

`tagihan.bulan_spp` karenanya bertipe **bulan Masehi** (`2026-08`), bukan kunci Hijriah.
Label Hijriah pada spreadsheet lama diperlakukan sebagai **penamaan periode**, bukan
definisi periode.

### Sisa persoalan: pendapatan 12 periode, biaya 12,37 periode

Yang tidak hilang adalah selisih ritme antara dua sisi buku. Tahun Hijriah 354,4 hari,
Masehi 365,2 hari — selisih **3,07%**. Bila SPP ditagih 12 kali per tahun Masehi sementara
mukafaah dibayar 12 kali per tahun Hijriah (setara 12,37 kali per tahun Masehi), maka
**periode biaya lebih banyak 3% daripada periode pendapatan**.

Ini bukan cacat yang harus diperbaiki sistem — bisa saja sudah diperhitungkan dalam
penetapan tarif. Yang perlu sistem lakukan hanya **membuatnya terlihat**, sesuatu yang
mustahil di spreadsheet lama:

- Laporan keuangan menyajikan pendapatan dan mukafaah pada **sumbu waktu Masehi yang sama**, sehingga selisih ritme tampak sebagai pola, bukan sebagai kejutan di bulan tertentu
- Sekitar sekali tiap 2,7 tahun akan ada bulan Masehi berisi **dua siklus mukafaah**; sistem memberi tahu pengurus dua bulan sebelumnya agar arus kasnya disiapkan
- `dim_waktu` memuat kedua kalender, sehingga perbandingan lintas-ritme ini bisa dihitung sama sekali

Perhatikan pembalikannya: persoalan pergeseran kalender berpindah dari sisi **tagihan wali**
ke sisi **pembayaran mukafaah** — dan di sana ia jauh lebih ringan, karena yang terdampak
satu pihak yang bisa merencanakan, bukan ratusan keluarga.

### Terverifikasi: pesantren sedang berpindah skema, dan dua skema hidup berdampingan

Pembacaan file 04 menemukan **dua skema penomoran periode SPP dalam berkas yang sama**:

| Skema              | Rentang                                    | Jumlah periode |
| ------------------ | ------------------------------------------ | -------------- |
| **Lama — Hijriah** | `1. Syawal 1446 H` → `12. Ramadhan 1447 H` | 12             |
| **Baru — Masehi**  | `1. April 2026` → `15. Juni 2027`          | **15**         |

Ini membenarkan konfirmasi pengurus: label Hijriah adalah **skema lama yang masih tersimpan**,
bukan praktik berjalan. Peralihan terjadi sekitar April 2026.

**Deretan baru berjumlah 15, bukan 12** — indikasi masa transisi: tiga bulan (April–Juni 2026)
menutup ekor tahun lama, lalu Juli 2026–Juni 2027 menjadi tahun ajaran penuh yang selaras
dengan kalender sekolah Indonesia. Bila benar, pesantren tidak sekadar pindah kalender
melainkan sekaligus **menggeser awal tahun ajaran ke Juli** — dan itu perlu dipastikan,
karena menentukan batas `tahun_ajaran` di skema.

### Konsekuensi untuk migrasi

Importer **wajib menangani kedua skema** dan memetakannya ke satu garis waktu:

- Transaksi berlabel Hijriah (sampai ~Maret 2026) dipetakan lewat tabel `kalender_hijriah`
- Transaksi berlabel Masehi (April 2026 dan sesudahnya) dipakai apa adanya
- **Periode transisi 15 bulan disimpan apa adanya**, tidak dinormalkan paksa menjadi 12 — memaksakan keseragaman di sini akan menghilangkan atau menggandakan tagihan nyata
- `tagihan` menyimpan `skema_periode` (`hijriah` | `masehi`) agar asal-usul tiap baris tetap dapat ditelusuri saat rekonsiliasi Fase 5

Tabel `kalender_hijriah` tetap diperlukan — bukan lagi untuk penagihan berjalan, melainkan
untuk **membaca data historis** dan untuk mukafaah.

### Kapan pergeseran itu terjadi — kini berlaku untuk mukafaah, bukan tagihan

Terverifikasi dari data. Awal bulan Hijriah merayap mundur ~1 hari tiap bulan Masehi —
terlihat langsung pada urutan di spreadsheet: Syawal mulai **30** Maret, Dzulqodah **29**
April, Dzulhijjah **28** Mei, Muharram **26** Juni, Shafar **26** Juli, Rabiul Akhir **23**
September, Jumadil Awal **23** Oktober, Rajab **21** Desember, Sya'ban **20** Januari,
Ramadhan **18** Februari.

Dihitung maju dari jangkar Ramadhan 1447 H = 18 Februari 2026, inilah bulan-bulan Masehi
yang akan memuat **dua siklus mukafaah**:

| Bulan Masehi     | Dua awal bulan Hijriah |
| ---------------- | ---------------------- |
| **Oktober 2027** | ~2 Okt dan ~31 Okt     |
| Juli 2030        | ~2 Jul dan ~31 Jul     |
| April 2033       | ~1 Apr dan ~30 Apr     |
| Desember 2035    | ~1 Des dan ~31 Des     |
| Agustus 2038     | ~2 Agu dan ~31 Agu     |

Jarak 32–33 bulan, cocok dengan hitungan teoretis: 365,24 ÷ 29,53 = 12,368 awal bulan per
tahun Masehi, kelebihan 0,368 → satu kejadian tiap 2,7 tahun.

**Yang pertama sekitar 14 bulan setelah rencana ini ditulis** — tak lama setelah sistem
hidup, jadi penanganannya tidak bisa ditunda ke "nanti".

**Peringatan penting:** hitungan di atas tabular dan bisa meleset ±1 hari dari hisab Kemenag.
Untuk kasus yang menempel di tanggal 1 atau 31, selisih satu hari membalikkan jawabannya.
**Deteksi wajib berjalan di atas tabel `kalender_hijriah` yang nyata, bukan rumus** — dan
inilah pembenaran terkuat mengapa tabel itu berstatus kritis.

### Menangani bulan dengan dua siklus mukafaah

Sistem mendeteksinya jauh hari dan memberi tahu pengurus **dua bulan sebelumnya**:

> _"Oktober 2027 akan memuat dua siklus mukafaah. Kebutuhan kas bulan itu naik sekitar dua kali lipat dari biasanya."_

Ini murni peringatan arus kas — tidak ada keputusan penagihan yang perlu diambil, dan wali
tidak terdampak sama sekali. Jauh lebih ringan daripada bila pergeseran ini jatuh di sisi
tagihan.

---

## Bagian 11 — Perlindungan Data Pribadi

Sistem ini memegang data pribadi **anak di bawah umur**: NIK santri dan wali, tanggal lahir,
alamat rumah, nomor HP, dan nomor rekening bank. UU PDP (UU 27/2022) sudah berlaku penuh,
dan pesantren berkedudukan sebagai **pengendali data**. NIK termasuk data yang diatur ketat.

### Aturan yang tidak bisa ditawar

1. **LLM tidak pernah melihat NIK, NISN, atau nomor rekening.** Tool MCP menyaringnya di
   `core` sebelum data keluar — bukan mengandalkan prompt untuk menahan diri. Model tidak
   membutuhkannya untuk menyusun laporan apa pun, dan sekali data itu masuk ke prompt, ia
   keluar dari kendali pesantren.
2. **Minimalisasi di setiap keluaran.** Laporan, Sheet publikasi, dan pesan Telegram memuat
   nama dan angka seperlunya — tidak pernah NIK atau rekening.
3. **NIK hanya terlihat oleh admin dan pengurus keuangan.** Pengajar tidak perlu, wali hanya
   melihat milik anaknya sendiri.
4. **Setiap akses ke data sensitif tercatat** di `audit_log` — siapa, kapan, untuk apa.
5. **Backup ke Drive dienkripsi** sebelum diunggah; kunci tidak ikut tersimpan di Drive.
6. **Wali hanya melihat anaknya** — sudah ditegakkan di `core`, dan diuji, bukan diasumsikan.

### Yang perlu diputuskan pesantren, bukan oleh sistem

- **Persetujuan wali** atas pengolahan data anak, dan bentuk pemberitahuannya
- **Retensi**: berapa lama data santri yang sudah keluar/alumni disimpan, dan apa yang dihapus
- **Akses wali setelah santri keluar** — masih bisa melihat riwayat, atau ditutup
- Siapa yang berperan sebagai penanggung jawab data di pesantren

### Bus factor sistem baru

Masalah "hanya satu orang yang paham" tidak selesai hanya dengan memindahkannya ke sistem
yang lebih rapi. Yang menjaganya di sini: seluruh pengetahuan hidup sebagai markdown di
`docs/`, seluruh pekerjaan sebagai npm script, panduan pemulihan ditulis untuk pembaca
non-teknis, dan **uji panduan** di bagian Verifikasi yang mensyaratkan orang lain benar-benar
bisa mengikutinya. Kalau uji itu tidak pernah dijalankan, bus factor-nya kembali menjadi satu.

---

## Bagian 12 — Rancangan Akademik

**Akademik adalah lahan kosong, bukan migrasi.** Pencarian Drive tidak menemukan sistem
akademik apa pun — hanya satu berkas "nilai per orang" berukuran 1 KB yang praktis kosong.
Seluruh spreadsheet aktif adalah keuangan. Karena itu tidak ada data lama yang bisa
memberitahu aturan mainnya seperti yang terjadi pada keuangan; semuanya dirancang dari awal.

Sinyal struktur yang tersedia berasal dari sheet `master` file 04: pembedaan tegas antara
`Pengajar Diniyah` dan `Pengajar Umum`, kolom `HALAQOH` yang terpisah dari `Kelas`, peran
`Wali Kelas`, hingga `Mapel 1`–`Mapel 5` per mudaris.

### Pengelompokan: santri berada di dua tempat sekaligus

| Entitas   | Untuk                       | Penanggung jawab            |
| --------- | --------------------------- | --------------------------- |
| `kelas`   | Pembelajaran diniyah & umum | Wali kelas + pengajar mapel |
| `halaqah` | Tahfidz                     | Mudaris/mudarisah           |

Keanggotaan disimpan terpisah (`santri_kelas`, `santri_halaqah`) per tahun ajaran, dan
keduanya menjadi dimensi SCD2 di lapisan OLAP — sehingga pertanyaan _"bagaimana capaian
angkatan ini saat masih di halaqah lama"_ tetap bisa dijawab.

`marhalah` mengikuti istilah yang dipakai pesantren: **RA-PAUD, MI Banin, MI Banat**.

### Absensi — dua aliran, masing-masing sekali sehari

Grain: **santri × tanggal × konteks**, dengan `konteks` ∈ `halaqah` | `kelas`.
Status: `hadir` | `sakit` | `izin` | `alpa`. Kunci unik pada ketiga kolom itu.

Dipisah karena mudaris dan pengajar kelas adalah orang berbeda, dan santri bisa hadir di
satu tapi tidak di lainnya — kenyataan yang hilang bila hanya dicatat per hari.

**Alur entri menentukan hidup-matinya fitur ini.** Absensi per sesi ditolak justru karena
bebannya membuat pengajar berhenti mengisi, dan absensi yang tidak diisi lebih buruk
daripada absensi kasar. Maka:

> `/absen` → pilih rombel → seluruh santri **sudah tercentang hadir** → pengajar hanya
> menandai yang tidak hadir → kirim.

Untuk halaqah berisi 10–15 santri, ini beberapa ketukan. Default hadir bukan kemalasan
desain — itu yang membuat pengisian harian bertahan lebih dari dua pekan.

**`kalender_akademik` diperlukan**: tanpa daftar hari KBM dan libur, sistem tidak bisa
membedakan santri yang mangkir dari hari yang memang tidak ada kegiatan — dan seluruh
angka kehadiran menjadi tidak bermakna.

### Nilai — dua jalur, satu rapor

`mata_pelajaran.jalur` ∈ `diniyah` | `umum`.

| Jalur     | Penilaian                                                            | Muara                                       |
| --------- | -------------------------------------------------------------------- | ------------------------------------------- |
| `umum`    | Kurikulum Merdeka: formatif & sumatif, capaian pembelajaran per fase | Rapor pesantren **dan** ekspor e-Rapor PKBM |
| `diniyah` | Penilaian pesantren sendiri                                          | Rapor pesantren saja                        |

PAUD tidak memakai nilai angka — memakai `perkembangan`, yaitu observasi naratif.

Rapor yang diterima wali menggabungkan keduanya plus hafalan dan akhlak; ekspor e-Rapor
menyaring `jalur = umum`. Satu kali entri, dua muara — pola yang sama dengan keuangan.

### Setoran hafalan — ziyadah dan murojaah dibedakan

`setoran`: santri · mudaris · tanggal · `jenis` (`ziyadah` | `murojaah`) · surah ·
`ayat_mulai` · `ayat_selesai` · kualitas · catatan.

Pembedaan ini penting karena keduanya mengukur hal berbeda: **ziyadah** menunjukkan
capaian yang bertambah, **murojaah** menunjukkan kedisiplinan menjaga — dan justru yang
kedua yang biasanya bermasalah, sekaligus yang tidak terlihat bila hanya capaian dicatat.

Diperlukan **tabel rujukan Al-Qur'an** (114 surah beserta jumlah ayat dan batas juz).
Tabel kecil dan statis, tapi membukakan banyak hal: validasi rentang ayat, hitungan
capaian kumulatif, dan **deteksi milestone** — selesai satu surah atau satu juz — yang
menjadi pemicu notifikasi membanggakan ke wali di Bagian 5.

### Peran akademik

| Peran             | Kewenangan tulis                                  |
| ----------------- | ------------------------------------------------- |
| Mudaris/mudarisah | Setoran + absensi **halaqah** miliknya            |
| Pengajar mapel    | Nilai + absensi **kelas** untuk mapel yang diampu |
| Wali kelas        | Tambahan: menyetujui rapor kelasnya               |

Satu orang dapat memegang beberapa peran sekaligus. Seluruhnya ditegakkan di `core`,
sama seperti izin lainnya.

### Kerangka tabel

**Prinsip: yang belum diketahui dibuat sebagai baris, bukan kolom.** Daftar mata pelajaran,
skala nilai diniyah, aspek akhlak, dan hari KBM semuanya tabel seed — bukan enum di skema.
Mendetailkannya nanti cukup entri data lewat Sheet Pola, tanpa migrasi dan tanpa rilis baru.

**Struktur**

```
tahun_ajaran      id · kode "2026/2027" · mulai · selesai · aktif
marhalah          id · kode (ra_paud|mi_banin|mi_banat) · nama
kelas             id · tahun_ajaran_id · marhalah_id · nama · fase · wali_kelas_id
halaqah           id · tahun_ajaran_id · nama · mudaris_id
santri_kelas      santri_id · kelas_id · mulai · selesai        ⟵ sumber SCD2
santri_halaqah    santri_id · halaqah_id · mulai · selesai      ⟵ sumber SCD2
pengajar          id · no_induk · nama · aktif
pengajar_peran    pengajar_id · tahun_ajaran_id · peran (mudaris|pengajar_mapel|wali_kelas)
```

**Kurikulum — seluruhnya seed, diisi menyusul**

```
mata_pelajaran    id · kode · nama · jalur (diniyah|umum) · marhalah_id? · aktif
pengampu          pengajar_id · mata_pelajaran_id · kelas_id · tahun_ajaran_id
skala_nilai       id · jalur · kode · nama · batas_bawah · batas_atas · predikat
aspek_akhlak      id · kode · nama · urutan · aktif
kalender_akademik tanggal · tahun_ajaran_id · jenis (kbm|libur|ujian) · keterangan
```

**Aktivitas**

```
absensi        id · santri_id · tanggal · konteks (halaqah|kelas) · ref_id
               · status (hadir|sakit|izin|alpa) · dicatat_oleh · catatan
               UNIQUE (santri_id, tanggal, konteks)

setoran        id · santri_id · halaqah_id · mudaris_id · tanggal
               · jenis (ziyadah|murojaah) · surah_no · ayat_mulai · ayat_selesai
               · kualitas · catatan

nilai          id · santri_id · mata_pelajaran_id · kelas_id · tanggal
               · jenis (formatif|sumatif) · nilai · deskripsi

perkembangan   id · santri_id · tanggal · aspek · observasi      ⟵ PAUD, naratif
```

**Rujukan statis**

```
quran_surah      nomor (1–114) · nama · nama_latin · jumlah_ayat
quran_juz_batas  juz · surah_mulai · ayat_mulai · surah_selesai · ayat_selesai
```

**Tidak disimpan — dihitung di lapisan OLAP**

Capaian hafalan diturunkan dari `setoran` berjenis `ziyadah`; milestone diturunkan dari
capaian itu terhadap `quran_juz_batas`. Keduanya sengaja tidak disimpan sebagai kolom agar
tidak pernah bisa menyimpang dari catatan setorannya — kesalahan yang persis terjadi pada
Kartu Kendali di sistem lama.

### Yang menyusul, dan bagaimana mengisinya

| Belum diketahui                            | Cara mengisi nanti             |
| ------------------------------------------ | ------------------------------ |
| Daftar mata pelajaran per jalur & marhalah | Sheet Pola `Mata Pelajaran`    |
| Skala nilai diniyah                        | Sheet Pola `Skala Nilai`       |
| Aspek penilaian akhlak                     | Sheet Pola `Aspek Akhlak`      |
| Hari & jam KBM, hari libur                 | Sheet Pola `Kalender Akademik` |

Tidak satu pun menuntut perubahan skema — semuanya entri data oleh pengurus.

---

## Bagian 13 — Usulan Skill (`/skills/*/SKILL.md`, format terbuka)

`.claude/skills` hanya symlink ke sini, sehingga skill tetap terpakai bila Claude ditinggalkan.

| #   | Skill                | Isi                                                                                                                                                                             |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `siakad-domain`      | Glosarium pesantren (halaqah, setoran, syahriah, mustawa), aturan bisnis, matriks peran, konvensi tahun Hijriah                                                                 |
| 2   | `agent-handoff`      | Cara memperbarui `docs/STATE.md`, granularitas commit, definisi selesai                                                                                                         |
| 3   | `sqlite-migration`   | Konvensi migrasi, WAL, penamaan Bahasa Indonesia, indeks, backfill aman                                                                                                         |
| 4   | `olap-model`         | Konvensi gudang data: penamaan bronze/silver/gold, aturan grain fakta, pola SCD Type 2, cara menambah mart, dan uji kualitas yang wajib menyertainya                            |
| 5   | `sheets-publisher`   | Publish ke Sheets: format, freeze header, proteksi range, share, kuota API                                                                                                      |
| 6   | `telegram-flow`      | Konvensi grammY: command, role guard, state percakapan, deep link, error                                                                                                        |
| 7   | `mcp-tool`           | Menambah tool MCP: skema, scope peran wajib, larangan SQL bebas, audit                                                                                                          |
| 8   | `agent-prompt`       | Konvensi prompt: aturan grounding, format JSON masukan, larangan aritmetika, gaya bahasa laporan                                                                                |
| 9   | `wali-copy`          | Nada & template pesan Bahasa Indonesia ke wali — sopan, ringkas, terbaca di HP                                                                                                  |
| 10  | `pesan-substantif`   | Aturan menulis pesan galat & notifikasi: sebut apa yang salah dan apa yang harus dilakukan, sebut nama entitas bukan ID, jangan pernah membocorkan pesan teknis ke pengguna     |
| 11  | `sheet-pola`         | Konvensi Sheet input: templat diterbitkan kode, struktur kolom, kolom status validasi, aturan tolak-seluruh-baris, cara menambah Sheet Pola baru                                |
| 12  | `data-pribadi`       | Field mana yang sensitif, apa yang wajib disaring sebelum keluar dari `core`, larangan mutlak NIK/rekening masuk ke prompt LLM, dan kewajiban audit                             |
| 13  | `akademik-pesantren` | Pemisahan halaqah vs kelas, dua jalur mapel (diniyah/umum), grain absensi & aturan default-hadir, ziyadah vs murojaah, pemakaian tabel rujukan Al-Qur'an, dan deteksi milestone |

Skill 1 dan 2 ditulis lengkap di fase 0 (prasyarat pergantian agent). Sisanya diisi saat
paketnya digarap, agar lahir dari kode nyata.

---

## Rencana Eksekusi

**Fase 0 — fondasi portabel**

1. `AGENTS.md`, `CLAUDE.md` (penunjuk), adapter `.claude/` + `.opencode/`, `docs/STATE.md`, `docs/TUGAS.md`, skrip `mulai` + `selesai`
2. `docs/00`–`05` + ADR: SQLite+DuckDB (lengkap dengan hitungan beban & pemicu pindah ke Postgres), Sheets sebagai lapisan publish, MCP sebagai batas agent, aturan grounding, kalender Kemenag
3. `packages/contracts`: skema zod seluruh entitas (termasuk `undangan`, `wali_santri`), tipe TS, DDL
4. Skill `siakad-domain` + `agent-handoff`
5. Workspace: `package.json` root (npm workspaces), tsconfig base, `.gitignore` (`data/`, `node_modules/`, kredensial), lint + test runner
6. **`docs/06-migrasi-legacy.md`** — dimulai dari temuan Bagian 9, lalu dilengkapi bersama
   pemegang pengetahuan untuk menjawab daftar pertanyaan terbuka di ujung bagian itu
   (PROTA, TAYSIR, aturan keringanan, santri keluar di tengah tahun). Dokumen ini bernilai
   walau kodenya tertunda, dan **menentukan bentuk skema keuangan di `contracts`** —
   karena itu ia mendahului, bukan menyusul
7. Baca file **03** dengan cara yang sama; bandingkan strukturnya dengan 04 untuk memisahkan
   pola yang tetap dari yang berubah antar tahun ajaran

> **Urutan ini mendahulukan keuangan.** Masalah nyata yang mendorong proyek ini seluruhnya
> keuangan, dan data lamanya yang rusak. Akademik menyusul setelah keuangan stabil, agar
> pengurus dan pengajar tidak menghadapi dua perubahan kebiasaan sekaligus.
>
> Satu hal tetap dibangun sejak awal meski fiturnya belakangan: **skema penuh dan pipeline
> OLAP**. SCD2 hanya merekam perubahan yang terjadi _setelah_ pipeline hidup, jadi menunda
> `dim_santri` berarti kehilangan riwayat perpindahan kelas periode itu secara permanen.

**Fase 1 — OLTP keuangan**

- `packages/db`: runner migrasi, **skema penuh** (akademik & TKA ikut dibuat walau belum dipakai — menghindari migrasi besar belakangan), repository
- `packages/core`: aturan **keuangan** — tagihan, prorata, cicilan, keringanan, PROTA, lebih bayar — + penegakan izin (unit test izin) + util tanggal Masehi↔Hijriah
- `scripts/seed-hijriah.ts`: seed `kalender_hijriah` dari kalender Kemenag tahun berjalan

**Fase 1b — OLAP** (dibangun berdampingan, bukan menyusul)

- `packages/analytics`: `snapshot.ts` (ekspor inkremental fakta + snapshot harian tabel mutable), `pipeline.ts` (runner SQL berurutan dependensi)
- `sql/bronze` → `sql/silver` (dim SCD2 + fact, termasuk `dim_waktu` Masehi+Hijriah) → `sql/gold` (mart)
- `tests/`: uji kualitas data — fakta yatim, duplikat grain, SCD2 aktif ganda, `SUM(pembayaran) <= tagihan`, jumlah baris fakta tidak menyusut

**Fase 2 — permukaan keuangan & migrasi data**

- `packages/bot` kerangka bersama
- `apps/bot-internal`: **catat pembayaran, terbitkan tagihan, kelola keringanan & PROTA**, alur `/undang`
- `apps/bot-wali`: `/start <kode>` + **tampilan tagihan & riwayat pembayaran anak**; tidak meng-import satu pun handler tulis
- `packages/drive`: auth service account, klien Sheets & Drive, **impor Sheet Pola + tulis-balik status validasi per baris**
- `scripts/import-legacy.ts`: **impor baris transaksinya saja** (data entri), mengikuti pemetaan di `docs/06-migrasi-legacy.md`. Tunggakan, saldo, dan seluruh angka turunan **dihitung ulang SIAKAD**, tidak disalin dari Kartu Kendali lama
- Importer menangani **dua skema periode** (Hijriah lama & Masehi baru) dan menyimpan `skema_periode` per baris; periode transisi 15 bulan dipertahankan apa adanya
- Saldo & tunggakan hasil impor ditandai **`belum_direkonsiliasi`**; ditampilkan apa adanya tapi tidak pernah disebut terverifikasi
- Spreadsheet lama **tidak dipensiunkan** — arsip baca-saja sampai rekonsiliasi selesai
- Jalur **tunai** diberi pencatatan & rekonsiliasi tersendiri; mutasi bank tidak mencakup ~4 dari 10 penerimaan
- **Mukafaah pengajar** (periode Hijriah) — pencatatan pengeluaran, agar sisi biaya tidak gelap

**Fase 3 — laporan & agent**

- `packages/mcp-server`: tool baca ber-scope peran
- `packages/agent`: loop OpenAI-compatible + pemeriksa grounding + template fallback
- `apps/worker`: snapshot → Parquet → publish Sheets → backup Drive → ringkasan mingguan pengurus → notifikasi kejadian & rekap bulanan wali (dengan penggabungan per-wali)
- Fitur agent di bot-internal: tanya-jawab, `/pesanmassal`
- `/notifikasi` di bot-wali; `/kalender` di bot-internal + pengingat otomatis menjelang sidang isbat

**Fase 4 — infrastruktur & ketahanan**

- `infra/`: Dockerfile multi-stage + compose (2 bot, worker, metabase), volume persisten `data/`, healthcheck, `restart: unless-stopped`
- **Migrasi otomatis saat container start** (didahului backup, rollback bila gagal)
- **Watchdog + heartbeat harian + `/status` + `/diagnosa`**
- **Uji pulih backup otomatis mingguan** dengan laporan ke pengurus
- Panduan pemulihan satu halaman, ditulis untuk pembaca non-teknis

**Fase 5 — rekonsiliasi berbantuan agent** (setelah sistem berjalan)

Sengaja **setelah** sistem hidup, bukan sebelum. Alasannya: selisih antara hitungan SIAKAD
dan Kartu Kendali lama **adalah hasil auditnya** — jadi rekonsiliasi hanya mungkin setelah
ada yang menghitung ulang.

- Agent menyusun perbandingan per santri: tunggakan menurut SIAKAD vs menurut Kartu Kendali lama, beserta rincian transaksi yang menyusunnya
- Pengurus memverifikasi **manual** per santri; hasilnya salah satu dari: angka lama benar, angka baru benar, atau perlu koreksi bernama
- Setiap koreksi lewat jalur empat mata di Bagian 8 — beralasan, disetujui orang kedua, tercatat permanen
- Santri yang sudah diverifikasi kehilangan tanda `belum_direkonsiliasi`; sisanya tetap bertanda sampai giliran mereka
- Setelah seluruh santri bersih, spreadsheet lama baru boleh dipensiunkan

Agent tepat dipakai di sini karena pekerjaannya membaca, membandingkan, dan menjelaskan —
bukan memutuskan. Angka tetap dari SQL, keputusan tetap dari pengurus.

**Fase 6 — akademik** (setelah keuangan stabil dan direkonsiliasi) — rancangan di Bagian 12

- Seed `quran_surah` (114 surah + jumlah ayat + batas juz) dan `kalender_akademik` (hari KBM & libur)
- `packages/core`: aturan akademik & hafalan + izin per peran (mudaris / pengajar mapel / wali kelas)
- `apps/bot-internal`: `/absen` dengan **default hadir, tandai pengecualian saja**; setoran (ziyadah/murojaah + rentang ayat); nilai per mapel
- Deteksi milestone hafalan (selesai surah / juz) sebagai pemicu notifikasi ke wali
- `apps/bot-wali`: tampilan absensi, progres hafalan, nilai
- **Rintis dengan satu halaqah dan satu kelas dulu**, minimal satu bulan penuh, baru diperluas — yang diuji bukan kodenya melainkan apakah pengisian harian bertahan

**Fase 7 — rapor & pelaporan eksternal**

- Rapor pesantren: penyusunan, `/rapor <kelas>` dengan draft agent, **disetujui wali kelas** sebelum terbit
- Terbitkan rapor ke wali (Sheet/PDF) — memuat nilai, hafalan, akhlak, catatan
- **Ekspor e-Rapor**: pemetaan `rapor_nilai` → struktur e-Rapor kesetaraan
- **Ekspor Dapodik**: berkas data peserta didik siap-unggah + penandaan NISN belum valid

**Fase 8 — persiapan TKA** (setelah operasional harian stabil)

- Pencatatan hasil tryout per mapel + rincian kompetensi
- Pemetaan kesiapan literasi & numerasi per santri dan per rombongan
- Rekomendasi fokus penguatan per santri lewat agent (draft, disetujui pengajar)

---

## Langkah Terdekat — Fase 0 Terperinci

### Kondisi awal

`~/Projects/siakad-annur` sudah ada: struktur direktori terbentuk, git ter-init pada `main`
tanpa commit, **nol berkas**. Strukturnya masih mengikuti rancangan lama — ada
`packages/agent` dan `apps/bot` tunggal, nama skill sudah berubah, dan `packages/mcp-server`
belum ada. Merapikannya jadi tugas pertama.

Folder Drive `My Drive/SIAKAD-ANNUR` **tetap di tempatnya** dan berubah peran menjadi
_data layer_ saja: rumah bagi spreadsheet lama (arsip), Sheet Pola, Sheet Laporan, dan
`_backup/`. Tidak ada kode di sana.

### Prasyarat eksternal — hanya Anda yang bisa menyiapkan

| #   | Prasyarat                                                                                                                                     | Dibutuhkan pada   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| P1  | Dua bot Telegram via @BotFather → token internal & token wali, beserta username bot wali untuk deep link                                      | Fase 2            |
| P2  | Google Cloud project + service account, aktifkan Drive & Sheets API, bagikan folder `SIAKAD-ANNUR` ke email service account, unduh kunci JSON | Fase 2            |
| P3  | Sesi dengan pemegang pengetahuan keuangan                                                                                                     | **Fase 0 (0.10)** |
| P4  | PDF Kalender Hijriah Kemenag 2026 & 2027                                                                                                      | Fase 1            |
| P5  | Langganan opencode Go (coding) + saldo Zen terpisah (runtime)                                                                                 | Fase 3            |
| P6  | ID grup Telegram pengurus                                                                                                                     | Fase 3            |

Hanya **P3** yang menghambat Fase 0. Sisanya bisa disiapkan sambil jalan.

### Urutan tugas

Isi awal `docs/TUGAS.md`. Tanda bobot mengikuti Bagian 1.

| #        | Tugas                       | Bobot    | Keluaran & syarat selesai                                                                                                                                                                                                                                                                                          |
| -------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0.1**  | Rapikan struktur folder     | `ringan` | Hapus `packages/agent`, `apps/bot`; tambah `packages/mcp-server`, `apps/bot-internal`, `apps/bot-wali`, `skills/` di root; `.claude/skills` jadi symlink ke `/skills`; bersihkan nama skill lama                                                                                                                   |
| **0.2**  | Bootstrap workspace         | `ringan` | `package.json` root (npm workspaces), `tsconfig.base.json`, `.gitignore` (`data/`, `node_modules/`, `*.env`, kunci JSON), prettier + eslint + vitest. **Selesai bila** `npm install` dan `npm run build` hijau pada repo kosong                                                                                    |
| **0.3**  | Instruksi agent             | `ringan` | `AGENTS.md` lengkap (lane, aturan, definisi selesai); `CLAUDE.md` hanya penunjuk; adapter tipis `.claude/` + `.opencode/`. **Selesai bila** uji-hapus `.claude/` tidak mengurangi kemampuan apa pun                                                                                                                |
| **0.4**  | Ritual sesi                 | `ringan` | `docs/STATE.md` bertemplat, `docs/TUGAS.md` berisi daftar ini, skrip `mulai` + `selesai`. **Selesai bila** `npm run mulai` mencetak STATE, tugas teratas, commit terakhir, dan status test                                                                                                                         |
| **0.5**  | Dokumen dasar               | `berat`  | `docs/00-overview.md` … `05-agent-boundary.md` — sebagian besar dapat diangkat dari rencana ini                                                                                                                                                                                                                    |
| **0.6**  | ADR                         | `berat`  | `0001` SQLite+DuckDB (+ hitungan beban & pemicu Postgres) · `0002` OLAP berlapis & SCD2 · `0003` MCP sebagai batas agent, jalur tulis deterministik · `0004` kalender: Masehi untuk tagihan, Hijriah untuk mukafaah · `0005` dua bot terpisah · `0006` portabilitas & anti lock-in · `0007` Sheets hanya dua jenis |
| **0.7**  | Skill fondasi               | `berat`  | `skills/siakad-domain` (glosarium: marhalah, halaqah, mudaris, ziyadah, murojaah, mukafaah, SPP, PROTA, keringanan; matriks peran; konvensi kalender) dan `skills/agent-handoff`                                                                                                                                   |
| **0.8**  | Baca file **03**            | `ringan` | Bandingkan dengan 04; catat pola yang tetap versus yang berubah antar tahun ajaran                                                                                                                                                                                                                                 |
| **0.9**  | `docs/06-migrasi-legacy.md` | `berat`  | **Butuh P3.** Jawab pertanyaan terbuka Bagian 9: status TAYSIR, aturan keringanan, santri keluar di tengah tahun, sisa dana PROTA, pergeseran awal tahun ajaran ke Juli                                                                                                                                            |
| **0.10** | `packages/contracts`        | `berat`  | Skema zod + tipe TS + DDL. **Bagian identitas, wali, dan akademik boleh jalan lebih dulu**; bagian keuangan menunggu 0.9. **Selesai bila** `npm run build` hijau dan `contracts` dapat di-import dari paket lain                                                                                                   |

**Ketergantungan:** 0.1 → 0.2 → (0.3, 0.4 paralel) → (0.5, 0.6, 0.7) → 0.10.
0.8 dan 0.9 berjalan di jalur terpisah, dan 0.9 memblokir bagian keuangan pada 0.10.

**Commit pertama** dilakukan setelah 0.2, agar riwayat dimulai dari repo yang sudah hijau.

---

## Verifikasi

**Uji lock-in**

- `rm -rf .claude/` → repo tetap bisa dikerjakan penuh oleh opencode; semua npm script jalan
- `grep -ri "anthropic\|claude" packages/ apps/` → nihil di kode produksi
- Ganti `AGENT_BASE_URL` ke provider lain → fitur agent tetap jalan tanpa ubah kode

**Fase 0–1**

- `npm run build` hijau; `packages/contracts` bisa di-import dari paket lain
- Migrasi jalan di SQLite kosong, `PRAGMA integrity_check` bersih
- Unit test izin: pengajar tidak bisa menulis nilai kelas lain; wali tidak bisa membaca santri yang tidak tertaut padanya

**Fase 1b — OLAP (yang membuktikan pemisahannya nyata)**

- Seluruh uji kualitas data lolos; satu pelanggaran → pipeline gagal keras, bukan lanjut diam-diam
- **Uji SCD2:** pindahkan seorang santri dari Paket A ke Paket B, jalankan pipeline, lalu query kehadiran periode lama → hasilnya tetap tercatat di bawah Paket A. Ini inti alasan lapisan OLAP ada
- **Uji idempoten:** jalankan pipeline dua kali berturut-turut → hasil gold identik
- **Uji `dim_waktu`:** agregasi per bulan Hijriah (mis. kehadiran Ramadan vs bulan biasa) menghasilkan angka yang konsisten dengan agregasi Masehi pada rentang tanggal yang sama
- Pipeline penuh selesai dalam hitungan detik pada data satu tahun

**Fase 2 — onboarding (end-to-end di test bot)**

- Buat undangan, klik dari akun uji → tautan terbentuk, pengurus dapat notifikasi
- Kode yang sama diklik kedua kali → ditolak; kode kadaluarsa & kode dicabut → ditolak dengan pesan jelas
- Satu akun menukarkan dua kode berbeda → **satu** record wali dengan dua santri
- Kode ngawur → ditolak tanpa membocorkan apakah santri tersebut ada
- Uji build: bundel `apps/bot-wali` tidak memuat simbol tulis dari `core`

**Fase 3 — agent (paling penting)**

- **Uji grounding:** suapkan JSON agregat yang diketahui, pastikan setiap angka pada teks
  keluaran ada di JSON tersebut; sisipkan kasus di mana model mengarang angka dan pastikan
  pemeriksa menolaknya
- **Uji fallback:** matikan `AGENT_API_KEY` → ringkasan berkala tetap terkirim sebagai tabel polos
- **Uji scope:** panggil tool MCP sebagai "wali" → hasil tersaring hanya ke santri yang tertaut, membuktikan penyekatan hidup di `core` dan bukan di prompt
- **Uji persetujuan:** `/pesanmassal` menghasilkan draft tanpa satu pun pesan terkirim sebelum pengurus menekan kirim
- Tidak ada tool tulis yang terdaftar di MCP server (uji otomatis atas daftar tool)
- **Uji kebocoran data pribadi:** panggil setiap tool MCP dengan data uji, pastikan tidak ada keluaran yang memuat NIK, NISN, atau nomor rekening — diperiksa otomatis dengan pola, bukan diperiksa mata
- Backup di Drive terenkripsi; berkas mentah tidak dapat dibaca tanpa kunci

**Fase 3 — irama notifikasi (anti-spam)**

- Hari tanpa kejadian → wali tidak menerima pesan apa pun
- Satu anak dengan 3 kejadian di hari yang sama → tepat **satu** pesan
- Satu wali dengan 3 anak yang semuanya ada kejadian → tepat **satu** pesan gabungan
- Siklus tagihan penuh → tepat 2 pesan (terbit + H-5), bukan lebih
- `/notifikasi` mematikan satu jenis → jenis tersebut berhenti, jenis lain tetap jalan

**Kalender**

- Semua kolom waktu tersimpan Masehi; tidak ada tanggal Hijriah tersimpan selain tabel `kalender_hijriah`
- Setiap teks laporan ke wali memuat tanggal Masehi **dan** Hijriah, Masehi lebih dulu
- Cocokkan hasil konversi dengan kalender Kemenag terbitan untuk seluruh 12 bulan tahun berjalan
- Tanggal di luar rentang tabel → ditandai perkiraan, bukan ditampilkan seolah pasti
- Bulan berstatus `provisional` (menunggu isbat) → laporan menampilkan Masehi saja
- Tabel tersisa <60 hari → admin menerima peringatan; pengingat sidang isbat terkirim di tanggal yang tepat

**Fase 6 — akademik**

- Rentang ayat di luar batas surah ditolak (mis. Al-Fatihah ayat 8) — divalidasi lewat `quran_surah`
- Setoran ziyadah berurutan menghasilkan capaian kumulatif yang benar; murojaah **tidak** menambah capaian
- Milestone terpicu tepat sekali saat juz/surah selesai, tidak berulang
- Absensi pada hari libur ditolak; santri tanpa catatan pada hari KBM **terdeteksi**, bukan diam-diam dianggap hadir
- Satu santri bisa `alpa` di kelas tapi `hadir` di halaqah pada hari yang sama, dan keduanya tercatat utuh
- **Uji ketahanan pengisian:** setelah rintisan satu bulan, ukur persentase hari KBM yang benar-benar terisi. Di bawah ambang wajar, yang diperbaiki **alur entrinya** — bukan mendesak pengajarnya

**Fase 7 — rapor & ekspor**

- Satu kali entri nilai menghasilkan dua keluaran: rapor pesantren untuk wali **dan** berkas ekspor e-Rapor
- Ekspor e-Rapor hanya memuat mapel `jalur = umum`; mapel diniyah tidak ikut
- Berkas ekspor Dapodik memuat seluruh field wajib; santri tanpa NISN valid tertandai, bukan diam-diam terlewat
- Rapor tidak bisa diterbitkan ke wali sebelum **wali kelas** menyetujui

**Fase 4 — infrastruktur**

- `docker compose up` semua service sehat; catat absensi + pembayaran di bot internal, cek muncul di bot wali
- Worker jalan → Sheets ter-update + backup muncul di Drive; Metabase di `localhost:3000` membaca snapshot
- Query DuckDB berat sementara bot menulis → tidak ada `SQLITE_BUSY`
- **Uji beban tulis**: simulasi 10 pengajar entri absensi serentak (~150 insert) → tidak ada kegagalan tulis, latensi wajar. Ini yang membuktikan asumsi konkurensi di Bagian Keputusan, bukan sekadar mengklaimnya
- **Uji pulih**: salin berkas SQLite dari Drive ke instans kosong → sistem jalan penuh. Prosedur pemulihan harus bisa dijalankan orang non-teknis

**Uji "tanpa tim IT" (lintas fase)**

- **Uji panduan:** minta orang non-teknis mengikuti panduan pemulihan satu halaman tanpa dibantu — kalau tersendat, panduannya yang diperbaiki, bukan orangnya
- **Uji Sheet Pola:** isi Sheet dengan 10 baris yang sengaja salah (NIK ganda, kelas tidak ada, tanggal keliru) → tiap baris memperoleh keterangan yang menyebut masalah dan cara memperbaiki, dan tidak ada baris rusak yang masuk DB
- **Uji templat dihasilkan kode:** hapus seluruh Sheet Pola, jalankan `npm run sheet:terbitkan` → templat lahir kembali utuh dengan header, dropdown, dan validasinya. Ini yang membuktikan strukturnya dimiliki kode, bukan seseorang
- **Uji proteksi Sheet Laporan:** coba sunting sel di sheet keluaran → ditolak
- **Uji bahasa:** tidak ada pesan yang sampai ke pengguna memuat nama tabel, kode galat, atau stack trace — diperiksa otomatis atas seluruh string keluaran
- **Uji mati mendadak:** matikan paksa satu container → menyala sendiri, dan pengurus menerima kabar
- **Uji migrasi gagal:** jalankan rilis dengan migrasi rusak → rollback bersih, data utuh, ada pemberitahuan
- **Uji tanpa developer:** seluruh tugas berulang pada peta Bagian 8 dapat diselesaikan tanpa membuka terminal sama sekali

**Fase 8 — TKA**

- Skor tryout tercatat per mapel dan per kompetensi; pemetaan kesiapan per rombongan konsisten dengan data mentah
- Rekomendasi fokus dari agent lolos uji grounding yang sama (tidak ada skor karangan)

## Yang belum diputuskan

- **Apakah awal tahun ajaran bergeser ke Juli** — deretan periode baru berjumlah 15 (April 2026 – Juni 2027), yang mengesankan transisi menuju tahun ajaran Juli–Juni. Menentukan batas `tahun_ajaran` di skema
- **TAYSIR** — masih hidup atau sudah mati, arah pertukaran data, dan field kunci pencocokan. Ditandai sebagai integrasi terbuka; harus dipastikan sebelum `contracts` dikunci
- Aturan penetapan besaran keringanan, dan perlakuan santri yang keluar di tengah tahun
- Sisa dana PROTA yang tidak teralokasi: dikembalikan ke donatur atau digulirkan
- **Akademik (Bagian 12):** daftar mata pelajaran per jalur & marhalah, skala nilai diniyah, aspek penilaian akhlak, serta hari & jam KBM. **Tidak memblokir** — keempatnya tabel seed yang diisi lewat Sheet Pola, jadi skema bisa dikunci sekarang dan detailnya menyusul tanpa migrasi
- Kebijakan default saat dua jatuh tempo jatuh di satu bulan Masehi (lihat Bagian 10)
- Jam pengiriman notifikasi kejadian ke wali (diusulkan sore, setelah KBM selesai)
- **Perlindungan data (Bagian 11):** bentuk persetujuan wali, masa retensi data alumni, akses wali setelah santri keluar, dan siapa penanggung jawab data di pesantren
- **Format ekspor e-Rapor & Dapodik yang sebenarnya** — perlu dilihat langsung dari PKBM induk (template unggahan atau tangkapan layar form). Ini penentu bentuk ekspor di Fase 4; sampai tersedia, ekspor dibuat generik (CSV berlabel) dan disempurnakan setelah formatnya diketahui
- Struktur mata pelajaran & fase per jenjang mengikuti Kurikulum Merdeka kesetaraan yang dipakai PKBM induk
- Daftar aspek akhlak/ibadah yang masuk rapor pesantren — ini kebijakan pesantren, bukan teknis
