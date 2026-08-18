# Handoff 0016 — Amendemen RFC-014: /terbitkan untuk bendahara + struktur menu

Tanggal: 2026-08-18
Status: selesai

## Yang dilakukan

1. **`/terbitkan` dibuka untuk bendahara** (`apps/bot-internal/src/index.ts`) —
   guard admin-only dihapus. Menerbitkan tagihan SPP bulanan (back office)
   diputuskan pemilik domain sebagai urusan keuangan. Admin tetap bisa.
2. **`docs/02-roles-matrix.md`** — baris "Terbitkan tagihan" → bendahara ✅ +
   catatan amendemen.
3. **`docs/rfcs/rfc-014-peran-bendahara.md`** — section Amendemen (butir 1
   diamendemen: /terbitkan tersedia bendahara; butir lain tetap).
4. **`docs/09-struktur-menu.md`** (baru) — struktur menu + role access
   (diagram Mermaid + tabel menu tombol & perintah).

## Catatan

- `/terbitkan` dipanggil via `terbitkanTagihanBulanan(dep, …)` (keuangan-batch)
  yang **tanpa gate peran di core** — ia batch back-office. Penegakan peran
  saat ini praktis di lapisan bot (hanya admin+bendahara yang lolos whitelist).
  Bila `pengurus`/`pengajar` dipetakan kelak, pertimbangkan gate peran di core.
- `docs/01..09` kini mencakup struktur menu (09). Perintah lain
  (`/setujui`, `/undang`, `/bayar`) tetap admin-only — tak berubah.
- Uji live: bendahara uji `/terbitkan` + `/laporan`; admin uji semua.