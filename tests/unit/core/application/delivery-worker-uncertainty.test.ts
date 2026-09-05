import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

describe('DeliveryWorker uncertain outcome', () => {
  const repositories: SqliteSupportRepository[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      repository.close();
    }
  });

  it('stops automatic retries when Telegram may have accepted the message', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-05T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.enqueueDelivery({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-05T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Ответ',
    });
    let sendAttempts = 0;
    const worker = new DeliveryWorker({
      channels: [
        {
          kind: 'telegram',
          send: () => {
            sendAttempts += 1;
            return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
          },
        },
      ],
      repository,
    });

    await worker.processPending();
    await worker.processPending();

    expect(sendAttempts).toBe(1);
    expect(repository.getDeliverySummary()).toEqual({
      failed: 1,
      pending: 0,
      uncertain: 1,
    });
    expect(repository.findFailedDeliveries(10)[0]).toMatchObject({
      id: 'delivery-1',
      outcomeUnknown: true,
    });
    expect(repository.retryFailedDelivery('delivery-1', new Date())).toBe(
      false,
    );
  });

  it('does not resend Telegram after delivery succeeded but persistence failed', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-05T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.enqueueDelivery({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-05T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Ответ',
    });
    vi.spyOn(repository, 'completeDelivery').mockImplementationOnce(() => {
      throw new Error('temporary persistence failure');
    });
    let sendAttempts = 0;
    const worker = new DeliveryWorker({
      channels: [
        {
          kind: 'telegram',
          send: () => {
            sendAttempts += 1;
            return Promise.resolve({ externalMessageId: 'telegram-1' });
          },
        },
      ],
      repository,
    });

    await worker.processPending();
    await worker.processPending();

    expect(sendAttempts).toBe(1);
    expect(repository.findFailedDeliveries(10)[0]).toMatchObject({
      id: 'delivery-1',
      outcomeUnknown: true,
    });
  });
});
