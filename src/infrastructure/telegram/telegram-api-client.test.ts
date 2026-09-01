import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  isUnavailableForumTopicError,
  TelegramApiClient,
} from './telegram-api-client.js';

const syntheticToken = '123456789:synthetic-api-client-token';

const requestPayloadSchema = z.object({
  allowed_updates: z.array(z.string()),
  offset: z.number().optional(),
  timeout: z.number(),
});

describe('TelegramApiClient', () => {
  it('recognizes errors for closed and deleted forum topics', () => {
    expect(
      isUnavailableForumTopicError(
        new Error(
          'Telegram API sendMessage failed: Bad Request: message thread not found',
        ),
      ),
    ).toBe(true);
    expect(
      isUnavailableForumTopicError(
        new Error('Telegram API sendMessage failed: TOPIC_CLOSED'),
      ),
    ).toBe(true);
  });

  it('sends a reply keyboard with a client message', async () => {
    const fetchMock = vi.fn(
      (
        input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        void input;
        void init;
        return Promise.resolve(
          Response.json({
            ok: true,
            result: {
              chat: { id: 101, type: 'private' },
              date: 1_788_177_600,
              message_id: 55,
            },
          }),
        );
      },
    );
    const client = new TelegramApiClient(syntheticToken, fetchMock);

    await client.sendMessage({
      chatId: 101,
      replyMarkup: {
        keyboard: [[{ text: 'Расписание' }]],
        resize_keyboard: true,
      },
      text: 'Выберите действие',
    });

    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') {
      throw new Error('Expected a JSON request body');
    }
    expect(JSON.parse(request.body)).toMatchObject({
      chat_id: 101,
      reply_markup: {
        keyboard: [[{ text: 'Расписание' }]],
        resize_keyboard: true,
      },
      text: 'Выберите действие',
    });
  });

  it('discovers Telegram groups from recent updates', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          result: [
            {
              message: {
                chat: {
                  id: -1001,
                  is_forum: true,
                  title: 'Operators',
                  type: 'supergroup',
                },
              },
            },
            {
              my_chat_member: {
                chat: { id: -1002, title: 'Team', type: 'group' },
              },
            },
            { message: { chat: { id: 5, type: 'private' } } },
          ],
        }),
      ),
    ) as unknown as typeof fetch;
    const client = new TelegramApiClient(syntheticToken, fetchMock);

    await expect(client.discoverOperatorChats()).resolves.toEqual([
      { id: -1001, isForum: true, title: 'Operators', type: 'supergroup' },
      { id: -1002, isForum: false, title: 'Team', type: 'group' },
    ]);
  });
  it('uses the confirmed offset and validates update responses', async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        return Promise.resolve(
          Response.json({
            ok: true,
            result: [
              {
                update_id: 77,
              },
            ],
          }),
        );
      },
    );
    const client = new TelegramApiClient(
      '123456789:synthetic-token-for-tests-only',
      fetchMock,
    );

    await expect(
      client.getUpdates({ offset: 77, timeoutSeconds: 30 }),
    ).resolves.toEqual([{ update_id: 77 }]);

    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== 'string') {
      throw new Error('Expected a JSON request body');
    }
    const rawPayload: unknown = JSON.parse(request.body);
    expect(requestPayloadSchema.parse(rawPayload)).toEqual({
      allowed_updates: ['message'],
      offset: 77,
      timeout: 30,
    });
  });

  it('does not expose the bot token in API errors', async () => {
    const token = '123456789:must-not-appear-in-errors';
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        return Promise.resolve(
          Response.json(
            { description: 'Unauthorized', ok: false },
            { status: 401 },
          ),
        );
      },
    );
    const client = new TelegramApiClient(token, fetchMock);

    const request = client.getUpdates({ timeoutSeconds: 30 });

    await expect(request).rejects.toThrowError(
      'Telegram API getUpdates failed: Unauthorized',
    );
    await expect(request).rejects.not.toThrowError(new RegExp(token));
  });

  it('drops network error details that could contain the token URL', async () => {
    const token = '123456789:secret-from-request-url';
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        return Promise.reject(new Error(`Connection failed for ${token}`));
      },
    );
    const client = new TelegramApiClient(token, fetchMock);

    const request = client.getUpdates({ timeoutSeconds: 30 });

    await expect(request).rejects.toEqual(
      new Error('Telegram API request failed for getUpdates'),
    );
    await expect(request).rejects.not.toThrowError(new RegExp(token));
  });
});
