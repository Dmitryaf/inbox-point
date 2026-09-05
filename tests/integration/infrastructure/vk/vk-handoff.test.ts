import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import {
  ClientInformationCatalog,
  faqButton,
} from '@/core/application/client-information.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import type { ClientIntakePolicy } from '@/core/contracts/client-intake-policy.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  VkGateway,
  VkKeyboard,
  VkLongPollResponse,
  VkLongPollServer,
} from '@/infrastructure/vk/vk-api-client.js';
import { VkClientChannel } from '@/infrastructure/vk/vk-client-channel.js';
import { VkClientMenu } from '@/infrastructure/vk/vk-client-menu.js';
import type { VkLongPollEvent } from '@/infrastructure/vk/vk-types.js';
import { VkUpdateRouter } from '@/infrastructure/vk/vk-update-router.js';

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
  let information: ClientInformationCatalog;
  let inbox: FakeOperatorInbox;
  let repository: SqliteSupportRepository;
  let router: VkUpdateRouter;
  let service: HandoffService;
  let vkPaused: boolean;

  beforeEach(() => {
    gateway = new FakeVkGateway();
    information = new ClientInformationCatalog();
    inbox = new FakeOperatorInbox();
    repository = new SqliteSupportRepository(':memory:');
    vkPaused = false;
    const intakePolicy: ClientIntakePolicy = {
      isPaused: (channel) => channel === 'vk' && vkPaused,
    };
    service = new HandoffService({
      operatorInbox: inbox,
      repository,
    });
    router = new VkUpdateRouter(
      service,
      gateway,
      new VkClientMenu(gateway, repository, information, intakePolicy),
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

  it('hides empty information buttons without blocking typed labels', async () => {
    await router.route(createMessageEvent({ text: 'Начать' }));
    await router.route(createMessageEvent({ text: 'Начать' }));

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.keyboard?.buttons.flat()).toHaveLength(1);

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

  it('redirects a new VK customer while intake is paused', async () => {
    vkPaused = true;

    await router.route(createMessageEvent());

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(0);
  });

  it('continues an open VK conversation after intake is paused', async () => {
    await router.route(createMessageEvent());
    vkPaused = true;

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Уточнение',
      }),
    );

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed).toHaveLength(1);
    expect(inbox.relayed[0]?.text).toBe('Уточнение');
  });

  it('shows and resolves the built-in FAQ without opening a request', async () => {
    information.replace({
      faq: [
        {
          answer: 'Напишите преподавателю.',
          question: 'Как записаться?',
        },
      ],
    });

    await router.route(createMessageEvent({ text: 'Начать' }));
    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: faqButton,
      }),
    );

    expect(inbox.opened).toHaveLength(0);
    expect(
      gateway.sent[0]?.keyboard?.buttons
        .flat()
        .map((button) => button.action.label),
    ).toContain(faqButton);
    expect(gateway.sent[1]?.text).toContain('❓ Как записаться?');
  });
  it('shows a custom VK button without opening an operator request', async () => {
    information.replace({
      customSections: [
        {
          label: 'Первое занятие',
          text: 'Приходите за 10 минут до начала.',
        },
      ],
    });

    await router.route(createMessageEvent({ text: 'Начать' }));
    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Первое занятие',
      }),
    );

    expect(inbox.opened).toHaveLength(0);
    expect(
      gateway.sent[0]?.keyboard?.buttons
        .flat()
        .map((button) => button.action.label),
    ).toContain('Первое занятие');
    expect(gateway.sent[1]?.text).toBe('Приходите за 10 минут до начала.');
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
