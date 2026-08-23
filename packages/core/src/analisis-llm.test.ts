import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buatPenyediaNarasiGo,
  kumpulkanAngka,
  periksaAngkaDariJson,
  rangkaiNarasiAman,
  urlChatCompletions,
  type PenyediaNarasi,
} from './analisis-llm.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('kumpulkanAngka', () => {
  it('mengumpulkan angka dari struktur JSON bertingkat', () => {
    expect(kumpulkanAngka({ ringkasan: { terbit: 450_000, masuk: 450_000 }, komponen: [{ terbit: 400 }] })).toEqual([
      450_000, 450_000, 400,
    ]);
  });

  it('menyerap urutan digit dari nilai string (label periode/NIS/kode)', () => {
    expect(kumpulkanAngka({ periode: '2026-08', nis: '2627001', ringkasan: { terbit: 450_000 } })).toContain(2026);
    expect(kumpulkanAngka({ periode: '2026-08', nis: '2627001', ringkasan: { terbit: 450_000 } })).toContain(8);
  });
});

describe('periksaAngkaDariJson', () => {
  const data = { terbit: 450_000, masuk: 450_000, sisa: 0 };

  it('narasi hanya berisi angka yang ada di JSON → diterima', () => {
    const hasil = periksaAngkaDariJson('Total terbit 450000, masuk 450000, sisa 0.', data);
    expect(hasil.ok).toBe(true);
  });

  it('narasi memuat angka asing → ditolak (anti-halusinasi)', () => {
    const hasil = periksaAngkaDariJson('Total tunggakan 77 dan terbit 450000.', data);
    expect(hasil.ok).toBe(false);
    expect(hasil.angkaAsing).toContain(77);
  });

  it('narasi berformat ribuan "450.000" setara dengan 450000 di sumber', () => {
    const hasil = periksaAngkaDariJson('Terbit 450.000 dan masuk Rp 300.000, sisa 150.000.', {
      terbit: 450_000,
      masuk: 300_000,
      sisa: 150_000,
    });
    expect(hasil.ok).toBe(true);
  });

  it('narasi menyebut periode ber-hyphen "2026-08" diterima (huruf label, bukan minus)', () => {
    const hasil = periksaAngkaDariJson('Pada periode 2026-08 terbit 450000.', {
      periode: '2026-08',
      terbit: 450_000,
    });
    expect(hasil.ok).toBe(true);
  });
});

describe('urlChatCompletions', () => {
  it('menyisip /chat/completions dan kekal /v1', () => {
    expect(urlChatCompletions('https://opencode.ai/zen/go/v1')).toBe(
      'https://opencode.ai/zen/go/v1/chat/completions',
    );
  });
  it('menghilangkan garis miring ganda di ujung base URL', () => {
    expect(urlChatCompletions('https://opencode.ai/zen/go//')).toBe(
      'https://opencode.ai/zen/go/chat/completions',
    );
  });
});

describe('penyedia Go & rangkaiNarasiAman', () => {
  it('penyedia Go tanpa konfigurasi lengkap menolak dengan pesan setelan', async () => {
    const p = buatPenyediaNarasiGo({});
    await expect(p.rangkai({ tool: 'x', parameter: {}, data: {} })).rejects.toThrow(/GO_BASE_URL/);
  });

  it('penyedia Go menolak bila salah satu env kosong', async () => {
    const p = buatPenyediaNarasiGo({ GO_BASE_URL: 'https://go', GO_API_KEY: 'k', GO_MODEL: '' });
    const p2 = buatPenyediaNarasiGo({ GO_BASE_URL: '', GO_API_KEY: 'k', GO_MODEL: 'm' });
    await expect(p.rangkai({ tool: 'x', parameter: {}, data: {} })).rejects.toThrow(/belum lengkap/);
    await expect(p2.rangkai({ tool: 'x', parameter: {}, data: {} })).rejects.toThrow(/belum lengkap/);
  });

  it('mengirim permintaan chat completions dan membaca choices[0].message.content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Ringkasan terbit 450000.' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p = buatPenyediaNarasiGo({
      GO_BASE_URL: 'https://opencode.ai/zen/go/v1',
      GO_API_KEY: 'rahasia',
      GO_MODEL: 'glm-5',
    });
    const narasi = await p.rangkai({ tool: 'ringkasan_laporan', parameter: { periode: '2026-08' }, data: { terbit: 450_000 } });

    expect(narasi).toBe('Ringkasan terbit 450000.');
    const panggilan = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = panggilan;
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer rahasia');
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('glm-5');
    expect(body.messages).toHaveLength(2);
  });

  it('mengangkat rincian bila provider menolak dengan status non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid api key', { status: 401 })),
    );
    const p = buatPenyediaNarasiGo({
      GO_BASE_URL: 'https://opencode.ai/zen/go/v1',
      GO_API_KEY: 'salah',
      GO_MODEL: 'glm-5',
    });
    await expect(p.rangkai({ tool: 'x', parameter: {}, data: {} })).rejects.toThrow(/HTTP 401.*invalid api key/);
  });

  it('rangkaiNarasiAman menolak narasi dengan angka asing', async () => {
    const stub: PenyediaNarasi = { async rangkai() { return 'Laporan terbit 450000, tunggakan 123.'; } };
    const hasil = await rangkaiNarasiAman(stub, { tool: 'x', parameter: {}, data: { terbit: 450_000 } });
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.alasan).toContain('123');
  });

  it('rangkaiNarasiAman menerima narasi yang angka-angkanya dari data', async () => {
    const stub: PenyediaNarasi = { async rangkai() { return 'Terbit 450000, masuk 450000, sisa 0.'; } };
    const hasil = await rangkaiNarasiAman(stub, { tool: 'x', parameter: {}, data: { terbit: 450_000, masuk: 450_000, sisa: 0 } });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(hasil.narasi).toContain('450000');
  });
});