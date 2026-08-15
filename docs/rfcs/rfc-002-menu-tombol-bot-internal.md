# RFC-002: Menu Tombol (Button Card) di Bot Internal

**Status:** Accepted (2026-08-12)
**Author:** Hermes (atas permintaan Hani)
**Date:** 2026-08-12
**Relates to:** RFC-001 (bot internal minimal), docs/08-akademik-kebutuhan.md (pola tombol dulu)

---

## Konteks singkat

RFC-001 berjalan: bot internal punya 4 perintah teks. Masalahnya: pengurus/wali adalah
pengguna non-teknis — mengetik `/bayar <nis> <nominal>` adalah friksi. `docs/08` sudah
menetapkan prinsipnya sejak awal: **tombol dulu, ketik sebagai jaring pengaman**. RFC ini
menerapkannya ke bot internal.

## Keputusan yang diminta

Setujui: menu utama + alur tombol (inline keyboard) untuk status/terbit/bayar, dengan
perintah teks RFC-001 tetap ada sebagai fallback.

## Keputusan desain

1. **Inline keyboard** (menempel di pesan), bukan reply keyboard — tampil sebagai "card"
   yang berubah-ubah (satu pesan diedit sepanjang alur via `editMessageText`).
2. **Alur stateless** — seluruh state di-carry di `callback_data` (≤64 byte). Tidak ada
   session map; bot tidak perlu ingat apa pun. Aman terhadap restart.
3. **Pemilihan santri selalu lewat tombol**, berapa pun jumlah santrinya (konsisten dengan
   aturan `usulan_izin` di docs/08: jangan pernah menyembunyikan pilihan).
4. **Konfirmasi sebelum tulis** (`terbit`, `bayar`): tombol ✅/❌ dulu, baru handler dipanggil.
5. **Nominal cepat**: 150.000 / 250.000 / 450.000. Nominal lain → ketik `/bayar <nis> <nominal>`
   (fallback RFC-001). Tombol "ketik nominal" ditunda: butuh session state.
6. **Callback kedaluwarsa** (tombol lama setelah restart): ditolak dengan pesan
   "menu sudah kedaluwarsa, kirim /start".

## Scope

### In scope
- Menu utama: `📋 Status tagihan` · `🧾 Terbitkan SPP` · `💰 Bayar` (+ `🏠 Menu utama`)
- Pemilih santri (daftar aktif dari DB)
- Konfirmasi terbitkan / bayar
- Perintah teks RFC-001 tetap jalan; balasannya diberi tombol `🏠 Menu utama`

### Out of scope — keputusan eksplisit
| Hal | Alasan | Kapan dievaluasi |
|---|---|---|
| Pagination pemilih santri (>10) | Seed 2 santri; daftar penuh ~150 menyusul | Saat data sungguhan masuk |
| Nominal custom via tombol | Butuh session state; fallback perintah teks cukup | Iterasi berikutnya |
| bot-wali | Belum dibangun (di luar RFC-001) | Fase 2 / RFC tersendiri |

## Verifikasi

- `npm run build && npm run lint && npm test` hijau
- Uji live dari HP: `/start` → menu → tap `Terbitkan SPP` → pilih santri → ✅ → hasil; tap `Bayar` → nominal → ✅; `Status tagihan` → rincian
- Tombol lama (sebelum restart) ditolak dengan pesan kedaluwarsa, bukan galat

---

## Decision Log

| Tanggal | Keputusan | Pemicu | Oleh |
|---|---|---|---|
| 2026-08-12 | Accepted. Inline keyboard, alur stateless, konfirmasi sebelum tulis | Uji coba lapangan: pengurus tidak mau ketik perintah | Hani |
