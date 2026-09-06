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

describe('SQLite closed-request retention', () => {
  it('removes conversation content after every delivery is sent', () => {
    const { databasePath, repository } = createRepository();
    createRequest(repository, 'eligible', 'closed', '2026-08-20', 'Alice');
    recordMessage(repository, 'eligible', 'client', 'Private question');
    recordMessage(repository, 'eligible', 'operator', 'Private answer');
    enqueueDelivery(repository, 'eligible', 'Private answer');
    repository.completeDelivery(
      'delivery-eligible',
      'client-answer-eligible',
      new Date('2026-08-20T12:05:00.000Z'),
      {
        clientMessageId: 'client-answer-eligible',
        createdAt: new Date('2026-08-20T12:05:00.000Z'),
        direction: 'operator_to_client',
        id: 'link-eligible',
        operatorMessageId: 'operator-message-eligible',
        requestId: 'eligible',
      },
    );

    expect(
      repository.purgeClosedConversationContent(
        new Date('2026-09-01T00:00:00.000Z'),
      ),
    ).toEqual({
      deliveriesRedacted: 1,
      eligibleRequests: 1,
      messagesDeleted: 2,
      requestsAnonymized: 1,
      skippedRequests: 0,
    });
    expect(repository.findConversationMessages('eligible', 10)).toEqual([]);
    expect(repository.findRequestById('eligible')).not.toHaveProperty(
      'displayName',
    );

    expect(
      repository.purgeClosedConversationContent(
        new Date('2026-09-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      deliveriesRedacted: 0,
      messagesDeleted: 0,
      requestsAnonymized: 0,
    });
    repository.close();

    const database = new DatabaseSync(databasePath);
    expect(
      database
        .prepare("SELECT text FROM deliveries WHERE id = 'delivery-eligible'")
        .get(),
    ).toEqual({ text: '' });
    database.close();
  });

  it('keeps active, recent, and unfinished requests intact', () => {
    const { repository } = createRepository();
    createRequest(repository, 'active', 'active', '2026-08-20', 'Active');
    createRequest(repository, 'recent', 'closed', '2026-09-05', 'Recent');
    createRequest(repository, 'pending', 'closed', '2026-08-20', 'Pending');
    createRequest(repository, 'failed', 'closed', '2026-08-20', 'Failed');

    for (const requestId of ['active', 'recent', 'pending', 'failed']) {
      recordMessage(repository, requestId, 'client', `Message ${requestId}`);
    }
    enqueueDelivery(repository, 'pending', 'Pending answer');
    enqueueDelivery(repository, 'failed', 'Failed answer');
    repository.markDeliveryFailed('delivery-failed', 'Permanent failure');

    expect(
      repository.purgeClosedConversationContent(
        new Date('2026-09-01T00:00:00.000Z'),
      ),
    ).toEqual({
      deliveriesRedacted: 0,
      eligibleRequests: 0,
      messagesDeleted: 0,
      requestsAnonymized: 0,
      skippedRequests: 2,
    });

    for (const requestId of ['active', 'recent', 'pending', 'failed']) {
      expect(repository.findConversationMessages(requestId, 10)).toHaveLength(
        1,
      );
      expect(repository.findRequestById(requestId)).toHaveProperty(
        'displayName',
      );
    }
    repository.close();
  });
});

function createRepository(): {
  databasePath: string;
  repository: SqliteSupportRepository;
} {
  const directory = mkdtempSync(join(tmpdir(), 'handoff-retention-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'handoff.sqlite');
  return {
    databasePath,
    repository: new SqliteSupportRepository(databasePath),
  };
}

function createRequest(
  repository: SqliteSupportRepository,
  id: string,
  status: 'active' | 'closed',
  day: string,
  displayName: string,
): void {
  repository.createRequest({
    channel: 'telegram',
    ...(status === 'closed'
      ? { closedAt: new Date(`${day}T12:10:00.000Z`) }
      : {}),
    conversationId: `conversation-${id}`,
    createdAt: new Date(`${day}T12:00:00.000Z`),
    displayName,
    id,
    operatorTopicId: `topic-${id}`,
    status,
  });
}

function recordMessage(
  repository: SqliteSupportRepository,
  requestId: string,
  sender: 'client' | 'operator',
  text: string,
): void {
  repository.recordConversationMessage({
    createdAt: new Date('2026-08-20T12:01:00.000Z'),
    direction:
      sender === 'client' ? 'client_to_operator' : 'operator_to_client',
    externalMessageId: `${sender}-message-${requestId}`,
    id: `${sender}-record-${requestId}`,
    requestId,
    senderName: sender === 'client' ? 'Client name' : 'Operator name',
    text,
  });
}

function enqueueDelivery(
  repository: SqliteSupportRepository,
  requestId: string,
  text: string,
): void {
  repository.enqueueDelivery({
    channel: 'telegram',
    conversationId: `conversation-${requestId}`,
    createdAt: new Date('2026-08-20T12:02:00.000Z'),
    id: `delivery-${requestId}`,
    idempotencyKey: `delivery-key-${requestId}`,
    operatorMessageId: `operator-message-${requestId}`,
    requestId,
    text,
  });
}
