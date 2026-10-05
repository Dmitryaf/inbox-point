import { expect, it } from 'vitest';
import { createApp } from '@/infrastructure/http/app.js';
import { beginApiRequest } from '@/infrastructure/diagnostics/api-request-diagnostic.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';

it('writes safe API diagnostics to the actual logger without request secrets', async () => {
  const lines: string[] = [];
  const secret = '123456789:synthetic-private-token';
  const app = createApp(
    {
      closedRequestRetentionDays: 7,
      databasePath: ':memory:',
      host: '127.0.0.1',
      instanceId: 'test',
      logLevel: 'info',
      nodeEnv: 'test',
      port: 3000,
    },
    {
      write: (line) => {
        lines.push(line);
      },
    },
  );
  const error = beginApiRequest('telegram', 'getMe')(
    new Error(secret),
    'transport',
    { cause: Object.assign(new Error(secret), { code: 'ECONNRESET' }) },
  );
  try {
    const client = new TelegramApiClient(
      secret,
      () =>
        Promise.reject(
          Object.assign(new Error(secret), { code: 'ECONNRESET' }),
        ),
      (diagnostic) =>
        app.log.warn({ apiFailure: diagnostic }, 'External API request failed'),
    );
    await client
      .sendMessage({ chatId: 1, text: 'Private customer message' })
      .catch(() => undefined);
    app.get('/test', (request) => {
      request.log.error({ err: error }, 'Channel startup failed');
      return { ok: true };
    });
    app.get('/test/error', () => {
      throw new Error(secret);
    });
    await app.inject({
      method: 'GET',
      url: '/test?token=' + secret,
      headers: {
        authorization: 'Bearer ' + secret,
        cookie: 'session=' + secret,
      },
    });
    await app.inject({
      method: 'GET',
      url: '/unknown/' + secret + '?token=' + secret,
    });
    await app.inject({ method: 'GET', url: '/test/error?token=' + secret });
    const output = lines.join('');
    expect(output).toContain('ECONNRESET');
    expect(output).toContain('getMe');
    expect(output).toContain('operationId');
    expect(output).toContain('sendMessage');
    expect(output).not.toContain('Private customer message');
    expect(output).toContain('HTTP route not found');
    expect(output).toContain('HTTP request failed');
    expect(output).not.toContain(secret);
    expect(output).not.toContain('?token');
  } finally {
    await app.close();
  }
});
