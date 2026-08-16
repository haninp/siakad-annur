# RFC-010: Pencarian Santri di Bot Internal (NIS / Nama)

**Status:** Accepted (2026-08-16)
**Author:** Hani (permintaan) + Hermes (dokumentasi)
**Date:** 2026-08-16
**Relates to:** RFC-003 (pengurus = monitoring), RFC-005 (hirarki menu)

## Problem Statement

Pengurus memantau puluhan–ratusan santri. Untuk melihat status tagihan satu
santri saat ini harus menelusuri menu berjenjang `Keuangan → Santri → pilih
komponen → pilih santri` — lambat dan mengandalkan ingatan letak santri di
daftar. Pengurus butuh jalan pintas: ketik NIS atau nama, langsung lihat
statusnya, dengan tempat yang siap untuk aksi lain yang mungkin ada kelak
(mis. mencatat pembayaran, memverifikasi, menandai keringanan).

## Alur

```
1. Pengurus menekan 🔍 Cari santri (menu utama) ATAU mengetik /cari <nis|nama>
2. Bot meminta kata kunci bila belum diketik (state tunggu-input, in-memory)
3. Pencarian: NIS cocok persis/awalan dulu, lalu nama mengandung kata kunci
4. Hasil (maks 10) tampil sebagai tombol per santri
5. Pilih santri → tampilan STATUS santri (semua komponen + saldo)
   + area tombol aksi yang bisa diperluas kelak
```

## Keputusan

1. **Satu sumber tampilan.** Detail hasil pencarian memakai `teksStatus(santri)`
   yang sudah dipakai alur `Keuangan → Santri` — format tagihan per komponen
   (RFC-007) + saldo. Tidak ada format kedua yang bisa menyimpang.
2. **Urutan hasil**: NIS persis → NIS diawali → nama mengandung (case-insensitive,
   diurutkan nama). Batas 10; bila lebih, pengurus diminta mempersempit.
3. **Area aksi siap diperluas.** View detail santri memakai pola callback
   `santri:<aksi>:<santriId>`. Saat ini hanya `santri:detail:<id>` (tampilan
   status). Aksi tulis (bayar, keringanan, verifikasi dari hasil cari) ditambahkan
   sebagai tombol baru di view yang sama — tanpa mengubah alur pencarian.
4. **Stateless** (pola alur lain di bot): state "tunggu kata kunci" in-memory
   per chat, hilang saat restart; callback_data membawa data.
5. **NIS adalah kunci yang paling tegas** — hasil NIS persis langsung menuju
   detail santri (tanpa layar pemilihan) bila hanya satu yang cocok; nama yang
   unik juga langsung menuju detail. Satu-satunya jalan pintas tanpa tombol.

## Pesan ke pengguna (substantif)

- Tidak ada hasil: *"Tidak ada santri dengan NIS atau nama '…'."*
- Terlalu banyak: *"Hasil terlalu banyak. Perhalus kata kunci (NIS atau nama
  lengkap)."*
- Belum terdaftar: *"Akun Anda belum terdaftar sebagai pengurus."*

## Out of scope

- Aksi tulis dari hasil pencarian (mencatat bayar, keringanan, dst.) — area
  tombolnya sudah disiapkan, aksinya menyusul saat kebutuhan nyata.
- Pencarian fuzzy/fonetik, pencarian per rombel/kelas.
- Pencarian di bot wali (wali sudah punya daftar anaknya sendiri).

## Verifikasi

- `npm run build && npm run lint && npm test` hijau.
- Uji live: `/cari 2627001` dan `/cari aisyah` dari bot internal → hasil →
  pilih → status santri tampil; hasil banyak → diminta mempersempit.
