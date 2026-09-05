import { afterEach, describe, expect, it } from 'vitest';

import type { ClientChannel } from '@/core/contracts/client-channel.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { TelegramRuntime } from '@/infrastructure/telegram/telegram-runtime.js';

describe('TelegramRuntime client channel registration', () => {
  const repositories: SqliteSupportRepository[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      repository.close();
    }
  });

  it('accepts a VK delivery channel before Telegram startup completes', () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const runtime = new TelegramRuntime(repository, {
      error: () => undefined,
    });
    const channel: ClientChannel = {
      kind: 'vk',
      send: () => Promise.resolve({ externalMessageId: 'vk-message-1' }),
    };

    expect(() => runtime.registerClientChannel(channel)).not.toThrow();
  });
});
