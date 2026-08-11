# Plan 1.2 — Skema Keuangan `packages/contracts`

> Disusun dengan GLM 5.2. Dieksekusi dengan kimi 2.7.
> Plan ini adalah kontrak antara sesi perencanaan dan sesi eksekusi.

## Tujuan

Membuat skema zod, tipe, entitas, dan DDL SQLite untuk bagian keuangan di
`packages/contracts`, berdasarkan ADR 0012 dan `docs/06-migrasi-legacy.md`.

## Prasyarat (semua sudah terpenuhi)

| Prasyarat | Status |
|-----------|--------|
| P3 terjawab sebagian | ✅ (ADR 0012) |
| `packages/contracts` master data identitas & akademik (0.10) | ✅ |
| `packages/db` runner migrasi versi 1–2 | ✅ |
| `packages/core` handler izin (1.1) | ✅ |

Tidak ada prasyarat eksternal.

---

## Spesifikasi entitas (9 tabel)

Tabel-tabel di bawah dibuat di `packages/contracts/src/keuangan.ts`. Ikuti pola dari
`identitas.ts` dan `akademik.ts`: skema zod, tipe, klasifikasi, dan entitas.

### 1. `akun_keuangan` — bagan akun

**Sumber:** sheet `master` berkas 03/04. Kode 1–12 pemasukan, 21–31 pengeluaran.
Kode 7–10 sengaja dibiarkan kosong (celah cadangan, bukan data hilang).

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `kode` | `z.number().int().positive()` | `publik` | `INTEGER PRIMARY KEY` | Kode akun dari bagan |
| `nama` | `Teks` | `publik` | `TEXT NOT NULL` | Nama persis dari sheet |
| `arah` | `z.enum(['masuk','keluar'])` | `publik` | `TEXT NOT NULL CHECK` | Pemasukan/pengeluaran |
| `aktif` | `z.boolean()` | `publik` | `INTEGER NOT NULL CHECK (0,1)` | Nonaktif, bukan dihapus |

**Kunci:** `kode` (PK). Tidak ada FK keluar.

### 2. `komponen_biaya` — jenis tagihan

**Sumber:** header Kartu Kendali berkas 04. 7 jenis tetap (kode enum).

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `publik` | `TEXT PRIMARY KEY` | |
| `kode` | `z.enum(['spp','pendaftaran','uang_gedung','sarpras','raport','modul_buku_atk','pkbm'])` | `publik` | `TEXT NOT NULL UNIQUE CHECK` | Stabil untuk Sheet & impor |
| `nama` | `Teks` | `publik` | `TEXT NOT NULL` | |
| `akun_keuangan_kode` | `z.number().int().positive()` | `publik` | `INTEGER NOT NULL REFERENCES akun_keuangan(kode)` | Pemetaan ke bagan akun |
| `aktif` | `z.boolean()` | `publik` | `INTEGER NOT NULL CHECK (0,1)` | |

**Kunci:** `id` (PK), `kode` (UNIQUE). FK ke `akun_keuangan`.

### 3. `tarif_komponen` — tarif per tahun ajaran

**Tidak ada di daftar tugas 1.2, tapi diperlukan** — tanpa ini, nominal tagihan
tidak bisa ditentukan. Inkluskan sebagai bagian skema keuangan.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `publik` | `TEXT PRIMARY KEY` | |
| `tahun_ajaran_id` | `Ulid` | `publik` | `TEXT NOT NULL REFERENCES tahun_ajaran(id)` | |
| `komponen_biaya_id` | `Ulid` | `publik` | `TEXT NOT NULL REFERENCES komponen_biaya(id)` | |
| `jalur` | `Jalur.nullable()` | `publik` | `TEXT CHECK` nullable | Sempit ke jalur tertentu |
| `marhalah` | `Marhalah.nullable()` | `publik` | `TEXT CHECK` nullable | Sempit ke marhalah |
| `tingkat` | `z.number().int().min(1).max(12).nullable()` | `publik` | `INTEGER CHECK` nullable | Sempit ke tingkat |
| `nominal` | `Uang` | `publik` | `INTEGER NOT NULL CHECK (>=0)` | |
| `aktif` | `z.boolean()` | `publik` | `INTEGER NOT NULL CHECK (0,1)` | |

**Kunci:** `id` (PK). UNIQUE `(tahun_ajaran_id, komponen_biaya_id, jalur, marhalah, tingkat)`.
NULL pada `jalur`/`marhalah`/`tingkat` berarti tarif berlaku umum.

### 4. `tagihan` — tagihan per santri per periode

**Prinsip:** nominal adalah nilai akhir setelah prorata, sebelum keringanan.
Tunggakan & saldo dihitung dari transaksi, tidak disimpan.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `santri_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES santri(id)` | |
| `tahun_ajaran_id` | `Ulid` | `publik` | `TEXT NOT NULL REFERENCES tahun_ajaran(id)` | |
| `komponen_biaya_id` | `Ulid` | `publik` | `TEXT NOT NULL REFERENCES komponen_biaya(id)` | |
| `periode` | `Teks` | `publik` | `TEXT NOT NULL` | Bulan Masehi `2026-08` atau kode lain |
| `skema_periode` | `z.enum(['hijriah','masehi'])` | `publik` | `TEXT NOT NULL CHECK` | Asal-usul (ADR 0004) |
| `jatuh_tempo` | `TanggalIso` | `publik` | `TEXT NOT NULL` | |
| `nominal` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | Setelah prorata |
| `prorata_mulai` | `TanggalIso.nullable()` | `publik` | `TEXT` nullable | NULL = tagihan penuh |
| `status` | `z.enum(['terbit','lunas','dibatalkan'])` | `publik` | `TEXT NOT NULL CHECK` | |

**Kunci:** `id` (PK). UNIQUE `(santri_id, tahun_ajaran_id, komponen_biaya_id, periode)`.

### 5. `keringanan` — pengurangan tagihan

**Aturan (ADR 0012):** murni kebijakan pengurus, bisa dari permintaan resmi wali.
Setiap baris wajib mencatat `alasan` dan `disetujui_oleh`.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `tagihan_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES tagihan(id)` | |
| `nominal` | `Uang.nullable()` | `internal` | `INTEGER CHECK (>=0)` nullable | Pengurangan tetap |
| `persentase` | `z.number().int().min(0).max(100).nullable()` | `internal` | `INTEGER CHECK (0-100)` nullable | Pengurangan persen |
| `alasan` | `Teks` | `internal` | `TEXT NOT NULL` | Wajib mencatat dasar |
| `disetujui_oleh` | `Ulid` | `internal` | `TEXT NOT NULL` | ID actor (lihat Catatan Actor) |
| `waktu` | `WaktuIso` | `internal` | `TEXT NOT NULL` | |

**Kunci:** `id` (PK). FK ke `tagihan`.
**CHECK:** salah satu dari `nominal`/`persentase` wajib terisi.
**Catatan Actor:** `disetujui_oleh` tidak punya FK ke tabel tertentu (lihat "Solusi Actor").

### 6. `pembayaran` — pembayaran cicilan (sampai 6×)

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `tagihan_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES tagihan(id)` | |
| `tanggal` | `TanggalIso` | `internal` | `TEXT NOT NULL` | Tanggal bayar |
| `nominal` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | |
| `metode` | `z.enum(['tunai','transfer','qris'])` | `internal` | `TEXT NOT NULL CHECK` | Tunai signifikan (~4/10) |
| `sumber` | `z.enum(['wali','orang_tua_asuh','prota','lainnya'])` | `internal` | `TEXT NOT NULL CHECK` | Sumber dana |
| `cicilan_ke` | `z.number().int().min(1).max(6).nullable()` | `internal` | `INTEGER CHECK (1-6)` nullable | NULL = non-cicilan |
| `dicatat_oleh` | `Ulid` | `internal` | `TEXT NOT NULL` | ID actor (lihat Catatan Actor) |
| `waktu` | `WaktuIso` | `internal` | `TEXT NOT NULL` | |

**Kunci:** `id` (PK). FK ke `tagihan`.

### 7. `prota` — dana donatur untuk santri asuh

**Aturan (ADR 0012):** sisa dana yang tidak teralokasi **digulirkan** ke periode
berikutnya, tidak dikembalikan ke donatur.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `donatur_wali_id` | `Ulid.nullable()` | `internal` | `TEXT REFERENCES wali(id)` nullable | Donatur terdaftar sebagai wali |
| `nama_donatur` | `Teks.nullable()` | `internal` | `TEXT` nullable | Donatur eksternal |
| `santri_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES santri(id)` | Anak asuh |
| `tahun_ajaran_id` | `Ulid` | `publik` | `TEXT NOT NULL REFERENCES tahun_ajaran(id)` | |
| `periode` | `Teks` | `publik` | `TEXT NOT NULL` | |
| `nominal` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | |
| `sisa` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | Sisa yang belum teralokasi |

**Kunci:** `id` (PK). FK ke `wali`, `santri`, `tahun_ajaran`.
**CHECK:** salah satu dari `donatur_wali_id`/`nama_donatur` wajib terisi.

### 8. `alokasi_prota` — alokasi PROTA ke tagihan

Satu setoran PROTA dapat dialokasikan ke banyak tagihan dan banyak bulan.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `prota_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES prota(id)` | |
| `tagihan_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES tagihan(id)` | |
| `nominal` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | |
| `waktu` | `WaktuIso` | `internal` | `TEXT NOT NULL` | |

**Kunci:** `id` (PK). FK ke `prota`, `tagihan`.

### 9. `lebih_bayar` — saldo kredit santri

**Aturan (ADR 0012):** dipotong ke tagihan berikutnya, tidak dikembalikan tunai.

| Kolom | Tipe zod | Klasifikasi | DDL SQLite | Catatan |
|-------|----------|-------------|-------------|---------|
| `id` | `Ulid` | `internal` | `TEXT PRIMARY KEY` | |
| `santri_id` | `Ulid` | `internal` | `TEXT NOT NULL REFERENCES santri(id)` | |
| `nominal` | `Uang` | `internal` | `INTEGER NOT NULL CHECK (>=0)` | |
| `asal_pembayaran_id` | `Ulid.nullable()` | `internal` | `TEXT REFERENCES pembayaran(id)` nullable | NULL = penyesuaian manual |
| `waktu` | `WaktuIso` | `internal` | `TEXT NOT NULL` | |

**Kunci:** `id` (PK). FK ke `santri`, `pembayaran`.

---

## Solusi Actor (resolusi risiko 2 & 3)

### Masalah

`keringanan.disetujui_oleh` dan `pembayaran.dicatat_oleh` saat ini di-draft mengacu ke
`pengajar(id)`. Padahal matriks peran mengizinkan `admin` dan `pengurus` juga melakukan
aksi ini, dan tidak semua pengurus terdaftar sebagai pengajar.

### Solusi yang diadopsi

**Kolom `disetujui_oleh` dan `dicatat_oleh` disimpan sebagai `TEXT` tanpa FK ke tabel
tertentu.** Isinya adalah ULID dari `pengguna_telegram` (tabel yang akan dibuat di Fase
berikutnya, lihat `docs/01-domain-model.md`).

Alasan:
1. Tabel `pengguna_telegram` belum ada, dan membuatnya sekarang akan melebarkan scope 1.2.
2. Sementara, kolom menerima ULID generik. Saat `pengguna_telegram` dibuat, constraint
   FK bisa ditambahkan lewat migrasi baru.
3. Hal ini menjaga skema keuangan tidak terikat ke `pengajar` saja.

**Tipe zod:** `Ulid` (tetap valid format, tapi tanpa FK di DDL).
**DDL:** `TEXT NOT NULL` (tanpa `REFERENCES`).

### Implikasi untuk draft yang ada

Draft `keuangan.ts` saat ini mengikat `disetujui_oleh` ke `REFERENCES pengajar(id)` dan
`dicatat_oleh` ke `REFERENCES pengajar(id)`. **Kimi 2.7 wajib menghapus kedua FK ini.**

---

## Draft yang sudah ada (status referensi)

Sebelum plan ini, sudah dibuat draft sebagai referensi:

- `packages/contracts/src/keuangan.ts` — 9 tabel lengkap (skema, entitas, DDL).
- `packages/contracts/src/index.ts` — export `./keuangan.js` ditambahkan.

**Draft ini BELUM di-commit dan BELUM lengkap.** Kimi 2.7 boleh:
- Melanjutkan dari draft (perbaiki sesuai plan ini), atau
- Menulis ulang dari nol mengikuti plan ini.

**Perubahan wajib dari draft:**
1. Hapus `REFERENCES pengajar(id)` dari `disetujui_oleh` dan `dicatat_oleh` (lihat Solusi Actor).
2. Tambahkan entitas keuangan ke daftar `ENTITAS_KEUANGAN` di `index.ts`.
3. Tambahkan `DDL_KEUANGAN` ke export dari `ddl.ts` atau pastikan terpisahkan ke migrasi tersendiri.

---

## Instruksi eksekusi untuk kimi 2.7

### Langkah 1 — Siapkan konteks

1. Jalankan `npm run mulai` untuk orientasi.
2. Baca plan ini: `docs/plan-1.2-skema-keuangan.md`.
3. Baca referensi: `docs/01-domain-model.md` (bagian Keuangan), `docs/adr/0012-keputusan-keuangan-dari-sesi-p3.md`,
   `docs/07-master-data.md` (bagian 8 & 9), `docs/06-migrasi-legacy.md` (Jawaban P3).
4. Baca pola: `packages/contracts/src/identitas.ts` dan `akademik.ts` untuk konvensi.

### Langkah 2 — Lengkapi `keuangan.ts`

1. Lihat draft `packages/contracts/src/keuangan.ts` (sudah ada).
2. **Perbaiki wajib:**
   - Hapus `REFERENCES pengajar(id)` dari `disetujui_oleh` dan `dicatat_oleh` di DDL.
   - Ganti `TEXT NOT NULL REFERENCES pengajar(id)` menjadi `TEXT NOT NULL` untuk kedua kolom.
3. **Verifikasi:**
   - Setiap entitas punya `entitasXxx` dengan `klasifikasi` lengkap.
   - `DDL_KEUANGAN` berisi semua 9 tabel berurutan (tidak ada rujukan melingkar).
   - `TABEL_KEUANGAN` berisi 9 nama tabel.
4. **Jangan ubah:** tipe zod, enum, dan klasifikasi sudah sesuai plan.

### Langkah 3 — Update `packages/contracts/src/index.ts`

1. Export `./keuangan.js` (sudah ada di draft).
2. Tambahkan daftar `ENTITAS_KEUANGAN` berisi semua entitas keuangan via `sebagaiEntitasUmum`:
   ```ts
   export const ENTITAS_KEUANGAN: readonly EntitasUmum[] = [
     sebagaiEntitasUmum(entitasAkunKeuangan),
     sebagaiEntitasUmum(entitasKomponenBiaya),
     sebagaiEntitasUmum(entitasTarifKomponen),
     sebagaiEntitasUmum(entitasTagihan),
     sebagaiEntitasUmum(entitasKeringanan),
     sebagaiEntitasUmum(entitasPembayaran),
     sebagaiEntitasUmum(entitasProta),
     sebagaiEntitasUmum(entitasAlokasiProta),
     sebagaiEntitasUmum(entitasLebihBayar),
   ];
   ```
3. Tambahkan ke `SEMUA_ENTITAS`: `[...ENTITAS_MASTER_DATA, ...ENTITAS_IZIN, ...ENTITAS_KEUANGAN]`.

### Langkah 4 — Update `packages/contracts/src/ddl.ts`

1. Tambahkan `export { DDL_KEUANGAN, TABEL_KEUANGAN } from './keuangan.js';`
   di akhir `ddl.ts` (atau ekspor langsung dari `keuangan.ts`; pastikan tidak duplikat).

### Langkah 5 — Tambah migrasi versi 3 ke `packages/db/src/daftar-migrasi.ts`

```ts
import { DDL_IZIN, DDL_KEUANGAN, DDL_MASTER_DATA } from '@siakad/contracts';

export const DAFTAR_MIGRASI: readonly Migrasi[] = [
  { versi: 1, nama: 'master data identitas dan akademik', sql: DDL_MASTER_DATA },
  { versi: 2, nama: 'usulan izin absen', sql: DDL_IZIN },
  { versi: 3, nama: 'keuangan', sql: DDL_KEUANGAN }, // TAMBAH INI
];
```

**Penting:** jangan ubah versi 1 dan 2.

### Langkah 6 — Tulis test `packages/contracts/src/keuangan.test.ts`

Test yang wajib ada:

1. **Validasi skema zod (positif):** buat objek valid untuk tiap entitas, parse dengan zod, harus lolos.
2. **Validasi skema zod (negatif):**
   - `akun_keuangan.arah` diisi selain 'masuk'/'keluar' → tolak.
   - `komponen_biaya.kode` diisi selain enum → tolak.
   - `tagihan.nominal` negatif → tolak.
   - `pembayaran.cicilan_ke` > 6 → tolak.
   - `keringanan` dengan `nominal` dan `persentase` keduanya NULL → tolak (pakai `.refine`).
   - `prota` dengan `donatur_wali_id` dan `nama_donatur` keduanya NULL → tolak.
3. **Kelengkapan klasifikasi:** setiap kolom di `entitasXxx.kolom` punya entry di `klasifikasi`.
   Ikuti pola `identitas.test.ts` yang memeriksa `ENTITAS_MASTER_DATA`.
4. **DDL CHECK constraints ditegakkan SQLite:** uji dengan `node:sqlite` in-memory:
   - Insert `tagihan.nominal` negatif → throw.
   - Insert `pembayaran.cicilan_ke` 7 → throw.
   - Insert `keringanan` dengan `nominal` & `persentase` NULL → throw.
   - Insert `prota` dengan `donatur_wali_id` & `nama_donatur` NULL → throw.

### Langkah 7 — Update test migrasi `packages/db/src/migrasi.test.ts`

1. Ubah ekspektasi `hasil.diterapkan` dari `[1, 2]` menjadi `[1, 2, 3]`.
2. Ubah `versiTerpasang` dari 2 menjadi 3.
3. Tambahkan `TABEL_KEUANGAN` ke loop pengecekan tabel yang muncul setelah migrasi.

### Langkah 8 — Jalankan verifikasi

```bash
npm run build
npm run lint
npm test
```

Semua harus hijau. Jika ada error:
- Error tipe zod: periksa konversi boolean & nullable.
- Error lint `any`: hindari, gunakan tipe zod yang tepat.
- Error FK: pastikan urutan DDL benar (tabel rujukan dibuat lebih dulu).

### Langkah 9 — Update dokumen

1. `docs/TUGAS.md` — centang 1.2.
2. `docs/STATE.md`:
   - Update tanggal.
   - Tambah 1.2 ke "Yang baru selesai".
   - Update "Langkah berikutnya" jadi 1.3.

### Langkah 10 — Commit, push, PR, merge

```bash
git checkout -b feat/contracts-skema-keuangan-1.2
git add packages/contracts/src/keuangan.ts packages/contracts/src/index.ts \
        packages/contracts/src/ddl.ts packages/contracts/src/keuangan.test.ts \
        packages/db/src/daftar-migrasi.ts packages/db/src/migrasi.test.ts \
        docs/TUGAS.md docs/STATE.md docs/plan-1.2-skema-keuangan.md
git commit -m "feat(contracts): skema keuangan — akun, tarif, tagihan, pembayaran, prota, keringanan, lebih bayar (1.2)"
git push -u origin feat/contracts-skema-keuangan-1.2
gh pr create --title "feat(contracts): skema keuangan (1.2)" \
  --body "..." --base main --head feat/contracts-skema-keuangan-1.2 \
  --repo haninp/siakad-annur
gh pr merge <N> --merge --repo haninp/siakad-annur
git checkout main && git pull origin main
```

---

## Prinsip yang tidak boleh dilanggar

1. **Angka turunan tidak disimpan.** Tunggakan, saldo, sisa tagihan dihitung dari
   transaksi di OLAP. Skema hanya simpan transaksi.
2. **`skema_periode`** menyimpan asal-usul Hijriah/Masehi (ADR 0004).
3. **Kode 7–10 celah** — jangan isi otomatis.
4. **Keringanan** bukan hak otomatis; tiap baris wajib `alasan` + `disetujui_oleh`.
5. **Lebih bayar** dipotong tagihan berikutnya, tidak dikembalikan tunai (ADR 0012).
6. **PROTA** sisa digulirkan, tidak dikembalikan ke donatur (ADR 0012).
7. **Cicilan** sampai 6× per tagihan.
8. **Tabel STRICT** — boolean disimpan INTEGER 0/1.
9. **Pesan ke pengguna substantif** — tidak ada nama tabel/kolom/istilah teknis.
10. **Izin ditegakkan di `packages/core`** — skema tidak menegakkan izin peran.

## Yang TIDAK dikerjakan di 1.2 (menyusul)

- Repository keuangan di `packages/db` → tugas 1.3.
- Aturan bisnis keuangan di `packages/core` (prorata, cicilan, dll.) → tugas 1.4.
- Seed data `akun_keuangan` & `komponen_biaya` → menyusul (bisa lewat Sheet Pola).
- Tabel `pengguna_telegram` & FK actor → Fase berikutnya.
- Tabel `mutasi_bank`, `mukafaah`, `kas` → menyusul (di luar scope 1.2).

## Definisi selesai

- `npm run build`, `npm run lint`, `npm test` hijau.
- 9 tabel keuangan ada di DDL & dibuat migrasi versi 3.
- Test skema zod & DDL CHECK constraints lulus.
- `docs/TUGAS.md` 1.2 dicentang.
- `docs/STATE.md` diperbarui.
- PR dibuat dan di-merge.