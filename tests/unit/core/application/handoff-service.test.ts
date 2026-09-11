import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HandoffService } from '@/core/application/handoff-service.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

class FakeOperatorInbox implements OperatorInbox {
  public firstOpenGate: Promise<void> | undefined;
  public onOpenRequest: (() => void) | undefined;
  public readonly closed: string[] = [];
  public readonly opened: OpenOperatorRequest[] = [];
  public readonly reopened: string[] = [];
  public readonly relayed: {
    initial: boolean;
    message: SupportMessage;
    operatorTopicId: string;
  }[] = [];

  public closeRequest(operatorTopicId: string): Promise<void> {
    this.closed.push(operatorTopicId);
    return Promise.resolve();
  }

  public async openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    this.opened.push(request);
    const openNumber = this.opened.length;

    if (this.onOpenRequest) {
      this.onOpenRequest();
    }

    if (openNumber === 1 && this.firstOpenGate) {
      await this.firstOpenGate;
    }

    if (request.reusableTopicId) {
      this.reopened.push(request.reusableTopicId);
      return { topicId: request.reusableTopicId };
    }
    return { topicId: `topic-${openNumber}` };
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    this.relayed.push({ initial: options.initial, message, operatorTopicId });
    return Promise.resolve({
      operatorMessageIds: [`relay-${this.relayed.length}`],
      operatorTopicId,
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
    expect(
      repository.getUsageEventCounts(new Date('2026-08-31T00:00:00.000Z'))
        .new_request,
    ).toBe(1);
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
        initial: true,
        message: createClientMessage('message-1', 'First'),
        operatorTopicId: 'topic-1',
      },
      {
        initial: false,
        message: createClientMessage('message-2', 'Second'),
        operatorTopicId: 'topic-1',
      },
    ]);
    expect(repository.getDeliverySummary().pending).toBe(1);
  });

  it('serializes simultaneous messages from the same client', async () => {
    const firstOpenGate = Promise.withResolvers<void>();
    const firstOpenStarted = Promise.withResolvers<void>();
    inbox.firstOpenGate = firstOpenGate.promise;
    inbox.onOpenRequest = firstOpenStarted.resolve;

    const first = service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'First'),
    );
    await firstOpenStarted.promise;

    const second = service.handleClientMessage(
      'update-2',
      createClientMessage('message-2', 'Second'),
    );

    expect(inbox.opened).toHaveLength(1);

    firstOpenGate.resolve();
    await Promise.all([first, second]);

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed).toEqual([
      {
        initial: true,
        message: createClientMessage('message-1', 'First'),
        operatorTopicId: 'topic-1',
      },
      {
        initial: false,
        message: createClientMessage('message-2', 'Second'),
        operatorTopicId: 'topic-1',
      },
    ]);
  });

  it('creates a new request in the previous client topic after close', async () => {
    await service.handleClientMessage(
      'update-1',
      createClientMessage('message-1', 'First'),
    );
    const firstRequest = repository.findActiveRequest('telegram', '101');
    await service.handleOperatorMessage('update-first-reply', {
      externalMessageId: 'operator-first',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:00:30.000Z'),
      text: 'First answer',
    });
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
    await service.handleOperatorMessage('update-second-reply', {
      externalMessageId: 'operator-second',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-08-31T12:02:00.000Z'),
      text: 'Second answer',
    });

    const secondRequest = repository.findActiveRequest('telegram', '101');
    expect(inbox.opened).toHaveLength(2);
    expect(inbox.opened[1]?.reusableTopicId).toBe('topic-1');
    expect(inbox.reopened).toEqual(['topic-1']);
    expect(inbox.relayed).toEqual([
      {
        initial: true,
        message: createClientMessage('message-1', 'First'),
        operatorTopicId: 'topic-1',
      },
      {
        initial: true,
        message: createClientMessage('message-2', 'New question'),
        operatorTopicId: 'topic-1',
      },
    ]);
    expect(firstRequest?.id).toBeDefined();
    expect(secondRequest).toMatchObject({
      operatorTopicId: 'topic-1',
    });
    expect(secondRequest?.id).not.toBe(firstRequest?.id);
    expect(
      repository.getUsageEventCounts(new Date('2026-08-31T00:00:00.000Z')),
    ).toMatchObject({ first_reply: 2, new_request: 2 });
    expect(repository.getDeliverySummary().pending).toBe(4);
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

  it('ignores a delayed close event from a previous request in a reused topic', async () => {
    repository.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-08-31T11:30:00.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-08-31T11:00:00.000Z'),
      id: 'old-request',
      operatorTopicId: 'shared-topic',
      status: 'closed',
    });
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      id: 'current-request',
      operatorTopicId: 'shared-topic',
      status: 'active',
    });

    await service.handleOperatorTopicClosed(
      'delayed-close',
      'shared-topic',
      new Date('2026-08-31T11:30:00.000Z'),
    );

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
      repository.getUsageEventCounts(new Date('2026-08-31T00:00:00.000Z'))
        .first_reply,
    ).toBe(1);
    repository.completeDelivery(
      'system:handoff-ack:id-1',
      'client-ack-1',
      new Date('2026-08-31T12:00:01.000Z'),
      {
        clientMessageId: 'client-ack-1',
        createdAt: new Date('2026-08-31T12:00:01.000Z'),
        direction: 'operator_to_client',
        id: 'ack-link-1',
        operatorMessageId: 'system:handoff-ack:id-1',
        requestId: 'id-1',
      },
    );

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
    repository.completeDelivery(
      'system:handoff-ack:id-1',
      'client-ack-1',
      new Date('2026-08-31T12:00:01.000Z'),
      {
        clientMessageId: 'client-ack-1',
        createdAt: new Date('2026-08-31T12:00:01.000Z'),
        direction: 'operator_to_client',
        id: 'ack-link-1',
        operatorMessageId: 'system:handoff-ack:id-1',
        requestId: 'id-1',
      },
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
