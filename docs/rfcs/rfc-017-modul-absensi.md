# RFC-017: Modul Absensi Santri (Fase 2 Akademik)

**Status:** Implementasi selesai (2026-08-20).
**Author:** Hani + Hermes
**Relates:** RFC-016 (tool `tren_absen_santri`), ADR "LLM tidak menulis DB".

## Masalah
Sistem belum punya data kehadiran santri; tool `tren_absen_santri` (RFC-016) ditunda
karena belum ada sumber data.

## Keputusan
1. **Tabel `absensi`** (migrasi 11): per hari per santri → status `hadir/izin/sakit/alpa`,
   UNIQUE(santri_id, tanggal). Ditulis kode deterministik (LLM tidak menulis DB).
2. **Penegak izin di core** (`absensi.ts`): catat = superadmin/admin/pengajar.
3. **Tool baru** `tren_absen_santri` di `/analisis` → ringkasan hadir/izin/sakit/alpa per bulan
   (via `repoAbsensi.ringkasanPerBulan`).

## Skema
```
absensi(id, santri_id REFERENCES santri, tanggal, status CHECK, keterangan,
        dicatat_oleh, waktu, UNIQUE(santri_id,tanggal))
```

## Verifikasi
Build + lint + test hijau (408 test), termasuk test tool `tren_absen_santri`.

## Out of scope (sementara)
- Alur input absensi & sinkronisasi dengan `usulan_izin` wali (Fase 2 lanjutan).
- Dashboard/statistik kehadiran tingkat kelas/lembaga.
