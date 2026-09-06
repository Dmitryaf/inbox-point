import { afterEach, describe, expect, it } from 'vitest';

import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import {
  OperatorInboxUnavailableError,
  type OpenOperatorRequest,
  type OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

class FakeOperatorInbox implements OperatorInbox {
  public readonly opened: OpenOperatorRequest[] = [];

  public closeRequest(): Promise<void> {
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    this.opened.push(request);
    return Promise.resolve({ topicId: 'topic-1' });
  }

  public notifyDeliveryFailure(): Promise<void> {
    return Promise.resolve();
  }

  public relayCustomerMessage(): Promise<{
    operatorMessageIds: readonly string[];
  }> {
    return Promise.resolve({ operatorMessageIds: ['operator-message-1'] });
  }

  public reopenRequest(): Promise<void> {
    return Promise.resolve();
  }
}

describe('HandoffRuntime', () => {
  const repositories: SqliteSupportRepository[] = [];

  afterEach(() => {
    for (const repository of repositories.splice(0)) {
      repository.close();
    }
  });

  it('fails closed and releases the event while no operator inbox is available', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const runtime = new HandoffRuntime({
      logger: { error: () => undefined },
      repository,
    });
    const message = {
      channel: 'vk' as const,
      conversationId: '101',
      displayName: 'VK Customer',
      externalMessageId: 'vk-message-1',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'Question',
    };

    await expect(
      runtime.handleClientMessage('vk-event-1', message),
    ).rejects.toBeInstanceOf(OperatorInboxUnavailableError);
    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();

    const inbox = new FakeOperatorInbox();
    runtime.registerOperatorInbox(inbox);
    await runtime.handleClientMessage('vk-event-1', message);

    expect(inbox.opened).toHaveLength(1);
    expect(repository.findActiveRequest('vk', '101')).toMatchObject({
      operatorTopicId: 'topic-1',
    });
  });

  it('runs outbound delivery without a Telegram runtime', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const runtime = new HandoffRuntime({
      logger: { error: () => undefined },
      repository,
    });
    const sent: string[] = [];
    runtime.registerClientChannel({
      kind: 'vk',
      send: (message) => {
        sent.push(message.text);
        return Promise.resolve({ externalMessageId: 'vk-message-1' });
      },
    });
    repository.createRequest({
      channel: 'vk',
      conversationId: '101',
      createdAt: new Date('2020-09-06T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.enqueueDelivery({
      channel: 'vk',
      conversationId: '101',
      createdAt: new Date('2020-09-06T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Answer to VK',
    });

    runtime.start();
    await expect.poll(() => sent).toEqual(['Answer to VK']);
    await runtime.stop();

    expect(repository.getDeliverySummary()).toEqual({ failed: 0, pending: 0 });
  });
});
