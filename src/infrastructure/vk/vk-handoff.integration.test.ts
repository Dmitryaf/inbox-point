import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  VkGateway,
  VkKeyboard,
  VkLongPollResponse,
  VkLongPollServer,
} from './vk-api-client.js';
import { VkClientChannel } from './vk-client-channel.js';
import { VkClientMenu } from './vk-client-menu.js';
import type { VkLongPollEvent } from './vk-types.js';
import { VkUpdateRouter } from './vk-update-router.js';

class FakeVkGateway implements VkGateway {
  public readonly sent: {
    keyboard?: VkKeyboard;
    peerId: number;
    randomId: number;
    text: string;
  }[] = [];

  public getLongPollServer(): Promise<VkLongPollServer> {
    return Promise.resolve({
      key: 'key',
      server: 'https://lp.vk.test',
      ts: '1',
    });
  }

  public getUserDisplayName(): Promise<string> {
    return Promise.resolve('VK Customer');
  }

  public poll(): Promise<VkLongPollResponse> {
    return Promise.resolve({ ts: '2', updates: [] });
  }

  public sendMessage(
    peerId: number,
    text: string,
    randomId: number,
    keyboard?: VkKeyboard,
  ): Promise<{ externalMessageId: string }> {
    this.sent.push({
      ...(keyboard ? { keyboard } : {}),
      peerId,
      randomId,
      text,
    });
    return Promise.resolve({ externalMessageId: 'vk-answer-1' });
  }
}

class FakeOperatorInbox implements OperatorInbox {
  public readonly opened: OpenOperatorRequest[] = [];
  public readonly relayed: SupportMessage[] = [];

  public closeRequest(): Promise<void> {
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ operatorMessageId: string; topicId: string }> {
    this.opened.push(request);
    return Promise.resolve({
      operatorMessageId: 'telegram-question-1',
      topicId: 'topic-1',
    });
  }

  public relayCustomerMessage(
    _operatorTopicId: string,
    message: SupportMessage,
  ): Promise<{ operatorMessageId: string }> {
    this.relayed.push(message);
    return Promise.resolve({ operatorMessageId: 'telegram-relay-1' });
  }

  public reopenRequest(): Promise<void> {
    return Promise.resolve();
  }
}

describe('VK handoff integration', () => {
  let gateway: FakeVkGateway;
  let inbox: FakeOperatorInbox;
  let repository: SqliteSupportRepository;
  let router: VkUpdateRouter;
  let service: HandoffService;

  beforeEach(() => {
    gateway = new FakeVkGateway();
    inbox = new FakeOperatorInbox();
    repository = new SqliteSupportRepository(':memory:');
    service = new HandoffService({
      operatorInbox: inbox,
      repository,
    });
    router = new VkUpdateRouter(
      service,
      gateway,
      new VkClientMenu(gateway, repository),
    );
  });

  afterEach(() => {
    repository.close();
  });

  it('routes a VK customer through Telegram and returns the reply to VK', async () => {
    const event = createMessageEvent();

    await router.route(event);
    await router.route(event);

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.opened[0]).toMatchObject({
      source: {
        channel: 'vk',
        conversationId: '101',
        displayName: 'VK Customer',
        text: 'Question from VK',
      },
      title: 'VK - VK Customer',
    });

    await service.handleOperatorMessage('telegram-update-1', {
      externalMessageId: 'telegram-answer-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: 'Answer to VK',
    });
    const worker = new DeliveryWorker({
      channels: [new VkClientChannel(gateway)],
      repository,
    });
    await worker.processPending();

    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.peerId).toBe(101);
    expect(gateway.sent[0]?.text).toBe('Answer to VK');
    expect(gateway.sent[0]?.randomId).toBeGreaterThan(0);
    expect(gateway.sent[0]?.keyboard).toMatchObject({
      inline: false,
      one_time: false,
    });
  });

  it('shows information buttons without opening or extending a request', async () => {
    await router.route(createMessageEvent({ text: 'Начать' }));
    await router.route(createMessageEvent({ text: 'Начать' }));

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.keyboard?.buttons.flat()).toHaveLength(4);

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Question from VK',
      }),
    );
    await router.route(
      createMessageEvent({
        conversation_message_id: 9,
        id: 503,
        text: 'Расписание',
      }),
    );

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed).toHaveLength(0);
    expect(gateway.sent.at(-1)?.text).toContain('Расписание');
    expect(gateway.sent.at(-1)?.keyboard).toBeDefined();
  });

  it('ignores outgoing, empty, and group-chat events', async () => {
    await router.route(createMessageEvent({ out: 1 }));
    await router.route(createMessageEvent({ text: ' ' }));
    await router.route(createMessageEvent({ peer_id: 2_000_000_001 }));

    expect(inbox.opened).toHaveLength(0);
  });
});

function createMessageEvent(
  overrides: Partial<VkLongPollEvent['object']['message']> = {},
): VkLongPollEvent {
  return {
    event_id: 'event-' + String(overrides.conversation_message_id ?? 7),
    group_id: 42,
    object: {
      message: {
        conversation_message_id: 7,
        date: 1_788_177_600,
        from_id: 101,
        id: 501,
        out: 0,
        peer_id: 101,
        text: 'Question from VK',
        ...overrides,
      },
    },
    type: 'message_new',
  };
}
