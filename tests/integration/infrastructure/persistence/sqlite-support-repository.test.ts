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
  it('persists awaiting-question intent across restart and clears it on request creation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const first = new SqliteSupportRepository(databasePath);

    first.setAwaitingClientQuestion(
      'telegram',
      'client-1',
      new Date('2026-09-16T10:00:00.000Z'),
    );
    first.close();

    const second = new SqliteSupportRepository(databasePath);
    expect(second.isAwaitingClientQuestion('telegram', 'client-1')).toBe(true);
    second.createRequest({
      channel: 'telegram',
      conversationId: 'client-1',
      createdAt: new Date('2026-09-16T10:01:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    expect(second.isAwaitingClientQuestion('telegram', 'client-1')).toBe(false);
    second.setAwaitingClientQuestion(
      'telegram',
      'client-1',
      new Date('2026-09-16T10:02:00.000Z'),
    );
    second.clearAwaitingClientQuestion('telegram', 'client-1');
    expect(second.isAwaitingClientQuestion('telegram', 'client-1')).toBe(false);
    second.close();
  });

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

  it('reuses a topic only for later requests from the same client', () => {
    const repository = new SqliteSupportRepository(':memory:');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-11T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: '900',
      status: 'active',
    });
    repository.closeRequest('request-1', new Date('2026-09-11T12:01:00.000Z'));
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-11T12:02:00.000Z'),
      id: 'request-2',
      operatorTopicId: '900',
      status: 'active',
    });

    expect(repository.findRequestByTopicId('900')?.id).toBe('request-2');
    expect(() =>
      repository.createRequest({
        channel: 'telegram',
        conversationId: '202',
        createdAt: new Date('2026-09-11T12:03:00.000Z'),
        id: 'request-3',
        operatorTopicId: '900',
        status: 'active',
      }),
    ).toThrow('operator topic belongs to another conversation');
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
      'Unsupported SQLite schema version 2; expected 10',
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
      user_version: 10,
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

  it('migrates a version 5 database to reusable client topics', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec(`
      CREATE TABLE support_requests (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        client_display_name TEXT,
        operator_topic_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;
      CREATE TABLE conversation_messages (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        direction TEXT NOT NULL CHECK (
          direction IN ('client_to_operator', 'operator_to_client')
        ),
        external_message_id TEXT NOT NULL,
        sender_name TEXT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (request_id, direction, external_message_id)
      ) STRICT;
      INSERT INTO support_requests (
        id,
        channel,
        external_conversation_id,
        operator_topic_id,
        status,
        created_at,
        closed_at
      ) VALUES (
        'request-1',
        'telegram',
        '101',
        '900',
        'closed',
        '2026-09-11T12:00:00.000Z',
        '2026-09-11T12:01:00.000Z'
      );
      INSERT INTO conversation_messages (
        id,
        request_id,
        direction,
        external_message_id,
        text,
        created_at
      ) VALUES (
        'message-1',
        'request-1',
        'client_to_operator',
        'external-1',
        'Первый вопрос',
        '2026-09-11T12:00:00.000Z'
      );
      PRAGMA user_version = 5;
    `);
    oldDatabase.close();

    const migrated = new SqliteSupportRepository(databasePath);
    migrated.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-11T12:02:00.000Z'),
      id: 'request-2',
      operatorTopicId: '900',
      status: 'active',
    });
    expect(migrated.findRequestByTopicId('900')?.id).toBe('request-2');
    expect(migrated.findConversationMessages('request-1', 10)).toEqual([
      expect.objectContaining({ id: 'message-1', text: 'Первый вопрос' }),
    ]);
    migrated.close();

    const verified = new DatabaseSync(databasePath, { readOnly: true });
    expect(verified.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 10,
    });
    verified.close();
  });

  it('migrates version 8 messages without treating them as held replies', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec(`
      CREATE TABLE support_requests (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        client_display_name TEXT,
        operator_topic_id TEXT NOT NULL,
        web_owned_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;
      CREATE TABLE conversation_messages (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        direction TEXT NOT NULL CHECK (
          direction IN ('client_to_operator', 'operator_to_client')
        ),
        external_message_id TEXT NOT NULL,
        sender_name TEXT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (request_id, direction, external_message_id)
      ) STRICT;
      INSERT INTO support_requests (
        id, channel, external_conversation_id, operator_topic_id, status,
        created_at
      ) VALUES (
        'request-1', 'telegram', '101', '900', 'active',
        '2026-09-16T12:00:00.000Z'
      );
      INSERT INTO conversation_messages (
        id, request_id, direction, external_message_id, text, created_at
      ) VALUES (
        'message-1', 'request-1', 'operator_to_client', '600',
        'Старый ответ', '2026-09-16T12:00:01.000Z'
      );
      PRAGMA user_version = 8;
    `);
    oldDatabase.close();

    const migrated = new SqliteSupportRepository(databasePath);
    expect(migrated.findConversationMessages('request-1', 10)).toEqual([
      expect.objectContaining({ id: 'message-1', text: 'Старый ответ' }),
    ]);
    migrated.close();

    const verified = new DatabaseSync(databasePath, { readOnly: true });
    expect(verified.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 10,
    });
    expect(
      verified
        .prepare(
          `SELECT processing_state, prerequisite_action_id
           FROM conversation_messages WHERE id = 'message-1'`,
        )
        .get(),
    ).toEqual({
      prerequisite_action_id: null,
      processing_state: 'accepted',
    });
    verified.close();
  });

  it('migrates version 9 operator actions and adds durable inbound cursors', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const action = {
      clientMessageId: 'client-message-1',
      createdAt: new Date('2026-09-16T12:00:00.000Z'),
      id: 'operator-reopen:request-old:client-message-1',
      initial: false,
      kind: 'reopen_request' as const,
      operatorTopicId: 'topic-1',
      requestId: 'request-old',
      sequence: 0,
    };
    const current = new SqliteSupportRepository(databasePath);
    current.createRequest({
      channel: 'telegram',
      closedAt: action.createdAt,
      conversationId: '101',
      createdAt: action.createdAt,
      id: 'request-old',
      operatorTopicId: 'topic-1',
      status: 'closed',
    });
    current.holdOperatorReply(
      {
        createdAt: action.createdAt,
        eventSource: 'operator:telegram',
        externalEventId: 'operator-update-1',
        externalMessageId: 'operator-message-1',
        id: 'held-message-1',
        requestId: 'request-old',
        text: 'Historical held reply',
      },
      action,
    );
    current.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-09-16T12:00:30.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-09-16T12:00:30.000Z'),
      id: 'request-middle',
      operatorTopicId: 'topic-1',
      status: 'closed',
    });
    current.close();

    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec(`
      DROP INDEX operator_actions_by_status;
      ALTER TABLE operator_actions RENAME TO operator_actions_v10;
      CREATE TABLE operator_actions (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        kind TEXT NOT NULL CHECK (kind IN (
          'close_request', 'open_request', 'relay_message', 'reopen_request'
        )),
        client_message_id TEXT NOT NULL,
        operator_topic_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        initial INTEGER NOT NULL CHECK (initial IN (0, 1)),
        status TEXT NOT NULL CHECK (status IN (
          'pending', 'sending', 'sent', 'failed', 'outcome_unknown', 'abandoned'
        )),
        external_result_id TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        attempt_started_at TEXT,
        completed_at TEXT,
        manual_resolution TEXT CHECK (manual_resolution IN (
          'confirmed_completed', 'confirmed_not_completed',
          'confirmed_received', 'use_web'
        )),
        resolved_at TEXT
      ) STRICT;
      INSERT INTO operator_actions SELECT * FROM operator_actions_v10;
      DROP TABLE operator_actions_v10;
      CREATE INDEX operator_actions_by_status
        ON operator_actions(status, created_at, id);
      DROP TABLE inbound_event_cursors;
      PRAGMA user_version = 9;
    `);
    oldDatabase.close();

    const migrated = new SqliteSupportRepository(databasePath);
    expect(migrated.prepareOperatorAction(action).status).toBe('superseded');
    expect(migrated.findConversationMessages('request-old', 10)).toEqual([
      expect.objectContaining({ text: 'Historical held reply' }),
    ]);
    expect(migrated.findPendingDeliveries(new Date(), 10)).toEqual([
      expect.objectContaining({ text: 'Historical held reply' }),
    ]);
    expect(
      migrated.createNextRequest({
        channel: 'telegram',
        conversationId: '101',
        createdAt: new Date('2026-09-16T12:01:00.000Z'),
        id: 'request-new',
        operatorTopicId: 'topic-1',
        status: 'active',
      }),
    ).toBe(true);
    expect(migrated.prepareOperatorAction(action).status).toBe('superseded');
    expect(
      migrated.findInboundEventCursor('telegram:get-updates'),
    ).toBeUndefined();
    migrated.close();

    const verified = new DatabaseSync(databasePath, { readOnly: true });
    expect(verified.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 10,
    });
    expect(
      verified
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inbound_event_cursors'",
        )
        .get(),
    ).toEqual({ name: 'inbound_event_cursors' });
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

  it('selects only unanswered active web requests for Telegram recovery', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-16T06:48:00.000Z');
    for (const requestId of ['unanswered', 'answered', 'historical-reply']) {
      repository.createRequest({
        channel: 'vk',
        conversationId: requestId,
        createdAt,
        id: requestId,
        operatorTopicId: `web:${requestId}`,
        status: 'active',
      });
      repository.recordConversationMessage({
        createdAt,
        direction: 'client_to_operator',
        externalMessageId: `${requestId}-message`,
        id: `${requestId}-message`,
        requestId,
        text: 'Question',
      });
    }
    repository.recordConversationMessage({
      createdAt: new Date(createdAt.getTime() + 1_000),
      direction: 'operator_to_client',
      externalMessageId: 'web:answer',
      id: 'web:answer',
      requestId: 'answered',
      text: 'Answer',
    });
    repository.recordConversationMessage({
      createdAt: new Date(createdAt.getTime() + 1_000),
      direction: 'operator_to_client',
      externalMessageId: 'telegram:historical-answer',
      id: 'telegram:historical-answer',
      requestId: 'historical-reply',
      text: 'Earlier Telegram answer',
    });
    repository.markWebOperatorOwned(
      'answered',
      'web:answered',
      new Date(createdAt.getTime() + 1_000),
    );

    expect(repository.countActiveWebOperatorRequests()).toBe(3);
    expect(repository.findRecoverableWebOperatorRequests(10)).toEqual([
      expect.objectContaining({ id: 'unanswered' }),
      expect.objectContaining({ id: 'historical-reply' }),
    ]);
    expect(repository.getWebOperatorRequestSummary()).toEqual({
      recoverable: 2,
      webOwned: 1,
    });

    repository.closeRequest(
      'unanswered',
      new Date(createdAt.getTime() + 2_000),
    );
    expect(repository.countActiveWebOperatorRequests()).toBe(2);
    expect(repository.findRecoverableWebOperatorRequests(10)).toEqual([
      expect.objectContaining({ id: 'historical-reply' }),
    ]);
    expect(repository.getWebOperatorRequestSummary()).toEqual({
      recoverable: 1,
      webOwned: 1,
    });
    repository.close();
  });

  it('atomically assigns a web request to one operator surface', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-16T07:00:00.000Z');
    for (const requestId of ['web-wins', 'recovery-wins']) {
      repository.createRequest({
        channel: 'vk',
        conversationId: requestId,
        createdAt,
        id: requestId,
        operatorTopicId: `web:${requestId}`,
        status: 'active',
      });
    }

    expect(
      repository.markWebOperatorOwned('web-wins', 'web:web-wins', createdAt),
    ).toBe(true);
    expect(
      repository.recoverWebOperatorRequest(
        'web-wins',
        'web:web-wins',
        'topic-1',
      ),
    ).toBe(false);

    expect(
      repository.recoverWebOperatorRequest(
        'recovery-wins',
        'web:recovery-wins',
        'topic-2',
      ),
    ).toBe(true);
    expect(
      repository.markWebOperatorOwned(
        'recovery-wins',
        'web:recovery-wins',
        createdAt,
      ),
    ).toBe(false);
    expect(repository.findRequestById('web-wins')?.operatorTopicId).toBe(
      'web:web-wins',
    );
    expect(repository.findRequestById('recovery-wins')?.operatorTopicId).toBe(
      'topic-2',
    );
    repository.close();
  });

  it('resolves a detached topic close without closing the web request', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-16T08:00:00.000Z');
    const actionId = 'operator-close:request-1:recovery-conflict:topic-1';
    repository.createRequest({
      channel: 'vk',
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    repository.prepareOperatorAction({
      clientMessageId: 'recovery-conflict:topic-1',
      createdAt,
      id: actionId,
      initial: false,
      kind: 'close_request',
      operatorTopicId: 'topic-1',
      requestId: 'request-1',
      sequence: 0,
    });
    expect(repository.claimOperatorAction(actionId, createdAt)).toBe(true);
    repository.markOperatorActionOutcomeUnknown(
      actionId,
      'Telegram outcome is unknown',
    );

    expect(
      repository.resolveOperatorLifecycleAction(
        actionId,
        'completed',
        new Date('2026-09-16T08:01:00.000Z'),
      ),
    ).toBe(true);
    expect(repository.findRequestById('request-1')).toMatchObject({
      operatorTopicId: 'web:request-1',
      status: 'active',
    });
    expect(repository.findOperatorActionIncident(actionId)).toBeUndefined();
    repository.close();
  });

  it('clears a pending question when an uncertain reopen is confirmed', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-16T08:00:00.000Z');
    const actionId = 'operator-reopen:request-1:update-reopen';
    repository.createRequest({
      channel: 'telegram',
      closedAt: createdAt,
      conversationId: '101',
      createdAt,
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'closed',
    });
    repository.setAwaitingClientQuestion('telegram', '101', createdAt);
    repository.prepareOperatorAction({
      clientMessageId: 'update-reopen',
      createdAt,
      id: actionId,
      initial: false,
      kind: 'reopen_request',
      operatorTopicId: 'topic-1',
      requestId: 'request-1',
      sequence: 0,
    });
    expect(repository.claimOperatorAction(actionId, createdAt)).toBe(true);
    repository.markOperatorActionOutcomeUnknown(
      actionId,
      'Telegram outcome is unknown',
    );

    expect(
      repository.resolveOperatorLifecycleAction(
        actionId,
        'completed',
        new Date('2026-09-16T08:01:00.000Z'),
      ),
    ).toBe(true);
    expect(repository.findRequestById('request-1')?.status).toBe('active');
    expect(repository.isAwaitingClientQuestion('telegram', '101')).toBe(false);
    repository.close();
  });

  it('supersedes historical operator uncertainty when a new request begins', () => {
    const repository = new SqliteSupportRepository(':memory:');
    const createdAt = new Date('2026-09-16T08:00:00.000Z');
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt,
      id: 'request-old',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    const relayAction = {
      clientMessageId: 'client-message-1',
      createdAt,
      id: 'operator-relay:request-old:client-message-1:0',
      initial: false,
      kind: 'relay_message' as const,
      operatorTopicId: 'topic-1',
      requestId: 'request-old',
      sequence: 0,
    };
    repository.prepareOperatorAction(relayAction);
    expect(repository.claimOperatorAction(relayAction.id, createdAt)).toBe(
      true,
    );
    repository.markOperatorActionOutcomeUnknown(
      relayAction.id,
      'Telegram message outcome is unknown',
    );
    repository.closeRequest(
      'request-old',
      new Date('2026-09-16T08:01:00.000Z'),
    );
    const reopenAction = {
      clientMessageId: 'operator-message-1',
      createdAt: new Date('2026-09-16T08:02:00.000Z'),
      id: 'operator-reopen:request-old:operator-message-1',
      initial: false,
      kind: 'reopen_request' as const,
      operatorTopicId: 'topic-1',
      requestId: 'request-old',
      sequence: 0,
    };
    repository.prepareOperatorAction(reopenAction);
    expect(
      repository.claimOperatorAction(reopenAction.id, reopenAction.createdAt),
    ).toBe(true);
    repository.markOperatorActionOutcomeUnknown(
      reopenAction.id,
      'Telegram reopen outcome is unknown',
    );
    repository.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-09-16T08:02:30.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-09-16T08:02:30.000Z'),
      id: 'request-middle',
      operatorTopicId: 'topic-1',
      status: 'closed',
    });
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 2 });

    expect(
      repository.createNextRequest({
        channel: 'telegram',
        conversationId: '101',
        createdAt: new Date('2026-09-16T08:03:00.000Z'),
        id: 'request-new',
        operatorTopicId: 'topic-1',
        status: 'active',
      }),
    ).toBe(true);

    expect(repository.prepareOperatorAction(relayAction).status).toBe(
      'superseded',
    );
    expect(repository.prepareOperatorAction(reopenAction).status).toBe(
      'superseded',
    );
    expect(repository.findRequestById('request-old')?.status).toBe('closed');
    expect(repository.findRequestById('request-new')?.status).toBe('active');
    expect(repository.findOperatorActionIncidents(10)).toEqual([]);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
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

  it('persists inbound events and their cursor atomically across restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const event = {
      externalEventId: 'telegram-update-41',
      payload: '{"update_id":41}',
      receivedAt: new Date('2026-09-16T12:00:00.000Z'),
      source: 'telegram:get-updates',
    };

    const first = new SqliteSupportRepository(databasePath);
    first.enqueueInboundEventsAndAdvanceCursor(event.source, [event], '42');
    first.close();

    const restored = new SqliteSupportRepository(databasePath);
    expect(restored.findInboundEventCursor(event.source)).toBe('42');
    expect(restored.findPendingInboundEvents(event.source, 10)).toEqual([
      { ...event, attempts: 0 },
    ]);
    restored.close();
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
