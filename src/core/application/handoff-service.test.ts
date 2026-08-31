import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import { HandoffService } from './handoff-service.js';

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
  let channel: FakeClientChannel;
  let inbox: FakeOperatorInbox;
  let repository: SqliteSupportRepository;
  let service: HandoffService;

  beforeEach(() => {
    let nextId = 1;
    channel = new FakeClientChannel();
    inbox = new FakeOperatorInbox();
    repository = new SqliteSupportRepository(':memory:');
    service = new HandoffService({
      clientChannels: [channel],
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

  it('delivers operator text to the originating client once', async () => {
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

    expect(channel.sent).toEqual([
      {
        conversationId: '101',
        idempotencyKey: 'operator:update-2',
        text: 'Answer',
      },
    ]);
  });

  it('reuses the outbox delivery after a temporary channel failure', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'Question'),
    );
    channel.failuresRemaining = 1;
    const operatorMessage = {
      externalMessageId: 'operator-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:01:00.000Z'),
      text: 'Answer',
    };

    await expect(
      service.handleOperatorMessage('update-2', operatorMessage),
    ).rejects.toThrowError('Temporary channel failure');
    await expect(
      service.handleOperatorMessage('update-2', operatorMessage),
    ).resolves.toBeUndefined();

    expect(channel.sent).toHaveLength(2);
    expect(channel.sent[0]?.idempotencyKey).toBe('operator:update-2');
    expect(channel.sent[1]?.idempotencyKey).toBe('operator:update-2');
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

    expect(channel.sent).toHaveLength(0);
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
    expect(channel.sent).toHaveLength(1);
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
