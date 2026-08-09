# ADR 0009 — Jalur tulis sempit untuk bot wali: `usulan_izin`

**Status:** diterima · 9 Agustus 2026
**Mengubah:** ADR 0005 (dua bot terpisah) — tidak membatalkannya, mempersempit invariannya
**Diperluas:** ADR 0010 — daftar-putih jadi dua handler, dan invariannya berpindah dari
hitungan ke sasaran

## Konteks

ADR 0005 menetapkan `apps/bot-wali` **tidak meng-import satu pun handler tulis**, dan
kemampuan tulis harus **absen dari binary-nya** — diverifikasi lewat uji build, bukan dijaga
runtime guard. `docs/02-roles-matrix.md` dan `AGENTS.md` menyatakan hal yang sama.

Kebutuhan lapangan (`docs/08-akademik-kebutuhan.md` bagian 7) meminta wali melaporkan sendiri
bahwa anaknya tidak masuk. Laporan itu harus tersimpan supaya bisa didistribusikan ke wali
kelas dan ditagih bila tak kunjung ditanggapi. Itu penulisan, dan invarian di atas melarangnya.

Dua jalan keluar dipertimbangkan. Yang ditolak dibahas di bawah.

## Keputusan

**`apps/bot-wali` boleh menulis ke tepat satu tabel — `usulan_izin` — lewat tepat satu handler.**
Selebihnya tetap baca-saja.

```
usulan_izin   id · santri_id · tanggal · jenis (sakit|izin) · alasan
              · dilaporkan_oleh · dicatat_oleh · kanal
              · status (menunggu|diterima|ditolak|dibatalkan)
              · ditanggapi_oleh · waktu_tanggap
```

Invariannya berubah bentuk, bukan hilang. Sebelumnya: *"tidak ada simbol tulis"*. Sekarang:
**"tidak ada simbol tulis selain `ajukanIzin`"** — masih bisa diperiksa uji build, dengan
daftar-putih yang ditulis eksplisit dan berisi tepat satu nama.

### Pagar yang menjaga nilai asli ADR 0005 tetap utuh

Nilai yang dijaga ADR 0005 adalah **wali tidak bisa menyentuh data akademik dan keuangan
santri**. Menulis usulan miliknya sendiri yang belum berlaku tidak melanggar nilai itu —
selama enam pagar berikut berdiri:

1. **`usulan_izin` bukan `absensi`.** Ia tidak pernah memengaruhi kehadiran sampai wali kelas
   meng-_acknowledge_. Yang menulis `absensi` tetap `bot-internal`.
2. **Hanya sisip, tidak ubah, tidak hapus.** Wali tidak bisa mengubah status usulannya sendiri
   menjadi `diterima`. Transisi status milik wali kelas, dan terjadi di `bot-internal`.
3. **Hanya untuk santri yang tertaut padanya.** Ditegakkan `packages/core`, bukan bot — sesuai
   `docs/02-roles-matrix.md`, izin hanya ditegakkan di satu tempat.
4. **Tidak memuat satu pun field akademik atau keuangan.** Tidak ada nilai, tidak ada tagihan,
   tidak ada poin.
5. **`santri_id` dan `tanggal` wajib eksplisit**, tidak boleh disimpulkan dari pengirim.
   Satu wali bisa punya beberapa santri; menebak akan salah secara senyap.
6. **Tidak ada LLM di jalur ini.** Kalau ekstraksi kalimat bebas dipakai, keluarannya divalidasi
   zod lebih dulu dan tetap menjadi usulan. Batas `AGENTS.md` tidak bergerak: LLM tidak pernah
   menulis ke basis data.

## Alternatif yang ditolak

**`bot-wali` tetap benar-benar baca-saja**, dengan laporan diteruskan sebagai pesan Telegram
bertombol ke wali kelas dan seluruh penulisan terjadi di `bot-internal` saat tombol ditekan.

Ditolak karena harganya jatuh pada hal yang lebih pokok: **usulan yang tidak pernah ditanggapi
tidak berjejak sama sekali.** Wali sudah mengabari, tidak ada yang menekan tombol, anak
tercatat `alpa`, dan tidak ada catatan bahwa kabar itu pernah masuk.

Itu persis jenis kegagalan senyap yang jadi alasan proyek ini ada — sistem lama rusak bukan
karena error yang kentara, melainkan karena angka tetap tampil sementara sebagiannya keliru
dan tidak ada yang bisa memeriksa yang mana.

Kemurnian invarian dibeli dengan kehilangan jejak. Harganya terlalu mahal.

## Konsekuensi

**Yang menjadi mungkin.** Wali melaporkan langsung ke sistem. Kabar yang masuk lewat jalur
lisan bisa dicatatkan pengampu absen ke tabel yang sama, sehingga wali kelas selalu diberi
tahu apa pun pintu masuknya — lihat `docs/08-akademik-kebutuhan.md` bagian 8.

**Yang menjadi lebih lemah.** Invarian "nol simbol tulis" adalah properti yang bisa diperiksa
tanpa berpikir; "nol kecuali satu" menuntut orang membaca daftar-putihnya. Perbedaannya kecil
hari ini dan membesar setiap kali ada yang menambah satu nama lagi.

**Yang harus dijaga.** Daftar-putihnya berisi **satu** nama. Penambahan kedua bukan perubahan
kecil — ia menandakan invariannya sudah tidak menahan apa-apa, dan menuntut ADR baru yang
memutuskan apakah pemisahan dua bot masih layak dipertahankan. Uji build menyebut jumlahnya,
bukan hanya isinya, supaya penambahan tidak lolos tanpa disadari.

**Utang yang diakui — sudah dilunasi ADR 0010.** Pembatalan usulan oleh wali kini diizinkan
selama belum di-_acknowledge_ wali kelas, lewat handler kedua `batalkanIzin`. Pagar 2 di atas
karenanya berbunyi lebih tepat: wali tidak bisa **memberikan** klaim pada dirinya sendiri;
menarik kembali klaim yang belum berlaku tidak dilarang.

**Dokumen yang ikut berubah.** `AGENTS.md` dan `docs/02-roles-matrix.md` diperbarui bersama
ADR ini. Membiarkan ketiganya berbeda akan mengulang persis kesalahan yang dilarang repo ini:
kebenaran yang sama hidup di dua tempat lalu menyimpang.
