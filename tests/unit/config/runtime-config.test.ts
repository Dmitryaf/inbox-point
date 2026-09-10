import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from '@/config/runtime-config.js';

describe('loadRuntimeConfig', () => {
  it('returns safe defaults for an empty environment', () => {
    expect(loadRuntimeConfig({})).toEqual({
      closedRequestRetentionDays: 7,
      databasePath: './data/messenger-handoff.sqlite',
      host: '127.0.0.1',
      logLevel: 'info',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('treats empty optional values from .env.example as unset', () => {
    expect(
      loadRuntimeConfig({
        ADMIN_PASSWORD: '',
        TELEGRAM_BOT_TOKEN: '',
        TELEGRAM_ENABLED: 'false',
        TELEGRAM_OPERATOR_CHAT_ID: '',
        VK_ACCESS_TOKEN: '',
        VK_ENABLED: 'false',
        VK_GROUP_ID: '',
      }),
    ).toEqual({
      closedRequestRetentionDays: 7,
      databasePath: './data/messenger-handoff.sqlite',
      host: '127.0.0.1',
      logLevel: 'info',
      nodeEnv: 'development',
      port: 3000,
    });
  });

  it('configures a bounded closed-request retention period', () => {
    expect(
      loadRuntimeConfig({ CLOSED_REQUEST_RETENTION_DAYS: '14' }),
    ).toMatchObject({ closedRequestRetentionDays: 14 });

    expect(() =>
      loadRuntimeConfig({ CLOSED_REQUEST_RETENTION_DAYS: '0' }),
    ).toThrowError(
      'Invalid runtime configuration: CLOSED_REQUEST_RETENTION_DAYS:',
    );
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

  it('enables remote administration only with a sufficiently long password', () => {
    expect(
      loadRuntimeConfig({
        ADMIN_PASSWORD: 'synthetic-admin-password',
      }),
    ).toMatchObject({
      adminPassword: 'synthetic-admin-password',
    });

    const load = (): void => {
      loadRuntimeConfig({ ADMIN_PASSWORD: 'short' });
    };
    expect(load).toThrowError('Invalid runtime configuration: ADMIN_PASSWORD:');
    expect(load).not.toThrowError(/synthetic-admin-password/);
  });

  it('does not accept the pre-production admin password variables as aliases', () => {
    expect(
      loadRuntimeConfig({
        CONTENT_ADMIN_PASSWORD: 'old-content-password',
        OPS_ADMIN_PASSWORD: 'old-operations-password',
      }),
    ).not.toHaveProperty('adminPassword');
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
