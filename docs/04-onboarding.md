# 04 — Onboarding Wali lewat Deep Link Telegram

Seluruh pengelolaan lewat Telegram. Tidak ada panel admin terpisah.

## Alur

1. Pengurus di bot-internal: `/undang` → cari santri → pilih jenis hubungan
   (`ayah` / `ibu` / `wali` / `asuh`)
2. Bot membalas **pesan siap-teruskan** berisi nama santri dan link:
   `https://t.me/<bot_wali>?start=<kode>` — pengurus tinggal forward ke WhatsApp
3. Wali mengklik → bot-wali menerima `/start <kode>` → tautan dibuat otomatis → konfirmasi
4. Bot-internal memberi tahu pengurus: _"Kode untuk Ahmad Fauzi dipakai oleh @username
   (Budi S.)"_ dengan tombol **Cabut**

Deep link Telegram membawa payload sampai 64 karakter (`A-Za-z0-9_-`), jadi token acak
128-bit (22 karakter base64url) muat dengan lega.

## Tabel `undangan`

```
kode · santri_id · jenis_hubungan · dibuat_oleh · dibuat_pada
· kadaluarsa_pada (default 7 hari) · maks_pakai (default 1)
· jumlah_terpakai · dicabut_pada
```

## Satu wali, banyak santri

Ditangani secara alami. Saat `/start <kode>` masuk, bot memeriksa apakah `telegram_id`
sudah terdaftar sebagai wali:

- **Belum** → buat record `wali`, lalu tautkan ke santri
- **Sudah** → **tambahkan tautan santri baru** ke wali yang sama, jangan buat wali kedua

Wali dengan tiga anak cukup menerima tiga link dan mengklik ketiganya. Sebaliknya, satu
santri bisa punya ayah, ibu, dan orang tua asuh — masing-masing undangan terpisah dengan
`jenis_hubungan` berbeda.

Program orang tua asuh memakai jalur yang **sama persis**; yang berbeda hanya labelnya.

Untuk pasangan ayah dan ibu yang ingin berbagi satu link, `maks_pakai` disetel 2.

## Keamanan

Link ini kredensial bawa-siapa-pun: siapa saja yang mengkliknya menjadi wali. Itu memang
yang diminta demi kemudahan, dan dikendalikan dengan empat lapis murah:

1. **Sekali pakai** (default) dan **kadaluarsa 7 hari**
2. **Token acak 128-bit** — tidak bisa ditebak
3. **Notifikasi ke pengurus** saat ditukarkan, lengkap dengan identitas Telegram penukar
4. **Bisa dicabut kapan saja**, sebelum maupun sesudah dipakai

Kode ngawur ditolak **tanpa membocorkan apakah santri tersebut ada** — pesan penolakannya
seragam untuk kode salah, kadaluarsa, dan sudah terpakai.

## Perintah pengelolaan (bot-internal)

| Perintah         | Fungsi                                         |
| ---------------- | ---------------------------------------------- |
| `/undang`        | Buat undangan                                  |
| `/undangan`      | Daftar yang belum terpakai dan yang kadaluarsa |
| `/cabut <kode>`  | Batalkan                                       |
| `/wali <santri>` | Lihat siapa saja yang tertaut                  |
| `/lepas`         | Putuskan tautan wali–santri                    |

Wali yang berganti nomor atau akun Telegram cukup diberi undangan baru; tautan lama dilepas.

## Yang wajib diuji

- Kode yang sama diklik kedua kali → ditolak
- Kode kadaluarsa dan kode dicabut → ditolak dengan pesan jelas
- Satu akun menukarkan dua kode berbeda → **satu** record wali dengan dua santri, bukan dua wali
- Kode ngawur → ditolak tanpa membocorkan keberadaan santri
