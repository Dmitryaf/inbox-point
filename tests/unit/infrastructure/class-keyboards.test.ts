import { describe, expect, it, vi } from 'vitest';
import { VkApiClient } from '@/infrastructure/vk/vk-api-client.js';
import {
  TelegramApiClient,
  TelegramKeyboardError,
  TelegramCallbackExpiredError,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { classFallbackMessages } from '@/core/application/class-navigation.js';
describe('class keyboard API boundaries', () => {
  it('recognizes an expired callback acknowledgement for safe recovery after an outage', async () => {
    const client = new TelegramApiClient(
      'synthetic-telegram-keyboard-token',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: false,
          error_code: 400,
          description:
            'Bad Request: query is too old and response timeout expired or query ID is invalid',
        }),
      ),
    );
    await expect(
      client.answerCallbackQuery('synthetic-query'),
    ).rejects.toBeInstanceOf(TelegramCallbackExpiredError);
  });
  it.each([911, 912])(
    'exposes VK keyboard rejection %s for an inline keyboard so navigation can send instructions',
    async (code) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          error: {
            error_code: code,
            error_msg: 'Synthetic keyboard rejection',
          },
        }),
      );
      const client = new VkApiClient('synthetic-vk-keyboard-token', fetchMock);
      await expect(
        client.sendMessage(101, 'Group', 11, {
          buttons: [],
          inline: true,
          one_time: false,
        }),
      ).rejects.toMatchObject({ code });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it('recognizes a confirmed Telegram keyboard rejection without treating permission or transport errors as keyboard failures', async () => {
    const client = new TelegramApiClient(
      'synthetic-telegram-keyboard-token',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: false,
          error_code: 400,
          description: 'Bad Request: BUTTON_DATA_INVALID',
        }),
      ),
    );
    await expect(
      client.sendMessage({
        chatId: 101,
        text: 'Group',
        replyMarkup: {
          inline_keyboard: [
            [{ text: 'Group', callback_data: 'classes:group:id' }],
          ],
        },
      }),
    ).rejects.toBeInstanceOf(TelegramKeyboardError);
    const denied = new TelegramApiClient(
      'synthetic-telegram-keyboard-token',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: false,
          error_code: 403,
          description: 'bot was blocked by the user',
        }),
      ),
    );
    await expect(
      denied.sendMessage({ chatId: 101, text: 'Group' }),
    ).rejects.not.toBeInstanceOf(TelegramKeyboardError);
  });
  it('keeps all old text when keyboard instructions would exceed a message limit', () => {
    const response = {
      text: 'a'.repeat(4000),
      buttons: [{ label: 'Меню', command: 'Меню', action: 'main' }],
    };
    const messages = classFallbackMessages(response);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(response.text);
    expect(messages[1]).toContain('Кнопки недоступны');
    expect(messages.every((text) => text.length <= 4000)).toBe(true);
  });
});
