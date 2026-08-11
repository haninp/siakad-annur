# Plan 1.3 (FINAL) — Repository Keuangan `packages/db`

> Disusun dengan GLM 5.2. Dieksekusi dengan kimi 2.7.

## Tujuan

Membuat repository di `packages/db` untuk 9 tabel keuangan yang sudah didefinisikan di
`packages/contracts/src/keuangan.ts` (1.2) dan migrasi versi 3 yang sudah ada.

## Prasyarat (semua terpenuhi)

| Prasyarat | Status |
|-----------|--------|
| Skema keuangan di `packages/contracts` (1.2) | ✅ |
| Migrasi versi 3 sudah ada di `daftar-migrasi.ts` | ✅ |
| Helper `buatRepoIdTunggal` / `buatRepoKomposit` sudah ada | ✅ |
| RepoUsulanIzin sebagai pola repo khusus | ✅ |

## Pilihan desain (sudah dikonfirmasi)

1. **`akun_keuangan`**: repo khusus dengan `id: number` (PK INTEGER), tidak pakai factory generik.
2. **Scope**: CRUD dasar + method query yang jelas dibutuhkan handler 1.4.
3. **`repoTarifKomponen`**: `cariAktif` cari persis; `cariUmum(tahun, komponen)` untuk tarif
   semua-NULL. Fallback menjadi tugas core (1.4), bukan repo.
4. **`repoTagihan`**: tidak ada `perbaruiStatus` generik. Hanya `tandaiLunas(id)` dan
   `batalkan(id)`, masing-masing `WHERE status = 'terbit'`. Transisi tidak boleh berbalik
   arah — koreksi dilakukan dengan tagihan baru, bukan menimpa status.

## Repository yang dibuat (9 repo di `packages/db/src/repository/repo-keuangan.ts`)

### 1. `repoAkunKeuangan` — PK INTEGER `kode` (khusus)

```
sisip(baris: AkunKeuangan): void
ambilSemua(): AkunKeuangan[]
ambil(kode: number): AkunKeuangan | undefined
perbarui(kode: number, perubahan: Partial<AkunKeuangan>): void
hapus(kode: number): void
```

Tidak pakai factory. Tipe `id: number` langsung. Konversi boolean `aktif` lewat `keSql`/`dariSql`.

### 2. `repoKomponenBiaya` — id ULID tunggal

```
CRUD dasar (sisip, ambil, ambilSemua, perbarui, hapus)
+ cariByKode(kode: string): KomponenBiaya | undefined   // kode UNIQUE, dipakai untuk pemetaan akun
```

### 3. `repoTarifKomponen` — id ULID tunggal

```
CRUD dasar
+ cariAktif(tahunAjaranId, komponenBiayaId, jalur, marhalah, tingkat): TarifKomponen | undefined
  // cari persis: WHERE cocok dengan nilai yang diminta (NULL tidak otomatis fallback)
+ cariUmum(tahunAjaranId, komponenBiayaId): TarifKomponen | undefined
  // cari tarif umum: WHERE tahun & komponen cocok AND jalur IS NULL AND marhalah IS NULL AND tingkat IS NULL
```

**Alasan pemisahan:** Fallback (spesifik → umum) adalah keputusan bisnis, bukan mekanisme
penyimpanan. Repo hanya menyediakan bahan; core (1.4) yang mengorkestrasi urutan fallback.

### 4. `repoTagihan` — id ULID tunggal

```
CRUD dasar (sisip, ambil, ambilSemua, perbarui sebagian, hapus)
+ cariBySantri(santriId): Tagihan[]
+ cariBySantriDanPeriode(santriId, periode): Tagihan[]
+ cariByStatus(status): Tagihan[]
+ tandaiLunas(id): void
    → UPDATE tagihan SET status='lunas' WHERE id=? AND status='terbit'
    → bila changes=0, lempar error ("tidak bisa, atau sudah lunas")
+ batalkan(id): void
    → UPDATE tagihan SET status='dibatalkan' WHERE id=? AND status='terbit'
    → bila changes=0, lempar error
```

**Tidak ada `perbaruiStatus(id, status)` generik.** Transisi `lunas`/`dibatalkan` bersifat
terminal — tidak ada UPDATE yang bisa memindahkan keluar. Koreksi dilakukan dengan tagihan
baru, bukan menimpa status. Aturan siapa boleh menandai lunas ditambah core (1.4).

### 5. `repoKeringanan` — id ULID tunggal

```
CRUD dasar
+ cariByTagihan(tagihanId): Keringanan[]
```

### 6. `repoPembayaran` — id ULID tunggal

```
CRUD dasar
+ cariByTagihan(tagihanId): Pembayaran[]          // cicilan-cicilan satu tagihan
+ hitungTotalByTagihan(tagihanId): number          // SUM(nominal) — dihitung, bukan disimpan
```

### 7. `repoProta` — id ULID tunggal

```
CRUD dasar
+ cariBySantri(santriId): Prota[]
+ cariByPeriode(periode): Prota[]
+ kurangiSisa(id, nominal): void
    → UPDATE prota SET sisa = sisa - nominal WHERE id=? AND sisa >= nominal
    → bila changes=0, lempar error ("sisa tidak cukup")
```

`kurangiSisa` memakai `WHERE sisa >= nominal` supaya tidak negatif. CHECK `sisa >= 0`
ditegakkan basis data, tapi repo gagal elegan lewat `changes === 0` sebelum sampai ke situ.

### 8. `repoAlokasiProta` — id ULID tunggal

```
CRUD dasar
+ cariByProta(protaId): AlokasiProta[]
+ cariByTagihan(tagihanId): AlokasiProta[]
```

### 9. `repoLebihBayar` — id ULID tunggal

```
CRUD dasar
+ cariBySantri(santriId): LebihBayar[]
+ hitungSaldo(santriId): number       // SUM(nominal) — dihitung, bukan disimpan
+ tambahSaldo(baris: LebihBayar): void   // sisip baru
```

## File yang dibuat / diubah

### Baru

1. `packages/db/src/repository/repo-keuangan.ts` — 9 repository + interface.
2. `packages/db/src/repository/repo-keuangan.test.ts` — test lengkap.
3. `docs/plan-1.3-repo-keuangan.md` — plan ini.

### Diubah

4. `packages/db/src/repository/index.ts` — export `./repo-keuangan.js`.
5. `docs/TUGAS.md` — centang 1.3.
6. `docs/STATE.md` — catat 1.3, langkah berikutnya jadi 1.4.

**Tidak ada perubahan skema atau migrasi** — itu sudah selesai di 1.2.

## Prinsip yang tidak boleh dilanggar

1. **Angka turunan tidak disimpan di repo.** `hitungTotalByTagihan` dan `hitungSaldo`
   menghitung dari baris, bukan membaca kolom turunan.
2. **`akun_keuangan.kode` adalah `number`**, bukan `string` — STRICT mode menolak TEXT
   untuk kolom INTEGER.
3. **`repoTagihan.tandaiLunas`/`batalkan`** hanya `WHERE status='terbit'`; tidak ada jalan
   keluar dari `lunas`/`dibatalkan` lewat repo. Koreksi = tagihan baru, bukan timpa status.
4. **`repoProta.kurangiSisa`** memakai `WHERE sisa >= nominal` supaya tidak negatif; bila
   gagal, lempar error dari repo.
5. **No fallback di repo.** `repoTarifKomponen.cariAktif` cari persis; `cariUmum` terpisah.
   Urutan fallback menjadi tugas core (1.4).
6. **FK ditegakkan SQLite** — test menguji bahwa insert dengan FK tidak valid throw.
7. **CHECK constraints** (keringanan nominal/persentase, prota donatur) ditegakkan basis
   data, bukan hanya zod.
8. **Tidak ada aturan izin di repo** — repo hanya mekanisme penyimpanan; izin peran di
   `packages/core` (1.4).

## Yang TIDAK dikerjakan di 1.3 (menyusul di 1.4)

- Aturan bisnis keuangan di `packages/core` (prorata, cicilan, keringanan, PROTA, lebih bayar).
- Handler keuangan untuk `bot-internal`.
- Penegakan izin peran untuk aksi keuangan.
- Logika fallback tarif spesifik → umum (tugas core 1.4).
- Seed data `akun_keuangan` & `komponen_biaya` (menyusul lewat Sheet Pola).

## Definisi selesai

- `npm run build`, `npm run lint`, `npm test` hijau.
- 9 repo keuangan ada di `packages/db/src/repository/repo-keuangan.ts`.
- Test repo keuangan lulus (CRUD + method query khusus + FK + CHECK + transisi terminal).
- `docs/TUGAS.md` 1.3 dicentang.
- `docs/STATE.md` diperbarui.
- PR dibuat dan di-merge.
