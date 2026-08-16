# TUGAS

Backlog berurutan. Ambil dari atas. Centang saat selesai — _selesai_ berarti
`npm run build`, `npm run lint`, dan `npm test` hijau, lalu sudah di-commit.

Tanda bobot: `[ringan]` aman untuk model mana pun; `[berat]` sebaiknya dikerjakan saat
model kuat tersedia (pemodelan OLAP, aturan izin, skema kontrak).

---

## Fase 0 — fondasi portabel

- [x] **0.1** Rapikan struktur folder ke rancangan final `[ringan]`
- [x] **0.2** Bootstrap workspace: npm workspaces, tsconfig, eslint, prettier, vitest `[ringan]`
- [x] **0.3** Instruksi agent: `AGENTS.md`, `CLAUDE.md` penunjuk, adapter `.opencode/` `[ringan]`
- [x] **0.4** Ritual sesi: `docs/STATE.md`, `docs/TUGAS.md`, skrip `mulai` + `selesai` `[ringan]`
- [x] **0.5** Dokumen dasar `docs/00-overview.md` … `05-agent-boundary.md` `[berat]`
- [x] **0.6** ADR `0001`–`0007` `[berat]`
- [x] **0.7** Skill fondasi: `skills/siakad-domain`, `skills/agent-handoff` `[berat]`
- [x] **0.8** Baca file **03**, bandingkan dengan 04, catat pola tetap vs berubah `[ringan]`
- [x] **0.9** `docs/06-migrasi-legacy.md` — draf sudah ditulis dari pembacaan 03 & 04;
      **9 pertanyaan P3 terjawab sebagian besar pada 10 Agustus 2026**. Dua pertanyaan
      masih terbuka: makna kolom `Khusus PROTA` dan nasib sheet arsip Juli–Agustus 2023.
      Bagian keuangan pada `contracts` sudah tidak lagi diblokir penuh `[berat]`
- [x] **0.8b** Periksa berkas **01** dan **02**: sebaran tahun tanggal transaksi `[ringan]`
      → 01 memegang 2023, 02 memegang 2024. Rantai 01–04 terkonfirmasi. Sekalian membongkar
      bahwa tabel sebaran versi lama menghitung derau (log add-on, tanggal lahir), dan bahwa
      ada **dua skema kolom jurnal** (01–02 vs 03–04)
- [x] **0.9b** Desain struktur master data: `docs/07-master-data.md` + ADR 0008 `[berat]`
- [x] **0.9c** Catat kebutuhan akademik dari lapangan: `docs/08-akademik-kebutuhan.md` `[ringan]`
- [x] **0.9d** **ADR 0009 — jalur tulis sempit `bot-wali`** `[berat]`
      → diputuskan: pengecualian sempit. `bot-wali` boleh menulis ke `usulan_izin` lewat tepat
      satu handler `ajukanIzin`. `AGENTS.md`, `docs/02-roles-matrix.md`, dan ADR 0005 ikut
      diperbarui supaya tidak saling bertentangan
- [x] **0.9e** **ADR 0010 — pembatalan usulan izin** `[berat]`
      → boleh selama belum di-ack wali kelas, ditegakkan CHECK bentuk data. Invarian
      `bot-wali` berpindah dari hitungan handler ke **sasaran tabel**
- [x] **0.11** `packages/core` — aturan izin absen: batas 3 kali batal-lalu-ajukan-ulang
      per anak per tanggal, plus uji mutu pesan untuk wali santri `[ringan]`
- [x] **0.10** `packages/contracts` — identitas, wali, akademik: zod + tipe + DDL SQLite,
      klasifikasi data pribadi berbasis metadata, dan status yatim sebagai fungsi turunan
      `[berat]` _(bagian keuangan menunggu 0.9)_

---

## Fase 1 — OLTP keuangan

Dimulai setelah P3 terjawab sebagian. Rincian menyusul seiring desain; yang pasti:

- [x] **1.0** `packages/db`: repository untuk master data dan `usulan_izin` di atas runner
      migrasi yang sudah ada `[ringan]`
- [x] **1.1** `packages/core`: penegakan izin peran + handler `ajukanIzin` / `batalkanIzin`
      yang boleh di-import `apps/bot-wali` `[berat]`
- [x] **1.2** `packages/contracts`: skema keuangan — `akun_keuangan`, `komponen_biaya`,
      `tagihan`, `pembayaran`, `prota`, `keringanan`, `lebih_bayar` — berdasarkan ADR 0012
      dan `docs/06-migrasi-legacy.md` `[berat]`
- [x] **1.3** `packages/db`: repository untuk 9 tabel keuangan (`akun_keuangan`,
      `komponen_biaya`, `tarif_komponen`, `tagihan`, `keringanan`, `pembayaran`,
      `prota`, `alokasi_prota`, `lebih_bayar`) di atas migrasi versi 3 `[berat]`
- [x] **1.4a** `packages/core`: `terbitkanTagihan` — lookuptarif + prorata bulan penuh `[berat]`
- [x] **1.4b** `packages/core`: `catatPembayaran` + cicilan (maks 6 kali) `[berat]`
- [x] **1.4c** `packages/core`: `tetapkanKeringanan` (nominal/persentase) `[berat]`
- [x] **1.4d** `packages/core`: `alokasiProta` + dukungan transaksi `[berat]`
- [x] **1.4e** `packages/core`: lebih bayar + migration v4 `pemakaian_lebih_bayar` `[berat]`
- [x] **1.5** Seed `kalender_hijriah` dari myQuran API (`method=islamic-umalqura`) +
      handler `setujuiBulanHijriah` + script `hijriah:isi`/`hijriah:periksa`. Semua baris API ditandai `provisional=1` sampai disetujui pengurus. Bot reminder otomatis menunggu **P1** (token Telegram). `[berat]`
- [x] **1.6** Bot internal minimal uji coba keuangan (RFC-001) `[berat]`
      → grammY 1.45 + `packages/bot` (`buatBot`) + `apps/bot-internal`: `/start`,
      `/tagihan <nis>`, `/bayar <nis> <nominal>`, `/status <nis>`. Whitelist admin
      `ADMIN_TELEGRAM_IDS` di `.env`; izin tetap lewat `buatHandlerKeuangan` di `core`.
      Script `npm run bot:internal`. Status RFC → Implemented.
- [x] **1.7** Menu tombol (button card) di bot internal (RFC-002) `[berat]`
      → inline keyboard: menu utama, pemilih santri, konfirmasi terbit/bayar,
      nominal cepat (150k/250k/450k). Stateless (state di `callback_data`),
      satu pesan diedit sepanjang alur. Perintah teks RFC-001 tetap ada sebagai
      fallback. Status RFC-002 → Implemented.
- [x] **1.8** Peran pengurus = monitoring; penerbitan tagihan = back office (RFC-003) `[berat]`
      → `terbitkanTagihanBulanan` di core + 3 test; `npm run tagihan:terbitkan`;
      menu pengurus: Status santri / Rekap bulan ini / Piutang; `/terbitkan`
      admin-only; `docs/02-roles-matrix.md` diperbarui (pengurus tidak trigger invoice).
- [x] **1.9** Bot wali — status tagihan baca-saja (RFC-004) `[berat]`
      → `apps/bot-wali`: `/start`, menu `📋 Tagihan anak` & `📊 Status bulan ini`,
      pemilih santri, rincian per anak + saldo lebih bayar. Baca-saja penuh (nol
      handler tulis di-import — lebih ketat dari ADR 0009). Binding dev via
      `DEV_WALI_TELEGRAM_IDS`. Script `npm run bot:wali`.
- [x] **1.10** Kosakata status tegas + hirarki menu (RFC-005) `[berat]`
      → `packages/core`: `statusPembayaran` + `formatStatusPembayaran` (SUDAH BAYAR /
      BAYAR SEBAGIAN / BELUM BAYAR / DIBATALKAN) + 6 test. Bot wali: label tegas
      dengan detail (nominal, tanggal bayar, jatuh tempo). Bot internal: hirarki
      `Keuangan → Santri → komponen (SPP/Uang Modul/Uang Gedung)` — komponen dinamis
      dari `komponen_biaya`; rekap & piutang per komponen.
- [x] **1.11** Bot wali — ringkasan agregat semua anak (RFC-006) `[berat]`
      → `/start` langsung menampilkan status bulan berjalan SEMUA anak di bawah
      wali (per komponen, kosakata tegas); satu tombol `📋 Detail tagihan` →
      pilih anak → rincian lengkap. Dua menu lama yang overlap digabung.
- [x] **1.12** Klarifikasi tampilan tagihan (RFC-007) `[berat]`
      → formatter `formatStatusPembayaran`: nominal jelas di kepala, SUDAH BAYAR
      menampilkan daftar "berapa & kapan", BAYAR SEBAGIAN tampil sudah/sisa/batas,
      kelebihan bayar → `Saldo: Rp …`. DB dev di-reset & disimulasi ulang
      (`data/simulasi-ulang.ts`): 1 santri lunas penuh, 1 santri lebih bayar
      (kelebihan 50.000 → Saldo).
- [x] **1.13** Alur verifikasi pembayaran (RFC-008) `[berat]`
      → `usulan_pembayaran` + `pengguna_telegram` (migrasi 6); core
      `ajukanUsulan` (cash wajib nama penerima) / `verifikasiUsulan` (bendahara →
      uang masuk, akrual) / `tolakUsulan` (alasan wajib) + `namaFileBukti`.
      Bot wali: 💳 Bayar tagihan (pilih anak → tagihan → metode → bukti → kirim);
      ringkasan tampil ⏳ MENUNGGU VERIFIKASI. Bot internal: 💳 Usulan pembayaran
      (daftar → lihat bukti → verifikasi/tolak + alasan → notifikasi wali via
      bot wali). `BENDAHARA_TELEGRAM_IDS` di `.env`.
- [x] **1.14** Registrasi wali sungguhan — undangan & `pengguna_telegram` (RFC-009) `[berat]`
      → admin `/undang` di bot internal → pilih wali → kode sekali pakai
      `undang-XXXXXX`; bot menampilkan **link deep link**
      `https://t.me/rtq_annur_bot?start=<kode>` — wali mengetuk link dari WA,
      Telegram terbuka, `/start <kode>` terkirim otomatis, terdaftar, kode
      hangus. `hubungkan` dipaksa sekali pakai di SQL (guard `undangan_kode`).
      `waliUntuk()` membaca `pengguna_telegram` sebagai sumber kebenaran,
      `DEV_WALI_BINDING` tinggal fallback dev. 15 test baru (repo + core).
- [x] **1.15** Pencarian santri di bot internal (RFC-010) `[ringan]`
      → 🔍 Cari santri di menu utama + `/cari <nis|nama>`: NIS persis → nama
      mengandung → NIS diawali (maks 10); satu hasil langsung ke tampilan
      status, banyak hasil jadi tombol pilihan. View detail santri punya area
      aksi (`tombolDetailSantri`) siap diperluas dengan aksi tulis kelak.

## Fase 2 — akademik

Dimulai setelah kebutuhan lapangan di `docs/08-akademik-kebutuhan.md` dikonfirmasi ulang.
Tugas pertama yang sudah tercatat:

- [ ] Rancang skema akademik: capaian hafalan, nilai, poin, PR, laporan absen `[berat]`

---

## Prasyarat eksternal yang ditunggu

Hanya **P3** yang menghambat Fase 0.

| Kode   | Prasyarat                                                        | Status    |
| ------ | ---------------------------------------------------------------- | --------- |
| P1     | Dua token bot Telegram via @BotFather + username bot wali        | belum     |
| P2     | Google Cloud service account + akses folder Drive `SIAKAD-ANNUR` | belum     |
| **P3** | **Sesi dengan pemegang pengetahuan keuangan** (0.9 terjawab sebagian) | **terjawab sebagian** |
| P4     | PDF Kalender Hijriah Kemenag 2026 & 2027                         | belum     |
| P5     | Langganan opencode Go + saldo Zen terpisah                       | belum     |
| P6     | ID grup Telegram pengurus                                        | belum     |
