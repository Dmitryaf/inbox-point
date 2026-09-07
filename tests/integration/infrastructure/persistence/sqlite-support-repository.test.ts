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
  it('stores idempotent pilot counters without message text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    const event = {
      channel: 'vk' as const,
      id: 'information:vk:event-1',
      occurredAt: new Date('2026-09-06T12:00:00.000Z'),
      type: 'information_section' as const,
    };

    repository.recordPilotEvent(event);
    repository.recordPilotEvent(event);
    expect(
      repository.getPilotEventCounts(new Date('2026-09-06T00:00:00.000Z')),
    ).toMatchObject({ information_section: 1 });
    repository.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    const columns = database
      .prepare('PRAGMA table_info(pilot_events)')
      .all() as unknown as { name: string }[];
    expect(columns.map((column) => column.name)).not.toContain('text');
    database.close();
  });

  it('marks an interrupted delivery attempt as unknown after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');

    const first = new SqliteSupportRepository(databasePath);
    first.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    for (const index of [1, 2]) {
      first.enqueueDelivery({
        channel: 'telegram',
        conversationId: '101',
        createdAt: new Date(createdAt.getTime() + index * 1_000),
        id: `delivery-${index}`,
        idempotencyKey: `operator:update-${index}`,
        operatorMessageId: `operator-message-${index}`,
        requestId: 'request-1',
        text: `Answer ${index}`,
      });
    }
    expect(first.claimDeliveryAttempt('delivery-1', createdAt)).toBe(true);
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(second.getDeliverySummary()).toEqual({
      failed: 1,
      oldestPendingAt: new Date(createdAt.getTime() + 2_000),
      pending: 1,
      uncertain: 1,
    });
    expect(second.findFailedDeliveries(10)[0]).toMatchObject({
      attempts: 1,
      id: 'delivery-1',
      operatorMessageId: 'operator-message-1',
      operatorTopicId: 'topic-1',
      outcomeUnknown: true,
      requestId: 'request-1',
    });
    expect(second.retryFailedDelivery('delivery-1', new Date())).toBe(false);
    expect(second.findPendingDeliveries(new Date('2026-09-07'), 10)).toEqual([
      expect.objectContaining({ id: 'delivery-2' }),
    ]);
    second.close();
  });

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

  it('records an explicit resolution for deliveries with an unknown outcome', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    for (const index of [1, 2]) {
      repository.enqueueDelivery({
        channel: 'telegram',
        conversationId: '101',
        createdAt: new Date(createdAt.getTime() + index * 1_000),
        id: `delivery-${index}`,
        idempotencyKey: `operator:update-${index}`,
        operatorMessageId: `operator-message-${index}`,
        requestId: 'request-1',
        text: `Answer ${index}`,
      });
      repository.markDeliveryOutcomeUnknown(
        `delivery-${index}`,
        'confirmation was lost',
      );
    }

    expect(
      repository.confirmUnknownDeliveryReceived('delivery-1', createdAt),
    ).toBe(true);
    expect(
      repository.confirmUnknownDeliveryNotReceived('delivery-2', createdAt),
    ).toBe(true);
    expect(repository.getDeliverySummary()).toMatchObject({
      failed: 0,
      pending: 1,
    });
    expect(repository.findPendingDeliveries(createdAt, 10)).toEqual([
      expect.objectContaining({ id: 'delivery-2' }),
    ]);
    expect(
      repository.confirmUnknownDeliveryReceived('delivery-1', createdAt),
    ).toBe(false);
    repository.close();

    const database = new DatabaseSync(databasePath);
    expect(
      database
        .prepare('SELECT id, manual_resolution FROM deliveries ORDER BY id')
        .all(),
    ).toEqual([
      { id: 'delivery-1', manual_resolution: 'confirmed_received' },
      { id: 'delivery-2', manual_resolution: 'confirmed_not_received' },
    ]);
    database.close();
  });

  it('persists retry state for operator failure notifications', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const failedAt = new Date('2026-09-06T12:00:00.000Z');
    const retryAt = new Date('2026-09-06T12:00:30.000Z');
    repository.createRequest({
      channel: 'vk',
      conversationId: '101',
      createdAt: failedAt,
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.enqueueDelivery({
      channel: 'vk',
      conversationId: '101',
      createdAt: failedAt,
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Private answer',
    });
    repository.markDeliveryFailed('delivery-1', 'Channel unavailable');

    expect(repository.findUnnotifiedFailedDeliveries(failedAt, 10)).toEqual([
      expect.objectContaining({ id: 'delivery-1', operatorTopicId: 'topic-1' }),
    ]);
    repository.markDeliveryFailureNotificationRetry('delivery-1', retryAt);
    expect(repository.findUnnotifiedFailedDeliveries(failedAt, 10)).toEqual([]);
    expect(repository.findUnnotifiedFailedDeliveries(retryAt, 10)).toHaveLength(
      1,
    );

    repository.markDeliveryFailureNotified('delivery-1', retryAt);
    expect(repository.findUnnotifiedFailedDeliveries(retryAt, 10)).toEqual([]);
    repository.close();
  });

  it('switches an active request to a new operator topic conditionally', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });

    expect(
      repository.switchOperatorTopic(
        'request-1',
        'another-topic',
        'web:request-1',
      ),
    ).toBe(false);
    expect(
      repository.switchOperatorTopic('request-1', 'topic-1', 'web:request-1'),
    ).toBe(true);
    expect(
      repository.switchOperatorTopic('request-1', 'topic-1', 'web:request-1'),
    ).toBe(false);
    expect(repository.findRequestById('request-1')).toMatchObject({
      operatorTopicId: 'web:request-1',
    });
    expect(repository.findRequestByTopicId('topic-1')).toBeUndefined();
    repository.close();

    const restored = new SqliteSupportRepository(databasePath);
    expect(restored.findRequestById('request-1')).toMatchObject({
      operatorTopicId: 'web:request-1',
    });
    expect(restored.findActiveWebOperatorRequests(10)).toEqual([
      expect.objectContaining({ id: 'request-1' }),
    ]);
    restored.close();
  });

  it('adds inbox and notification storage to an existing database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const current = new SqliteSupportRepository(databasePath);
    current.close();

    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      DROP TABLE conversation_messages;
      ALTER TABLE support_requests DROP COLUMN client_display_name;
      ALTER TABLE deliveries DROP COLUMN operator_notified_at;
      ALTER TABLE deliveries DROP COLUMN notification_next_attempt_at;
    `);
    legacyDatabase.close();

    const migrated = new SqliteSupportRepository(databasePath);
    migrated.close();
    const database = new DatabaseSync(databasePath);
    const columns = database.prepare('PRAGMA table_info(deliveries)').all() as {
      name: string;
    }[];

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'operator_notified_at',
        'notification_next_attempt_at',
      ]),
    );
    const requestColumns = database
      .prepare('PRAGMA table_info(support_requests)')
      .all() as { name: string }[];
    expect(requestColumns.map((column) => column.name)).toContain(
      'client_display_name',
    );
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversation_messages'",
        )
        .get(),
    ).toEqual({ name: 'conversation_messages' });
    database.close();
  });

  it('returns the durable operator conversation with delivery state', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    repository.createRequest({
      channel: 'vk',
      conversationId: '101',
      createdAt,
      displayName: 'Test Customer',
      id: 'request-1',
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    repository.createRequest({
      channel: 'telegram',
      conversationId: '202',
      createdAt,
      displayName: 'Telegram Customer',
      id: 'request-2',
      operatorTopicId: 'topic-2',
      status: 'active',
    });
    repository.recordConversationMessage({
      createdAt,
      direction: 'client_to_operator',
      externalMessageId: 'client-message-1',
      id: 'message-1',
      requestId: 'request-1',
      senderName: 'Test Customer',
      text: 'Question',
    });
    repository.recordConversationMessage({
      createdAt: new Date(createdAt.getTime() + 1_000),
      direction: 'operator_to_client',
      externalMessageId: 'web:reply-1',
      id: 'message-2',
      requestId: 'request-1',
      text: 'Answer',
    });
    repository.recordConversationMessage({
      createdAt,
      direction: 'client_to_operator',
      externalMessageId: 'client-message-1',
      id: 'duplicate-message',
      requestId: 'request-1',
      senderName: 'Test Customer',
      text: 'Duplicate question',
    });
    repository.enqueueDelivery({
      channel: 'vk',
      conversationId: '101',
      createdAt: new Date(createdAt.getTime() + 1_000),
      id: 'delivery-1',
      idempotencyKey: 'operator:reply-1',
      operatorMessageId: 'web:reply-1',
      requestId: 'request-1',
      text: 'Answer',
    });

    expect(repository.findActiveWebOperatorRequests(10)).toEqual([
      expect.objectContaining({
        displayName: 'Test Customer',
        id: 'request-1',
        latestMessageAt: new Date(createdAt.getTime() + 1_000),
      }),
    ]);
    expect(repository.findConversationMessages('request-1', 20)).toEqual([
      expect.objectContaining({
        direction: 'client_to_operator',
        text: 'Question',
      }),
      expect.objectContaining({
        deliveryOutcomeUnknown: false,
        deliveryStatus: 'pending',
        direction: 'operator_to_client',
        text: 'Answer',
      }),
    ]);
    repository.close();
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
