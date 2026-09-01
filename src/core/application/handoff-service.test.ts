import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  OpenOperatorRequest,
  OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import { HandoffService } from './handoff-service.js';

class FakeOperatorInbox implements OperatorInbox {
  public readonly closed: string[] = [];
  public readonly opened: OpenOperatorRequest[] = [];
  public readonly reopened: string[] = [];
  public readonly relayed: {
    message: SupportMessage;
    operatorTopicId: string;
  }[] = [];

  public closeRequest(operatorTopicId: string): Promise<void> {
    this.closed.push(operatorTopicId);
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ operatorMessageId: string; topicId: string }> {
    this.opened.push(request);
    return Promise.resolve({
      operatorMessageId: `operator-message-${this.opened.length}`,
      topicId: `topic-${this.opened.length}`,
    });
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
  ): Promise<{ operatorMessageId: string }> {
    this.relayed.push({ message, operatorTopicId });
    return Promise.resolve({
      operatorMessageId: `relay-${this.relayed.length}`,
    });
  }

  public reopenRequest(operatorTopicId: string): Promise<void> {
    this.reopened.push(operatorTopicId);
    return Promise.resolve();
  }
}

describe('HandoffService', () => {
  let inbox: FakeOperatorInbox;
  let repository: SqliteSupportRepository;
  let service: HandoffService;

  beforeEach(() => {
    let nextId = 1;
    inbox = new FakeOperatorInbox();
    repository = new SqliteSupportRepository(':memory:');
    service = new HandoffService({
      clock: () => new Date('2026-08-31T12:00:00.000Z'),
      createId: () => `id-${nextId++}`,
      operatorInbox: inbox,
      repository,
    });
  });

  afterEach(() => {
    repository.close();
  });

  it('opens one topic and ignores a repeated client event', async () => {
    const message = createClientMessage('message-1', 'Need help');

    await service.handleClientMessage('update-1', message);
    await service.handleClientMessage('update-1', message);

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.opened[0]?.title).toBe('TG - Test Customer');
    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: 'topic-1',
      status: 'active',
    });
  });

  it('reuses the active topic for subsequent client messages', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'First'),
    );
    await service.handleClientMessage(
      'update-2',
      createClientMessage('message-2', 'Second'),
    );

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed).toEqual([
      {
        message: createClientMessage('message-2', 'Second'),
        operatorTopicId: 'topic-1',
      },
    ]);
  });

  it('reopens the previous topic instead of creating a duplicate', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'First'),
    );
    await service.handleOperatorMessage('update-2', {
      externalMessageId: 'operator-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:01:00.000Z'),
      text: '/close',
    });

    await service.handleClientMessage(
      'update-3',
      createClientMessage('message-2', 'New question'),
    );

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.reopened).toEqual(['topic-1']);
    expect(inbox.relayed).toEqual([
      {
        message: createClientMessage('message-2', 'New question'),
        operatorTopicId: 'topic-1',
      },
    ]);
    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      id: 'id-1',
      operatorTopicId: 'topic-1',
    });
  });

  it('keeps an older duplicate topic closed', async () => {
    repository.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-08-31T11:30:00.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-08-31T11:00:00.000Z'),
      id: 'old-request',
      operatorTopicId: 'old-topic',
      status: 'closed',
    });
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'current-request',
      operatorTopicId: 'current-topic',
      status: 'active',
    });

    await service.handleOperatorTopicReopened(
      'update-old-reopened',
      'old-topic',
    );

    expect(inbox.closed).toEqual(['old-topic']);
    expect(repository.findRequestByTopicId('old-topic')?.status).toBe('closed');
    expect(repository.findActiveRequest('telegram', '101')?.id).toBe(
      'current-request',
    );
  });

  it('enqueues operator text for the originating client once', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'Question'),
    );
    const operatorMessage = {
      externalMessageId: 'operator-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:01:00.000Z'),
      text: 'Answer',
    };

    await service.handleOperatorMessage('update-2', operatorMessage);
    await service.handleOperatorMessage('update-2', operatorMessage);

    expect(
      repository.findPendingDeliveries(
        new Date('2026-08-31T12:00:00.000Z'),
        10,
      ),
    ).toEqual([
      expect.objectContaining({
        attempts: 0,
        conversationId: '101',
        idempotencyKey: 'operator:update-2',
        operatorMessageId: 'operator-1',
        text: 'Answer',
      }),
    ]);
  });

  it('closes, blocks replies, and reopens a request', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'Question'),
    );

    await service.handleOperatorMessage('update-2', {
      externalMessageId: 'operator-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:01:00.000Z'),
      text: '/close',
    });
    await service.handleOperatorMessage('update-3', {
      externalMessageId: 'operator-2',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:02:00.000Z'),
      text: 'Blocked answer',
    });

    expect(
      repository.findPendingDeliveries(
        new Date('2026-08-31T12:00:00.000Z'),
        10,
      ),
    ).toHaveLength(0);
    expect(inbox.closed).toEqual(['topic-1']);
    expect(repository.findRequestByTopicId('topic-1')?.status).toBe('closed');

    await service.handleOperatorMessage('update-4', {
      externalMessageId: 'operator-3',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:03:00.000Z'),
      text: '/reopen',
    });
    await service.handleOperatorMessage('update-5', {
      externalMessageId: 'operator-4',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:04:00.000Z'),
      text: 'Delivered answer',
    });

    expect(inbox.reopened).toEqual(['topic-1']);
    expect(
      repository.findPendingDeliveries(
        new Date('2026-08-31T12:00:00.000Z'),
        10,
      ),
    ).toEqual([expect.objectContaining({ text: 'Delivered answer' })]);
    expect(repository.findRequestByTopicId('topic-1')?.status).toBe('active');
  });
});

function createClientMessage(
  externalMessageId: string,
  text: string,
): SupportMessage {
  return {
    channel: 'telegram',
    conversationId: '101',
    displayName: 'Test Customer',
    externalMessageId,
    receivedAt: new Date('2026-08-31T12:00:00.000Z'),
    text,
  };
}
