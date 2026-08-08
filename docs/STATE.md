# STATE — kondisi terkini

> Diperbarui di akhir setiap sesi. Berkas ini yang dibaca lebih dulu oleh agent berikutnya,
> apa pun mereknya. STATE yang basi lebih berbahaya daripada tidak ada, karena ia dipercaya.

**Terakhir diperbarui:** 8 Agustus 2026

---

## Yang baru selesai

Fase 0 tugas **0.1 – 0.4**:

- Struktur monorepo final: 7 paket + 3 aplikasi, npm workspaces, TypeScript project references
- `npm run build`, `npm run lint`, `npm test` hijau; 0 kerentanan npm
- `AGENTS.md` sebagai sumber instruksi tunggal; `CLAUDE.md` dan `.opencode/AGENTS.md` hanya penunjuk
- `skills/` di akar repo, `.claude/skills` cuma symlink — uji-hapus `.claude/` lolos
- Skrip `mulai` dan `selesai` berjalan (Node 26 menjalankan TypeScript tanpa flag)

## Sedang dikerjakan

Tidak ada. Sesi berhenti di batas tugas yang bersih.

## Langkah berikutnya

Ambil **0.5** (dokumen dasar `docs/00`–`05`) dari `docs/TUGAS.md`. Sebagian besar isinya
dapat diangkat dari plan yang sudah disetujui — lihat bagian "Yang perlu diketahui" di bawah.

Jalur yang tidak saling menunggu:

- **0.8** (baca file 03) bisa dikerjakan kapan saja, tidak bergantung apa pun
- **0.10** bagian identitas/wali/akademik boleh mulai tanpa menunggu 0.9

## Keputusan yang menggantung

Semuanya menunggu jawaban pesantren, bukan menunggu kode:

1. **P3 — sesi dengan pemegang pengetahuan keuangan.** Memblokir 0.9, dan 0.9 memblokir
   bagian keuangan pada `contracts`. Pertanyaannya: status TAYSIR, aturan penetapan
   keringanan, perlakuan santri yang keluar di tengah tahun, sisa dana PROTA yang tidak
   teralokasi, dan apakah awal tahun ajaran benar bergeser ke Juli.
2. **Perlindungan data**: bentuk persetujuan wali, masa retensi data alumni, akses wali
   setelah santri keluar, penanggung jawab data.
3. **Akademik**: daftar mapel per jalur & marhalah, skala nilai diniyah, aspek akhlak,
   hari & jam KBM. **Tidak memblokir** — keempatnya tabel seed, diisi lewat Sheet Pola.

## Yang perlu diketahui

- **Plan lengkap** ada di `~/.claude/plans/abstract-soaring-starfish.md`. Berisi seluruh
  rancangan, temuan pembacaan spreadsheet lama, dan pembenaran tiap keputusan. Isi
  `docs/00`–`05` dan `docs/adr/` diangkat dari sana.
- **Temuan paling penting dari spreadsheet lama**: ~5.269 sel rusak (`#N/A`, `#VALUE!`,
  `#REF!`) yang merambat lewat lookup ke Kartu Kendali dan seluruh laporan. Karena itu
  angka turunan **dihitung ulang**, tidak pernah disalin.
- **Dua skema periode SPP** hidup berdampingan di data lama: Hijriah (sampai ~Maret 2026)
  dan Masehi (`1. April 2026` … `15. Juni 2027`). Importer wajib menangani keduanya.
- **Akademik adalah lahan kosong** — tidak ada sistem akademik di Drive. Dirancang dari
  awal, bukan dimigrasikan.

## Jebakan yang ditemukan

- `vitest` 2.x membawa 5 kerentanan (1 kritis) lewat vite/esbuild. Sudah dinaikkan ke 4.x.
  Jangan turunkan kembali.
- Struktur folder awal sempat dibuat mengikuti rancangan lama (`packages/agent`, `apps/bot`
  tunggal). Sudah dirapikan di 0.1 — kalau menemukan rujukan ke nama itu di dokumen mana
  pun, itu sisa yang terlewat.
