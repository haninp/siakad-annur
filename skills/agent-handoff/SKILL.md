---
name: agent-handoff
description: Cara memulai dan menutup sesi kerja di repo SIAKAD An-Nuur — memperbarui docs/STATE.md, mengambil tugas dari docs/TUGAS.md, granularitas commit, dan definisi selesai. Baca saat memulai sesi, saat hendak commit, atau saat menutup pekerjaan.
---

# Serah terima antar sesi

Repo ini dikerjakan **bergantian** oleh Claude Code dan opencode, dipilih menurut
ketersediaan saat itu. Setiap sesi dimulai tanpa ingatan dari sesi sebelumnya.

**Repo yang menanggung konteks, bukan percakapan.** Kalau sesuatu hanya hidup di dalam
percakapan, ia hilang.

## Membuka sesi

```bash
npm run mulai
```

Mencetak `docs/STATE.md`, tugas terbuka teratas dari `docs/TUGAS.md`, lima commit terakhir,
dan peringatan bila ada perubahan belum di-commit.

Bila ada perubahan belum di-commit, **periksa dulu apakah pekerjaannya utuh** sebelum
menimpanya — itu jejak sesi yang berakhir tidak rapi.

## Mengambil tugas

Ambil dari `docs/TUGAS.md`, **dari atas**. Tanda bobot:

- `[ringan]` — aman untuk model mana pun: handler, migrasi, boilerplate
- `[berat]` — sebaiknya saat model kuat tersedia: pemodelan OLAP, aturan izin, skema kontrak

Kalau tugas teratas `[berat]` dan model yang tersedia terbatas, ambil `[ringan]` berikutnya
yang tidak bergantung padanya. Jangan mengerjakan `[berat]` setengah jalan lalu berhenti —
itu meninggalkan pekerjaan yang mahal dibongkar.

## Definisi selesai

Sebuah tugas selesai bila:

1. `npm run build` hijau
2. `npm run lint` hijau
3. `npm test` hijau
4. Sudah di-commit
5. `docs/TUGAS.md` dicentang

**Test adalah kontrak, bukan ingatan.** Agent berikutnya tidak perlu mempercayai narasi apa
pun — ia menjalankan test.

## Granularitas commit

**Satu tugas = satu commit yang meninggalkan repo hijau.** Ini yang membuat pergantian agent
di tengah jalan jadi murah.

Gaya conventional: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

Badan commit menjelaskan **mengapa**, bukan mengulang diff. Sebutkan nomor tugas.

Butuh perubahan di luar lingkup tugas? Tulis catatan di `docs/handoff/`, jangan diam-diam
melebarkan commit.

## Menutup sesi

```bash
npm run selesai
```

Menjalankan build, lint, dan test, lalu mengingatkan memperbarui `docs/STATE.md`.

**Sesi tidak boleh berakhir tanpa STATE.md diperbarui.** Isinya:

- **Yang baru selesai** — nomor tugas dan hasilnya
- **Sedang dikerjakan** — dan sampai mana persisnya, bila berhenti di tengah
- **Langkah berikutnya** — tugas mana yang harus diambil, dan jalur mana yang tidak saling menunggu
- **Keputusan yang menggantung** — beserta siapa yang harus menjawabnya
- **Jebakan yang baru ditemukan** — hal yang akan membuat agent berikutnya tersandung

**STATE.md yang basi lebih berbahaya daripada tidak ada**, karena ia dipercaya. Kalau isinya
tidak lagi benar, perbaiki — jangan biarkan.

## Keputusan arsitektur

Masuk `docs/adr/`, bernomor, bukan hanya ke percakapan. Formatnya: konteks, keputusan,
konsekuensi, dan bila relevan pemicu untuk meninjau ulang.

ADR yang baik menjawab pertanyaan _"kenapa dulu diputuskan begini"_ enam bulan kemudian,
saat tidak ada yang ingat.

## Portabilitas

Setiap alur kerja harus jadi **npm script**, sehingga jalan di Claude Code, opencode, maupun
terminal biasa. Jangan pernah membuat slash-command atau fitur khas satu agent menjadi
satu-satunya cara menjalankan sesuatu.

Uji: `rm -rf .claude/` harus tidak mengurangi kemampuan repo sama sekali.
