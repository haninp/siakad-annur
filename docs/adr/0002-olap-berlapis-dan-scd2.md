# ADR 0002 — OLAP berlapis dengan star schema dan SCD Type 2

**Status:** diterima · 8 Agustus 2026

## Konteks

Rancangan awal hanya menjalankan DuckDB langsung di atas tabel OLTP lewat
`ATTACH ... (TYPE sqlite)`. Itu **bukan lapisan analitik** — itu mesin query berbeda dengan
model data yang sama.

Masalah sebenarnya bukan kecepatan query, melainkan ini: **skema OLTP menyimpan keadaan
sekarang, bukan sejarah.** Santri naik kelas, tarif SPP berubah tiap tahun, pengajar
berganti halaqah — semuanya ditimpa di tempat.

Setelah tertimpa, pertanyaan berikut tidak bisa dijawab, secanggih apa pun mesin query-nya:

- Bagaimana kehadiran angkatan ini saat mereka masih di kelas sebelumnya?
- Tunggakan naik karena tarif berubah, atau karena kepatuhan menurun?

## Keputusan

**Gudang data tiga lapis di DuckDB, dengan star schema dan SCD Type 2 pada dimensi yang
memang berubah.**

- **Bronze** — fakta diekspor inkremental per bulan (append-only, tak pernah ditulis ulang);
  tabel mutable di-snapshot harian. ~25 MB/tahun.
- **Silver** — `fact_*` dan `dim_*`. SCD2 pada `dim_santri`, `dim_jenis_tagihan`,
  `dim_pengajar`. `dim_waktu` memuat Masehi **dan** Hijriah.
- **Gold** — mart pra-agregasi yang dibaca laporan, Sheets, Metabase, dan agent.

**Pemodelan serius, orkestrasi sepele.** Pada ~180.000 baris/tahun, bangun ulang penuh tiap
malam selesai dalam hitungan detik. Tanpa incremental state, tanpa watermark, tanpa drift —
idempoten karena konstruksinya.

Transformasi ditulis sebagai berkas SQL polos dijalankan runner TypeScript kecil.
**Tanpa dbt**: mesin incremental dan state-nya tidak terpakai di skala ini, dan itu berarti
menambah Python ke stack yang sudah diputuskan TypeScript-saja.

## Konsekuensi

**Pipeline harus hidup sejak awal, bukan menyusul.** SCD2 hanya merekam perubahan yang
terjadi _setelah_ ia berjalan. Menundanya berarti kehilangan sejarah periode itu secara
permanen — dan tidak ada cara memulihkannya dari OLTP, karena OLTP sudah menimpanya.

Inilah alasan skema penuh (termasuk tabel akademik) dibuat sejak Fase 1 meski fiturnya baru
dipakai di Fase 6.

`dim_waktu` yang memuat Hijriah membuka analisis yang mustahil bila waktu hanya Masehi —
membandingkan kehadiran selama Ramadan dengan bulan biasa, dan menyejajarkan mukafaah
(berperiode Hijriah) dengan SPP (berperiode Masehi) pada satu sumbu.

## Uji yang membuktikan lapisan ini nyata

Pindahkan seorang santri dari satu kelas ke kelas lain, jalankan pipeline, lalu query
kehadiran periode lama. **Hasilnya harus tetap tercatat di bawah kelas lama.** Kalau ikut
berpindah, SCD2-nya salah dan seluruh lapisan ini tidak ada gunanya.
