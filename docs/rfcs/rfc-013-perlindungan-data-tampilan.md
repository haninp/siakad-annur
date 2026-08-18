# RFC-013: Perlindungan Data Pribadi di Tampilan Chat

**Status:** Accepted (2026-08-17)
**Author:** Hani (keputusan) + Hermes (dokumentasi)
**Date:** 2026-08-17
**Relates to:** klasifikasi data pribadi di `contracts` (tugas 0.10), UU PDP, docs/02 (matriks peran)

## Problem Statement

Data pribadi tampil apa adanya di chat Telegram. Chat adalah media yang mudah
bocor — screenshot, ponsel hilang, grup. Pesantren berkedudukan sebagai
**pengendali data** (UU PDP), dan yang terdata sebagian besar anak di bawah
umur. Klasifikasi data pribadi sudah ada di `contracts` (`publik`/`internal`/
`sensitif`/`terlarang`) tetapi lapisan tampilan belum membatasi apa pun.

## Keputusan

1. **Nama anak & NIS = core bisnis, TIDAK dimasking.** Muncul di tagihan,
   status, rekap, pencarian — masking akan merepotkan dan mengganggu operasi.
   Tampil normal di semua bot.
2. **Nama wali memakai kunyah/alias.** Tabel `wali_alias` (migrasi 1) sudah
   ada. Aturan tampil: alias **`kunyah`** → fallback **`panggilan`** →
   fallback nama lengkap. Satu fungsi di core (`formatNamaTampil`) dipakai
   kedua bot — tidak ada format kedua yang bisa menyimpang.
3. **Pembeda alias kembar.** Alias bisa sama antar-wali. Tampilan wali di
   daftar (bot internal: `/undang`, pemilih wali) menyertakan pembeda alami
   **NIS anak**: `Ummu Aisyah · anak 2627005`.
4. **NIK & NISN tetap 'terlarang'** — tidak pernah keluar core ke bot mana pun
   (kebijakan yang sudah berjalan, dipertahankan).
5. **Tanggal lahir & NIK/NISN bila dirender = spoiler.** Belum ada fitur yang
   menampilkannya; aturan ini mengunci masa depan: kalau suatu fitur merender
   data itu, wajib lewat helper spoiler core. **Alur reveal + audit_log
   dibangun BERSAMA trigger pertama** (fitur yang menampilkan data itu) —
   tidak dibangun sekarang demi menghindari dead code.
6. **Eligible viewer di semua bot.** Kebijakan sama untuk bot wali maupun bot
   pengurus; bedanya hanya cakupan data: wali hanya bisa melihat data
   **anaknya sendiri**; pengurus melihat semua santri. (Nama anak & NIS tetap
   normal — lihat keputusan 1; yang diatur di sini adalah data identitas
   pribadi bila dirender.)
7. **Reconfirmation wajib saat registrasi (undangan).** Setelah `/start
   <kode>` (deep link), bot wali bertanya: *"Konfirmasi: sebutkan salah satu
   nama lengkap anak yang terdaftar di RTQ An-Nuur"* — wali bebas menyebut
   nama anak mana pun miliknya. Cocok **case-insensitive, persis setelah
   trim** terhadap daftar nama anak wali itu (`santri_wali`). Tiga percobaan
   salah → pesan minta hubungi pengurus; **kode undangan TIDAK hangus**
   (proteksi, bukan hukuman — pemilik sah bisa coba lagi). Melindungi dari
   link yang bocor: kode memang satu-satu ke wali, ini lapisan kedua.
8. **MarkdownV2 dengan escape.** Spoiler memakai `parse_mode: MarkdownV2`;
   karakter khusus (`_ * [ ] ( ) ~ \` > # + - = | { } . !`) wajib di-escape
   sebelum dirender — helper di core.

## Skema

**Tidak ada migrasi baru.** `wali_alias` (migrasi 1) dan `santri_wali` sudah
ada; reconfirmation memakai state in-memory (pola `stateBayar`); `audit_log`
baru dibangun bersama trigger reveal pertama (keputusan 5).

## Alur reconfirmation (bot wali)

```
1. Wali membuka link undangan → /start <kode>  (M2, RFC-009)
2. Kode valid → bot bertanya: "sebutkan salah satu nama lengkap anak…"
   (state in-memory: chatId → { kode, percobaan })
3. Jawaban cocok (case-insensitive, salah satu nama anak wali itu) →
   telegram_id terhubung, kode hangus, ringkasan tampil
4. 3× salah → "Konfirmasi gagal. Hubungi pengurus." (kode tetap berlaku)
```

## Implementasi (peta)

- `packages/core` — `formatNamaTampil(wali, alias[])` (kunyah→panggilan→
  lengkap), `spoil(teks)` + `escapeMarkdownV2(teks)` + test.
- `apps/bot-internal` — daftar wali (`/undang`, pemilih) memakai
  `formatNamaTampil` + pembeda NIS anak.
- `apps/bot-wali` — alur reconfirmation di `/start <kode>`; handler teks bebas
  menangani state konfirmasi sebelum alur lain.
- `data/simulasi-ulang.ts` — seed alias kunyah/panggilan untuk 3 wali dummy.
- Test: format alias (kunyah > panggilan > lengkap), escape MarkdownV2,
  reconfirmation (cocok / salah / 3× gagal → kode tetap berlaku).

## Out of scope

- Alur reveal + `audit_log` (siapa membuka data identitas) — dibangun bersama
  fitur pertama yang menampilkan tanggal lahir/NIK (keputusan 5).
- Persetujuan 2 lapis untuk NIK (peminta → pengurus lain setujui) — rancangan
  lanjutan bila NIK perlu ditampilkan; fondasi peran sudah ada di core.
- Formulir persetujuan wali, retensi data alumni, penanggung jawab data —
  keputusan domain menyusul (tercatat di STATE).
- Enkripsi chat Telegram — di luar kendali aplikasi.

## Verifikasi

- `npm run build && npm run lint && npm test` hijau.
- Uji live: daftar wali via link undangan → harus sebutkan salah satu nama
  anak dulu (3× salah → minta hubungi pengurus); di bot pengurus, `/undang`
  menampilkan kunyah + NIS anak sebagai pembeda.
