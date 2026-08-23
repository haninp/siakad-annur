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

/**
 * Kumpulkan semua angka numerik dari struktur JSON (rekursif, termasuk di array).
 * Nilai angka (`number`) dikumpulkan bulat; pada nilai string (mis. label periode
 * `"2026-08"`, NIS, kode) urutan digit lepas ikut dikumpulkan agar narasi yang
 * menyebut label itu tidak teranggap angka asing.
 */
export function kumpulkanAngka(nilai: unknown, keluar: number[] = []): number[] {
  if (typeof nilai === 'number') keluar.push(nilai);
  else if (typeof nilai === 'string') {
    // Pada label (periode/NIS/kode) hyphen adalah pemisah, bukan tanda minus.
    const re = /\d+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(nilai)) !== null) keluar.push(Number(m[0]));
  } else if (Array.isArray(nilai)) for (const v of nilai) kumpulkanAngka(v, keluar);
  else if (nilai !== null && typeof nilai === 'object')
    for (const k of Object.keys(nilai as Record<string, unknown>))
      kumpulkanAngka((nilai as Record<string, unknown>)[k], keluar);
  return keluar;
}

/**
 * Periksa narasi: setiap bilangan bulat di teks harus ada pada JSON sumber.
 * Bila ada angka yang tidak ada di JSON → indikasi halusinasi → ditolak.
 *
 * Heuristik: angka ribuan ber-format penuh (mis. "1.250.000" atau "1,250,000")
 * dinormalkan dulu menghilangkan separator sehingga dibandingkan sebagai satu
 * bilangan; angka pada label tanggal/kode (periode "2026-08", NIS) sudah ikut
 * diperhitungkan lewat `kumpulkanAngka` (label itu adalah data, bukan karangan).
 */
export function periksaAngkaDariJson(
  teks: string,
  data: unknown,
): { ok: boolean; angkaAsing: number[] } {
  const sumber = new Set(kumpulkanAngka(data));

  // Normalisasi separator ribuan (titik/koma di antara tiga digit) hingga stabil,
  // dan ubah pemisah tanggal "2026-08" jadi "2026 08" (bukan tanda minus).
  let teksNorm = teks.replace(/(\d)[-–—](\d)/g, '$1 $2');
  for (let i = 0; i < 5; i++) {
    const baru = teksNorm.replace(/(\d{1,3})[.,](\d{3})(?!\d)/g, '$1$2');
    if (baru === teksNorm) break;
    teksNorm = baru;
  }

  const asing: number[] = [];
  const regex = /-?\d+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(teksNorm)) !== null) {
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

/** Konfigurasi penyedia narasi — env opencode-go (RFC-016 P5, handoff 0021). */
export interface EnvPenyedia {
  readonly GO_BASE_URL?: string;
  readonly GO_API_KEY?: string;
  readonly GO_MODEL?: string;
}

const TIMEOUT_MS = 60_000;

/** Bangun URL chat completions dari base URL (kekal /v1, sisip /chat/completions). */
export function urlChatCompletions(base: string): string {
  return base.trim().replace(/\/+$/, '') + '/chat/completions';
}

/**
 * Penyedia narasi via opencode-go (`{GO_BASE_URL}/chat/completions`, format
 * OpenAI-compatible, auth Bearer). Instansiasi aman; panggilan `rangkai`
 * menolak dengan pesan konfigurasi bila GO_BASE_URL/GO_API_KEY/GO_MODEL kosong.
 * Output mengikuti `choices[0].message.content`.
 */
export function buatPenyediaNarasiGo(env: EnvPenyedia): PenyediaNarasi {
  const base = env.GO_BASE_URL?.trim();
  const key = env.GO_API_KEY?.trim();
  const model = env.GO_MODEL?.trim();
  if (!base || !key || !model) {
    return {
      async rangkai() {
        throw new Error(
          'Penyedia LLM belum lengkap — isi GO_BASE_URL, GO_API_KEY, dan GO_MODEL di .env lalu restart bot.',
        );
      },
    };
  }
  const url = urlChatCompletions(base);

  return {
    async rangkai(input) {
      const sistem =
        'Kamu adalah asisten analisis data pesantren. Tugasmu HANYA merangkai narasi ' +
        'manajerial ringkas dan substantif dalam Bahasa Indonesia berdasarkan angka ' +
        'yang tersedia pada JSON berikut. JANGAN pernah menambah atau menghitung angka ' +
        'selain yang ada di JSON (ada pemeriksa otomatis yang menolak narasi berangka asing). ' +
        'Jangan menyebut nama tabel, ID internal, atau istilah teknis; sebut nama entitas.';
      const bujur = { tool: input.tool, parameter: input.parameter, data: input.data };
      const kontroler = new AbortController();
      const pengaturWaktu = setTimeout(() => kontroler.abort(), TIMEOUT_MS);
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            max_tokens: 1200,
            messages: [
              { role: 'system', content: sistem },
              { role: 'user', content: JSON.stringify(bujur) },
            ],
          }),
          signal: kontroler.signal,
        });
        if (!resp.ok) {
          const rincian = (await resp.text()).slice(0, 300);
          throw new Error(`Penyedia LLM menolak (HTTP ${resp.status}): ${rincian}`);
        }
        const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
        const narasi = j.choices?.[0]?.message?.content?.trim();
        if (!narasi) throw new Error('Penyedia LLM mengembalikan respons kosong.');
        return narasi;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          throw new Error('Penyedia LLM tidak merespons dalam batas waktu.');
        }
        throw e;
      } finally {
        clearTimeout(pengaturWaktu);
      }
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
