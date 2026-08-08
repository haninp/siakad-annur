# 03 — Aliran Data

```
OLTP   Telegram ──► handler bot ──► core (izin) ──► SQLite      [deterministik, tanpa LLM]
                                                       │
                                                       ▼ worker, tiap malam
OLAP   bronze (Parquet) ──► silver (dim_* SCD2 + fact_*) ──► gold (mart_*)
                                                               │
                        ┌──────────────────────────────────────┼───────────────┐
                        ▼                                      ▼               ▼
                 Sheets (terbit)                          Metabase        mcp-server
                                                                               │
                                                          packages/agent ◄─────┘  [baca-saja]
                                                                 │
                                            ├──► ringkasan pekanan ──► grup pengurus
                                            └──► jawaban / draft ──► bot-internal
```

## Kenapa dipisah

Pemisahan OLTP/OLAP di sini **bukan soal performa** — pada 150 santri, SQLite punya
kelonggaran dua sampai tiga orde besaran. Alasannya sejarah.

Skema OLTP menyimpan _keadaan sekarang_. Santri naik kelas, tarif berubah, pengajar
berganti halaqah — semuanya ditimpa di tempat. Setelah tertimpa, pertanyaan seperti
_"bagaimana kehadiran angkatan ini saat masih di kelas lama"_ tidak bisa dijawab,
secanggih apa pun mesin query-nya. **Lapisan OLAP yang memulihkan sejarah itu.**

Konsekuensinya: pipeline harus hidup **sejak awal**. SCD2 hanya merekam perubahan yang
terjadi _setelah_ ia berjalan; menundanya berarti kehilangan sejarah periode itu permanen.

## Bronze — ekspor mentah

| Jenis tabel                                    | Strategi                                               | Alasan                               |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| Fakta (absensi, setoran, nilai, pembayaran)    | Ekspor inkremental per bulan, tak pernah ditulis ulang | Append-only, sudah kekal sejak lahir |
| Mutable (santri, kelas, tarif, status tagihan) | Snapshot harian                                        | Bahan SCD2; kecil sekali             |

Sekitar **25 MB/tahun** — sejarah satu dekade ~250 MB.

## Silver — star schema

- **Fakta**: `fact_absensi` (grain santri × sesi), `fact_setoran`, `fact_nilai`,
  `fact_tagihan`, `fact_pembayaran`, `fact_tryout_tka`
- **Dimensi SCD2** di tempat yang memang berubah: `dim_santri`, `dim_jenis_tagihan`, `dim_pengajar`
- **Dimensi statis**: `dim_mapel`, `dim_kelas`, `dim_wali`
- **`dim_waktu`**: Masehi **dan** Hijriah, dimaterialisasi sekali dari tabel Kemenag

`dim_waktu` yang memuat Hijriah membuka analisis yang mustahil bila waktu hanya disimpan
Masehi — membandingkan kehadiran selama Ramadan dengan bulan biasa, misalnya. Untuk
pesantren itu pertanyaan yang wajar. Ia juga yang menyejajarkan mukafaah (berperiode
Hijriah) dengan SPP (berperiode Masehi) pada satu sumbu.

## Gold — mart

`mart_kehadiran_bulanan` · `mart_progres_hafalan` · `mart_keuangan_santri` ·
`mart_ringkasan_pekanan` · `mart_kesiapan_tka`

**Agent hanya membaca gold** — bukan silver, bukan OLTP. Itu yang membuat aturan "angka
dari SQL, kalimat dari model" bisa ditegakkan: angkanya sudah selesai dihitung.

## Pipeline — sengaja dibuat bodoh

Pada ~180.000 baris per tahun, **bangun ulang penuh tiap malam** selesai dalam hitungan
detik. Tidak ada incremental state, tidak ada watermark, tidak ada drift — idempoten karena
konstruksinya, bukan karena dijaga.

Kompleksitas ditaruh di pemodelan, bukan orkestrasi. Transformasi ditulis sebagai berkas SQL
polos di `packages/analytics/sql/`, dijalankan runner TypeScript yang mengurutkan
berdasarkan dependensi. **Tanpa dbt** — mesin incremental-nya tidak terpakai di skala ini,
dan itu berarti menambah Python ke stack yang sudah diputuskan TypeScript-saja.

## Uji kualitas data

Pipeline **gagal keras** bila salah satu tidak terpenuhi:

- Tidak ada fakta yatim (FK ke dimensi selalu ketemu)
- Tidak ada duplikat pada grain tiap fakta
- Tepat satu baris SCD2 aktif per entitas
- `SUM(pembayaran) <= tagihan` per santri
- Tidak ada santri aktif di dua kelas sekaligus
- Jumlah baris fakta tidak pernah menyusut antar-jalan

Gagalnya tidak berhenti di log: pengurus menerima pesan substantif yang menyebut **nama
santri yang bermasalah** dan cara memperbaikinya.

## Permukaan baca

| Kanal             | Untuk                          | Sifat                                                          |
| ----------------- | ------------------------------ | -------------------------------------------------------------- |
| **Sheet Laporan** | Wali & pengurus, dari Android  | Terbit otomatis, **diproteksi**, tidak pernah disunting tangan |
| **Metabase**      | Pengurus yang ingin menjelajah | Membaca snapshot Parquet, bukan SQLite live                    |
| **Agent**         | Pertanyaan bahasa bebas        | Baca-saja lewat MCP                                            |

Sheet Laporan diproteksi bukan karena formalitas: bila manusia menyuntingnya sementara
sistem juga menulisinya, suntingan itu tertimpa pada jalan berikutnya. Sekali terjadi,
orang berhenti mempercayai angkanya — dan seluruh lapisan pelaporan kehilangan gunanya.

## Sheet Pola — masukan massal

Arah sebaliknya. Sheet input berpola tetap (Data Santri, Wali, Kelas, Mapel, Tarif) yang
**templatnya diterbitkan kode**, bukan disusun orang. Worker mengimpor berkala, memvalidasi,
lalu menulis balik status per baris: _"Baris 47 — NIK sudah dipakai santri lain (Ahmad Fauzi)"_.

**Satu arah saja.** Sheet adalah formulir, bukan cermin database. Baris yang gagal validasi
ditolak utuh, tidak diimpor sebagian.
