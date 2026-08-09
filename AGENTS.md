# AGENTS.md — instruksi kerja untuk coding agent

Berkas ini adalah **satu-satunya sumber instruksi** bagi agent mana pun yang bekerja di
repo ini. `CLAUDE.md` hanya menunjuk ke sini. Jangan pernah menaruh instruksi yang hanya
hidup di satu format vendor.

---

## Apa ini

**SIAKAD An-Nuur** — sistem informasi akademik & keuangan untuk Pesantren An-Nuur Limo
(±150 santri, jenjang RA-PAUD, MI Banin, MI Banat, menginduk ke PKBM).

Menggantikan spreadsheet keuangan yang saat ini hanya dipahami satu orang dan mengandung
ribuan sel rusak. Input harian lewat Telegram; Google Sheets tetap dipertahankan sebagai
permukaan baca karena semua pengguna mengakses dari Android.

Baca `docs/00-overview.md` untuk gambaran penuh, `docs/STATE.md` untuk kondisi terkini.

`docs/RENCANA.md` memuat rencana lengkap beserta pembenaran tiap keputusan — rujuk ke sana
bila `docs/00`–`06` terasa kurang menjelaskan _mengapa_. Bila keduanya berbeda, **`docs/00`–`06`
dan `docs/adr/` yang berlaku**; RENCANA.md adalah dokumen asal, bukan sumber kebenaran.

---

## Mulai sesi

```bash
npm run mulai      # kondisi terkini, tugas berikutnya, commit terakhir, status test
```

Jalankan ini lebih dulu, selalu. Sesi bisa dimulai oleh agent mana pun tanpa ingatan dari
sesi sebelumnya — repo yang menanggung konteksnya, bukan percakapan.

## Akhiri sesi

```bash
npm run selesai    # build + lint + test, lalu ingatkan memperbarui STATE.md
```

**Sesi tidak boleh berakhir tanpa `docs/STATE.md` diperbarui.** Sesi yang berakhir tanpa itu
meninggalkan pekerjaan yang harus dibongkar ulang oleh agent berikutnya.

---

## Aturan kerja

1. **Test adalah kontrak, bukan ingatan.** Selesai berarti `npm run build`, `npm run lint`,
   dan `npm test` hijau. Agent pengganti tidak perlu mempercayai narasi apa pun — ia
   menjalankan test.

2. **Satu tugas = satu commit yang meninggalkan repo hijau.** Ini yang membuat pergantian
   agent di tengah jalan jadi murah.

3. **Ambil tugas dari `docs/TUGAS.md`**, dari atas. Tanda `[ringan]` aman untuk model mana
   pun; `[berat]` (pemodelan OLAP, aturan izin, skema kontrak) sebaiknya dikerjakan saat
   model kuat tersedia.

4. **Keputusan arsitektur masuk `docs/adr/`, bukan hanya ke percakapan.** Percakapan hilang
   saat sesi berganti; ADR tidak.

5. **Nol perkakas eksklusif.** Setiap alur kerja harus jadi npm script, sehingga jalan di
   Claude Code, opencode, maupun terminal biasa.

6. **Butuh perubahan di luar lingkup tugas?** Tulis catatan di `docs/handoff/`, jangan
   diam-diam melebarkan commit.

---

## Batas yang tidak boleh dilanggar

Ini bukan preferensi gaya. Melanggarnya menghasilkan kerusakan yang sulit ditemukan.

### Jalur tulis bebas LLM

Absensi, nilai, dan seluruh transaksi keuangan ditulis oleh kode deterministik. **LLM tidak
pernah menulis ke database.** Usulan dari LLM selalu melewati persetujuan manusia, dan yang
mengeksekusi tetap kode biasa.

### Angka dari SQL, kalimat dari model

`packages/analytics` menghitung seluruh agregat lewat SQL dan menyerahkannya sebagai JSON.
Model hanya merangkai narasi di sekitar angka itu. Prompt melarang aritmetika, dan ada
pemeriksa yang menolak keluaran memuat angka yang tidak ada pada JSON masukan.

Alasannya: satu angka karangan pada laporan keuangan pesantren cukup untuk menghapus
kepercayaan pada seluruh sistem.

### Data pribadi tidak pernah masuk prompt

**NIK, NISN, dan nomor rekening disaring di `packages/core` sebelum data keluar** — bukan
diserahkan pada prompt untuk menahan diri. Ini data anak di bawah umur; UU PDP berlaku dan
pesantren berkedudukan sebagai pengendali data.

### Izin hanya ditegakkan di `packages/core`

Bot dan MCP server sama-sama memanggilnya. Jangan pernah menulis aturan izin di dua tempat —
begitu terjadi, keduanya akan menyimpang dan tidak ada yang tahu mana yang benar.

### Angka turunan tidak disimpan

Tunggakan, saldo, dan capaian hafalan **dihitung dari transaksinya**, tidak disimpan sebagai
kolom. Sistem lama rusak persis karena ini: angka turunan disimpan terpisah dari sumbernya,
lalu menyimpang tanpa ada yang menyadari.

### Portabilitas

`.claude/` dan `.opencode/` hanya adapter tipis. Uji: `rm -rf .claude/` harus tidak
mengurangi kemampuan repo sama sekali. Skill hidup di `/skills` (format terbuka
agentskills.io); `.claude/skills` cuma symlink.

---

## Peta repo

```
packages/contracts    skema zod + tipe + DDL — sumber kebenaran bentuk data
packages/db           migrasi SQLite + repository
packages/core         aturan bisnis + penegakan izin      ⟵ satu-satunya tempat izin
packages/analytics    OLAP: sql/{bronze,silver,gold} + pipeline DuckDB
packages/drive        Google Drive & Sheets
packages/bot          kerangka grammY bersama
packages/mcp-server   batas agent: tool MCP baca-saja ber-scope peran

apps/bot-internal     pengurus, pengajar, admin  (baca + tulis)
apps/bot-wali         wali santri                (baca-saja)
apps/worker           snapshot, publikasi, backup, notifikasi

skills/               SKILL.md format terbuka
docs/adr/             keputusan arsitektur ber-nomor
data/                 SQLite, Parquet, ekspor — TIDAK PERNAH masuk git
```

`apps/bot-wali` **hanya boleh meng-import satu handler tulis: `ajukanIzin`** (ADR 0009).
Selebihnya kemampuan tulis harus absen dari binary-nya, bukan sekadar dijaga runtime guard.
Daftar-putih itu berisi **satu** nama; penambahan kedua menuntut ADR baru.

---

## Konvensi

- **Bahasa Indonesia** untuk nama tabel, kolom, dan pesan pengguna. Kode dan tipe boleh Inggris.
- **Pesan ke pengguna ditulis substantif**, bukan teknis. Sebut apa yang salah dan apa yang
  harus dilakukan, sebut nama entitas bukan ID. Jangan pernah membocorkan nama tabel, kode
  galat, atau stack trace ke pengguna — mereka bukan orang teknis, dan pesan yang tidak bisa
  ditindaklanjuti berarti sistem berhenti sampai developer sempat menengok.
- **Waktu** disimpan Masehi (ISO, Asia/Jakarta). Tagihan SPP berperiode bulan Masehi;
  mukafaah pengajar berperiode Hijriah. Konversi Hijriah lewat tabel `kalender_hijriah`
  bersumber Kemenag — **bukan rumus**, karena tidak ada rumus yang menghasilkannya.
- **Commit** memakai gaya conventional (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

---

## Perintah

```bash
npm run mulai      # orientasi awal sesi
npm run build      # tsc --build seluruh workspace
npm run lint       # eslint
npm test           # vitest
npm run format     # prettier --write
npm run selesai    # build + lint + test + pengingat STATE.md
```
