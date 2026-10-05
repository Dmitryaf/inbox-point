import { describe, expect, it, vi } from 'vitest';
import {
  beginApiRequest,
  getApiRequestDiagnostic,
  serializeSafeError,
  safeTransportCodes,
} from '@/infrastructure/diagnostics/api-request-diagnostic.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';
import { VkApiClient, VkApiError } from '@/infrastructure/vk/vk-api-client.js';

const secret = '123456789:synthetic-private-token';
function networkError(code: string): Error {
  return new TypeError(
    `fetch failed for https://api.telegram.org/bot${secret}/getMe`,
    {
      cause: Object.assign(new Error('Private customer message'), {
        code,
        body: secret,
      }),
    },
  );
}

describe('external API diagnostics', () => {
  it('records failures even when the caller handles them and isolates logger failures', async () => {
    const observed = vi.fn();
    const client = new TelegramApiClient(
      secret,
      () => Promise.reject(networkError('ECONNRESET')),
      observed,
    );
    await client
      .sendMessage({ chatId: 1, text: 'Private customer message' })
      .catch(() => undefined);
    expect(observed).toHaveBeenCalledOnce();
    const diagnostic: unknown = observed.mock.calls[0]?.[0];
    expect(diagnostic).toMatchObject({
      method: 'sendMessage',
      kind: 'transport',
      transportCodes: ['ECONNRESET'],
    });
    expect(JSON.stringify(diagnostic)).not.toContain(secret);
    const brokenLogger = new TelegramApiClient(
      secret,
      () => Promise.reject(networkError('ECONNRESET')),
      () => {
        throw new Error('collector failed');
      },
    );
    await expect(
      brokenLogger.sendMessage({ chatId: 1, text: 'Private customer message' }),
    ).rejects.toBeInstanceOf(DeliveryOutcomeUnknownError);
  });
  it.each(['ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND'])(
    'preserves safe %s details without exception payloads',
    async (code) => {
      const client = new TelegramApiClient(
        secret,
        vi.fn(() => Promise.reject(networkError(code))),
      );
      const error: unknown = await client
        .getUpdates({ timeoutSeconds: 30 })
        .catch((error: unknown) => error);
      expect(getApiRequestDiagnostic(error)).toMatchObject({
        channel: 'telegram',
        method: 'getUpdates',
        kind: 'transport',
        transportCodes: [code],
        durationMs: expect.any(Number) as unknown,
        operationId: expect.any(String) as unknown,
      });
      const logged = JSON.stringify(serializeSafeError(error));
      expect(logged).not.toContain(secret);
      expect(logged).not.toContain('Private customer');
      expect(logged).not.toContain('api.telegram.org');
      expect(getApiRequestDiagnostic(error)?.durationMs).toBeGreaterThanOrEqual(
        0,
      );
    },
  );

  it('keeps uncertain delivery semantics while retaining diagnostics', async () => {
    const client = new TelegramApiClient(
      secret,
      vi.fn(() => Promise.reject(networkError('ECONNRESET'))),
    );
    const error: unknown = await client
      .sendMessage({ chatId: 1, text: 'Private customer message' })
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DeliveryOutcomeUnknownError);
    expect(getApiRequestDiagnostic(error)?.transportCodes).toEqual([
      'ECONNRESET',
    ]);
  });

  it('retains HTTP and API codes without arbitrary Telegram descriptions', async () => {
    const client = new TelegramApiClient(
      secret,
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            {
              ok: false,
              error_code: 401,
              description: secret + ' Private customer message',
            },
            { status: 401 },
          ),
        ),
      ),
    );
    const error: unknown = await client
      .getUpdates({ timeoutSeconds: 30 })
      .catch((error: unknown) => error);
    expect(getApiRequestDiagnostic(error)).toMatchObject({
      kind: 'api',
      httpStatus: 401,
      apiCode: 401,
    });
    expect(error instanceof Error && error.message).toBe(
      'Telegram API getUpdates failed: request rejected',
    );
  });

  it('captures VK long poll failures without its URL or key', async () => {
    const client = new VkApiClient(
      secret,
      vi.fn(() => Promise.reject(networkError('ECONNREFUSED'))),
    );
    const error: unknown = await client
      .poll(
        { server: 'https://lp.vk.test/poll', key: secret, ts: '1' },
        25,
        new AbortController().signal,
      )
      .catch((error: unknown) => error);
    expect(getApiRequestDiagnostic(error)).toMatchObject({
      channel: 'vk',
      method: 'longPoll',
      transportCodes: ['ECONNREFUSED'],
    });
    expect(JSON.stringify(serializeSafeError(error))).not.toContain(secret);
  });

  it('preserves typed VK errors needed for keyboard fallback', async () => {
    const client = new VkApiClient(
      secret,
      vi.fn(() =>
        Promise.resolve(
          Response.json({ error: { error_code: 911, error_msg: secret } }),
        ),
      ),
    );
    const error: unknown = await client
      .getLongPollServer(1)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(VkApiError);
    expect(getApiRequestDiagnostic(error)).toMatchObject({
      kind: 'api',
      apiCode: 911,
      httpStatus: 200,
    });
  });

  it('bounds traversal of cyclic and aggregate causes and rejects unknown codes', () => {
    const cycle = Object.assign(new Error(secret), { code: secret });
    cycle.cause = cycle;
    expect(
      safeTransportCodes(
        new AggregateError([cycle, networkError('EAI_AGAIN')], secret),
      ),
    ).toEqual(['EAI_AGAIN']);
    expect(JSON.stringify(serializeSafeError(cycle))).not.toContain(secret);
    const error = beginApiRequest('telegram', 'getMe')(
      new Error('safe'),
      'transport',
      { cause: networkError('ECONNRESET') },
    );
    const copy = getApiRequestDiagnostic(error);
    if (copy) {
      copy.method = secret;
    }
    expect(getApiRequestDiagnostic(error)?.method).toBe('getMe');
  });
});
