/**
 * Skenario uji A+B (RFC-012) — menyiapkan data agar reminder memicu:
 * 1. Sisip baris kalender hijriah PROVISIONAL mulai H+2 (sumber manual)
 * 2. Set jatuh_tempo tagihan terbit pertama → H+3 (jendela H-3)
 *
 * Jalankan: node data/uji-reminder.ts   (data/ tidak pernah masuk git)
 */
import { bukaBasisData, repoKalenderHijriah, repoTagihan } from '@siakad/db';

const db = bukaBasisData({ lokasi: 'data/sqlite/siakad.db' });

const hariIni = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const tambah = (n: number): string =>
  new Date(new Date(`${hariIni}T00:00:00+07:00`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

// 1. Kalender hijriah provisional — mulai H+2 (dalam jendela 3 hari worker)
const repoK = repoKalenderHijriah(db);
const mulaiUji = tambah(2);
repoK.sisip({
  tahun_hijriah: 1448,
  bulan_hijriah: 12,
  nama_bulan: 'Zulhijah',
  tanggal_mulai_masehi: mulaiUji,
  provisional: true,
  disetujui_oleh: null,
  disetujui_pada: null,
  diingatkan_pada: null,
  sumber: 'manual',
  catatan: 'Baris uji RFC-012 (hapus setelah selesai)',
});
console.log('kalender uji: 1448-12 Zulhijah mulai', mulaiUji);

// 2. Tagihan terbit pertama → jatuh tempo H+3 (H-3)
const repoT = repoTagihan(db);
const tagihan = db
  .prepare(`SELECT id FROM tagihan WHERE status = 'terbit' ORDER BY jatuh_tempo LIMIT 1`)
  .get() as { id: string } | undefined;
if (tagihan) {
  const jatuh = tambah(3);
  repoT.perbarui(tagihan.id, { jatuh_tempo: jatuh });
  console.log('tagihan uji:', tagihan.id, 'jatuh_tempo →', jatuh);
} else {
  console.log('tidak ada tagihan terbit — lewati');
}
