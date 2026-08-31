import { describe, expect, it, vi } from 'vitest';

import { TelegramApiClient } from './telegram-api-client.js';

const syntheticToken = '123456789:synthetic-setup-token-for-tests';

describe('TelegramApiClient.verifySetup', () => {
  it('accepts a forum supergroup with the required bot rights and no webhook', async () => {
    const fetchMock = createFetchMock([
      { id: 42, is_bot: true },
      { id: -1_001, is_forum: true, type: 'supergroup' },
      { can_manage_topics: true, status: 'administrator' },
      { url: '' },
    ]);
    const client = new TelegramApiClient(syntheticToken, fetchMock);

    await expect(client.verifySetup(-1_001)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects a group without Topics', async () => {
    const client = new TelegramApiClient(
      syntheticToken,
      createFetchMock([
        { id: 42, is_bot: true },
        { id: -1_001, type: 'supergroup' },
      ]),
    );

    await expect(client.verifySetup(-1_001)).rejects.toThrowError(
      'Topics are not enabled in the operator group',
    );
  });

  it('rejects an operator chat that is not a supergroup', async () => {
    const client = new TelegramApiClient(
      syntheticToken,
      createFetchMock([
        { id: 42, is_bot: true },
        { id: -1_001, type: 'group' },
      ]),
    );

    await expect(client.verifySetup(-1_001)).rejects.toThrowError(
      'operator chat must be a supergroup',
    );
  });

  it('rejects a bot without topic-management rights', async () => {
    const client = new TelegramApiClient(
      syntheticToken,
      createFetchMock([
        { id: 42, is_bot: true },
        { id: -1_001, is_forum: true, type: 'supergroup' },
        { can_manage_topics: false, status: 'administrator' },
      ]),
    );

    await expect(client.verifySetup(-1_001)).rejects.toThrowError(
      'the bot requires can_manage_topics',
    );
  });

  it('rejects a bot that is not an operator group administrator', async () => {
    const client = new TelegramApiClient(
      syntheticToken,
      createFetchMock([
        { id: 42, is_bot: true },
        { id: -1_001, is_forum: true, type: 'supergroup' },
        { status: 'member' },
      ]),
    );

    await expect(client.verifySetup(-1_001)).rejects.toThrowError(
      'the bot must be an operator group administrator',
    );
  });

  it('rejects a configured webhook without exposing its URL', async () => {
    const webhookUrl = 'https://private.example.invalid/telegram';
    const client = new TelegramApiClient(
      syntheticToken,
      createFetchMock([
        { id: 42, is_bot: true },
        { id: -1_001, is_forum: true, type: 'supergroup' },
        { can_manage_topics: true, status: 'administrator' },
        { url: webhookUrl },
      ]),
    );
    const verification = client.verifySetup(-1_001);

    await expect(verification).rejects.toThrowError(
      'remove the configured webhook before using long polling',
    );
    await expect(verification).rejects.not.toThrowError(new RegExp(webhookUrl));
  });
});

function createFetchMock(results: readonly unknown[]): typeof fetch {
  let nextResult = 0;

  return vi.fn(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      void input;
      void init;
      const result = results[nextResult];
      nextResult += 1;
      if (result === undefined) {
        return Promise.reject(new Error('Unexpected Telegram API call'));
      }
      return Promise.resolve(Response.json({ ok: true, result }));
    },
  );
}
