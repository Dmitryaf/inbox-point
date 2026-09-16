import { describe, expect, it } from 'vitest';

import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import type { InboundEventStore } from '@/core/contracts/support-repository.js';
import type {
  InboundEventFailureOutcome,
  InboundEventIncident,
  InboundEventSummary,
  PendingInboundEvent,
  QueuedInboundEvent,
} from '@/core/model/inbound-event.js';
import type {
  GetUpdatesOptions,
  SendMessageOptions,
  TelegramGateway,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import type { TelegramUpdate } from '@/infrastructure/telegram/telegram-types.js';

const source = 'telegram:get-updates';

describe('TelegramPoller', () => {
  it('persists updates and advances the durable offset before routing them', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway(abortController, [
      [createUpdate(1), createUpdate(2)],
      [],
    ]);
    const eventStore = new MemoryInboundEventStore();
    const routed: number[] = [];
    const poller = new TelegramPoller(
      gateway,
      {
        route: (update) => {
          expect(eventStore.findInboundEventCursor(source)).toBe('3');
          routed.push(update.update_id);
          return Promise.resolve();
        },
      },
      30,
      eventStore,
      {
        onSuccess: () => {
          if (gateway.offsets.length === 2) {
            abortController.abort();
          }
        },
      },
    );

    await poller.run(abortController.signal);

    expect(gateway.offsets).toEqual([undefined, 3]);
    expect(routed).toEqual([1, 2]);
    expect(eventStore.findInboundEventCursor(source)).toBe('3');
    expect(eventStore.findPendingInboundEvents(source, 10)).toEqual([]);
  });

  it('retries a transient failure before processing the next update', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway(abortController, [
      [createUpdate(1), createUpdate(2)],
    ]);
    const eventStore = new MemoryInboundEventStore();
    const routed: number[] = [];
    let firstAttempts = 0;
    const poller = new TelegramPoller(
      gateway,
      {
        route: (update) => {
          routed.push(update.update_id);
          if (update.update_id === 1) {
            firstAttempts += 1;
            if (firstAttempts === 1) {
              return Promise.reject(new Error('Temporary failure'));
            }
          }
          if (update.update_id === 2) {
            abortController.abort();
          }
          return Promise.resolve();
        },
      },
      30,
      eventStore,
      { retryDelay: () => Promise.resolve(), retryDelayMs: 0 },
    );

    await poller.run(abortController.signal);

    expect(routed).toEqual([1, 1, 2]);
    expect(gateway.offsets).toEqual([undefined]);
    expect(eventStore.getInboundEventSummary()).toEqual({ quarantined: 0 });
  });

  it('quarantines a poison update and continues with the next update', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway(abortController, [
      [createUpdate(1), createUpdate(2)],
    ]);
    const eventStore = new MemoryInboundEventStore();
    const routed: number[] = [];
    const poller = new TelegramPoller(
      gateway,
      {
        route: (update) => {
          routed.push(update.update_id);
          if (update.update_id === 1) {
            return Promise.reject(new Error('Permanent routing failure'));
          }
          abortController.abort();
          return Promise.resolve();
        },
      },
      30,
      eventStore,
      {
        maxEventAttempts: 2,
        retryDelay: () => Promise.resolve(),
        retryDelayMs: 0,
      },
    );

    await poller.run(abortController.signal);

    expect(routed).toEqual([1, 1, 2]);
    expect(eventStore.findQuarantinedInboundEvents(10)).toEqual([
      expect.objectContaining({
        attempts: 2,
        externalEventId: '1',
        lastError: 'Permanent routing failure',
        source,
      }),
    ]);
  });

  it('does not blindly retry an update after an uncertain side effect', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway(abortController, [
      [createUpdate(1), createUpdate(2)],
    ]);
    const eventStore = new MemoryInboundEventStore();
    const routed: number[] = [];
    const poller = new TelegramPoller(
      gateway,
      {
        route: (update) => {
          routed.push(update.update_id);
          if (update.update_id === 1) {
            return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
          }
          abortController.abort();
          return Promise.resolve();
        },
      },
      30,
      eventStore,
      {
        maxEventAttempts: 3,
        retryDelay: () => Promise.resolve(),
        retryDelayMs: 0,
      },
    );

    await poller.run(abortController.signal);

    expect(routed).toEqual([1, 2]);
    expect(eventStore.findQuarantinedInboundEvents(10)[0]).toMatchObject({
      attempts: 1,
      externalEventId: '1',
    });
  });

  it('processes a stored update before polling with the durable offset', async () => {
    const abortController = new AbortController();
    const gateway = new ScriptedGateway(abortController, [[]]);
    const eventStore = new MemoryInboundEventStore();
    eventStore.enqueueInboundEventsAndAdvanceCursor(
      source,
      [storedUpdate(createUpdate(8))],
      '9',
    );
    const routed: number[] = [];
    const poller = new TelegramPoller(
      gateway,
      {
        route: (update) => {
          routed.push(update.update_id);
          return Promise.resolve();
        },
      },
      30,
      eventStore,
      { onSuccess: () => abortController.abort() },
    );

    await poller.run(abortController.signal);

    expect(routed).toEqual([8]);
    expect(gateway.offsets).toEqual([9]);
    expect(eventStore.findInboundEventCursor(source)).toBe('9');
  });
});

class ScriptedGateway implements TelegramGateway {
  public readonly offsets: (number | undefined)[] = [];

  public constructor(
    private readonly abortController: AbortController,
    private readonly responses: (readonly TelegramUpdate[])[],
  ) {}

  public closeForumTopic(): Promise<void> {
    return Promise.resolve();
  }

  public createForumTopic(): Promise<{ topicId: number }> {
    return Promise.resolve({ topicId: 1 });
  }

  public getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    this.offsets.push(options.offset);
    const response = this.responses.shift();
    if (!response) {
      this.abortController.abort();
      return Promise.resolve([]);
    }
    return Promise.resolve(response);
  }

  public reopenForumTopic(): Promise<void> {
    return Promise.resolve();
  }

  public sendMessage(
    options: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    void options;
    return Promise.resolve({ messageId: 1 });
  }
}

class MemoryInboundEventStore implements InboundEventStore {
  private readonly cursors = new Map<string, string>();
  private readonly events: StoredInboundEvent[] = [];

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
    this.insertEvents(events);
  }

  public enqueueInboundEventsAndAdvanceCursor(
    source: string,
    events: readonly PendingInboundEvent[],
    nextCursor: string,
  ): void {
    this.insertEvents(events);
    this.cursors.set(source, nextCursor);
  }

  public findInboundEventCursor(source: string): string | undefined {
    return this.cursors.get(source);
  }

  public findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly QueuedInboundEvent[] {
    return this.events
      .filter((event) => event.source === source && event.status === 'pending')
      .slice(0, limit);
  }

  public findQuarantinedInboundEvents(
    limit: number,
  ): readonly InboundEventIncident[] {
    return this.events
      .filter((event) => event.status === 'quarantined')
      .slice(0, limit)
      .map((event) => ({
        attempts: event.attempts,
        externalEventId: event.externalEventId,
        lastError: event.lastError ?? '',
        receivedAt: event.receivedAt,
        source: event.source,
      }));
  }

  public getInboundEventSummary(): InboundEventSummary {
    return {
      quarantined: this.events.filter((event) => event.status === 'quarantined')
        .length,
    };
  }

  public recordInboundEventFailure(
    source: string,
    externalEventId: string,
    error: string,
    nextAttemptAt: Date,
    maxAttempts: number,
  ): InboundEventFailureOutcome {
    const event = this.events.find(
      (candidate) =>
        candidate.source === source &&
        candidate.externalEventId === externalEventId &&
        candidate.status === 'pending',
    );
    if (!event) {
      throw new Error('Pending inbound event was not found');
    }
    event.attempts += 1;
    event.lastError = error;
    event.nextAttemptAt = nextAttemptAt;
    if (event.attempts >= maxAttempts) {
      event.status = 'quarantined';
      delete event.nextAttemptAt;
      return 'quarantined';
    }
    return 'retry';
  }

  public retryQuarantinedInboundEvent(
    source: string,
    externalEventId: string,
  ): boolean {
    const event = this.findQuarantined(source, externalEventId);
    if (!event) {
      return false;
    }
    event.status = 'pending';
    event.attempts = 0;
    return true;
  }

  public skipQuarantinedInboundEvent(
    source: string,
    externalEventId: string,
  ): boolean {
    const event = this.findQuarantined(source, externalEventId);
    if (!event) {
      return false;
    }
    this.events.splice(this.events.indexOf(event), 1);
    return true;
  }

  private findQuarantined(
    source: string,
    externalEventId: string,
  ): StoredInboundEvent | undefined {
    return this.events.find(
      (event) =>
        event.source === source &&
        event.externalEventId === externalEventId &&
        event.status === 'quarantined',
    );
  }

  private insertEvents(events: readonly PendingInboundEvent[]): void {
    for (const event of events) {
      const exists = this.events.some(
        (stored) =>
          stored.source === event.source &&
          stored.externalEventId === event.externalEventId,
      );
      if (!exists) {
        this.events.push({ ...event, attempts: 0, status: 'pending' });
      }
    }
  }
}

interface StoredInboundEvent extends QueuedInboundEvent {
  lastError?: string;
  status: 'pending' | 'quarantined';
}

function createUpdate(updateId: number): TelegramUpdate {
  return { update_id: updateId };
}

function storedUpdate(update: TelegramUpdate): PendingInboundEvent {
  return {
    externalEventId: String(update.update_id),
    payload: JSON.stringify(update),
    receivedAt: new Date('2026-09-16T12:00:00.000Z'),
    source,
  };
}
