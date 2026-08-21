/**
 * Lapisan narasi LLM untuk analisis (RFC-016) — KERANGKA, aktif saat Zen siap.
 *
 * Menegakkan prinsip AGENTS.md "Angka dari SQL, kalimat dari model":
 * - Agregat dihitung SQL → JSON tool (liat analisis-chat.ts).
 * - Model HANYA merangkai narasi di sekitar angka itu.
 * - `periksaAngkaDariJson` menolak narasi yang memuat angka yang TIDAK ada pada JSON
 *   masukan — mencegah angka karangan pada ringkasan manajerial.
 * - LLM tidak pernah menulis ke database (jalur tulis tetap deterministik).
 */

/** Kumpulkan semua angka numerik dari struktur JSON (rekursif, termasuk di array). */
export function kumpulkanAngka(nilai: unknown, keluar: number[] = []): number[] {
  if (typeof nilai === 'number') keluar.push(nilai);
  else if (Array.isArray(nilai)) for (const v of nilai) kumpulkanAngka(v, keluar);
  else if (nilai !== null && typeof nilai === 'object')
    for (const k of Object.keys(nilai as Record<string, unknown>))
      kumpulkanAngka((nilai as Record<string, unknown>)[k], keluar);
  return keluar;
}

/**
 * Periksa narasi: setiap bilangan bulat di teks harus ada pada JSON sumber.
 * Bila ada angka yang tidak ada di JSON → indikasi halusinasi → ditolak.
 * Catatan: heuristic untuk integer (format ribuan "1.250.000" dan desimal disederhanakan);
 * tujuan utama = memblokir angka yang jelas-jelas tidak berasal dari data.
 */
export function periksaAngkaDariJson(
  teks: string,
  data: unknown,
): { ok: boolean; angkaAsing: number[] } {
  const sumber = new Set(kumpulkanAngka(data));
  const asing: number[] = [];
  const regex = /-?\d+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(teks)) !== null) {
    const n = Number(m[0]);
    if (Number.isFinite(n) && !sumber.has(n)) asing.push(n);
  }
  return { ok: asing.length === 0, angkaAsing: asing };
}

export interface RangkaiInput {
  readonly tool: string;
  readonly parameter: unknown;
  readonly data: unknown;
}

/** Satu antarmuka penyedia narasi (ADR 0006) dibalik bot & MCP seragam. */
export interface PenyediaNarasi {
  rangkai(input: RangkaiInput): Promise<string>;
}

export interface EnvPenyedia {
  readonly ZEN_BASE_URL?: string;
  readonly ZEN_API_KEY?: string;
}

/**
 * Penyedia narasi via Zen (ADR 0006). BELUM aktif bila key belum di-provision (prasyarat P5).
 * Instansiasi tetap aman; panggilan `rangkai` menolak dengan pesan konfigurasi saat key kosong.
 */
export function buatPenyediaNarasiZen(env: EnvPenyedia): PenyediaNarasi {
  if (!env.ZEN_BASE_URL || !env.ZEN_API_KEY) {
    return {
      async rangkai() {
        throw new Error('Penyedia LLM belum dikonfigurasi (set ZEN_BASE_URL & ZEN_API_KEY).');
      },
    };
  }
  return {
    async rangkai(input) {
      // Penerapan klien penyedia (Zen/OpenAI-compatible) diselesaikan saat key tersedia.
      void input;
      throw new Error('Penerapan penyedia Zen menyusul (butuh klien HTTP).');
    },
  };
}

/**
 * Rangkai narasi lalu periksa angka. `rangkaiNarasiAman` menjanjikan output yang
 * TIDAK memuat angka asing (pemeriksa adalah pengaman terakhir, bukan andalan prompt).
 */
export async function rangkaiNarasiAman(
  penyedia: PenyediaNarasi,
  input: RangkaiInput,
): Promise<{ ok: true; narasi: string } | { ok: false; alasan: string }> {
  const narasi = await penyedia.rangkai(input);
  const hasil = periksaAngkaDariJson(narasi, input.data);
  if (!hasil.ok) return { ok: false, alasan: `Narasi memuat angka di luar data: ${hasil.angkaAsing.join(', ')}` };
  return { ok: true, narasi };
}
