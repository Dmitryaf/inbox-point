import { afterEach, describe, expect, it } from 'vitest';

import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import {
  type OpenOperatorRequest,
  type OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

class FakeOperatorInbox implements OperatorInbox {
  public failNextRelay = false;
  public readonly opened: OpenOperatorRequest[] = [];
  public relayCount = 0;

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
    this.relayCount += 1;
    if (this.failNextRelay) {
      this.failNextRelay = false;
      return Promise.reject(new Error('Telegram unavailable'));
    }
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

  it('stores an emergency web request while no Telegram inbox is available', async () => {
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

    await runtime.handleClientMessage('vk-event-1', message);
    const emergencyRequest = repository.findActiveRequest('vk', '101');
    expect(emergencyRequest).toMatchObject({
      displayName: 'VK Customer',
    });
    expect(emergencyRequest?.operatorTopicId.startsWith('web:')).toBe(true);
    expect(
      repository.findConversationMessages(emergencyRequest?.id ?? '', 20),
    ).toEqual([
      expect.objectContaining({
        direction: 'client_to_operator',
        senderName: 'VK Customer',
        text: 'Question',
      }),
    ]);

    const inbox = new FakeOperatorInbox();
    runtime.registerOperatorInbox(inbox);
    await runtime.handleClientMessage('vk-event-follow-up', {
      ...message,
      externalMessageId: 'vk-message-follow-up',
      text: 'Follow-up question',
    });
    expect(inbox.relayCount).toBe(0);
    await runtime.handleClientMessage('vk-event-2', {
      ...message,
      conversationId: '102',
      externalMessageId: 'vk-message-2',
    });

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayCount).toBe(1);
    expect(repository.findActiveRequest('vk', '102')).toMatchObject({
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

  it('keeps the request in the web inbox when Telegram relay fails', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const errors: string[] = [];
    const runtime = new HandoffRuntime({
      logger: {
        error: (_error, message) => {
          errors.push(message);
        },
      },
      repository,
    });
    const inbox = new FakeOperatorInbox();
    inbox.failNextRelay = true;
    runtime.registerOperatorInbox(inbox);

    await runtime.handleClientMessage('vk-event-1', {
      channel: 'vk',
      conversationId: '101',
      displayName: 'VK Customer',
      externalMessageId: 'vk-message-1',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'Question during outage',
    });

    const request = repository.findActiveRequest('vk', '101');
    expect(request?.operatorTopicId).toBe('topic-1');
    expect(repository.findConversationMessages(request?.id ?? '', 20)).toEqual([
      expect.objectContaining({ text: 'Question during outage' }),
    ]);
    expect(errors).toContain(
      'Operator inbox relay failed; using emergency web inbox',
    );
  });
});
