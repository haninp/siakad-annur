# ADR 0001 — SQLite untuk OLTP, DuckDB untuk OLAP

**Status:** diterima · 8 Agustus 2026

## Konteks

Cakupan sistem meluas jauh selama perencanaan: keuangan, akademik, hafalan, rapor, ekspor
kementerian, dan lapisan agent. Wajar muncul pertanyaan apakah SQLite masih memadai.

Yang tumbuh adalah **keluasan fitur**, bukan volume data maupun konkurensi — dan hanya dua
hal terakhir itulah yang mematahkan SQLite.

## Hitungan beban

Pada 150 santri:

| Tabel                         | Baris/tahun  |
| ----------------------------- | ------------ |
| Absensi (150 × ~250 hari KBM) | 37.500       |
| Setoran hafalan               | 18.000       |
| Nilai                         | 24.000       |
| Tagihan + pembayaran          | 3.600        |
| Rapor                         | 3.000        |
| Audit log                     | ~90.000      |
| **Total**                     | **~180.000** |

Sepuluh tahun ≈ 1,8 juta baris, berkas 300–500 MB. Batas praktis SQLite ada di ratusan juta
baris — **kelonggaran ~2 orde besaran**.

Konkurensi puncak: ~10 pengajar entri absensi pagi hari, sekitar 1–5 tulis/detik tersebar
beberapa menit. SQLite WAL menangani ribuan tulis/detik di SSD — **kelonggaran ~3 orde besaran**.

## Keputusan

**SQLite (WAL) sebagai OLTP; DuckDB sebagai gudang data OLAP read-only.**

Alasan penentunya justru non-teknis dan kembali ke kendala utama pesantren: **keterbatasan
personil**. Basis data satu berkas di-backup dengan menyalin file, dipulihkan dengan
menyalinnya kembali, dan diperiksa dengan viewer SQLite apa pun. Postgres menukar itu dengan
container tambahan, `pg_dump`, dan pemulihan yang menuntut orang paham Postgres — di lembaga
yang tidak punya staf IT.

## Harga yang dibayar

| Keterbatasan                         | Penanganan                                                           |
| ------------------------------------ | -------------------------------------------------------------------- |
| Sebagian migrasi butuh rebuild-table | Migrasi ditulis sebagai SQL polos + uji migrasi tiap rilis           |
| Tidak ada tipe ENUM native           | `CHECK constraint` di DB + zod di batas aplikasi                     |
| Satu penulis pada satu waktu         | WAL + `busy_timeout`; bot-wali baca-saja, jadi penulis nyata hanya 2 |
| Semua container wajib satu host      | Diterima — tidak ada kebutuhan multi-host di skala ini               |

## Pemicu meninjau ulang

Pindah ke Postgres bila salah satu terjadi:

- Cabang atau lokasi kedua
- Kebutuhan akses dari beberapa host
- Tulis bersamaan yang **menetap** di puluhan per detik

Akses DB disembunyikan di balik repository `packages/db` dengan SQL portabel, sehingga
perpindahan tetap pekerjaan terbatas — bukan penulisan ulang.

## Konsekuensi

- Backup = salin satu berkas ke Drive; pemulihan bisa dijalankan orang non-teknis
- Uji beban tulis (10 pengajar serentak) wajib ada, agar asumsi konkurensi terbukti bukan diklaim
- Uji pulih dari backup dijalankan otomatis mingguan — backup yang belum pernah dipulihkan
  bukan backup
