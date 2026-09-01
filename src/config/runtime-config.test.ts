import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from './runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('returns safe defaults for an empty environment', () => {
    expect(loadRuntimeConfig({})).toEqual({
      databasePath: './data/messenger-handoff.sqlite',
      host: '127.0.0.1',
      logLevel: 'info',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('rejects an invalid port without including unrelated environment data', () => {
    const load = (): void => {
      loadRuntimeConfig({
        PORT: '70000',
        TELEGRAM_BOT_TOKEN:
          '123456789:must-not-appear-in-the-validation-error-message',
      });
    };

    expect(load).toThrowError('Invalid runtime configuration: PORT:');
    expect(load).not.toThrowError(/must-not-appear/);
  });

  it('enables Telegram only with the required credentials', () => {
    expect(
      loadRuntimeConfig({
        TELEGRAM_BOT_TOKEN: '123456789:test-token-with-safe-synthetic-value',
        TELEGRAM_ENABLED: 'true',
        TELEGRAM_OPERATOR_CHAT_ID: '-1001234567890',
        TELEGRAM_POLL_TIMEOUT_SECONDS: '20',
      }),
    ).toMatchObject({
      telegram: {
        botToken: '123456789:test-token-with-safe-synthetic-value',
        operatorChatId: -1_001_234_567_890,
        pollTimeoutSeconds: 20,
      },
    });
  });

  it('rejects enabled Telegram without exposing a configured token', () => {
    const token = '123456789:must-not-appear-in-error-output';
    const load = (): void => {
      loadRuntimeConfig({
        TELEGRAM_BOT_TOKEN: token,
        TELEGRAM_ENABLED: 'true',
      });
    };

    expect(load).toThrowError(
      'Telegram requires TELEGRAM_BOT_TOKEN and TELEGRAM_OPERATOR_CHAT_ID',
    );
    expect(load).not.toThrowError(new RegExp(token));
  });

  it('enables VK only with the required community credentials', () => {
    expect(
      loadRuntimeConfig({
        VK_ACCESS_TOKEN: 'synthetic-vk-community-access-token',
        VK_ENABLED: 'true',
        VK_GROUP_ID: '42',
        VK_POLL_TIMEOUT_SECONDS: '20',
      }),
    ).toMatchObject({
      vk: {
        accessToken: 'synthetic-vk-community-access-token',
        groupId: 42,
        pollTimeoutSeconds: 20,
      },
    });
  });

  it('rejects enabled VK without exposing a configured token', () => {
    const token = 'must-not-appear-vk-community-token';
    const load = (): void => {
      loadRuntimeConfig({ VK_ACCESS_TOKEN: token, VK_ENABLED: 'true' });
    };

    expect(load).toThrowError('VK requires VK_ACCESS_TOKEN and VK_GROUP_ID');
    expect(load).not.toThrowError(new RegExp(token));
  });
});
