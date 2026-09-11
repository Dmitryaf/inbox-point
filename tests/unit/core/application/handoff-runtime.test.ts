import { afterEach, describe, expect, it } from 'vitest';

import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import {
  OperatorActionOutcomeUnknownError,
  type OpenOperatorRequest,
  type OperatorInbox,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

class FakeOperatorInbox implements OperatorInbox {
  public failNextRelay = false;
  public unknownNextRelay = false;
  public onRelay: (() => void) | undefined;
  public readonly opened: OpenOperatorRequest[] = [];
  public relayGate: Promise<void> | undefined;
  public relayCount = 0;

  public closeRequest(): Promise<void> {
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    this.opened.push(request);
    return Promise.resolve({ topicId: `topic-${this.opened.length}` });
  }

  public notifyDeliveryFailure(): Promise<void> {
    return Promise.resolve();
  }

  public async relayCustomerMessage(
    operatorTopicId: string,
    _message: SupportMessage,
    _options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    void _message;
    void _options;
    this.relayCount += 1;
    this.onRelay?.();
    await this.relayGate;
    if (this.failNextRelay) {
      this.failNextRelay = false;
      throw new Error('Telegram unavailable');
    }
    if (this.unknownNextRelay) {
      this.unknownNextRelay = false;
      throw new OperatorActionOutcomeUnknownError('relay-action-1', 'relay');
    }
    return {
      operatorMessageIds: ['operator-message-1'],
      operatorTopicId,
    };
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

  it('moves a failed Telegram conversation exclusively to web until it closes', async () => {
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
    expect(request?.operatorTopicId).toBe(`web:${request?.id}`);
    expect(repository.findConversationMessages(request?.id ?? '', 20)).toEqual([
      expect.objectContaining({ text: 'Question during outage' }),
    ]);
    expect(errors).toContain(
      'Operator inbox relay failed; using emergency web inbox',
    );

    await runtime.handleClientMessage('vk-event-2', {
      channel: 'vk',
      conversationId: '101',
      displayName: 'VK Customer',
      externalMessageId: 'vk-message-2',
      receivedAt: new Date('2026-09-06T12:01:00.000Z'),
      text: 'Follow-up during outage',
    });
    expect(inbox.relayCount).toBe(1);

    await runtime.handleOperatorMessage('telegram-reply-after-takeover', {
      externalMessageId: 'telegram-operator-message-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-06T12:02:00.000Z'),
      text: 'Stale Telegram answer',
    });
    expect(
      repository.findPendingDeliveries(
        new Date('2100-01-01T00:00:00.000Z'),
        10,
      ),
    ).toEqual([
      expect.objectContaining({
        text: 'Вопрос отправлен.',
      }),
    ]);

    const webTopicId = request?.operatorTopicId;
    if (!request || !webTopicId) {
      throw new Error('Expected a web-owned request');
    }
    const webReply = {
      externalMessageId: 'web:reply-1',
      operatorTopicId: webTopicId,
      receivedAt: new Date('2026-09-06T12:03:00.000Z'),
      text: 'Web answer',
    };
    await runtime.handleWebOperatorMessage('web-reply-event-1', webReply);
    await runtime.handleWebOperatorMessage('web-reply-event-1', webReply);
    expect(repository.getDeliverySummary().pending).toBe(2);
    expect(repository.findConversationMessages(request.id, 20)).toContainEqual(
      expect.objectContaining({
        direction: 'operator_to_client',
        text: 'Web answer',
      }),
    );

    await runtime.handleWebOperatorMessage('web-close-event-1', {
      externalMessageId: 'web:close-1',
      operatorTopicId: webTopicId,
      receivedAt: new Date('2026-09-06T12:04:00.000Z'),
      text: '/close',
    });
    await runtime.handleClientMessage('vk-event-3', {
      channel: 'vk',
      conversationId: '101',
      displayName: 'VK Customer',
      externalMessageId: 'vk-message-3',
      receivedAt: new Date('2026-09-06T12:05:00.000Z'),
      text: 'New question after recovery',
    });

    const nextRequest = repository.findActiveRequest('vk', '101');
    expect(nextRequest).toMatchObject({ operatorTopicId: 'topic-2' });
    expect(nextRequest?.id).not.toBe(request.id);
    expect(inbox.opened).toHaveLength(2);
    expect(inbox.relayCount).toBe(2);
  });

  it('does not use web fallback when a Telegram relay outcome is unknown', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const errors: string[] = [];
    const runtime = new HandoffRuntime({
      logger: {
        error: (_error, message) => errors.push(message),
      },
      repository,
    });
    const inbox = new FakeOperatorInbox();
    runtime.registerOperatorInbox(inbox);
    const message = {
      channel: 'telegram' as const,
      conversationId: '101',
      displayName: 'Telegram Customer',
      externalMessageId: 'message-1',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'First question',
    };
    await runtime.handleClientMessage('event-1', message);
    inbox.unknownNextRelay = true;

    await runtime.handleClientMessage('event-2', {
      ...message,
      externalMessageId: 'message-2',
      text: 'Uncertain follow-up',
    });

    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: 'topic-1',
    });
    expect(errors).not.toContain(
      'Operator inbox relay failed; using emergency web inbox',
    );
    expect(repository.getDeliverySummary().pending).toBe(1);
  });

  it('orders a Telegram reply before a concurrent web takeover without duplication', async () => {
    const repository = new SqliteSupportRepository(':memory:');
    repositories.push(repository);
    const runtime = new HandoffRuntime({
      logger: { error: () => undefined },
      repository,
    });
    const inbox = new FakeOperatorInbox();
    runtime.registerOperatorInbox(inbox);
    const message = {
      channel: 'telegram' as const,
      conversationId: '101',
      displayName: 'Telegram user',
      externalMessageId: 'telegram-message-1',
      receivedAt: new Date('2026-09-07T10:00:00.000Z'),
      text: 'Initial question',
    };
    await runtime.handleClientMessage('telegram-event-1', message);

    const relayStarted = Promise.withResolvers<void>();
    const allowRelayFailure = Promise.withResolvers<void>();
    inbox.failNextRelay = true;
    inbox.onRelay = relayStarted.resolve;
    inbox.relayGate = allowRelayFailure.promise;
    const takeover = runtime.handleClientMessage('telegram-event-2', {
      ...message,
      externalMessageId: 'telegram-message-2',
      text: 'Follow-up during outage',
    });
    await relayStarted.promise;
    expect(repository.findRequestByTopicId('topic-1')).toMatchObject({
      status: 'active',
    });

    await runtime.handleOperatorMessage('telegram-reply-before-takeover', {
      externalMessageId: 'telegram-operator-message-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-07T10:01:00.000Z'),
      text: 'Answer accepted before takeover',
    });
    expect(repository.getDeliverySummary().pending).toBe(2);
    allowRelayFailure.resolve();
    await takeover;

    const request = repository.findActiveRequest('telegram', '101');
    expect(request?.operatorTopicId).toBe(`web:${request?.id}`);
    expect(repository.getDeliverySummary().pending).toBe(2);
    expect(
      repository
        .findPendingDeliveries(new Date('2100-01-01T00:00:00.000Z'), 10)
        .map((delivery) => delivery.text),
    ).toEqual(['Вопрос отправлен.']);
    expect(
      repository.findConversationMessages(request?.id ?? '', 10),
    ).toContainEqual(
      expect.objectContaining({ text: 'Answer accepted before takeover' }),
    );
  });
});
