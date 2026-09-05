import { describe, expect, it, vi } from 'vitest';

import type {
  InboundEventStore,
  PendingInboundEvent,
} from '@/core/contracts/support-repository.js';
import type {
  VkGateway,
  VkLongPollResponse,
  VkLongPollServer,
} from '@/infrastructure/vk/vk-api-client.js';
import { VkPoller } from '@/infrastructure/vk/vk-poller.js';
import type { VkLongPollEvent } from '@/infrastructure/vk/vk-types.js';

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
    const onSuccess = vi.fn();
    const poller = new VkPoller(
      gateway,
      42,
      { route },
      new MemoryInboundEventStore(),
      { onSuccess, waitSeconds: 25 },
    );

    await poller.run(abortController.signal);

    expect(gateway.serverRequests).toBe(2);
    expect(gateway.pollRequests.map((request) => request.ts)).toEqual([
      '1',
      '2',
      '10',
    ]);
    expect(route).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledTimes(3);
  });

  it('retries the failed event before advancing the batch cursor', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway([
      {
        ts: '2',
        updates: [createEvent('event-1'), createEvent('event-2')],
      },
    ]);
    const routed: string[] = [];
    let secondEventAttempts = 0;
    const poller = new VkPoller(
      gateway,
      42,
      {
        route: (event) => {
          const eventId = event.event_id;
          if (!eventId) {
            throw new Error('Expected a synthetic event identifier');
          }
          routed.push(eventId);
          if (eventId === 'event-2') {
            secondEventAttempts += 1;
            if (secondEventAttempts === 1) {
              return Promise.reject(new Error('Temporary routing failure'));
            }
            abortController.abort();
          }
          return Promise.resolve();
        },
      },
      new MemoryInboundEventStore(),
      { retryDelay: () => Promise.resolve() },
    );

    await poller.run(abortController.signal);

    expect(routed).toEqual(['event-1', 'event-2', 'event-2']);
    expect(gateway.pollRequests.map((request) => request.ts)).toEqual(['1']);
  });

  it('retries initial server discovery instead of stopping the poller', async () => {
    const abortController = new AbortController();
    let serverRequests = 0;
    const errors: unknown[] = [];
    const gateway: VkGateway = {
      getLongPollServer: () => {
        serverRequests += 1;
        if (serverRequests === 1) {
          return Promise.reject(new Error('VK is temporarily unavailable'));
        }
        return Promise.resolve({
          key: 'key',
          server: 'https://lp.vk.test',
          ts: '1',
        });
      },
      getUserDisplayName: () => Promise.resolve('Customer'),
      poll: () => {
        abortController.abort();
        return Promise.resolve({ ts: '2', updates: [] });
      },
      sendMessage: () => Promise.resolve({ externalMessageId: '1' }),
    };
    const poller = new VkPoller(
      gateway,
      42,
      { route: vi.fn() },
      new MemoryInboundEventStore(),
      {
        onError: (error) => errors.push(error),
        retryDelay: () => Promise.resolve(),
      },
    );

    await poller.run(abortController.signal);

    expect(serverRequests).toBe(2);
    expect(errors).toHaveLength(1);
  });

  it('keeps retrying when long poll server recovery temporarily fails', async () => {
    const abortController = new AbortController();
    const cursors: string[] = [];
    const errors: unknown[] = [];
    let serverRequests = 0;
    const gateway: VkGateway = {
      getLongPollServer: () => {
        serverRequests += 1;
        if (serverRequests === 2) {
          return Promise.reject(new Error('VK recovery failed'));
        }
        return Promise.resolve({
          key: `key-${serverRequests}`,
          server: 'https://lp.vk.test',
          ts: serverRequests === 1 ? '1' : '10',
        });
      },
      getUserDisplayName: () => Promise.resolve('Customer'),
      poll: (server) => {
        cursors.push(server.ts);
        if (server.ts === '10') {
          abortController.abort();
          return Promise.resolve({ ts: '11', updates: [] });
        }
        return Promise.resolve({ failed: 2 });
      },
      sendMessage: () => Promise.resolve({ externalMessageId: '1' }),
    };
    const poller = new VkPoller(
      gateway,
      42,
      { route: vi.fn() },
      new MemoryInboundEventStore(),
      {
        onError: (error) => errors.push(error),
        retryDelay: () => Promise.resolve(),
      },
    );

    await poller.run(abortController.signal);

    expect(serverRequests).toBe(3);
    expect(cursors).toEqual(['1', '1', '10']);
    expect(errors).toHaveLength(1);
  });

  it('processes a stored event before opening a new long poll session', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway([]);
    const eventStore = new MemoryInboundEventStore();
    const event = createEvent('stored-event');
    eventStore.enqueueInboundEvents([
      {
        externalEventId: 'stored-event',
        payload: JSON.stringify(event),
        receivedAt: new Date('2026-09-05T12:00:00.000Z'),
        source: 'vk:long-poll',
      },
    ]);
    const route = vi.fn(() => {
      abortController.abort();
      return Promise.resolve();
    });
    const poller = new VkPoller(gateway, 42, { route }, eventStore);

    await poller.run(abortController.signal);

    expect(route).toHaveBeenCalledWith(event);
    expect(gateway.serverRequests).toBe(0);
    expect(eventStore.findPendingInboundEvents('vk:long-poll', 10)).toEqual([]);
  });
});

class MemoryInboundEventStore implements InboundEventStore {
  private readonly events: PendingInboundEvent[] = [];

  public completeInboundEvent(source: string, externalEventId: string): void {
    const index = this.events.findIndex(
      (event) =>
        event.source === source && event.externalEventId === externalEventId,
    );
    if (index >= 0) {
      this.events.splice(index, 1);
    }
  }

  public enqueueInboundEvents(events: readonly PendingInboundEvent[]): void {
    for (const event of events) {
      const exists = this.events.some(
        (stored) =>
          stored.source === event.source &&
          stored.externalEventId === event.externalEventId,
      );
      if (!exists) {
        this.events.push(event);
      }
    }
  }

  public findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly PendingInboundEvent[] {
    return this.events
      .filter((event) => event.source === source)
      .slice(0, limit);
  }
}

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

function createEvent(eventId = 'event-1'): VkLongPollEvent {
  return {
    event_id: eventId,
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
