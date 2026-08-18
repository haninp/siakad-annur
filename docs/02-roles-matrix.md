# 02 — Peran dan Izin

> **Izin hanya ditegakkan di `packages/core`.** Bot dan MCP server sama-sama memanggilnya.
> Jangan pernah menulis aturan izin di dua tempat — begitu terjadi, keduanya akan menyimpang
> dan tidak akan ada yang tahu mana yang benar.

## Peran

| Peran      | Melekat pada                          | Kanal        |
| ---------- | ------------------------------------- | ------------ |
| `admin`    | pengurus yang ditunjuk                | bot-internal |
| `pengurus` | pengurus pesantren                    | bot-internal |
| `bendahara`| bendahara / kasir pesantren           | bot-internal |
| `pengajar` | mudaris / pengajar mapel / wali kelas | bot-internal |
| `wali`     | orang tua & orang tua asuh            | bot-wali     |

Satu orang dapat memegang beberapa peran akademik sekaligus — seorang mudaris bisa juga
wali kelas dan pengajar mapel.

Peran `bendahara` (RFC-014) adalah peran mandiri, bukan "admin kedua": ia memegang hak baca
laporan keuangan dan verifikasi pembayaran, tanpa hak admin (menerbitkan tagihan, undangan,
kalender hijriah, catat pembayaran manual). Penetapan via `BENDAHARA_TELEGRAM_IDS` di `.env`;
sumber kebenaran masa depan `pengguna_telegram` (RFC-009).

## Matriks

| Aksi                                             | admin | bendahara | pengurus |       pengajar       |     wali      |
| ------------------------------------------------ | :---: | :-------: | :------: | :------------------: | :-----------: |
| Kelola pengguna & pemetaan `telegram_id`         |  ✅   |     —     |    —     |          —           |       —       |
| Kelola data master (santri, kelas, mapel, tarif) |  ✅   |     —     |    ✅    |          —           |       —       |
| Terbitkan tagihan (invoice) — back office                |  ✅   |     ✅    |    —     |          —           |       —       |
| Catat pembayaran (manual)                        |  ✅   |     —     |    —     |          —           |       —       |
| Pantau status pembayaran & piutang (individu & kolektif) |  ✅   |     ✅    |    ✅    |          —           |       —       |
| Baca laporan keuangan (terbit/masuk/sisa)        |  ✅   |     ✅    |    ✅    |          —           |       —       |
| Verifikasi / tolak usulan pembayaran wali (RFC-008) |  ✅   |     ✅    |    ✅    |          —           |       —       |
| Tetapkan keringanan & alokasi PROTA              |  ✅   |     —     |    ✅    |          —           |       —       |
| Buat & cabut undangan wali                       |  ✅   |     —     |    ✅    |          —           |       —       |
| Perbarui `kalender_hijriah`                      |  ✅   |     —     |    —     |          —           |       —       |
| Tulis absensi **halaqah**                        |  ✅   |     —     |    —     | mudaris halaqah itu  |       —       |
| Tulis absensi **kelas**                          |  ✅   |     —     |    —     |  pengajar kelas itu  |       —       |
| Tulis setoran hafalan                            |  ✅   |     —     |    —     | mudaris halaqah itu  |       —       |
| Tulis nilai                                      |  ✅   |     —     |    —     |  pengampu mapel itu  |       —       |
| Setujui rapor                                    |  ✅   |     —     |    —     | wali kelas kelas itu |       —       |
| Baca seluruh santri                              |  ✅   |     —     |    ✅    |          —           |       —       |
| Baca santri yang diampu                          |  ✅   |     —     |    ✅    |          ✅          |       —       |
| Baca santri yang tertaut padanya                 |  ✅   |     —     |    ✅    |          —           |      ✅       |
| Ajukan izin absen anaknya (`usulan_izin`)        |  ✅   |     —     |    ✅    |          ✅          |      ✅       |
| Batalkan usulan izin **selama belum di-ack**    |  ✅   |     —     |    ✅    |          —           |   pelapornya  |
| Tanya-jawab bebas ke agent                       |  ✅   |     —     |    ✅    |          —           |       —       |
| Lihat NIK / NISN / no. rekening                  |  ✅   |     —     |    ✅    |          —           | milik anaknya |

> **Catatan `bendahara` (RFC-014 + amendemen 2026-08-18):** "Catat pembayaran"
> bagi bendahara hanya terjadi lewat alur verifikasi usulan wali (RFC-008) —
> tanpa jalur manual. **Amendemen**: `/terbitkan` (tagihan SPP bulanan, back
> office) adalah urusan keuangan → tersedia bagi admin & bendahara (sebelumnya
> admin saja). Bot internal menyembunyikan menu/tombol di luar hak peran,
> tetapi **penegak izin terakhir tetap handler di `packages/core`** (AGENTS.md).

## Aturan penyempitan

Tiga aturan yang harus punya unit test, bukan sekadar tertulis:

1. **Pengajar hanya boleh menulis untuk kelompok yang ia ampu.** Mudaris halaqah A tidak
   bisa mencatat setoran santri halaqah B.
2. **Wali hanya melihat santri yang tertaut padanya**, tanpa membedakan `jenis_hubungan`.
   Orang tua asuh melihat anak asuhnya persis seperti orang tua kandung melihat anaknya.
3. **Tidak ada peran yang bisa menulis lewat LLM.** Agent hanya punya tool baca.

## Isolasi bot wali

`apps/bot-wali` **hanya meng-import satu handler tulis dari `core`: `ajukanIzin`**. Selebihnya
kemampuan tulis absen dari binary-nya, bukan sekadar dijaga runtime guard — dan itu
diverifikasi lewat uji build, bukan diasumsikan.

Ini alasan utama memilih dua bot terpisah daripada satu bot dengan guard peran.

**Pengecualian itu sempit dan disengaja** (ADR 0009, diperluas ADR 0010): handler tulis
`bot-wali` hanya boleh menyentuh `usulan_izin`, tidak pernah `absensi`, dan hanya untuk santri
yang tertaut pada wali pengirim. Saat ini dua — `ajukanIzin` (sisip) dan `batalkanIzin` (ubah
status `menunggu` → `dibatalkan`).

Yang diuji build adalah **sasarannya**, bukan jumlahnya: aturan berbasis hitungan tergerus
satu per satu, aturan berbasis sasaran tidak. Wali tetap tidak bisa menandai izin anaknya
`diterima` — pembatalan hanya menghapus klaim, tidak memberikannya.

## Data pribadi

NIK, NISN, dan nomor rekening **disaring di `core` sebelum data keluar**, bukan diserahkan
pada prompt untuk menahan diri. Tool MCP tidak pernah mengembalikannya ke LLM dalam keadaan
apa pun. Rinciannya di `05-agent-boundary.md`.
