/**
 * Wrapper transaksi untuk operasi keuangan yang melibatkan beberapa tabel.
 *
 * `alokasiProta` dan `terapkanLebihBayar` menulis ke tiga tabel sekaligus.
 * Bila salah satu langkah gagal, seluruh perubahan harus dibatalkan supaya
 * `prota.sisa`, `pembayaran`, dan tabel alokasi tetap konsisten.
 *
 * Implementasi disediakan oleh pemanggil (biasanya dari `bukaBasisData`),
 * sehingga `core` tetap tidak bergantung pada pustaka SQLite tertentu.
 */
export interface DukunganTransaksi {
  readonly jalankanTransaksi: <T>(fn: () => T) => T;
}