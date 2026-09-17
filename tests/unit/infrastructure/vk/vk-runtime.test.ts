import { afterEach, describe, expect, it, vi } from 'vitest';

import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import type {
  VkGateway,
  VkLongPollResponse,
  VkLongPollServer,
} from '@/infrastructure/vk/vk-api-client.js';
import type { VkLongPollReadinessGateway } from '@/infrastructure/vk/vk-long-poll-readiness.js';
import {
  VkRuntime,
  type VkHandoffHost,
} from '@/infrastructure/vk/vk-runtime.js';

describe('VkRuntime readiness', () => {
  const repositories: SqliteSupportRepository[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      repository.close();
    }
  });

  it('rejects a stored configuration when outgoing Long Poll events are disabled', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const registerClientChannel = vi.fn(() => () => undefined);
    const gateway = new ReadinessGateway();
    gateway.getLongPollSettings = vi.fn(() =>
      Promise.resolve({
        enabled: true,
        messageNew: true,
        messageReply: false,
      }),
    );
    const handoffHost: VkHandoffHost = {
      handleChannelOperatorMessage: vi.fn(() => Promise.resolve()),
      handleClientMessage: vi.fn(() => Promise.resolve()),
      registerClientChannel,
    };
    const runtime = new VkRuntime(
      handoffHost,
      repository,
      { error: vi.fn() },
      undefined,
      undefined,
      undefined,
      () => gateway,
    );

    await expect(
      runtime.start({
        accessToken: 'synthetic-token',
        groupId: 42,
        pollTimeoutSeconds: 25,
      }),
    ).rejects.toThrow('message_reply event is disabled');

    expect(runtime.running).toBe(false);
    expect(registerClientChannel).not.toHaveBeenCalled();
    expect(gateway.getLongPollServer).not.toHaveBeenCalled();
  });
});

class ReadinessGateway implements VkGateway, VkLongPollReadinessGateway {
  public getLongPollServer = vi.fn<
    (groupId: number) => Promise<VkLongPollServer>
  >(() =>
    Promise.resolve({ key: 'key', server: 'https://lp.vk.test', ts: '1' }),
  );

  public getLongPollSettings = vi.fn(() =>
    Promise.resolve({ enabled: true, messageNew: true, messageReply: true }),
  );

  public getUserDisplayName(): Promise<string> {
    return Promise.resolve('VK Customer');
  }

  public poll(): Promise<VkLongPollResponse> {
    return Promise.resolve({ ts: '2', updates: [] });
  }

  public sendMessage(): Promise<{ externalMessageId: string }> {
    return Promise.resolve({ externalMessageId: '1' });
  }
}
