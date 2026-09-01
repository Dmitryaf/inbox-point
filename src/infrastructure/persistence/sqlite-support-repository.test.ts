import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteSupportRepository } from './sqlite-support-repository.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('SqliteSupportRepository', () => {
  it('restores request and duplicate-event state after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');

    const first = new SqliteSupportRepository(databasePath);
    first.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    expect(
      first.claimEvent(
        'client:telegram',
        'update-1',
        new Date('2026-08-31T12:00:00.000Z'),
      ),
    ).toBe(true);
    first.enqueueDelivery({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-2',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Answer',
    });
    first.markDeliveryRetry(
      'delivery-1',
      'Temporary network failure',
      new Date('2026-08-31T12:08:00.000Z'),
    );
    expect(first.getDeliverySummary()).toEqual({ failed: 0, pending: 1 });
    first.closeRequest('request-1', new Date('2026-08-31T12:05:00.000Z'));
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(second.findRequestByTopicId('topic-1')).toMatchObject({
      closedAt: new Date('2026-08-31T12:05:00.000Z'),
      conversationId: '101',
      id: 'request-1',
      status: 'closed',
    });
    expect(
      second.claimEvent(
        'client:telegram',
        'update-1',
        new Date('2026-08-31T12:10:00.000Z'),
      ),
    ).toBe(false);
    expect(
      second.findPendingDeliveries(new Date('2026-08-31T12:07:00.000Z'), 10),
    ).toHaveLength(0);
    expect(
      second.findPendingDeliveries(new Date('2026-08-31T12:10:00.000Z'), 10),
    ).toEqual([
      expect.objectContaining({
        attempts: 1,
        id: 'delivery-1',
        operatorMessageId: 'operator-message-1',
        text: 'Answer',
      }),
    ]);
    expect(second.getDeliverySummary()).toEqual({ failed: 0, pending: 1 });
    second.close();
  });

  it('rolls back delivery completion when the message link cannot be stored', () => {
    const repository = new SqliteSupportRepository(':memory:');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.addMessageLink({
      clientMessageId: 'client-question-1',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      direction: 'client_to_operator',
      id: 'duplicate-link',
      operatorMessageId: 'operator-question-1',
      requestId: 'request-1',
    });
    repository.enqueueDelivery({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-2',
      operatorMessageId: 'operator-answer-1',
      requestId: 'request-1',
      text: 'Answer',
    });

    expect(() =>
      repository.completeDelivery(
        'delivery-1',
        'client-answer-1',
        new Date('2026-08-31T12:02:00.000Z'),
        {
          clientMessageId: 'client-answer-1',
          createdAt: new Date('2026-08-31T12:02:00.000Z'),
          direction: 'operator_to_client',
          id: 'duplicate-link',
          operatorMessageId: 'operator-answer-1',
          requestId: 'request-1',
        },
      ),
    ).toThrow();
    expect(
      repository.findPendingDeliveries(
        new Date('2026-08-31T12:03:00.000Z'),
        10,
      ),
    ).toHaveLength(1);
    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 1 });
    repository.close();
  });
});
