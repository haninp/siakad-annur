# 05 — Batas Agent

## Kenapa ada agent

Pengurus kekurangan personil. Agent dipakai untuk memikul pekerjaan yang saat ini tidak ada
orangnya — bukan sebagai hiasan.

| Fitur                   | Pemicu                            | Keluaran                                  | Persetujuan                    |
| ----------------------- | --------------------------------- | ----------------------------------------- | ------------------------------ |
| **Ringkasan berkala**   | Cron pekanan (worker)             | Narasi kondisi pesantren ke grup pengurus | — (baca-saja)                  |
| **Tanya-jawab laporan** | Pengurus bertanya di bot-internal | Jawaban + angka + link Sheet              | — (baca-saja)                  |
| **Draft pesan ke wali** | `/pesanmassal`                    | Draft personal per-wali                   | **Wajib** — pengurus kirim     |
| **Draft isi rapor**     | `/rapor <kelas>`                  | Deskripsi capaian + catatan wali kelas    | **Wajib** — wali kelas setujui |

Ringkasan berkala adalah yang paling berdampak, karena tidak menuntut pengurus **ingat untuk
bertanya** — dan itu yang paling sering gagal pada tim kecil.

Draft pesan massal menyasar pekerjaan yang diam-diam paling memakan waktu: mengirim
pengingat tagihan ke puluhan wali, masing-masing dengan nama dan angka berbeda. **Tidak ada
auto-blast** — pengiriman selalu tindakan manusia, dieksekusi kode deterministik.

## Batas keras

### LLM tidak pernah menulis ke database

Seluruh perubahan data lewat kode deterministik. Usulan dari LLM selalu melewati persetujuan
manusia, dan yang mengeksekusi tetap kode biasa.

### MCP server hanya menyediakan tool baca

`packages/mcp-server` mengekspos tool bertipe — `rekap_absensi`, `progres_hafalan`,
`tunggakan_spp`, `cari_santri` — masing-masing menerima identitas pemanggil dan
melewatkannya ke `core` untuk penyaringan per-peran.

**Tidak ada tool tulis. Tidak ada tool SQL bebas.** Model tidak pernah menyusun query mentah
ke data santri.

Karena MCP protokol terbuka, server yang sama melayani agent operasional **dan** coding agent
saat pengembangan — satu permukaan, bukan dua.

### Data pribadi tidak pernah masuk prompt

**NIK, NISN, dan nomor rekening disaring di `core` sebelum data keluar** — bukan diserahkan
pada prompt untuk menahan diri.

Model tidak membutuhkannya untuk menyusun laporan apa pun, dan sekali data itu masuk ke
prompt, ia keluar dari kendali pesantren. Ini data anak di bawah umur; UU PDP berlaku dan
pesantren berkedudukan sebagai pengendali data.

Ada uji otomatis yang memanggil setiap tool MCP dan memeriksa pola keluarannya — bukan
diperiksa mata.

## Grounding — "angka dari tool, kalimat dari model"

Untuk sistem yang memegang nilai santri dan uang pesantren, satu angka karangan cukup
merusak kepercayaan pada seluruh sistem. Tiga lapis:

1. **LLM tidak pernah berhitung.** `packages/analytics` menghitung seluruh agregat lewat SQL
   dan menyerahkannya sebagai JSON terstruktur. Prompt melarang aritmetika.
2. **Pemeriksaan pasca-generasi.** Setiap angka dalam teks keluaran dicocokkan dengan angka
   pada JSON masukan. Ada angka yang tidak bersumber dari sana → keluaran ditolak dan
   dibangkitkan ulang, atau jatuh ke template statis. Pemeriksaan regex sederhana yang
   menangkap persis kegagalan paling berbahaya.
3. **Nama dan identitas dari slot template**, bukan dari teks model.

**Bila LLM tidak tersedia atau gagal grounding, sistem tetap mengirim laporan** dalam format
tabel polos. Fitur LLM memperbaiki keterbacaan; ia tidak pernah menjadi titik gagal.

## Runtime dan portabilitas

`packages/agent` berisi loop sendiri — sekitar 300 baris TypeScript memanggil endpoint
OpenAI-compatible. Bukan SDK vendor.

Hermes Agent sempat dipertimbangkan dan **tidak dipakai**: daya tarik utamanya (integrasi
Telegram, cron, memori) sudah kita punya sendiri atau tidak terpakai, sehingga yang tersisa
hanya loop pemanggil tool — tidak sepadan dengan menambah container Python.

Model ditentukan **per fitur** lewat env:

```
AGENT_BASE_URL · AGENT_API_KEY
AGENT_MODEL_RINGKASAN · AGENT_MODEL_TANYA · AGENT_MODEL_PESAN · AGENT_MODEL_REKAP · AGENT_MODEL_RAPOR
```

Pindah dari opencode Zen ke OpenRouter, Nous Portal, atau model lokal tidak menyentuh satu
baris kode pun.

## Biaya

Volume runtime sangat kecil, sehingga menghemat model untuk fitur jarang-pakai justru
mengorbankan kualitas demi selisih beberapa sen. **Model bagus di semua tempat, hemat hanya
pada satu fitur yang benar-benar bulk** (draft pesan massal dan rekap bulanan wali).

Perkiraan total **≈ $0,50/bulan** pada skala 150 santri. Rincian per fitur ada di plan
Bagian 7.

Akun runtime **terpisah** dari akun coding: bila runtime menumpang jatah langganan coding,
sesi pengembangan yang boros bisa menghabiskan kuota dan laporan pengurus gagal terkirim.
Produksi tidak boleh berebut kuota dengan development.
