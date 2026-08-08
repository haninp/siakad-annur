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
- [ ] **0.9** `docs/06-migrasi-legacy.md` — draf sudah ditulis dari pembacaan 03 & 04;
      **tinggal menjawab 7 pertanyaan terbuka di ujung dokumen** bersama pemegang
      pengetahuan keuangan (prasyarat P3) `[berat]`
- [ ] **0.8b** Periksa berkas **01** dan **02**: sebaran tahun tanggal transaksi, untuk
      memastikan tidak ada periode yang tak terwakili berkas mana pun. **Penting** — file 04
      terbukti tidak mewarisi riwayat 2025 dari 03 `[ringan]`
- [ ] **0.10** `packages/contracts` — identitas, wali, akademik `[berat]`
      _(bagian keuangan menunggu 0.9; sisanya boleh jalan lebih dulu)_

---

## Fase 1 — OLTP keuangan

_Belum dirinci. Rujuk plan Fase 1 sebelum memulai._

- [ ] Seed `kalender_hijriah` dari PDF Kemenag (butuh prasyarat P4)
- [ ] `packages/db`: runner migrasi + skema penuh + repository
- [ ] `packages/core`: aturan keuangan (tagihan, prorata, cicilan, keringanan, PROTA, lebih bayar) + izin

---

## Prasyarat eksternal yang ditunggu

Hanya **P3** yang menghambat Fase 0.

| Kode   | Prasyarat                                                        | Status    |
| ------ | ---------------------------------------------------------------- | --------- |
| P1     | Dua token bot Telegram via @BotFather + username bot wali        | belum     |
| P2     | Google Cloud service account + akses folder Drive `SIAKAD-ANNUR` | belum     |
| **P3** | **Sesi dengan pemegang pengetahuan keuangan** (memblokir 0.9)    | **belum** |
| P4     | PDF Kalender Hijriah Kemenag 2026 & 2027                         | belum     |
| P5     | Langganan opencode Go + saldo Zen terpisah                       | belum     |
| P6     | ID grup Telegram pengurus                                        | belum     |
