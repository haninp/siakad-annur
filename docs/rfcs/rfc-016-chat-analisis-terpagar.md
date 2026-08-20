# RFC-016: Chat Analisis Data Terpagar (LLM Baca-Saja untuk Admin & Bendahara)

**Status:** Deterministik selesai (2026-08-20) — tool + core + audit + menu `/analisis`
terpasang & ter-commit. Lapisan LLM (rangkai kalimat) menyusul saat key Zen (P5) tersedia.
**Author:** Hani (ide) + Hermes (rancangan)
**Date:** 2026-08-19
**Relates to:** ADR 0006 (satu antarmuka penyedia LLM + validasi zod), `packages/analytics`
(SQL agregat), `packages/mcp-server` (tool baca ber-scope peran), RFC-015 (peran),
AGENTS.md (Angka dari SQL / data pribadi tidak di prompt / LLM tak menulis DB)

---

## Problem Statement

Admin & bendahara ingin bertanya **dalam bahasa natural** hal-hal analitis (tren absen
santri tertentu, tren siklus pembayaran SPP per wali, dsb.) tanpa harus memegang laporan
atau memahami SQL. Namun **interaksi harus dijaga, tidak "bebas banget"**: jawaban harus
berasal dari database yang ada, tidak boleh karangan, tidak boleh membocorkan data pribadi,
dan LLM tidak boleh menulis apa pun.

## Keputusan

1. **Chat analisis = tool-gated retrieval, bukan free-chat.** LLM **tidak pernah menyentuh
   database langsung**. Ia hanya dapat memanggil **tool baca-saja** yang sudah ber-scope
   peran. Tool menghitung agregat di SQL (`packages/analytics`), mengembalikan **JSON**.
   LLM berperan sebagai penerjemah bahasa: pertanyaan → pilih tool → rangkai jawaban.
2. **Tool awal (tajam & sedikit, diperluas bertahap):**
   - `tren_pembayaran_spp({ nis | wali_id, mulai, selesai })` → per periode: terbit/lunas/masuk/sisa.
   - `tren_absen_santri({ santri_id, mulai, selesai })` → ringkasan absensi per periode/usulan izin.
   - `ringkasan_laporan({ periode })` → laporan keuangan per komponen + ringkasan (RFC-014).
   Setiap tool punya **parameter zod**, **tanpa SQL mentah**; skema tabel tidak bocor ke model.
3. **Scope peran di-enforce di core** (sama seperti izin sekarang): admin/bendahara →
   keuangan + absen lintas santri; wali → hanya anaknya sendiri; pengajar → hanya yang diampu.
   Bot hanya routing; **penegak terakhir = core**.
4. **Output diperiksa** (pola "Angka dari SQL, kalimat dari model"): **pemeriksa menolak
   jawaban yang memuat angka yang tidak ada di JSON tool**. Model dilarang menjawab dari
   pengetahuan umum — semua klaim angka wajib berasal dari tool yang dipanggil.
5. **Data pribadi tidak masuk prompt** (NIK/NISN/no. rekening disaring di tool/core,
   bukan diserahkan pada model untuk menahan diri). Tool diarahkan mengembalikan **agregat**,
   bukan baris mentah, agar minim PII.
6. **Tulis dilarang total**: LLM tidak pernah menulis/penghapusan ke database
   (jalur tulis bebas-LLM ABSEN, konsisten AGENTS.md). Model hanya memanggil tool baca.
7. **Audit**: tiap pertanyaan + tool yang dipanggil (beserta parameternya) + jawaban
   dicatat ke `audit_log` (siapa, kapan).
8. **Penyedia LLM lewat satu antarmuka** (per ADR 0006), dan setiap keluaran **divalidasi
   zod** sebelum ditampilkan — model murah tidak menjamin bentuk.
9. **Pintu masuk**: perintah/menu `/analisis` di bot internal, tersedia untuk
   **superadmin/admin/bendahara** (superadmin selalu lolos untuk setup & uji).
   Wali/pengajar TIDAK — menyusul dengan scope sempit masing-masing.
10. **Promosi pola → menu deterministik (anti-prompting).** Audit mencatat setiap
    kombinasi tool + parameter. Bila sebuah **pola permintaan muncul berulang/dominan**
    (mis. "tren pembayaran SPP santri X bulan lalu"), percepatan ke jalur deterministik
    layak dipertimbangkan: eksekusi tool langsung, **tanpa menyentuh LLM** — murah,
    konsisten, hasil pasti. Jalur *chat → menu*.
11. **Governance pengembangan: perubahan TIDAK lewat bot.** Penambahan/pengubahan tool
    atau menu analisis **bukan aksi pengguna bot internal**. Bot hanya **mencatat pola
    yang sering dipakai** (audit) sebagai bahan usulan — ia TIDAK pernah
    mengeksekusi/menambah fitur sendiri. Untuk menjadikan sebuah pola menu permanen:
    **persetujuan superadmin** → **dijadikan RFC** → **dieksekusi lewat diskusi di luar bot**
    (agent). Intinya, proses pengembangan selalu melalui diskusi, bukan langsung dari bot.

## Skema

Tidak ada tabel core baru. Memanfaatkan tabel eksisting (`tagihan`, `pembayaran`,
`absensi`, `usulan_izin`, `pengguna_telegram`, dst). Interaksi analisis dicatat di
`audit_log` (kolom: aktor, perintah `chat-analisis`, tool, parameter, jawaban ringkas,
waktu).

## Peta implementasi

1. `packages/analytics` — implementasi SQL tiap tool (bronze/silver/gold atau kueri ad hoc
   ber-scope) → fungsi `trenPembayaranSpp(...)`, `trenAbsenSantri(...)`, `ringkasanLaporan(...)`
   (reuse `repoLaporan` RFC-014).
2. `packages/core` — `analisis-chat.ts`: `buatHandlerAnalisisChat` → input
   `{ aktor, tool, parameter }`; **enforce scope peran** + validasi zod parameter + panggil
   tool → JSON. Ini satu-satunya penegak izin (AGENTS.md).
3. **Pemeriksa output** — `pemeriksaAngka(teks, json)` menolak jawaban yang memuat angka
   di luar nilai pada JSON tool (pola eksisting di AGENTS.md).
4. Penyedia LLM — panggil via antarmuka penyedia (ADR 0006); untuk versi pertama boleh
   **delegasi tool-selection** sederhana: user pilih intent/tool (tombol) lalu model hanya
   merangkai kalimat dari JSON tool. (Opsi B lebih aman & murah — lihat Catatan.)
5. Bot — `/analisis` + menu tombol per tool; alur: pilih tool → isi parameter (NIS/santri/
   rentang, divalidasi) → model rangkai → tampil + simpan audit.
6. Test — scope peran (wali hanya anaknya; admin/bendahara lintas; pengajar = yang diampu;
   non-staf ditolak), pemeriksa angka (tolak angka karangan), validasi parameter, audit
   tercatat.  Pilih `analytics`.
7. docs: `docs/02` (akses analisis = admin/bendahara), STATE, handoff.

## Verifikasi

- `npm run build && npm run lint && npm test` hijau.
- Smoke test: admin tanya "tren pembayaran SPP santri X bulan lalu" → jawaban memakai tool
  dan angka cocok dengan `/rekap`+`/piutang`; wali hanya dapat data anaknya; jawaban yang
  memuat angka karangan ditolak pemeriksa; tidak ada jalur LLM menulis ke DB.
- Audit: baris `chat-analisis` tercatat dengan tool + parameter + aktor.

## Out of scope

- **Free-chat umum** (tanya apa saja di luar tool) — tidak dibuka.
- LLM menulis/menghapus data — dilarang total.
- Ekspor hasil ke Google Sheets (P2).
- Akses analisis untuk wali/pengajar — menyusul dengan scope sempit masing-masing.

## Catatan untuk konfirmasi

- **Mode tool-selection**: (A) LLM bebas memilih tool dari menu; atau (B) **user memilih
  tool via tombol** dulu, lalu LLM hanya merangkai kalimat dari JSON tool. (B) lebih aman &
  hemat, direkomendasikan untuk rilis pertama.
- Daftar tool awal cukup `tren_pembayaran_spp` + `tren_absen_santri` + `ringkasan_laporan`?
- Penyedia LLM mana yang dipakai (Zen per ADR 0006)? Butuh token/key.
