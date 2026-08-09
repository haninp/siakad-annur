# ADR 0010 — Pembatalan usulan izin, dan invarian `bot-wali` berbasis sasaran

**Status:** diterima · 9 Agustus 2026
**Mengubah:** ADR 0009 — memperluas daftar-putih dari satu handler jadi dua, dan mengganti
bentuk invariannya

## Konteks

ADR 0009 menyisakan satu utang yang diakui: **pembatalan usulan izin oleh wali belum
dirancang.** Pagar kedua di sana berbunyi "hanya sisip, tidak ubah, tidak hapus", sehingga
wali tidak punya jalan menarik kembali laporannya.

Keputusan pengelola: **pembatalan boleh, selama belum di-_acknowledge_ wali kelas.**

ADR 0009 juga menuliskan aturannya sendiri: daftar-putih handler tulis `bot-wali` berisi satu
nama, dan **penambahan kedua menuntut ADR baru yang memutuskan apakah pemisahan dua bot masih
layak dipertahankan.** Dokumen ini adalah ADR itu. Aturan yang ditulis untuk menahan
pelebaran diam-diam hanya berguna kalau benar-benar dijalankan ketika terpicu.

## Peninjauan: apakah pemisahan dua bot masih layak?

**Ya.** Nilai yang dijaga ADR 0005 adalah *satu bug di `bot-wali` tidak boleh membocorkan atau
merusak data akademik dan keuangan santri lain.* Handler kedua tidak menyentuh nilai itu:

- Ia hanya mengubah baris `usulan_izin` — tidak ada tabel lain yang bisa dijangkau.
- Ia hanya boleh menyentuh baris yang dilaporkan wali pengirim, ditegakkan `packages/core`.
- Ia hanya bisa memindahkan status `menunggu` → `dibatalkan`, arah yang **menghapus** klaim,
  bukan memberikannya. Wali tetap tidak bisa menandai izin anaknya `diterima`.
- Seluruh simbol tulis lain tetap absen dari binary.

Yang mengkhawatirkan bukan handler keduanya, melainkan **bentuk aturannya.** "Berisi satu
nama" adalah batas yang tergerus satu per satu: tiap penambahan tampak kecil, dan setelah
beberapa kali tidak ada lagi yang bisa dijelaskan mengapa batasnya di angka itu.

## Keputusan

### 1. Pembatalan diizinkan, dan syaratnya ditegakkan bentuk data

Handler kedua `batalkanIzin` masuk daftar-putih. Ia memindahkan status `menunggu` →
`dibatalkan` dan mengisi `dibatalkan_oleh_wali_id`.

Syarat "hanya selama belum di-_ack_" **tidak diserahkan pada urutan alur.** Ia jadi sifat
barisnya sendiri:

```sql
CHECK (
  status <> 'dibatalkan'
  OR (dibatalkan_oleh_wali_id IS NOT NULL
      AND ditanggapi_oleh_pengajar_id IS NULL   -- ⟵ inilah syaratnya
      AND waktu_tanggap IS NOT NULL)
)
```

Baris yang pernah di-_acknowledge_ wali kelas punya `ditanggapi_oleh_pengajar_id` terisi.
Karena itu baris batal yang juga memuatnya **tidak akan lolos ke basis data** — bahkan bila
suatu hari ada kode yang keliru mencoba membatalkan usulan yang sudah ditanggapi. Aturan yang
hanya hidup di alur bisa dilewati; aturan yang hidup di bentuk data tidak.

Pembatalan juga dipisah dari penanggapan: `dibatalkan_oleh_wali_id` berdiri sendiri, tidak
menumpang `ditanggapi_oleh_pengajar_id`. Menumpangkan keduanya akan membuat "siapa yang
menutup usulan ini" tidak terjawab — dan kolomnya merujuk tabel yang berbeda.

### 2. Invarian `bot-wali` berpindah dari hitungan ke sasaran

Daftar-putih tidak lagi sekadar nama, melainkan nama **beserta tabel yang boleh disentuhnya**:

```ts
export const HANDLER_TULIS_BOT_WALI: readonly HandlerTulis[] = [
  { nama: 'ajukanIzin', tabel: 'usulan_izin', operasi: 'sisip' },
  { nama: 'batalkanIzin', tabel: 'usulan_izin', operasi: 'ubah' },
];
```

**Invariannya sekarang: setiap handler tulis `bot-wali` hanya boleh menyentuh `usulan_izin`.**
Itu batas yang tidak tergerus oleh penambahan — handler kesebelas pun tetap tidak bisa
menyentuh `absensi`, `nilai`, atau tabel keuangan mana pun.

Jumlah handler **tetap diuji**, tapi perannya berubah: dari larangan menjadi **pemicu
tinjauan**. Ia memaksa orang membaca ulang ADR ini saat menambah, bukan memutuskan bolehnya.

## Konsekuensi

**Yang menjadi mungkin.** Wali menarik kembali laporan yang keliru — salah anak, salah
tanggal, atau ternyata anaknya jadi masuk — tanpa menunggu wali kelas dan tanpa mengganggu
siapa pun.

**Yang menjadi lebih baik dari ADR 0009.** Batasnya kini menyatakan hal yang benar-benar
dijaga. "Nol kecuali satu" melindungi lewat kelangkaan; "hanya `usulan_izin`" melindungi lewat
sasaran, dan itu bertahan terhadap pertumbuhan.

**Yang tetap harus dijaga.** Kalau suatu hari ada usulan menambahkan handler dengan `tabel`
selain `usulan_izin`, itu **bukan** perluasan daftar — itu pembatalan ADR 0005, dan harus
diperlakukan begitu.

**Yang belum diputuskan.** Apakah wali boleh membatalkan lalu mengajukan ulang untuk tanggal
yang sama, atau pembatalan bersifat final untuk hari itu. Sementara ini tidak dilarang skema;
bila ternyata disalahgunakan, batasnya ditambahkan di `core`, bukan di sini.
