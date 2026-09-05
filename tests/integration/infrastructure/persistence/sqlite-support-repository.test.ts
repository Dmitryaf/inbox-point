import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

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
    first.completeEvent(
      'client:telegram',
      'update-1',
      new Date('2026-08-31T12:00:01.000Z'),
    );
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
    expect(first.getDeliverySummary()).toEqual({
      failed: 0,
      oldestPendingAt: new Date('2026-08-31T12:01:00.000Z'),
      pending: 1,
    });
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
    expect(second.getDeliverySummary()).toEqual({
      failed: 0,
      oldestPendingAt: new Date('2026-08-31T12:01:00.000Z'),
      pending: 1,
    });
    second.close();
  });

  it('releases an interrupted event claim when the process restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');

    const first = new SqliteSupportRepository(databasePath);
    expect(
      first.claimEvent(
        'client:telegram',
        'interrupted-update',
        new Date('2026-08-31T12:00:00.000Z'),
      ),
    ).toBe(true);
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(
      second.claimEvent(
        'client:telegram',
        'interrupted-update',
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(true);
    second.completeEvent(
      'client:telegram',
      'interrupted-update',
      new Date('2026-08-31T12:01:01.000Z'),
    );
    expect(
      second.claimEvent(
        'client:telegram',
        'interrupted-update',
        new Date('2026-08-31T12:02:00.000Z'),
      ),
    ).toBe(false);
    second.close();
  });

  it('migrates existing processed events as completed', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE processed_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;
      INSERT INTO processed_events (
        source,
        external_event_id,
        claimed_at
      ) VALUES (
        'client:telegram',
        'completed-update',
        '2026-08-31T12:00:00.000Z'
      );
    `);
    legacyDatabase.close();

    const repository = new SqliteSupportRepository(databasePath);

    expect(
      repository.claimEvent(
        'client:telegram',
        'completed-update',
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(false);
    expect(
      repository.claimEvent(
        'client:telegram',
        'new-update',
        new Date('2026-08-31T12:02:00.000Z'),
      ),
    ).toBe(true);
    repository.completeEvent(
      'client:telegram',
      'new-update',
      new Date('2026-08-31T12:02:01.000Z'),
    );
    repository.close();
  });

  it('restores queued inbound events after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const event = {
      externalEventId: 'vk-event-1',
      payload: '{"type":"message_new"}',
      receivedAt: new Date('2026-09-05T12:00:00.000Z'),
      source: 'vk:long-poll',
    };

    const first = new SqliteSupportRepository(databasePath);
    first.enqueueInboundEvents([event]);
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(second.findPendingInboundEvents('vk:long-poll', 10)).toEqual([
      event,
    ]);
    second.completeInboundEvent('vk:long-poll', 'vk-event-1');
    second.close();

    const third = new SqliteSupportRepository(databasePath);
    expect(third.findPendingInboundEvents('vk:long-poll', 10)).toEqual([]);
    third.close();
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
    expect(repository.getDeliverySummary()).toEqual({
      failed: 0,
      oldestPendingAt: new Date('2026-08-31T12:01:00.000Z'),
      pending: 1,
    });
    repository.close();
  });
});
