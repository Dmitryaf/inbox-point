import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import { DeliveryWorker } from './delivery-worker.js';

class FakeClientChannel implements ClientChannel {
  public failuresRemaining = 0;
  public readonly kind = 'telegram' as const;
  public readonly sent: OutgoingClientMessage[] = [];

  public send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    this.sent.push(message);
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return Promise.reject(new Error('Temporary channel failure'));
    }
    return Promise.resolve({
      externalMessageId: `client-message-${this.sent.length}`,
    });
  }
}

describe('DeliveryWorker', () => {
  let channel: FakeClientChannel;
  let now: Date;
  let repository: SqliteSupportRepository;

  beforeEach(() => {
    channel = new FakeClientChannel();
    now = new Date('2026-08-31T12:02:00.000Z');
    repository = new SqliteSupportRepository(':memory:');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
  });

  afterEach(() => {
    repository.close();
  });

  it('delivers a persisted operator reply', async () => {
    enqueueDelivery(repository);
    const worker = createWorker(repository, channel, () => now);

    await worker.processPending();

    expect(channel.sent).toEqual([
      {
        conversationId: '101',
        idempotencyKey: 'operator:update-2',
        text: 'Answer',
      },
    ]);
    expect(repository.findPendingDeliveries(now, 10)).toHaveLength(0);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 0 });
  });

  it('keeps a temporary failure pending and retries it', async () => {
    enqueueDelivery(repository);
    channel.failuresRemaining = 1;
    const worker = createWorker(repository, channel, () => now);

    await worker.processPending();
    expect(repository.findPendingDeliveries(now, 10)).toHaveLength(0);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 1 });
    now = new Date(now.getTime() + 1_000);
    expect(repository.findPendingDeliveries(now, 10)).toEqual([
      expect.objectContaining({ attempts: 1 }),
    ]);

    await worker.processPending();
    expect(channel.sent).toHaveLength(2);
    expect(repository.findPendingDeliveries(now, 10)).toHaveLength(0);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 0 });
  });

  it('stops retrying after the configured attempt limit', async () => {
    enqueueDelivery(repository);
    channel.failuresRemaining = 3;
    const worker = createWorker(repository, channel, () => now, 2);

    await worker.processPending();
    now = new Date(now.getTime() + 1_000);
    await worker.processPending();
    await worker.processPending();

    expect(channel.sent).toHaveLength(2);
    expect(repository.findPendingDeliveries(now, 10)).toHaveLength(0);
    expect(repository.getDeliverySummary()).toEqual({ failed: 1, pending: 0 });
    expect(repository.findFailedDeliveries(10)).toEqual([
      expect.objectContaining({
        attempts: 2,
        channel: 'telegram',
        id: 'delivery-1',
        lastError: 'Temporary channel failure',
      }),
    ]);

    channel.failuresRemaining = 0;
    expect(repository.retryFailedDelivery('delivery-1', now)).toBe(true);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 1 });
    await worker.processPending();

    expect(channel.sent).toHaveLength(3);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 0 });
    expect(repository.retryFailedDelivery('delivery-1', now)).toBe(false);
  });

  it('preserves reply order while the first delivery is retrying', async () => {
    enqueueDelivery(repository, {
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      text: 'First answer',
    });
    enqueueDelivery(repository, {
      id: 'delivery-2',
      idempotencyKey: 'operator:update-2',
      operatorMessageId: 'operator-message-2',
      text: 'Second answer',
    });
    channel.failuresRemaining = 1;
    const worker = createWorker(repository, channel, () => now);

    expect(await worker.processPending()).toBe(1);
    expect(await worker.processPending()).toBe(0);
    expect(channel.sent.map((message) => message.text)).toEqual([
      'First answer',
    ]);

    now = new Date(now.getTime() + 1_000);
    expect(await worker.processPending()).toBe(1);
    expect(await worker.processPending()).toBe(1);

    expect(channel.sent.map((message) => message.text)).toEqual([
      'First answer',
      'First answer',
      'Second answer',
    ]);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 0 });
  });
});

function createWorker(
  repository: SqliteSupportRepository,
  channel: FakeClientChannel,
  clock: () => Date,
  maxAttempts = 5,
): DeliveryWorker {
  let nextId = 1;
  return new DeliveryWorker({
    channels: [channel],
    clock,
    createId: () => `link-${nextId++}`,
    maxAttempts,
    repository,
    retryBaseDelayMs: 1_000,
  });
}

function enqueueDelivery(
  repository: SqliteSupportRepository,
  delivery: {
    id?: string;
    idempotencyKey?: string;
    operatorMessageId?: string;
    text?: string;
  } = {},
): void {
  repository.enqueueDelivery({
    channel: 'telegram',
    conversationId: '101',
    createdAt: new Date('2026-08-31T12:01:00.000Z'),
    id: delivery.id ?? 'delivery-1',
    idempotencyKey: delivery.idempotencyKey ?? 'operator:update-2',
    operatorMessageId: delivery.operatorMessageId ?? 'operator-message-1',
    requestId: 'request-1',
    text: delivery.text ?? 'Answer',
  });
}
