# ADR 0003 — MCP sebagai batas agent, jalur tulis bebas LLM

**Status:** diterima · 8 Agustus 2026

## Konteks

Pesantren kekurangan personil, sehingga LLM punya peran nyata: ringkasan berkala,
tanya-jawab laporan, draft pesan ke wali, draft isi rapor.

Pertanyaannya bukan _apakah_ memakai LLM, melainkan **seberapa jauh ia boleh menyentuh
data** — sistem ini memegang uang pesantren dan nilai santri.

Pilihan runtime yang dipertimbangkan: Hermes Agent (MIT, self-host, punya Telegram + cron +
memori bawaan), opencode Zen sebagai gateway, atau loop sendiri.

## Keputusan

**Batas sistem adalah MCP server milik sendiri; runtime hanya mencolok ke sana.**

1. **`packages/mcp-server` menyediakan tool baca-saja ber-scope peran.** Tidak ada tool
   tulis, tidak ada tool SQL bebas. Tiap tool menerima identitas pemanggil dan
   melewatkannya ke `core` untuk penyaringan.

2. **Jalur tulis 100% deterministik.** Usulan LLM selalu melewati persetujuan manusia, dan
   yang mengeksekusi tetap kode biasa.

3. **Runtime = loop sendiri di `packages/agent`**, sekitar 300 baris memanggil endpoint
   OpenAI-compatible. **Hermes tidak dipakai**: daya tarik utamanya (Telegram, cron, memori)
   sudah kita punya atau tidak terpakai, sehingga yang tersisa hanya loop pemanggil tool —
   tidak sepadan dengan menambah container Python sebagai bahasa kedua.

4. **Model per fitur lewat env.** Pindah provider tidak menyentuh kode.

## Grounding

**Angka dari SQL, kalimat dari model.** Satu angka karangan pada laporan keuangan pesantren
cukup untuk menghapus kepercayaan pada seluruh sistem — dan begitu pengurus tidak percaya
laporannya, fitur ini jadi beban, bukan bantuan.

Tiga lapis:

1. `analytics` menghitung seluruh agregat lewat SQL, diserahkan sebagai JSON. Prompt
   melarang aritmetika.
2. Pemeriksaan pasca-generasi mencocokkan setiap angka pada teks keluaran dengan angka pada
   JSON masukan. Tidak bersumber → ditolak, dibangkitkan ulang, atau jatuh ke template statis.
3. Nama dan identitas dari slot template, bukan dari teks model.

**Bila LLM mati, laporan tetap terkirim** sebagai tabel polos. Fitur LLM memperbaiki
keterbacaan; ia tidak pernah menjadi titik gagal.

## Konsekuensi

- Bila runtime agent mengecewakan, ia diganti tanpa menyentuh kode SIAKAD
- MCP server yang sama melayani coding agent saat pengembangan — satu permukaan, bukan dua
- Akun LLM runtime **terpisah** dari akun coding, agar produksi tidak berebut kuota dengan
  development
- Uji wajib: daftar tool MCP tidak memuat satu pun tool tulis (diperiksa otomatis)
