# 00 — Gambaran Umum

## Untuk siapa

**Pesantren An-Nuur Limo**, Depok. Sekitar 100–150 santri pada tiga marhalah: RA-PAUD,
MI Banin, MI Banat. Menginduk ke **PKBM**, sehingga terikat pada Dapodik, Verval PD,
e-Rapor kesetaraan, dan TKA.

Pengurus berjumlah sedikit. Tidak ada staf IT. Hampir semua pengguna mengakses dari Android.

## Masalah yang diselesaikan

Operasional keuangan berjalan di atas dua spreadsheet Google yang disusun seadanya. Dua hal
membuatnya mendesak:

1. **Hanya satu orang yang memahami strukturnya.** Selama itu bertahan, pesantren berjarak
   satu orang berhalangan dari kehilangan akses pada pemahaman keuangannya sendiri.
2. **Pembacaan menemukan ~5.269 sel rusak** (`#N/A`, `#VALUE!`, `#REF!`) yang merambat
   lewat lookup ke Kartu Kendali dan seluruh laporan turunan.

Arahnya bukan menuju kegagalan yang kentara, melainkan **kesalahan yang senyap**: angka
tetap tampil, sebagian keliru, dan tidak ada yang bisa memeriksa yang mana — karena
satu-satunya orang yang memahami strukturnya juga satu-satunya yang bisa mengauditnya.

Karena itu pekerjaan ini lebih dekat ke **penyelamatan daripada peningkatan**.

## Apa yang dibangun

| Lapisan            | Isi                                                                          |
| ------------------ | ---------------------------------------------------------------------------- |
| Masukan harian     | Dua bot Telegram — internal (pengurus/pengajar/admin) dan wali (baca-saja)   |
| Sumber kebenaran   | SQLite, satu berkas, mode WAL                                                |
| Analitik & sejarah | DuckDB berlapis bronze/silver/gold dengan star schema + SCD Type 2           |
| Permukaan baca     | Google Sheets terbit otomatis + Metabase                                     |
| Bantuan            | Agent LLM untuk ringkasan, tanya-jawab, dan draft — **tidak pernah menulis** |

Google Sheets sengaja dipertahankan sebagai permukaan baca: mengubah kebiasaan ratusan
orang lebih mahal daripada mempertahankan alat yang sudah mereka kuasai.

## Apa yang tidak dibangun

- **Dapodik, Verval PD, e-Rapor, TKA** tetap milik kementerian. SIAKAD **memasok** data
  siap-salin, bukan menyaingi. Membangun ulang format rapor Kurikulum Merdeka berarti
  mengejar target yang terus bergerak sambil membuat pengurus entri dua kali.
- **Panel web admin.** Seluruh administrasi lewat Telegram dan Google Sheets.

## Prinsip yang mengikat seluruh rancangan

1. **Ramah tim tanpa IT.** Hanya dua permukaan administrasi: Telegram dan Sheets. Tidak ada
   terminal, tidak ada SQL. Sistem melapor sendiri dalam bahasa substantif, bukan teknis.
2. **Jalur tulis bebas LLM.** Data keuangan dan nilai santri tidak pernah bergantung pada
   keputusan model.
3. **Angka dari SQL, kalimat dari model.** Ditegakkan mekanis, bukan lewat prompt.
4. **Angka turunan dihitung, tidak disimpan.** Persis kesalahan yang merusak sistem lama.
5. **Portabilitas.** Repo tidak terkunci pada satu vendor agent; `rm -rf .claude/` harus
   tidak mengurangi apa pun.
6. **Data pribadi anak dilindungi.** NIK, NISN, dan nomor rekening tidak pernah masuk prompt.

## Urutan pembangunan

Keuangan lebih dulu — di situlah masalah nyata. Akademik menyusul setelah keuangan stabil,
agar pengurus dan pengajar tidak menghadapi dua perubahan kebiasaan sekaligus.

Fase penuh ada di `docs/TUGAS.md`; pembenaran tiap keputusan ada di `docs/adr/`.

## Peta dokumen

| Berkas                 | Isi                                             |
| ---------------------- | ----------------------------------------------- |
| `01-domain-model.md`   | Entitas dan relasi                              |
| `02-roles-matrix.md`   | Peran × aksi → izin                             |
| `03-data-flow.md`      | SQLite → DuckDB → Sheets & Metabase             |
| `04-onboarding.md`     | Undangan wali lewat deep link Telegram          |
| `05-agent-boundary.md` | Batas agent, MCP, dan aturan grounding          |
| `06-migrasi-legacy.md` | Pembacaan spreadsheet lama _(menunggu sesi P3)_ |
| `adr/`                 | Keputusan arsitektur ber-nomor                  |
| `STATE.md`             | Kondisi terkini — dibaca lebih dulu tiap sesi   |
| `TUGAS.md`             | Backlog berurutan                               |
