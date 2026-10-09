import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { clientMessages } from '@/core/application/client-messages.js';
import {
  ClientInformationCatalog,
  faqButton,
  handoffButton,
} from '@/core/application/client-information.js';
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { ChannelOperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  VkGateway,
  VkKeyboard,
  VkLongPollResponse,
  VkLongPollServer,
} from '@/infrastructure/vk/vk-api-client.js';
import { VkClientChannel } from '@/infrastructure/vk/vk-client-channel.js';
import { VkClientMenu } from '@/infrastructure/vk/vk-client-menu.js';
import type {
  VkLongPollEvent,
  VkMessageNewEvent,
} from '@/infrastructure/vk/vk-types.js';
import { VkUpdateRouter } from '@/infrastructure/vk/vk-update-router.js';

class FakeVkGateway implements VkGateway {
  public failNextSend = false;
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

  public getLongPollSettings(): Promise<{
    enabled: boolean;
    messageNew: boolean;
    messageReply: boolean;
  }> {
    return Promise.resolve({
      enabled: true,
      messageNew: true,
      messageReply: true,
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
    if (this.failNextSend) {
      this.failNextSend = false;
      return Promise.reject(new Error('Temporary VK failure'));
    }
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
  public readonly closed: string[] = [];
  public readonly createdTopics: string[] = [];
  public readonly opened: OpenOperatorRequest[] = [];
  public readonly reopened: string[] = [];
  public readonly relayed: SupportMessage[] = [];
  public readonly mirrored: {
    message: ChannelOperatorMessage;
    operatorTopicId: string;
  }[] = [];

  public closeRequest(operatorTopicId: string): Promise<void> {
    this.closed.push(operatorTopicId);
    return Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    this.opened.push(request);
    if (request.reusableTopicId) {
      this.reopened.push(request.reusableTopicId);
      return Promise.resolve({ topicId: request.reusableTopicId });
    }
    const topicId = `topic-${this.createdTopics.length + 1}`;
    this.createdTopics.push(topicId);
    return Promise.resolve({ topicId });
  }

  public mirrorOperatorMessage(
    operatorTopicId: string,
    message: ChannelOperatorMessage,
  ): Promise<void> {
    this.mirrored.push({ message, operatorTopicId });
    return Promise.resolve();
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    void options;
    this.relayed.push(message);
    return Promise.resolve({
      operatorMessageIds: ['telegram-relay-1'],
      operatorTopicId,
    });
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

  it('delivers a pending application after a process restart using its original label', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-application-'));
    const path = join(directory, 'support.sqlite');
    information.replace({
      customSections: [
        {
          id: 'registration',
          label: 'Записаться',
          mode: 'application',
          text: 'Когда?',
        },
      ],
    });
    const first = new SqliteSupportRepository(path);
    try {
      await new VkClientMenu(gateway, first, information).handle({
        externalEventId: 'registration-click',
        peerId: 101,
        payload: menuPayload('custom:registration'),
        text: 'Записаться',
      });
    } finally {
      first.close();
    }
    const restarted = new SqliteSupportRepository(path);
    try {
      information.replace({ customSections: [] });
      const restartedRouter = new VkUpdateRouter(
        new HandoffService({ operatorInbox: inbox, repository: restarted }),
        gateway,
        new VkClientMenu(gateway, restarted, information),
      );
      await restartedRouter.route(createMessageEvent({ text: 'Во вторник' }));
      expect(inbox.relayed.at(-1)?.text).toBe(
        'Заявка: Записаться\n\nВо вторник',
      );
      const request = restarted.findActiveRequest('vk', '101')!;
      expect(
        restarted.findConversationMessages(request.id)[0]?.applicationLabel,
      ).toBe('Записаться');
    } finally {
      restarted.close();
      rmSync(directory, { recursive: true });
    }
  });

  it('does not reopen a closed conversation from an expired application answer', async () => {
    let now = new Date('2026-10-10T10:00:00Z');
    information.replace({
      customSections: [
        {
          id: 'registration',
          label: 'Записаться',
          mode: 'application',
          text: 'Когда?',
        },
      ],
    });
    repository.createRequest({
      id: 'closed-request',
      channel: 'vk',
      conversationId: '101',
      createdAt: now,
      closedAt: now,
      status: 'closed',
      operatorTopicId: 'topic-1',
    });
    const timedRouter = new VkUpdateRouter(
      new HandoffService({
        operatorInbox: inbox,
        repository,
        clock: () => now,
      }),
      gateway,
      new VkClientMenu(
        gateway,
        repository,
        information,
        acceptingClientIntakePolicy,
        () => now,
      ),
    );
    await timedRouter.route(
      createMessageEvent({
        payload: menuPayload('custom:registration'),
        text: 'Записаться',
      }),
    );
    now = new Date('2026-10-10T12:00:00Z');
    await timedRouter.route(
      createMessageEvent({
        id: 502,
        conversation_message_id: 8,
        text: 'Во вторник',
      }),
    );
    expect(inbox.relayed).toHaveLength(0);
    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(gateway.sent.at(-1)?.text).toBe(clientMessages.closedConversation);
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain('Записаться');
  });

  it.each(['first', 'closed', 'active'] as const)(
    'accepts a custom application in a %s conversation exactly once',
    async (stage) => {
      information.replace({
        customSections: [
          {
            id: 'registration',
            label: 'Записаться на занятие',
            mode: 'application',
            text: 'На какое занятие хотите записаться?',
          },
        ],
      });
      if (stage !== 'first') {
        await router.route(createMessageEvent({ text: 'Первый вопрос' }));
        if (stage === 'closed') {
          const request = repository.findActiveRequest('vk', '101')!;
          repository.closeRequest(request.id, new Date());
        }
      }
      const previous = repository.findLatestRequest('vk', '101');
      const menu = createMessageEvent({
        id: 502,
        conversation_message_id: 8,
        payload: menuPayload('custom:registration'),
        text: 'Записаться на занятие',
      });
      await router.route(menu);
      await router.route(menu);
      expect(
        gateway.sent.filter(
          (message) => message.text === 'На какое занятие хотите записаться?',
        ),
      ).toHaveLength(1);
      expect(gateway.sent.at(-1)?.keyboard?.buttons).toEqual([]);
      const answer = createMessageEvent({
        id: 503,
        conversation_message_id: 9,
        text: 'Бачата, вторник',
      });
      await router.route(answer);
      await router.route(answer);
      const current = repository.findActiveRequest('vk', '101')!;
      expect(
        stage === 'active'
          ? current.id === previous?.id
          : current.id !== previous?.id,
      ).toBe(true);
      expect(
        inbox.relayed.filter(
          (message) =>
            message.text === 'Заявка: Записаться на занятие\n\nБачата, вторник',
        ),
      ).toHaveLength(1);
      expect(
        repository.findAwaitingApplicationLabel('vk', '101', new Date()),
      ).toBeUndefined();
      const worker = new DeliveryWorker({
        channels: [new VkClientChannel(gateway, repository, information)],
        repository,
      });
      await worker.processPending();
      await worker.processPending();
      expect(
        gateway.sent.filter(
          (message) => message.text === clientMessages.applicationSent,
        ),
      ).toHaveLength(1);
      if (stage === 'closed') {
        expect(inbox.reopened).toEqual(['topic-1']);
      }
    },
  );

  it.each(['first', 'closed', 'active'] as const)(
    'opens the menu and cancels application intent in a %s conversation',
    async (stage) => {
      information.replace({
        customSections: [
          {
            id: 'registration',
            label: 'Записаться',
            mode: 'application',
            text: 'Когда?',
          },
        ],
      });
      if (stage !== 'first') {
        await router.route(createMessageEvent());
        if (stage === 'closed') {
          repository.closeRequest(
            repository.findActiveRequest('vk', '101')!.id,
            new Date(),
          );
        }
      }
      await router.route(
        createMessageEvent({
          id: 502,
          conversation_message_id: 8,
          payload: menuPayload('custom:registration'),
          text: 'Записаться',
        }),
      );
      await router.route(
        createMessageEvent({
          id: 503,
          conversation_message_id: 9,
          text: '  мЕнЮ  ',
        }),
      );
      expect(
        repository.findAwaitingApplicationLabel('vk', '101', new Date()),
      ).toBeUndefined();
      expect(
        gateway.sent
          .at(-1)
          ?.keyboard?.buttons.flat()
          .map((button) => button.action.label),
      ).toContain('Записаться');
      expect(
        inbox.relayed.some((message) => message.text.includes('мЕнЮ')),
      ).toBe(false);
    },
  );

  it('keeps ordinary typed application labels as client text in VK and blocks application clicks during intake pause', async () => {
    information.replace({
      prices: '1000',
      customSections: [
        {
          id: 'registration',
          label: 'Записаться',
          mode: 'application',
          text: 'Когда?',
        },
      ],
    });
    vkPaused = true;
    await router.route(createMessageEvent({ text: 'Меню' }));
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toEqual(['Цены']);
    await router.route(
      createMessageEvent({
        id: 502,
        conversation_message_id: 8,
        payload: menuPayload('custom:registration'),
        text: 'Записаться',
      }),
    );
    expect(repository.isAwaitingClientQuestion('vk', '101', new Date())).toBe(
      false,
    );
    expect(inbox.opened).toHaveLength(0);
    vkPaused = false;
    await router.route(
      createMessageEvent({
        id: 503,
        conversation_message_id: 9,
        text: 'Записаться',
      }),
    );
    expect(inbox.relayed.at(-1)?.text).toBe('Записаться');
  });

  it('retains application context on retry without consuming a newer application', async () => {
    information.replace({
      customSections: [
        {
          id: 'registration',
          label: 'Записаться',
          mode: 'application',
          text: 'Когда?',
        },
      ],
    });
    await router.route(createMessageEvent());
    await router.route(
      createMessageEvent({
        id: 502,
        conversation_message_id: 8,
        payload: menuPayload('custom:registration'),
        text: 'Записаться',
      }),
    );
    const answer = createMessageEvent({
      id: 503,
      conversation_message_id: 9,
      text: 'Во вторник',
    });
    const relay = inbox.relayCustomerMessage.bind(inbox);
    let fail = true;
    inbox.relayCustomerMessage = (...args) => {
      if (fail) {
        fail = false;
        return Promise.reject(new Error('Temporary inbox failure'));
      }
      return relay(...args);
    };
    await expect(router.route(answer)).rejects.toThrow(
      'Temporary inbox failure',
    );
    await router.route(
      createMessageEvent({
        id: 504,
        conversation_message_id: 10,
        payload: menuPayload('custom:registration'),
        text: 'Записаться',
      }),
    );
    await router.route(answer);
    expect(inbox.relayed.at(-1)?.text).toBe('Заявка: Записаться\n\nВо вторник');
    expect(
      repository.findAwaitingApplicationLabel('vk', '101', new Date()),
    ).toBe('Записаться');
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
    expect(inbox.relayed).toHaveLength(1);

    await service.handleOperatorMessage('telegram-update-1', {
      externalMessageId: 'telegram-answer-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: 'Answer to VK',
    });
    const worker = new DeliveryWorker({
      channels: [new VkClientChannel(gateway, repository)],
      repository,
    });
    await worker.processPending();
    await worker.processPending();

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]?.peerId).toBe(101);
    expect(gateway.sent[0]?.text).toBe(clientMessages.handoffSent);
    expect(gateway.sent[0]?.randomId).toBeGreaterThan(0);
    expect(gateway.sent[0]?.keyboard).toMatchObject({
      inline: false,
      one_time: false,
    });
    expect(gateway.sent[1]?.text).toBe('Answer to VK');
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).new_request,
    ).toBe(1);
  });

  it('mirrors a manual VK reply with a non-zero random ID once', async () => {
    await router.route(createMessageEvent());
    const reply = createReplyEvent({
      admin_author_id: 777,
      conversation_message_id: 8,
      from_id: -42,
      out: 1,
      random_id: -781_261_767,
      text: 'Answer sent directly from VK',
    });

    await router.route(reply);
    await router.route(reply);

    expect(inbox.createdTopics).toEqual(['topic-1']);
    expect(inbox.mirrored).toHaveLength(1);
    const mirrored = inbox.mirrored[0];
    expect(mirrored?.operatorTopicId).toBe('topic-1');
    expect(mirrored?.message.channel).toBe('vk');
    expect(mirrored?.message.conversationId).toBe('101');
    expect(mirrored?.message.externalMessageId).toBe('101:8');
    expect(mirrored?.message.text).toBe('Answer sent directly from VK');
    expect(gateway.sent).toHaveLength(0);
    expect(
      repository
        .findConversationMessages(
          repository.findActiveRequest('vk', '101')?.id ?? '',
          10,
        )
        .filter((message) => message.direction === 'operator_to_client'),
    ).toEqual([
      expect.objectContaining({
        externalMessageId: '101:8',
        text: 'Answer sent directly from VK',
      }),
    ]);
  });

  it('ignores an outgoing VK event created by an API call', async () => {
    await router.route(createMessageEvent());

    await router.route(
      createReplyEvent({
        conversation_message_id: 9,
        from_id: -42,
        out: 1,
        random_id: 123_456,
        text: 'Automated answer from Inbox Point',
      }),
    );

    expect(inbox.mirrored).toHaveLength(0);
  });

  it('keeps accepting the wrapped message_reply payload variant', async () => {
    await router.route(createMessageEvent());
    const directReply = createReplyEvent({
      admin_author_id: 777,
      conversation_message_id: 10,
      from_id: -42,
      out: 1,
      text: 'Wrapped manual reply',
    });

    await router.route({
      ...directReply,
      object: { message: directReply.object },
    });

    expect(inbox.mirrored).toHaveLength(1);
    expect(inbox.mirrored[0]?.message.text).toBe('Wrapped manual reply');
  });

  it('reuses one Telegram topic for later requests from the same VK client', async () => {
    await router.route(createMessageEvent());
    const firstRequest = repository.findActiveRequest('vk', '101');
    await service.handleOperatorMessage('telegram-close-1', {
      externalMessageId: 'telegram-command-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: '/close',
    });

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        payload: menuPayload('handoff'),
        text: handoffButton,
      }),
    );
    await router.route(
      createMessageEvent({
        conversation_message_id: 9,
        id: 503,
        text: 'Second question from VK',
      }),
    );
    const nextRequest = repository.findActiveRequest('vk', '101');

    expect(firstRequest?.id).toBeDefined();
    expect(nextRequest?.id).not.toBe(firstRequest?.id);
    expect(nextRequest?.operatorTopicId).toBe('topic-1');
    expect(inbox.closed).toEqual(['topic-1']);
    expect(inbox.createdTopics).toEqual(['topic-1']);
    expect(inbox.opened[1]?.reusableTopicId).toBe('topic-1');
    expect(inbox.reopened).toEqual(['topic-1']);

    await service.handleOperatorMessage('telegram-answer-2', {
      externalMessageId: 'telegram-answer-2',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:02:00.000Z'),
      text: 'Second answer to VK',
    });
    const worker = new DeliveryWorker({
      channels: [new VkClientChannel(gateway, repository)],
      repository,
    });
    await worker.processPending();
    await worker.processPending();
    await worker.processPending();

    expect(gateway.sent.map((message) => message.text)).toContain(
      'Second answer to VK',
    );
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).new_request,
    ).toBe(2);
  });

  it('repeats the question prompt after its first delivery fails', async () => {
    const event = createMessageEvent({
      payload: menuPayload('handoff'),
      text: handoffButton,
    });
    gateway.failNextSend = true;

    await expect(router.route(event)).rejects.toThrow('Temporary VK failure');
    expect(repository.isAwaitingClientQuestion('vk', '101', new Date())).toBe(
      true,
    );

    await router.route(event);

    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(gateway.sent).toEqual([
      expect.objectContaining({
        peerId: 101,
        text: 'Напишите свой вопрос. Мы ответим здесь.',
      }),
    ]);
  });

  it('cancels a pending new question when the client opens the menu', async () => {
    await router.route(createMessageEvent({ text: 'Первый вопрос' }));
    await service.handleOperatorMessage('telegram-close-1', {
      externalMessageId: 'telegram-command-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: '/close',
    });
    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        payload: menuPayload('handoff'),
        text: handoffButton,
      }),
    );

    await router.route(
      createMessageEvent({
        conversation_message_id: 9,
        id: 503,
        text: '/menu',
      }),
    );

    expect(repository.isAwaitingClientQuestion('vk', '101', new Date())).toBe(
      false,
    );
    expect(gateway.sent.at(-1)?.text).toBe(clientMessages.menuOpened);
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain(handoffButton);

    await router.route(
      createMessageEvent({
        conversation_message_id: 10,
        id: 504,
        text: 'Спасибо',
      }),
    );
    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
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
    expect(inbox.relayed).toHaveLength(2);
    expect(inbox.relayed[1]?.text).toBe('Расписание');
    expect(gateway.sent).toHaveLength(1);
  });

  it('redirects a new VK customer while intake is paused', async () => {
    vkPaused = true;

    await router.route(createMessageEvent());

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.text).toBe(clientMessages.pausedIntake);
  });

  it('keeps configured VK information available while intake is paused', async () => {
    information.replace({
      customSections: [{ label: 'Как добраться', text: 'Вход со двора.' }],
      schedule: [{ dayTime: 'Понедельник 19:00', title: 'Бачата' }],
    });
    vkPaused = true;

    await router.route(
      createMessageEvent({
        payload: menuPayload('information-0'),
        text: 'Расписание',
      }),
    );
    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        payload: menuPayload('custom-0'),
        text: 'Как добраться',
      }),
    );

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent.map((message) => message.text)).toEqual([
      'Расписание\n\nБачата\nПонедельник 19:00',
      'Вход со двора.',
    ]);
    const labels = gateway.sent[0]?.keyboard?.buttons
      .flat()
      .map((button) => button.action.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Расписание', 'Как добраться']),
    );
    expect(labels).not.toContain(handoffButton);
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).menu_action,
    ).toBe(2);
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
    await router.route(
      createMessageEvent({
        conversation_message_id: 9,
        id: 503,
        text: 'Расписание',
      }),
    );

    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed).toHaveLength(3);
    expect(inbox.relayed[1]?.text).toBe('Уточнение');
    expect(inbox.relayed[2]?.text).toBe('Расписание');
    expect(gateway.sent).toHaveLength(0);
  });

  it('uses payload for an information click but relays the same manual text', async () => {
    information.replace({
      schedule: [{ dayTime: 'Понедельник 19:00', title: 'Бачата' }],
    });
    await router.route(createMessageEvent({ text: 'Первый вопрос' }));

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Расписание',
      }),
    );
    await router.route(
      createMessageEvent({
        conversation_message_id: 9,
        id: 503,
        payload: menuPayload('information-0'),
        text: 'Расписание',
      }),
    );

    expect(inbox.relayed.map((message) => message.text)).toEqual([
      'Первый вопрос',
      'Расписание',
    ]);
    expect(gateway.sent.at(-1)?.text).toBe(
      'Расписание\n\nБачата\nПонедельник 19:00',
    );
    const labels = gateway.sent
      .at(-1)
      ?.keyboard?.buttons.flat()
      .map((button) => button.action.label);
    expect(labels).toEqual(['Расписание', handoffButton]);
  });

  it('keeps the handoff button without opening another active request', async () => {
    await router.route(createMessageEvent({ text: 'Первый вопрос' }));
    const request = repository.findActiveRequest('vk', '101');

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        payload: menuPayload('handoff'),
        text: handoffButton,
      }),
    );

    expect(repository.findActiveRequest('vk', '101')?.id).toBe(request?.id);
    expect(inbox.opened).toHaveLength(1);
    expect(inbox.relayed.map((message) => message.text)).toEqual([
      'Первый вопрос',
    ]);
    expect(gateway.sent.at(-1)?.text).toBe(clientMessages.questionPrompt);
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain(handoffButton);
  });

  it.each(['/start', '/menu', 'Начать'])(
    'opens the active menu for %s without forwarding the command',
    async (command) => {
      await router.route(createMessageEvent({ text: 'Первый вопрос' }));

      await router.route(
        createMessageEvent({
          conversation_message_id: 8,
          id: 502,
          text: command,
        }),
      );

      expect(inbox.relayed.map((message) => message.text)).toEqual([
        'Первый вопрос',
      ]);
      expect(gateway.sent.at(-1)?.text).toBe(clientMessages.activeMenu);
    },
  );

  it('does not open a request from post-dialog VK text', async () => {
    await router.route(createMessageEvent({ text: 'Первый вопрос' }));
    const firstRequest = repository.findActiveRequest('vk', '101');
    await service.handleOperatorMessage('telegram-close-1', {
      externalMessageId: 'telegram-command-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: '/close',
    });

    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Спасибо',
      }),
    );

    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(repository.findLatestRequest('vk', '101')?.id).toBe(
      firstRequest?.id,
    );
    expect(gateway.sent.at(-1)?.text).toContain('Предыдущий разговор завершён');
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain(handoffButton);
  });

  it('clears expired question intent and restores the current VK menu', async () => {
    await router.route(createMessageEvent({ text: 'Первый вопрос' }));
    const firstRequest = repository.findActiveRequest('vk', '101');
    await service.handleOperatorMessage('telegram-close-1', {
      externalMessageId: 'telegram-command-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T10:00:00.000Z'),
      text: '/close',
    });
    repository.setAwaitingClientQuestion(
      'vk',
      '101',
      new Date('2026-09-01T10:00:00.000Z'),
    );
    const checkedAt = new Date('2026-09-01T12:01:00.000Z');
    const expiredIntentRouter = new VkUpdateRouter(
      service,
      gateway,
      new VkClientMenu(
        gateway,
        repository,
        information,
        acceptingClientIntakePolicy,
        () => checkedAt,
      ),
    );

    await expiredIntentRouter.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        text: 'Поздний вопрос',
      }),
    );

    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(repository.findLatestRequest('vk', '101')?.id).toBe(
      firstRequest?.id,
    );
    expect(repository.isAwaitingClientQuestion('vk', '101', checkedAt)).toBe(
      false,
    );
    expect(gateway.sent.at(-1)?.text).toBe(clientMessages.closedConversation);
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain(handoffButton);
  });

  it('uses the current closed state for a delayed VK keyboard', async () => {
    await router.route(createMessageEvent({ text: 'Вопрос' }));
    const worker = new DeliveryWorker({
      channels: [new VkClientChannel(gateway, repository)],
      repository,
    });
    await worker.processPending();
    await service.handleOperatorMessage('telegram-answer-1', {
      externalMessageId: 'telegram-answer-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:01:00.000Z'),
      text: 'Ответ',
    });
    await service.handleOperatorMessage('telegram-close-1', {
      externalMessageId: 'telegram-close-1',
      operatorTopicId: 'topic-1',
      receivedAt: new Date('2026-09-01T12:02:00.000Z'),
      text: '/close',
    });

    await worker.processPending();

    expect(gateway.sent.at(-1)?.text).toBe('Ответ');
    expect(
      gateway.sent
        .at(-1)
        ?.keyboard?.buttons.flat()
        .map((button) => button.action.label),
    ).toContain(handoffButton);
  });

  it('shows and resolves the built-in FAQ without opening a request', async () => {
    information.replace({
      faq: [
        {
          answer: 'Напишите нам.',
          question: 'Как записаться?',
        },
      ],
    });

    await router.route(createMessageEvent({ text: 'Начать' }));
    await router.route(
      createMessageEvent({
        conversation_message_id: 8,
        id: 502,
        payload: menuPayload('information-0'),
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
        payload: menuPayload('custom-0'),
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

  it('recovers an older VK button without opening an operator request', async () => {
    information.replace(
      {
        customSections: [{ label: 'Цены занятий', text: 'Текущий ответ.' }],
      },
      ['Стоимость', 'Абонементы'],
    );
    const event = createMessageEvent({
      payload: menuPayload('custom-1'),
      text: 'Абонементы',
    });

    await router.route(event);
    await router.route(event);

    expect(repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.text).toBe(clientMessages.menuUpdated);
    expect(
      gateway.sent[0]?.keyboard?.buttons
        .flat()
        .map((button) => button.action.label),
    ).toContain('Цены занятий');
  });

  it('ignores outgoing, empty, and group-chat events', async () => {
    await router.route(createMessageEvent({ out: 1 }));
    await router.route(createMessageEvent({ text: ' ' }));
    await router.route(createMessageEvent({ peer_id: 2_000_000_001 }));

    expect(inbox.opened).toHaveLength(0);
  });

  it('ignores unsupported Long Poll event types', async () => {
    const event: VkLongPollEvent = {
      event_id: 'group-join-1',
      group_id: 42,
      object: {
        join_type: 'join',
        user_id: 101,
      },
      type: 'group_join',
    };

    await expect(router.route(event)).resolves.toBeUndefined();

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(0);
  });

  it('reports an invalid message_new event instead of ignoring it', async () => {
    const event: VkLongPollEvent = {
      event_id: 'invalid-message-1',
      group_id: 42,
      object: {
        user_id: 101,
      },
      type: 'message_new',
    };

    await expect(router.route(event)).rejects.toThrow(
      'VK message_new event invalid-message-1 is invalid',
    );

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(0);
  });

  it('explains that VK attachments are not supported', async () => {
    await router.route(
      createMessageEvent({
        attachments: [{ type: 'audio_message' }],
        text: '',
      }),
    );

    expect(inbox.opened).toHaveLength(0);
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]).toMatchObject({
      peerId: 101,
      text: clientMessages.unsupportedContent,
    });
  });
});

function createMessageEvent(
  overrides: Partial<VkMessageNewEvent['object']['message']> = {},
): VkMessageNewEvent {
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

function createReplyEvent(
  overrides: Partial<VkMessageNewEvent['object']['message']> & {
    random_id?: number;
  } = {},
): VkLongPollEvent {
  const base = createMessageEvent(overrides);
  return {
    event_id: base.event_id,
    group_id: base.group_id,
    object: base.object.message,
    type: 'message_reply',
  };
}

function menuPayload(action: string): string {
  return JSON.stringify({ action });
}
