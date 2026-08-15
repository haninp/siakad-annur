import { Bot, type BotError, type Context } from 'grammy';

export interface KonfigurasiBot {
  readonly token: string;
}

/**
 * Kerangka bot grammY bersama (RFC-001).
 *
 * Minimal untuk uji coba: membuat instance bot + penanganan galat terpusat
 * dengan pesan substantif (AGENTS.md). Seluruh perilaku perintah hidup di
 * apps/ masing-masing, bukan di sini.
 */
export function buatBot(konfigurasi: KonfigurasiBot): Bot {
  const bot = new Bot(konfigurasi.token);
  bot.catch((err: BotError) => {
    console.error('[bot] galat tidak tertangani:', err.error);
    err.ctx
      .reply('Maaf, terjadi gangguan. Silakan coba lagi sebentar lagi.')
      .catch(() => undefined);
  });
  return bot;
}

export type { Bot, Context };
