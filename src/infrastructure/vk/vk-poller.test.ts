import { describe, expect, it, vi } from 'vitest';

import type {
  VkGateway,
  VkLongPollResponse,
  VkLongPollServer,
} from './vk-api-client.js';
import { VkPoller } from './vk-poller.js';
import type { VkLongPollEvent } from './vk-types.js';

describe('VkPoller', () => {
  it('updates ts for failed=1 and refreshes the server for failed=2', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway([
      { failed: 1, ts: '2' },
      { failed: 2 },
      { ts: '11', updates: [createEvent()] },
    ]);
    const route = vi.fn(() => {
      abortController.abort();
      return Promise.resolve();
    });
    const poller = new VkPoller(gateway, 42, { route }, 25);

    await poller.run(abortController.signal);

    expect(gateway.serverRequests).toBe(2);
    expect(gateway.pollRequests.map((request) => request.ts)).toEqual([
      '1',
      '2',
      '10',
    ]);
    expect(route).toHaveBeenCalledOnce();
  });
});

class ScriptedGateway implements VkGateway {
  public readonly pollRequests: VkLongPollServer[] = [];
  public serverRequests = 0;

  public constructor(private readonly responses: VkLongPollResponse[]) {}

  public getLongPollServer(): Promise<VkLongPollServer> {
    this.serverRequests += 1;
    return Promise.resolve({
      key: 'key-' + this.serverRequests,
      server: 'https://lp.vk.test',
      ts: this.serverRequests === 1 ? '1' : '10',
    });
  }

  public getUserDisplayName(): Promise<string> {
    return Promise.resolve('Customer');
  }

  public poll(server: VkLongPollServer): Promise<VkLongPollResponse> {
    this.pollRequests.push(server);
    const response = this.responses.shift();
    if (!response) {
      throw new Error('Unexpected poll');
    }
    return Promise.resolve(response);
  }

  public sendMessage(): Promise<{ externalMessageId: string }> {
    return Promise.resolve({ externalMessageId: '1' });
  }
}

function createEvent(): VkLongPollEvent {
  return {
    event_id: 'event-1',
    group_id: 42,
    object: {
      message: {
        conversation_message_id: 1,
        date: 1_788_177_600,
        from_id: 101,
        id: 501,
        out: 0,
        peer_id: 101,
        text: 'Question',
      },
    },
    type: 'message_new',
  };
}
