# ADR 0006 — Portabilitas dan anti vendor lock-in

**Status:** diterima · 8 Agustus 2026

## Konteks

Repo dikerjakan **bergantian** oleh Claude Code dan opencode, dipilih menurut ketersediaan
saat itu. Pemilik project tidak ingin terkunci pada format project satu vendor.

Konsekuensinya: setiap sesi bisa dimulai oleh agent mana pun, tanpa ingatan dari sesi
sebelumnya. **Repo yang harus menanggung konteks itu, bukan percakapan.**

## Keputusan

1. **Pengetahuan hidup sebagai markdown biasa** (`docs/`, `AGENTS.md`); **pekerjaan hidup
   sebagai npm script** — bisa dijalankan manusia tanpa agent sama sekali.
2. **`AGENTS.md` satu-satunya sumber instruksi.** `CLAUDE.md` dan `.opencode/AGENTS.md`
   hanya menunjuk ke sana.
3. **Folder vendor hanya adapter tipis.** Skill hidup di `/skills` (format terbuka
   agentskills.io); `.claude/skills` cuma symlink.
4. **`docs/STATE.md` sebagai serah terima**, `docs/TUGAS.md` sebagai backlog bertanda bobot.
5. **Test sebagai kontrak, bukan ingatan.** Agent pengganti tidak perlu mempercayai narasi
   apa pun — ia menjalankan test.

## Uji

- `rm -rf .claude/` → repo tetap bisa dikerjakan penuh; semua npm script jalan
- `grep -ri "anthropic\|claude" packages/ apps/` → nihil di kode produksi
- Ganti `AGENT_BASE_URL` ke provider lain → fitur agent tetap jalan tanpa ubah kode

Uji pertama sudah dijalankan dan lolos pada commit 0.3/0.4.

## Konsekuensi

- Tidak boleh ada slash-command atau fitur khas satu agent yang menjadi **satu-satunya** cara
  menjalankan sesuatu
- Keputusan arsitektur wajib masuk `docs/adr/`, karena percakapan hilang saat sesi berganti
