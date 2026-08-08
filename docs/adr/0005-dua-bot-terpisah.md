# ADR 0005 — Dua bot Telegram terpisah

**Status:** diterima · 8 Agustus 2026

## Konteks

Empat golongan pengguna: admin, pengurus, pengajar, dan wali santri. Pilihannya satu bot
dengan guard peran, atau bot terpisah untuk wali.

## Keputusan

**Dua bot: `bot-internal` (admin, pengurus, pengajar) dan `bot-wali` (baca-saja).**

Alasannya isolasi, bukan kerapian. Dengan satu bot, satu bug pada guard peran cukup untuk
membocorkan data santri lain ke wali. Dengan bot terpisah, **kemampuan tulis absen dari
binary bot wali** — bukan sekadar dijaga runtime guard.

`apps/bot-wali` tidak meng-import satu pun handler tulis dari `core`, dan itu diverifikasi
lewat uji build.

## Harga

Dua token, dua container, sebagian kode dipakai bersama lewat `packages/bot`.

## Konsekuensi

- Onboarding wali jadi lebih sederhana: deep link menunjuk langsung ke bot wali
- Wali tidak pernah melihat perintah internal, bahkan tidak tahu keberadaannya
- Uji wajib: bundel `apps/bot-wali` tidak memuat simbol tulis dari `core`
