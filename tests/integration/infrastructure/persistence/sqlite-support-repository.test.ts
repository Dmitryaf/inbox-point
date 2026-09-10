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
  it('stores idempotent usage counters without message text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    const event = {
      channel: 'vk' as const,
      id: 'information:vk:event-1',
      occurredAt: new Date('2026-09-06T12:00:00.000Z'),
      type: 'information_section' as const,
    };

    repository.recordUsageEvent(event);
    repository.recordUsageEvent(event);
    expect(
      repository.getUsageEventCounts(new Date('2026-09-06T00:00:00.000Z')),
    ).toMatchObject({ information_section: 1 });
    repository.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    const columns = database
      .prepare('PRAGMA table_info(usage_events)')
      .all() as unknown as { name: string }[];
    expect(columns.map((column) => column.name)).not.toContain('text');
    database.close();
  });

  it('marks an interrupted delivery attempt as unknown after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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

  it('marks an interrupted operator relay as unknown after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    const action = {
      clientMessageId: 'client-message-1',
      createdAt,
      id: 'operator-relay:request-1:client-message-1:0',
      initial: false,
      kind: 'relay_message' as const,
      operatorTopicId: '900',
      requestId: 'request-1',
      sequence: 0,
    };

    const first = new SqliteSupportRepository(databasePath);
    first.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: '900',
      status: 'active',
    });
    expect(first.prepareOperatorAction(action).status).toBe('pending');
    expect(first.claimOperatorAction(action.id, createdAt)).toBe(true);
    first.close();

    const restored = new SqliteSupportRepository(databasePath);
    expect(restored.prepareOperatorAction(action).status).toBe(
      'outcome_unknown',
    );
    expect(restored.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(restored.findOperatorActionIncidents(10)).toEqual([
      expect.objectContaining({
        clientMessageId: 'client-message-1',
        id: action.id,
        operatorTopicId: '900',
        requestId: 'request-1',
      }),
    ]);
    restored.close();
  });

  it('keeps the web owner when topic creation is interrupted', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    const action = {
      clientMessageId: 'client-message-1',
      createdAt,
      id: 'operator-open:request-1',
      initial: true,
      kind: 'open_request' as const,
      operatorTopicId: 'web:request-1',
      requestId: 'request-1',
      sequence: 0,
    };
    const beforeCrash = new SqliteSupportRepository(databasePath);
    beforeCrash.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    beforeCrash.prepareOperatorAction(action);
    beforeCrash.claimOperatorAction(action.id, createdAt);
    beforeCrash.close();

    const restored = new SqliteSupportRepository(databasePath);
    expect(restored.findRequestById('request-1')?.operatorTopicId).toBe(
      'web:request-1',
    );
    expect(restored.findOperatorActionIncidents(10)).toEqual([
      expect.objectContaining({
        id: action.id,
        kind: 'open_request',
      }),
    ]);
    restored.close();
  });

  it('commits a created Telegram topic together with its request owner', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    const action = {
      clientMessageId: 'client-message-1',
      createdAt,
      id: 'operator-open:request-1',
      initial: true,
      kind: 'open_request' as const,
      operatorTopicId: 'web:request-1',
      requestId: 'request-1',
      sequence: 0,
    };
    repository.prepareOperatorAction(action);
    repository.claimOperatorAction(action.id, createdAt);

    repository.completeOperatorAction(action.id, '900', createdAt);

    expect(repository.findRequestById('request-1')?.operatorTopicId).toBe(
      '900',
    );
    expect(repository.prepareOperatorAction(action)).toMatchObject({
      externalResultId: '900',
      status: 'sent',
    });
    repository.close();
  });

  it('restores request and duplicate-event state after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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

  it('rejects a database with an outdated schema', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const current = new SqliteSupportRepository(databasePath);
    current.close();

    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA user_version = 2');
    database.close();

    expect(() => new SqliteSupportRepository(databasePath)).toThrow(
      'Unsupported SQLite schema version 2; expected 5',
    );
  });

  it('migrates a version 3 database without losing requests', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const current = new SqliteSupportRepository(databasePath);
    current.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: '900',
      status: 'active',
    });
    current.close();

    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec(`
      DROP TABLE operator_actions;
      DROP TABLE inbound_events;
      CREATE TABLE inbound_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;
      PRAGMA user_version = 3;
    `);
    oldDatabase.close();

    const migrated = new SqliteSupportRepository(databasePath);
    expect(migrated.findRequestById('request-1')).toMatchObject({
      operatorTopicId: '900',
    });
    migrated.close();

    const verified = new DatabaseSync(databasePath, { readOnly: true });
    expect(verified.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 5,
    });
    expect(
      verified
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'operator_actions'",
        )
        .get(),
    ).toEqual({ name: 'operator_actions' });
    verified.close();
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
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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

  it('restores queued inbound events after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
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
      { ...event, attempts: 0 },
    ]);
    second.completeInboundEvent('vk:long-poll', 'vk-event-1');
    second.close();

    const third = new SqliteSupportRepository(databasePath);
    expect(third.findPendingInboundEvents('vk:long-poll', 10)).toEqual([]);
    third.close();
  });

  it('quarantines, retries, and skips failed inbound events', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const event = {
      externalEventId: 'vk-event-1',
      payload: '{"type":"message_new"}',
      receivedAt: new Date('2026-09-05T12:00:00.000Z'),
      source: 'vk:long-poll',
    };
    repository.enqueueInboundEvents([event]);

    expect(
      repository.recordInboundEventFailure(
        event.source,
        event.externalEventId,
        'Invalid stored event',
        new Date('2026-09-05T12:00:01.000Z'),
        2,
      ),
    ).toBe('retry');
    expect(
      repository.recordInboundEventFailure(
        event.source,
        event.externalEventId,
        'Invalid stored event',
        new Date('2026-09-05T12:00:02.000Z'),
        2,
      ),
    ).toBe('quarantined');
    expect(repository.findPendingInboundEvents(event.source, 10)).toEqual([]);
    expect(repository.findQuarantinedInboundEvents(10)).toEqual([
      expect.objectContaining({
        attempts: 2,
        externalEventId: event.externalEventId,
        lastError: 'Invalid stored event',
      }),
    ]);

    expect(
      repository.retryQuarantinedInboundEvent(
        event.source,
        event.externalEventId,
      ),
    ).toBe(true);
    expect(repository.findPendingInboundEvents(event.source, 10)).toEqual([
      { ...event, attempts: 0 },
    ]);
    repository.recordInboundEventFailure(
      event.source,
      event.externalEventId,
      'Invalid stored event',
      new Date('2026-09-05T12:00:03.000Z'),
      1,
    );
    expect(
      repository.skipQuarantinedInboundEvent(
        event.source,
        event.externalEventId,
      ),
    ).toBe(true);
    expect(repository.getInboundEventSummary()).toEqual({ quarantined: 0 });
    repository.close();
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
