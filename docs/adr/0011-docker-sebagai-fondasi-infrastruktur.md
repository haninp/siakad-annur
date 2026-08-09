# ADR 0011 — Docker sebagai fondasi infrastruktur

**Status:** diterima · 10 Agustus 2026

## Konteks

`docs/RENCANA.md` sudah menetapkan ini sejak awal:

> **Deploy — Docker sejak hari pertama, jalan lokal dulu.** Pindah ke VPS nanti = ganti host,
> tanpa ubah kode.

Rencana itu juga sudah merinci isi `infra/`: Dockerfile multi-stage dan compose untuk dua bot,
worker, dan Metabase.

**Tapi keputusan itu tidak pernah benar-benar berlaku.** `docs/00`–`08` dan seluruh ADR diam
soal Docker, dan `infra/` hanya berisi satu direktori kosong. `AGENTS.md` menyatakan
`docs/` dan `docs/adr/` yang berlaku bila berbeda dengan RENCANA.md — jadi selama ADR ini
tidak ada, "Docker sejak hari pertama" hanyalah niat di dokumen asal.

Dokumen ini menutup celah itu, dan sekaligus memutuskan hal yang RENCANA.md tidak bahas:
**apa yang justru tidak dikontainerkan, dan apa harganya.**

## Keputusan

**Seluruh runtime dijalankan lewat Docker.** Satu citra multi-stage dipakai bersama; yang
membedakan antar service hanya perintah start-nya.

### Yang TIDAK dikontainerkan, dan mengapa

**SQLite dan DuckDB tidak punya proses untuk dikontainerkan.** Keduanya pustaka _embedded_ —
ia berjalan di dalam proses aplikasi, bukan sebagai server yang mendengarkan port. Tidak ada
"container basis data" di sini, dan mencarinya berarti salah paham terhadap ADR 0001.

Yang dikontainerkan adalah **aplikasinya**; datanya berupa berkas di volume. Konsekuensi
praktisnya: tidak ada service `db` di compose, dan tidak ada kredensial basis data di mana pun.

### Satu citra, bukan satu citra per aplikasi

Ketiga aplikasi berbagi paket yang sama. Tiga citra terpisah berarti tiga kali waktu build
untuk isi yang hampir identik.

**Isolasi `bot-wali` tidak bergantung pada pemisahan citra.** Ia ditegakkan pada tingkat impor
dan diverifikasi uji build (ADR 0005, 0009, 0010). Memisahkan citra akan memberi rasa aman
yang tidak ditopang apa pun — dua binary dari basis kode yang sama tetap bisa meng-import
handler yang salah, dan citra terpisah tidak akan menangkapnya.

### Migrasi jalan saat container start

Sesuai RENCANA.md. Runner-nya idempoten dan menolak berjalan bila migrasi lama disunting
(lihat `packages/db`), jadi menjalankannya di tiap start aman dan menghapus satu langkah
manual yang bisa terlupa.

## Harga yang dibayar, dan satu bahaya nyata

**Berkas basis data di-_bind mount_ (`./data:/data`), bukan named volume.** Alasannya: berkas
itu harus terjangkau dari host — VSCode untuk menjelajah, skrip backup, dan pipeline DuckDB
semuanya membacanya langsung. Named volume menyembunyikannya di dalam VM.

**Di Linux (VPS produksi) ini aman.** Bind mount di sana adalah filesystem asli.

**Di macOS tidak sepenuhnya aman, dan ini perlu dinyatakan terang.** Baik Docker Desktop
maupun Colima menembus lapisan filesystem tervirtualisasi. Penguncian berkas dan `fsync` di
sana tidak sekuat filesystem asli, sementara SQLite bergantung pada keduanya — terlebih mode
WAL yang memakai berkas `-shm` bersama.

Untuk **basis data pengembangan yang bisa dibangun ulang kapan saja**, risikonya diterima.
Untuk **data sungguhan di macOS**, jangan pakai bind mount — pindah ke named volume, dan
ambil isinya lewat `docker cp`. Data pesantren yang rusak diam-diam persis jenis kegagalan
yang jadi alasan proyek ini ada.

## Yang sudah diuji, bukan diasumsikan

Dijalankan sungguhan di Colima aarch64, Docker 29.4:

- `docker compose run --rm --build migrasi` → 16 tabel terbentuk, versi 0 → 2
- berkas muncul di `data/sqlite/siakad.db` pada host dan bisa dibaca `sqlite3` dari host
- `docker compose run --rm sqlite` → shell sqlite3 membaca berkas yang sama

Dua bug ketahuan justru karena dijalankan, bukan dibayangkan: skrip mengabaikan `SIAKAD_DB`
sehingga menulis ke dalam citra, dan `apk add` saat runtime gagal karena container berjalan
tanpa hak root. Keduanya sudah diperbaiki — yang kedua dengan memasang `sqlite` di citra,
karena memasang paket saat container jalan menuntut jaringan dan hak yang justru tidak ingin
kita beri.

## Konsekuensi

**Docker menambah jalur, bukan menggantikan.** `AGENTS.md` aturan 5 melarang perkakas
eksklusif, jadi setiap alur tetap punya npm script yang jalan tanpa Docker:

| Tanpa Docker      | Dengan Docker            |
| ----------------- | ------------------------ |
| `npm run db`      | `npm run docker:db`      |
| `npm run db:isi`  | `npm run docker:db:isi`  |
| `npm run db:jelajah` | `npm run docker:jelajah` |

Jalur host menuntut Node dan `sqlite3` terpasang; jalur Docker tidak menuntut apa pun selain
Docker. Keduanya harus tetap hidup — begitu salah satunya mati, repo ini kehilangan sifat yang
membuatnya bisa dikerjakan siapa pun.

**Yang belum ada.** Metabase menyusul bersama lapisan analitik; service dua bot dan worker
sudah ditulis di compose tapi ditandai profil `belum-siap` karena aplikasinya masih rangka.
Healthcheck, `restart: unless-stopped`, backup sebelum migrasi, dan watchdog masuk Fase 4
sesuai RENCANA.md.

**Yang harus dijaga.** Citra berjalan sebagai pengguna `node`, bukan root. Bila suatu hari ada
yang menambah langkah build yang menuntut root saat runtime, itu pertanda langkahnya salah
tempat — pindahkan ke tahap build citra.
