# Handoff 0021 — RFC-017 lanjutan: Alur Absensi Pengajar (no.2)

Tanggal: 2026-08-20 · Status update 2026-08-23: **no.1 (provider LLM Go) SELESAI**; no.2 (alur absensi) lanjut di sesi baru.

## No.1 (LLM) — SELESAI (2026-08-23)
- Provider **"go"** = opencode-go (`https://opencode.ai/zen/go/v1`, model chat_completions
  memakai `{GO_BASE_URL}/chat/completions`, auth Bearer).
- `analisis-llm.ts`: `buatPenyediaNarasiZen` → diganti **`buatPenyediaNarasiGo`** (env
  `GO_BASE_URL`/`GO_API_KEY`/`GO_MODEL` + klien HTTP via `fetch`, timeout 60s, menolak bila
  salah satu env kosong). `urlChatCompletions` + `rangkaiNarasiAman` tetap.
- API key diletakkan di **`.env` repo siakad** (`/opt/data/work/siakad-annur/.env`); Hani sudah
  isi ketiganya. Restart bot `bash /opt/data/scripts/restart-bot-internal.sh`.
- Test hijau **422** (+8 untuk penyedia Go / url / normalisasi angka). Build & lint hijau.
- **Tersisa:** wiring penyedia ke menu `/analisis` bot (mengganti/melengkapi `teksAnalisis`
  deterministik dengan narasi ber-LLM lewat `rangkaiNarasiAman`) — keputusan UX milik Hani
  (ganti total vs tampilkan narasi di samping tabel).

## Yang SUDAH dikerjakan (fondasi domain — izin di core, AGENTS.md)
- `packages/core/src/absensi.ts` diperluas:
  - dep kini `{ repoAbsensi, repoSantri(ambilSemua/Santri aktif), repoUsulanIzin }`.
  - `catatAbsensi` (ada; pencatat = superadmin/admin/pengajar).
  - baru `daftarKehadiranHari({aktor, tanggal})` → `BarisKehadiran[]`
    `{santri_id, nis, nama, status(✔/—), adaIzinWali(bool)}` — utk penanda tombol & tombol "ack izin".
- Build/lint/test hijau (414). Commit checkpoint (belum dibuat).

## Yang TERSISA (pekerjaan no.2 di sesi baru)
1. **Bot menu absensi pengajar** (apps/bot-internal/src/index.ts): `/absen` →
   pilih rombel → daftar santri (nama+NIS, tanda ✔/—) → tap santri → tombol status
   (✅ Hadir / 📝 Izin / 🤒 Sakit / 🚫 Alpa) + tombol **"ack izin"** bila `adaIzinWali`.
2. **Relasi rombel→santri**: junction `santri_rombel` per tahun ajaran (akademik.ts);
   perlu repo/query utk daftar santri dalam rombel (belum dieksplorasi penuh).
3. State maps bot utk alur (pilih tanggal/hari; tampil daftar; pilih santri).
4. Test → docs → build hijau → deploy (migrasi tak berubah) → push.

## Ringkasan keputusan desain (no.2, dari Hani)
- Pengajar yang mengisi, **pilih nama anak + NIS**, mudah.
- **Penanda pada tombol** sudah-absen/belum.
- Anak **tidak masuk** → pilihan **tanpa keterangan (alpa)** atau **izin**.
- **Digabung permohonan izin wali**: tombol **"ack izin"** muncul saat absensi.