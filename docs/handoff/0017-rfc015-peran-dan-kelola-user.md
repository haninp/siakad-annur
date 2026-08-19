# Handoff 0017 — RFC-015: Rombak Peran & Pengelolaan User Superadmin

Tanggal: 2026-08-19
Status: selesai

## Yang dilakukan
1. **Rombak peran** — `Peran` → `superadmin/admin/bendahara/pengajar/wali`; `peranCukup`
   superadmin selalu lolos; semua gate handler disesuaikan (terbitkan tagihan →
   **bendahara**, catat manual → admin+bendahara, undangan wali → superadmin+admin,
   kalender/laporan → admin/bendahara). Enum `PeranPenggunaTelegram` ikut 5 peran.
2. **env** — `ADMIN_TELEGRAM_IDS` → `SUPERADMIN_TELEGRAM_IDS` (bootstrap 2 superadmin),
   `ADMIN_TELEGRAM_IDS` kosong (admin via undangan user), tambah
   `TELEGRAM_BOT_INTERNAL_USERNAME`.
3. **Bot** — `peranUntuk` 5 peran + fallback ke `pengguna_telegram` (user yang diundang);
   whitelist = peran terdaftar (bukan wali); menu & tombol digate per peran; **semua
   fitur jadi tombol**: Terbitkan / Catat bayar / Setujui kalender / Kelola user.
4. **Fitur undangan user (superadmin)** — superadmin pilih role (admin/bendahara/pengajar)
   → kode + deep link bot internal → calon user `/start <kode>` → terdaftar di
   `pengguna_telegram` dengan role tsb → akses menu sesuai role. `cariMenungguUser` di repo.
   **Penyederhanaan**: reuse `pengguna_telegram` (bukan tabel baru `undangan_user`).

## Catatan
- Superadmin tidak diundang; penetapan via `.env` (trust root, cegah privilege-escalation).
- `.env` diubah langsung (gitignored) saat deploy.
- Changelog commit: `7b136db` (rombak core) · `888bb15` (rombak bot) · (commit berikutnya:
  fitur undangan user + docs + deploy).
- Menunggu uji live: superadmin kelola user (undang bendahara → login), menu per peran,
  `/laporan` cocok dengan `/rekap`+`/piutang`.