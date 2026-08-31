import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TelegramApiClient } from './telegram-api-client.js';

const requestPayloadSchema = z.object({
  allowed_updates: z.array(z.string()),
  offset: z.number().optional(),
  timeout: z.number(),
});

describe('TelegramApiClient', () => {
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
