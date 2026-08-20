# 02 — Peran dan Izin

> **Izin hanya ditegakkan di `packages/core`.** Bot dan MCP server sama-sama memanggilnya.
> Jangan pernah menulis aturan izin di dua tempat — begitu terjadi, keduanya akan menyimpang
> dan tidak akan ada yang tahu mana yang benar.

## Peran

| Peran        | Melekat pada                          | Penetapan                  | Kanal        |
| ------------ | ------------------------------------- | -------------------------- | ------------ |
| `superadmin` | pengelola sistem (2 orang, trust root)| `.env` `SUPERADMIN_TELEGRAM_IDS` | bot-internal |
| `admin`      | eks `pengurus`; pantau & kelola master| undangan user (RFC-015)    | bot-internal |
| `bendahara`  | keuangan: terbitkan, laporan, verifikasi | undangan user (RFC-015) / env | bot-internal |
| `pengajar`   | mudaris / pengajar mapel / wali kelas | undangan user (RFC-015)    | bot-internal |
| `wali`       | orang tua & orang tua asuh            | undangan wali (RFC-009)    | bot-wali     |

Satu orang dapat memegang beberapa peran akademik sekaligus — seorang mudaris bisa juga
wali kelas dan pengajar mapel.

Peran (RFC-015): **superadmin adalah peran tertinggi** (selalu lolos semua gate). `admin`
adalah pengganti nama `pengurus`. **Bendahara** memegang urusan keuangan termasuk
**menerbitkan tagihan** (berpindah dari admin/pengurus). Superadmin tidak diundang — hanya
via `.env` (trust root di luar mekanisme sistem, cegah privilege-escalation lewat kode).

## Matriks

| Aksi                                             | superadmin | admin | bendahara |       pengajar       |     wali      |
| ------------------------------------------------ | :--------: | :---: | :-------: | :------------------: | :-----------: |
| Kelola user (undang admin/bendahara/pengajar)    |     ✅     |   —   |     —     |          —           |       —       |
| Kelola data master (santri, kelas, mapel, tarif) |     ✅     |   ✅  |     —     |          —           |       —       |
| Analisis data (chat/`/analisis`)                 |     ✅     |   ✅  |    ✅     |          —           |       —       |
| Terbitkan tagihan (invoice) — back office        |     ✅     |   —   |    ✅     |          —           |       —       |
| Catat pembayaran (manual)                        |     ✅     |   —   |    ✅     |          —           |       —       |
| Pantau status pembayaran & piutang               |     ✅     |   ✅  |    ✅     |          —           |       —       |
| Baca laporan keuangan (terbit/masuk/sisa)        |     ✅     |   ✅  |    ✅     |          —           |       —       |
| Verifikasi / tolak usulan pembayaran wali (RFC-008)|    ✅     |   ✅  |    ✅     |          —           |       —       |
| Tetapkan keringanan & alokasi PROTA              |     ✅     |   ✅  |    —      |          —           |       —       |
| Buat & cabut undangan wali                       |     ✅     |   ✅  |    —      |          —           |       —       |
| Perbarui `kalender_hijriah`                      |     ✅     |   ✅  |    —      |          —           |       —       |
| Tulis absensi **halaqah**                        |     ✅     |   —   |    —      | mudaris halaqah itu  |       —       |
| Tulis absensi **kelas**                          |     ✅     |   —   |    —      |  pengajar kelas itu  |       —       |
| Tulis setoran hafalan                            |     ✅     |   —   |    —      | mudaris halaqah itu  |       —       |
| Tulis nilai                                      |     ✅     |   —   |    —      |  pengampu mapel itu  |       —       |
| Setujui rapor                                    |     ✅     |   —   |    —      | wali kelas kelas itu |       —       |
| Baca seluruh santri                              |     ✅     |   ✅  |    —      |          —           |       —       |
| Baca santri yang diampu                          |     ✅     |   ✅  |    —      |          ✅          |       —       |
| Baca santri yang tertaut padanya                 |     ✅     |   ✅  |    —      |          —           |      ✅       |
| Ajukan izin absen anaknya (`usulan_izin`)        |     ✅     |   ✅  |    —      |          ✅          |      ✅       |
| Batalkan usulan izin **selama belum di-ack**    |     ✅     |   ✅  |    —      |          —           |   pelapornya  |
| Tanya-jawab bebas ke agent                       |     ✅     |   ✅  |    —      |          —           |       —       |
| Lihat NIK / NISN / no. rekening                  |     ✅     |   ✅  |    —      |          —           | milik anaknya |

> **Catatan (RFC-014 + RFC-015):** "Catat pembayaran manual" & "Terbitkan tagihan" adalah
> urusan **bendahara** (superadmin tetap bisa). Verifikasi usulan wali = bendahara/admin.
> Undangan **user** (staf) = khusus **superadmin**. Bot menyembunyikan menu/tombol di luar
> hak peran, tetapi **penegak izin terakhir tetap handler di `packages/core`** (AGENTS.md).

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
