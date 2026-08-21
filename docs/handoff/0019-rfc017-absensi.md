# Handoff 0019 — RFC-017: Modul Absensi + tool tren_absen_santri

Tanggal: 2026-08-20 · Status: selesai
- Migrasi 11 `absensi` (UNIQUE santri_id+tanggal, status hadir/izin/sakit/alpa).
- `repoAbsensi` (catat/upsert, cari rentang, ringkasanPerBulan).
- Core `absensi.ts` (catatAbsensi, izin: superadmin/admin/pengajar).
- Tool `tren_absen_santri` di analisis-chat + menu `/analisis` (tombol "Tren absen santri").
- Test hijau (408).

Next: fase B kerangka LLM (pemeriksa angka + penyedia ADR 0006); alur input absensi menyusul.
