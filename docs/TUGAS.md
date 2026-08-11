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
- [ ] **1.4e** `packages/core`: lebih bayar + migration v4 `pemakaian_lebih_bayar` `[berat]`
- [ ] **1.4c** `packages/core`: `tetapkanKeringanan` (nominal/persentase) `[berat]`
- [ ] **1.4d** `packages/core`: `alokasiProta` + dukungan transaksi `[berat]`
- [ ] **1.4e** `packages/core`: lebih bayar + migration v4 `pemakaian_lebih_bayar` `[berat]`
- [ ] Seed `kalender_hijriah` dari PDF Kemenag (butuh prasyarat P4)

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
