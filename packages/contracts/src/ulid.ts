import { randomBytes } from 'node:crypto';

/**
 * Pembangkit ULID — kunci primer seluruh entitas (ADR 0008).
 *
 * Dipilih daripada UUIDv4 karena **terurut menurut waktu**: 48 bit pertama adalah
 * milidetik Unix, sehingga baris yang dibuat berurutan juga tersimpan berdekatan
 * di indeks. Pada SQLite yang kuncinya TEXT, itu perbedaan antara sisipan yang
 * menempel di ujung indeks dan sisipan yang menyebar ke mana-mana.
 */

/** Crockford base32 — tanpa I, L, O, dan U supaya tidak tertukar saat dibaca orang. */
const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(nilai: bigint, panjang: number): string {
  let hasil = '';
  let sisa = nilai;
  for (let i = 0; i < panjang; i++) {
    hasil = ALFABET[Number(sisa % 32n)] + hasil;
    sisa /= 32n;
  }
  return hasil;
}

/**
 * @param waktuMs milidetik Unix; dapat diisi untuk membuat ULID yang dapat diulang
 *   pada uji. Nilai bakunya waktu sekarang.
 */
export function buatUlid(waktuMs: number = Date.now()): string {
  const waktu = base32(BigInt(waktuMs), 10);
  const acak = base32(BigInt(`0x${randomBytes(10).toString('hex')}`), 16);
  return waktu + acak;
}
