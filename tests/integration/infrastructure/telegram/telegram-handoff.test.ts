import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { EmergencyOperatorInbox } from '@/core/application/emergency-operator-inbox.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { clientMessages } from '@/core/application/client-messages.js';
import { SwitchableOperatorInbox } from '@/core/application/switchable-operator-inbox.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import {
  ClientInformationCatalog,
  faqButton,
  handoffButton,
} from '@/core/application/client-information.js';
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  GetUpdatesOptions,
  SendMessageOptions,
  TelegramGateway,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import type { TelegramUpdate } from '@/infrastructure/telegram/telegram-types.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';

class FakeTelegramGateway implements TelegramGateway {
  public readonly alreadyClosedTopics = new Set<number>();
  public readonly alreadyOpenTopics = new Set<number>();
  public closeAttempts = 0;
  public readonly closedTopics: number[] = [];
  public readonly createdTopics: number[] = [];
  public failNextClose = false;
  public failNextReopen = false;
  public failNextSend = false;
  public unknownNextOpen = false;
  public unknownNextClose = false;
  public unknownNextReopen = false;
  public unknownOnSendNumber: number | undefined;
  public readonly reopened: number[] = [];
  public reopenAttempts = 0;
  public readonly sent: SendMessageOptions[] = [];
  public readonly unavailableTopics = new Set<number>();
  private nextTopicId = 900;

  public closeForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    void chatId;
    this.closeAttempts += 1;
    if (this.failNextClose) {
      this.failNextClose = false;
      return Promise.reject(new Error('Temporary Telegram close failure'));
    }
    if (this.unknownNextClose) {
      this.unknownNextClose = false;
      this.closedTopics.push(messageThreadId);
      return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
    }
    if (this.alreadyClosedTopics.has(messageThreadId)) {
      return Promise.reject(
        new Error(
          'Telegram API closeForumTopic failed: Bad Request: TOPIC_CLOSED',
        ),
      );
    }
    if (this.unavailableTopics.has(messageThreadId)) {
      return Promise.reject(
        new Error(
          'Telegram API closeForumTopic failed: Bad Request: message thread not found',
        ),
      );
    }
    this.closedTopics.push(messageThreadId);
    return Promise.resolve();
  }

  public createForumTopic(
    chatId: number,
    name: string,
  ): Promise<{ topicId: number }> {
    void chatId;
    void name;
    const topicId = this.nextTopicId++;
    this.createdTopics.push(topicId);
    if (this.unknownNextOpen) {
      this.unknownNextOpen = false;
      return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
    }
    return Promise.resolve({ topicId });
  }

  public getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    void options;
    return Promise.resolve([]);
  }

  public reopenForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    void chatId;
    this.reopenAttempts += 1;
    if (this.failNextReopen) {
      this.failNextReopen = false;
      return Promise.reject(new Error('Temporary Telegram reopen failure'));
    }
    if (this.unknownNextReopen) {
      this.unknownNextReopen = false;
      return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
    }
    if (this.alreadyOpenTopics.has(messageThreadId)) {
      return Promise.reject(
        new Error(
          'Telegram API reopenForumTopic failed: Bad Request: TOPIC_NOT_MODIFIED',
        ),
      );
    }
    if (this.unavailableTopics.has(messageThreadId)) {
      return Promise.reject(
        new Error(
          'Telegram API reopenForumTopic failed: Bad Request: message thread not found',
        ),
      );
    }
    this.reopened.push(messageThreadId);
    return Promise.resolve();
  }

  public sendMessage(
    options: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    if (this.failNextSend) {
      this.failNextSend = false;
      return Promise.reject(new Error('Temporary Telegram failure'));
    }
    if (Array.from(options.text).length > 4_096) {
      return Promise.reject(new Error('Telegram text is too long'));
    }
    if (
      options.messageThreadId !== undefined &&
      this.unavailableTopics.has(options.messageThreadId)
    ) {
      return Promise.reject(
        new Error(
          'Telegram API sendMessage failed: Bad Request: message thread not found',
        ),
      );
    }
    this.sent.push(options);
    if (this.sent.length === this.unknownOnSendNumber) {
      return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
    }
    return Promise.resolve({ messageId: 700 + this.sent.length });
  }
}

describe('Telegram handoff integration', () => {
  let gateway: FakeTelegramGateway;
  let information: ClientInformationCatalog;
  let deliveryWorker: DeliveryWorker;
  let handoff: HandoffService;
  let repository: SqliteSupportRepository;
  let router: TelegramUpdateRouter;
  let telegramPaused: boolean;

  beforeEach(() => {
    gateway = new FakeTelegramGateway();
    information = new ClientInformationCatalog();
    repository = new SqliteSupportRepository(':memory:');
    telegramPaused = false;
    const intakePolicy: ClientIntakePolicy = {
      isPaused: (channel) => channel === 'telegram' && telegramPaused,
    };
    handoff = new HandoffService({
      clock: () => new Date('2026-08-31T12:00:00.000Z'),
      createId: (() => {
        let nextId = 1;
        return () => `id-${nextId++}`;
      })(),
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, repository),
      repository,
    });
    deliveryWorker = new DeliveryWorker({
      channels: [
        new TelegramClientChannel(
          gateway,
          repository,
          information,
          intakePolicy,
        ),
      ],
      repository,
    });
    router = new TelegramUpdateRouter(
      handoff,
      -1_001,
      new TelegramClientMenu(gateway, repository, information, intakePolicy),
      gateway,
    );
  });

  afterEach(() => {
    repository.close();
  });

  it('routes customer text through a topic and returns the operator reply', async () => {
    await router.route({
      message: {
        chat: { id: 101, type: 'private' },
        date: 1_788_177_600,
        from: {
          first_name: 'Test',
          id: 101,
          is_bot: false,
        },
        message_id: 501,
        text: 'Question',
      },
      update_id: 1,
    });
    information.replace({
      customSections: [{ label: 'Как добраться', text: 'Вход со двора.' }],
    });
    await router.route({
      message: {
        chat: { id: -1_001, type: 'supergroup' },
        date: 1_788_177_660,
        from: {
          first_name: 'Operator',
          id: 202,
          is_bot: false,
        },
        message_id: 502,
        message_thread_id: 900,
        text: 'Answer',
      },
      update_id: 2,
    });
    await deliveryWorker.processPending();
    await deliveryWorker.processPending();

    expect(gateway.sent).toHaveLength(3);
    expect(gateway.sent[0]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain('Question');
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      text: clientMessages.handoffSent,
    });
    expect(gateway.sent[2]).toMatchObject({
      chatId: 101,
      text: 'Answer',
    });
    const activeReplyMarkup = gateway.sent[2]?.replyMarkup;
    if (!activeReplyMarkup || !('keyboard' in activeReplyMarkup)) {
      throw new Error('Expected an active conversation keyboard');
    }
    expect(
      activeReplyMarkup.keyboard.flat().map((button) => button.text),
    ).toEqual(['Как добраться', handoffButton]);
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).new_request,
    ).toBe(1);
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).first_reply,
    ).toBe(1);
  });

  it('posts a privacy-safe delivery failure notice in the affected topic', async () => {
    const inbox = new TelegramTopicsInbox(gateway, -1_001, repository);

    await inbox.notifyDeliveryFailure({
      attempts: 5,
      channel: 'vk',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'delivery-private-id',
      lastError: 'Private client answer was rejected',
      operatorMessageId: '502',
      operatorTopicId: '900',
      outcomeUnknown: false,
      requestId: 'request-private-id',
    });

    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain('Ответ не доставлен');
    expect(gateway.sent[0]?.text).toContain('Сообщение администратора: 502');
    expect(gateway.sent[0]?.text).toContain('раздел «Состояние»');
    expect(gateway.sent[0]?.text).not.toContain('Private client answer');
    expect(gateway.sent[0]?.text).not.toContain('request-private-id');
    expect(gateway.sent[0]?.text).not.toContain('delivery-private-id');
  });

  it('warns against blind retries when delivery outcome is unknown', async () => {
    const inbox = new TelegramTopicsInbox(gateway, -1_001, repository);

    await inbox.notifyDeliveryFailure({
      attempts: 1,
      channel: 'telegram',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'delivery-1',
      lastError: 'Response confirmation was lost',
      operatorMessageId: '502',
      operatorTopicId: '900',
      outcomeUnknown: true,
      requestId: 'request-1',
    });

    expect(gateway.sent[0]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain(
      'Не отправляйте тот же ответ повторно',
    );
    expect(gateway.sent[0]?.text).toContain(
      'Не удалось подтвердить доставку ответа',
    );
  });

  it('keeps a new request in web inbox when topic creation is uncertain', async () => {
    gateway.unknownNextOpen = true;
    const message = {
      channel: 'telegram' as const,
      conversationId: '101',
      displayName: 'Test Customer',
      externalMessageId: 'message-uncertain-open',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'Question',
    };
    const handoff = new HandoffService({
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, repository),
      repository,
    });

    await handoff.handleClientMessage('update-uncertain-open', message);
    await handoff.handleClientMessage('update-uncertain-open', message);

    expect(gateway.createdTopics).toHaveLength(1);
    expect(
      repository
        .findActiveRequest('telegram', '101')
        ?.operatorTopicId.startsWith('web:'),
    ).toBe(true);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('does not resend a partial multi-chunk relay with an unknown outcome', async () => {
    repository.createRequest({
      channel: 'telegram',
      conversationId: '202',
      createdAt: new Date('2026-09-06T12:00:00.000Z'),
      id: 'request-partial',
      operatorTopicId: '900',
      status: 'active',
    });
    gateway.unknownOnSendNumber = 1;
    const handoff = new HandoffService({
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, repository),
      repository,
    });
    const message = {
      channel: 'telegram' as const,
      conversationId: '202',
      displayName: 'Test Customer',
      externalMessageId: 'message-partial',
      receivedAt: new Date('2026-09-06T12:00:00.000Z'),
      text: 'Я'.repeat(5_000),
    };

    await handoff.handleClientMessage('update-partial', message);
    await handoff.handleClientMessage('update-partial', message);

    expect(gateway.sent).toHaveLength(2);
    expect(repository.findRequestById('request-partial')).toMatchObject({
      operatorTopicId: '900',
    });
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 0 });
  });

  it('mirrors a native VK operator reply into its Telegram topic once', async () => {
    repository.createRequest({
      channel: 'vk',
      conversationId: '202',
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      id: 'request-vk-native',
      operatorTopicId: '900',
      status: 'active',
    });
    const message = {
      channel: 'vk' as const,
      conversationId: '202',
      externalMessageId: '202:8',
      receivedAt: new Date('2026-09-17T08:01:00.000Z'),
      text: 'Ответ из интерфейса VK',
    };

    await handoff.handleChannelOperatorMessage('vk-native-event-1', message);
    await handoff.handleChannelOperatorMessage('vk-native-event-1', message);

    expect(gateway.sent).toEqual([
      expect.objectContaining({
        messageThreadId: 900,
        text: 'Ответ администратора из VK:\n\nОтвет из интерфейса VK',
      }),
    ]);
    expect(
      repository.findConversationMessages('request-vk-native', 10),
    ).toEqual([
      expect.objectContaining({
        direction: 'operator_to_client',
        externalMessageId: '202:8',
        text: 'Ответ из интерфейса VK',
      }),
    ]);
  });

  it('does not resend a VK reply whose Telegram mirror outcome is unknown', async () => {
    repository.createRequest({
      channel: 'vk',
      conversationId: '203',
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      id: 'request-vk-native-unknown',
      operatorTopicId: '901',
      status: 'active',
    });
    gateway.unknownOnSendNumber = 1;
    const message = {
      channel: 'vk' as const,
      conversationId: '203',
      externalMessageId: '203:9',
      receivedAt: new Date('2026-09-17T08:01:00.000Z'),
      text: 'Ответ с неизвестным исходом отражения',
    };

    await handoff.handleChannelOperatorMessage(
      'vk-native-event-unknown',
      message,
    );
    repository.closeRequest(
      'request-vk-native-unknown',
      new Date('2026-09-17T08:02:00.000Z'),
    );
    expect(
      repository.createNextRequest({
        channel: 'vk',
        conversationId: '203',
        createdAt: new Date('2026-09-17T08:03:00.000Z'),
        id: 'request-vk-native-next',
        operatorTopicId: '901',
        status: 'active',
      }),
    ).toBe(true);
    await handoff.handleChannelOperatorMessage(
      'vk-native-event-unknown',
      message,
    );

    expect(gateway.sent).toHaveLength(1);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
    expect(
      repository.findConversationMessages('request-vk-native-next', 10),
    ).toEqual([]);
  });

  it('completes a retried historical mirror after manual receipt confirmation', async () => {
    repository.createRequest({
      channel: 'vk',
      conversationId: '206',
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      id: 'request-vk-confirmed-mirror',
      operatorTopicId: '903',
      status: 'active',
    });
    const action = {
      clientMessageId: '206:12',
      createdAt: new Date('2026-09-17T08:01:00.000Z'),
      id: 'operator-mirror:request-vk-confirmed-mirror:vk:206:12:0',
      initial: false,
      kind: 'mirror_operator_message' as const,
      operatorTopicId: '903',
      requestId: 'request-vk-confirmed-mirror',
      sequence: 0,
    };
    repository.prepareOperatorAction(action);
    repository.claimOperatorAction(action.id, action.createdAt);
    repository.markOperatorActionOutcomeUnknown(
      action.id,
      'Telegram response was lost',
    );
    expect(
      repository.confirmOperatorActionReceived(
        action.id,
        new Date('2026-09-17T08:02:00.000Z'),
      ),
    ).toBe(true);
    const inbox = new TelegramTopicsInbox(gateway, -1_001, repository);

    await inbox.mirrorOperatorMessage(
      '903',
      {
        channel: 'vk',
        conversationId: '206',
        externalMessageId: '206:12',
        receivedAt: action.createdAt,
        text: 'Уже подтверждённый ответ',
      },
      { requestId: 'request-vk-confirmed-mirror' },
    );

    expect(gateway.sent).toHaveLength(0);
  });

  it('keeps a retried VK reply bound to its original request generation', async () => {
    repository.createRequest({
      channel: 'vk',
      conversationId: '204',
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      id: 'request-vk-original',
      operatorTopicId: '902',
      status: 'active',
    });
    gateway.failNextSend = true;
    const message = {
      channel: 'vk' as const,
      conversationId: '204',
      externalMessageId: '204:10',
      receivedAt: new Date('2026-09-17T08:01:00.000Z'),
      text: 'Ответ, повторённый после временной ошибки',
    };

    await expect(
      handoff.handleChannelOperatorMessage('vk-native-event-retry', message),
    ).rejects.toThrow('Temporary Telegram failure');
    repository.closeRequest(
      'request-vk-original',
      new Date('2026-09-17T08:02:00.000Z'),
    );
    expect(
      repository.createNextRequest({
        channel: 'vk',
        conversationId: '204',
        createdAt: new Date('2026-09-17T08:03:00.000Z'),
        id: 'request-vk-later',
        operatorTopicId: '902',
        status: 'active',
      }),
    ).toBe(true);

    await handoff.handleChannelOperatorMessage(
      'vk-native-event-retry',
      message,
    );

    expect(gateway.sent).toHaveLength(1);
    expect(
      repository.findConversationMessages('request-vk-original', 10),
    ).toEqual([expect.objectContaining({ externalMessageId: '204:10' })]);
    expect(repository.findConversationMessages('request-vk-later', 10)).toEqual(
      [],
    );
  });

  it('replaces a missing topic before mirroring a native VK reply', async () => {
    repository.createRequest({
      channel: 'vk',
      conversationId: '205',
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      displayName: 'VK Customer',
      id: 'request-vk-missing-topic',
      operatorTopicId: '800',
      status: 'active',
    });
    repository.recordConversationMessage({
      createdAt: new Date('2026-09-17T08:00:00.000Z'),
      direction: 'client_to_operator',
      externalMessageId: '205:1',
      id: 'client-message-vk-missing-topic',
      requestId: 'request-vk-missing-topic',
      senderName: 'VK Customer',
      text: 'Исходный вопрос клиента',
    });
    gateway.unavailableTopics.add(800);

    await handoff.handleChannelOperatorMessage('vk-native-event-missing', {
      channel: 'vk',
      conversationId: '205',
      externalMessageId: '205:11',
      receivedAt: new Date('2026-09-17T08:01:00.000Z'),
      text: 'Ответ после удаления темы',
    });

    expect(
      repository.findRequestById('request-vk-missing-topic'),
    ).toMatchObject({ operatorTopicId: '900', status: 'active' });
    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]?.messageThreadId).toBe(900);
    expect(gateway.sent[0]?.text).toContain('Исходный вопрос клиента');
    expect(gateway.sent[1]).toMatchObject({
      messageThreadId: 900,
      text: 'Ответ администратора из VK:\n\nОтвет после удаления темы',
    });
  });

  it('splits a maximum-length customer message without creating extra topics', async () => {
    const update = createPrivateUpdate(1, 501, 'Я'.repeat(4_096));

    await router.route(update);
    await router.route(update);

    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent.every((message) => message.text.length <= 4_096)).toBe(
      true,
    );
    expect(gateway.sent[0]?.text).toContain('Первое сообщение:');
    expect(gateway.sent[1]?.text).toMatch(/^Продолжение сообщения:/);
    expect(
      gateway.sent.reduce(
        (count, message) =>
          count +
          Array.from(message.text).filter((value) => value === 'Я').length,
        0,
      ),
    ).toBe(4_096);
  });

  it('retries a failed first relay in the already persisted topic', async () => {
    const update = createPrivateUpdate(1, 501, 'Question');
    gateway.failNextSend = true;

    await expect(router.route(update)).rejects.toThrow(
      'Temporary Telegram failure',
    );
    await router.route(update);

    expect(gateway.createdTopics).toEqual([900]);
    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: '900',
    });
    expect(gateway.sent).toHaveLength(1);
  });

  it('moves an unanswered web request to one Telegram topic after recovery', async () => {
    const handoff = new HandoffService({
      operatorInbox: new EmergencyOperatorInbox(),
      repository,
    });
    const firstMessage = {
      channel: 'vk' as const,
      conversationId: '101',
      displayName: 'VK Customer',
      externalMessageId: 'vk-message-1',
      receivedAt: new Date('2026-09-16T06:48:00.000Z'),
      text: 'First question',
    };
    await handoff.handleClientMessage('vk-event-1', firstMessage);
    await handoff.handleClientMessage('vk-event-2', {
      ...firstMessage,
      externalMessageId: 'vk-message-2',
      text: 'More details',
    });

    const telegramInbox = new TelegramTopicsInbox(gateway, -1_001, repository);
    await handoff.recoverWebRequests(telegramInbox);
    await handoff.recoverWebRequests(telegramInbox);

    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]).toMatchObject({
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain('First question');
    expect(gateway.sent[1]?.text).toContain('More details');
    expect(repository.findActiveRequest('vk', '101')).toMatchObject({
      operatorTopicId: '900',
    });
  });

  it('replaces a permanently missing topic during web recovery exactly once', async () => {
    const primaryInbox = new TelegramTopicsInbox(gateway, -1_001, repository);
    const switchableInbox = new SwitchableOperatorInbox(
      new EmergencyOperatorInbox(),
    );
    switchableInbox.register(primaryInbox);
    const recoveringHandoff = new HandoffService({
      operatorInbox: switchableInbox,
      repository,
    });
    const recoveringRouter = new TelegramUpdateRouter(
      recoveringHandoff,
      -1_001,
      new TelegramClientMenu(gateway, repository, information),
      gateway,
    );

    await recoveringRouter.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await recoveringRouter.route(
      createOperatorUpdate(2, 601, 900, 'Первый ответ'),
    );
    gateway.unavailableTopics.add(900);
    await recoveringRouter.route(createPrivateUpdate(3, 502, 'Уточнение'));

    expect(
      repository.findActiveRequest('telegram', '101')?.operatorTopicId,
    ).toMatch(/^web:/);
    expect(repository.getWebOperatorRequestSummary()).toEqual({
      recoverable: 1,
      webOwned: 0,
    });

    await recoveringHandoff.recoverWebRequests(primaryInbox);
    await recoveringHandoff.recoverWebRequests(primaryInbox);

    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: '901',
    });
    expect(gateway.createdTopics).toEqual([900, 901]);
    expect(
      gateway.sent.filter((message) => message.messageThreadId === 901),
    ).toHaveLength(2);
  });

  it('shows the menu without opening a request and hands off the actual question', async () => {
    const startUpdate = createPrivateUpdate(1, 501, '/start');

    await router.route(startUpdate);
    await router.route(startUpdate);
    await router.route(createPrivateUpdate(2, 502, handoffButton));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]).toMatchObject({
      chatId: 101,
      replyMarkup: {
        input_field_placeholder: 'Выберите действие',
        is_persistent: true,
        resize_keyboard: true,
      },
    });
    const initialMenu = gateway.sent[0]?.replyMarkup;
    if (!initialMenu || !('keyboard' in initialMenu)) {
      throw new Error('Expected a reply keyboard');
    }
    expect(initialMenu.keyboard.flat().map((button) => button.text)).toEqual([
      handoffButton,
    ]);
    expect(gateway.sent[1]?.text).toContain('Напишите свой вопрос');
    expect(gateway.sent[1]?.replyMarkup).toEqual({ remove_keyboard: true });

    await router.route(
      createPrivateUpdate(3, 503, 'Когда проходит занятие для начинающих?'),
    );

    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
    expect(gateway.sent).toHaveLength(3);
    expect(gateway.sent[2]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[2]?.text).toContain(
      'Когда проходит занятие для начинающих?',
    );
    expect(gateway.sent[2]?.text).not.toContain('Request:');
  });

  it('never turns private commands into customer requests', async () => {
    await router.route(createPrivateUpdate(1, 501, '/close'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]).toMatchObject({
      chatId: 101,
      text: clientMessages.noOpenRequest,
    });
  });

  it('redirects a new customer while Telegram intake is paused', async () => {
    telegramPaused = true;

    await router.route(createPrivateUpdate(1, 501, 'Мне нужна помощь'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.chatId).toBe(101);
    expect(gateway.sent[0]?.text).toBe(clientMessages.pausedIntake);
    expect(gateway.sent[0]?.replyMarkup).toEqual({ remove_keyboard: true });
  });

  it('keeps configured Telegram information available while intake is paused', async () => {
    information.replace({
      customSections: [{ label: 'Как добраться', text: 'Вход со двора.' }],
      schedule: [{ dayTime: 'Понедельник 19:00', title: 'Бачата' }],
    });
    telegramPaused = true;

    await router.route(createPrivateUpdate(1, 501, 'Расписание'));
    await router.route(createPrivateUpdate(2, 502, 'Как добраться'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent.map((message) => message.text)).toEqual([
      'Расписание\n\nБачата\nПонедельник 19:00',
      'Вход со двора.',
    ]);
    const replyMarkup = gateway.sent[0]?.replyMarkup;
    if (!replyMarkup || !('keyboard' in replyMarkup)) {
      throw new Error('Expected a reply keyboard');
    }
    const labels = replyMarkup.keyboard.flat().map((button) => button.text);
    expect(labels).toEqual(
      expect.arrayContaining(['Расписание', 'Как добраться']),
    );
    expect(labels).not.toContain(handoffButton);
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01'))
        .information_section,
    ).toBe(2);
  });

  it('continues an open Telegram conversation after intake is paused', async () => {
    information.replace({
      schedule: [{ dayTime: 'Понедельник 19:00', title: 'Бачата' }],
    });
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    telegramPaused = true;

    await router.route(createPrivateUpdate(2, 502, 'Уточнение'));
    await router.route(createPrivateUpdate(3, 503, 'Расписание'));

    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
    expect(gateway.sent).toHaveLength(3);
    expect(gateway.sent[1]?.chatId).toBe(-1_001);
    expect(gateway.sent[1]?.messageThreadId).toBe(900);
    expect(gateway.sent[1]?.text).toContain('Уточнение');
    expect(gateway.sent[2]).toMatchObject({
      chatId: 101,
      text: 'Расписание\n\nБачата\nПонедельник 19:00',
    });
    const activeMenu = gateway.sent[2]?.replyMarkup;
    if (!activeMenu || !('keyboard' in activeMenu)) {
      throw new Error('Expected an active conversation keyboard');
    }
    expect(activeMenu.keyboard.flat().map((button) => button.text)).toEqual([
      'Расписание',
    ]);
  });

  it.each(['/start', '/menu'])(
    'opens the active menu for %s without forwarding the command',
    async (command) => {
      await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
      await router.route(createPrivateUpdate(2, 502, command));

      expect(gateway.sent).toHaveLength(2);
      expect(gateway.sent[1]).toMatchObject({
        chatId: 101,
        text: clientMessages.activeMenu,
      });
      const activeMenu = gateway.sent[1]?.replyMarkup;
      if (!activeMenu || !('keyboard' in activeMenu)) {
        throw new Error('Expected an active conversation keyboard');
      }
      expect(activeMenu.keyboard.flat().map((button) => button.text)).toEqual([
        handoffButton,
      ]);
    },
  );

  it('keeps the handoff button without opening another active request', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    const request = repository.findActiveRequest('telegram', '101');

    await router.route(createPrivateUpdate(2, 502, handoffButton));

    expect(repository.findActiveRequest('telegram', '101')?.id).toBe(
      request?.id,
    );
    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      text: clientMessages.questionPrompt,
    });
    const activeMenu = gateway.sent[1]?.replyMarkup;
    if (!activeMenu || !('keyboard' in activeMenu)) {
      throw new Error('Expected an active conversation keyboard');
    }
    expect(activeMenu.keyboard.flat().map((button) => button.text)).toEqual([
      handoffButton,
    ]);
  });

  it('keeps information buttons available during an active request', async () => {
    information.replace({
      schedule: [{ dayTime: 'Понедельник 19:00', title: 'Бачата' }],
    });
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createPrivateUpdate(2, 502, 'Расписание'));

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      text: 'Расписание\n\nБачата\nПонедельник 19:00',
    });
    const activeMenu = gateway.sent[1]?.replyMarkup;
    if (!activeMenu || !('keyboard' in activeMenu)) {
      throw new Error('Expected an active conversation keyboard');
    }
    expect(activeMenu.keyboard.flat().map((button) => button.text)).toEqual([
      'Расписание',
      handoffButton,
    ]);
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01'))
        .information_section,
    ).toBe(1);
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

    await router.route(createPrivateUpdate(1, 501, '/start'));
    await router.route(createPrivateUpdate(2, 502, faqButton));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    const replyMarkup = gateway.sent[0]?.replyMarkup;
    if (!replyMarkup || !('keyboard' in replyMarkup)) {
      throw new Error('Expected a reply keyboard');
    }
    expect(replyMarkup.keyboard.flat().map((button) => button.text)).toContain(
      faqButton,
    );
    expect(gateway.sent[1]?.text).toContain('❓ Как записаться?');
  });
  it('shows a custom section without opening an operator request', async () => {
    information.replace({
      customSections: [
        {
          label: 'Первое занятие',
          text: 'Приходите за 10 минут до начала.',
        },
      ],
    });

    await router.route(createPrivateUpdate(1, 501, '/start'));
    await router.route(createPrivateUpdate(2, 502, 'Первое занятие'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    const replyMarkup = gateway.sent[0]?.replyMarkup;
    if (!replyMarkup || !('keyboard' in replyMarkup)) {
      throw new Error('Expected a reply keyboard');
    }
    expect(replyMarkup.keyboard.flat().map((button) => button.text)).toContain(
      'Первое занятие',
    );
    expect(gateway.sent[1]?.text).toBe('Приходите за 10 минут до начала.');
  });

  it('recovers buttons from multiple menu revisions without a handoff', async () => {
    information.replace(
      {
        customSections: [{ label: 'Цены занятий', text: 'Текущий ответ.' }],
      },
      ['Стоимость', 'Абонементы', 'Удалённая кнопка'],
    );

    const oldestEvent = createPrivateUpdate(1, 501, 'Абонементы');
    await router.route(oldestEvent);
    await router.route(oldestEvent);

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.text).toBe(clientMessages.menuUpdated);
    const renamedKeyboard = gateway.sent[0]?.replyMarkup;
    if (!renamedKeyboard || !('keyboard' in renamedKeyboard)) {
      throw new Error('Expected a refreshed Telegram keyboard');
    }
    expect(
      renamedKeyboard.keyboard.flat().map((button) => button.text),
    ).toContain('Цены занятий');

    await router.route(createPrivateUpdate(2, 502, 'Стоимость'));
    await router.route(createPrivateUpdate(3, 503, 'Удалённая кнопка'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent[1]?.text).toBe(clientMessages.menuUpdated);
    expect(gateway.sent[2]?.text).toBe(clientMessages.menuUpdated);
  });

  it('still sends unknown customer text to the operator after a menu change', async () => {
    information.replace(
      {
        customSections: [{ label: 'Текущая кнопка', text: 'Ответ.' }],
      },
      ['Предыдущая кнопка', 'Старая кнопка'],
    );

    await router.route(createPrivateUpdate(1, 501, 'У меня другой вопрос'));

    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
  });

  it.each(['Спасибо', 'Когда следующее занятие?'])(
    'does not open a request from post-dialog text: %s',
    async (text) => {
      await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
      const firstRequest = repository.findActiveRequest('telegram', '101');
      await router.route(createOperatorUpdate(2, 601, 900, '/close'));

      await router.route(createPrivateUpdate(3, 502, text));

      expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
      expect(repository.findLatestRequest('telegram', '101')?.id).toBe(
        firstRequest?.id,
      );
      expect(gateway.sent.at(-1)?.text).toContain(
        'Предыдущий разговор завершён',
      );
      expect(gateway.sent.at(-1)?.replyMarkup).toMatchObject({
        is_persistent: true,
      });
    },
  );

  it('clears expired question intent and restores the current menu', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    repository.setAwaitingClientQuestion(
      'telegram',
      '101',
      new Date('2026-09-01T10:00:00.000Z'),
    );
    const checkedAt = new Date('2026-09-01T12:01:00.000Z');
    const expiredIntentRouter = new TelegramUpdateRouter(
      handoff,
      -1_001,
      new TelegramClientMenu(
        gateway,
        repository,
        information,
        acceptingClientIntakePolicy,
        () => checkedAt,
      ),
      gateway,
    );

    await expiredIntentRouter.route(
      createPrivateUpdate(3, 502, 'Поздний вопрос'),
    );

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(repository.findLatestRequest('telegram', '101')?.id).toBe(
      firstRequest?.id,
    );
    expect(
      repository.isAwaitingClientQuestion('telegram', '101', checkedAt),
    ).toBe(false);
    expect(gateway.sent.at(-1)?.text).toBe(clientMessages.closedConversation);
    const replyMarkup = gateway.sent.at(-1)?.replyMarkup;
    if (!replyMarkup || !('keyboard' in replyMarkup)) {
      throw new Error('Expected a restored Telegram menu');
    }
    expect(replyMarkup.keyboard.flat().map((button) => button.text)).toContain(
      handoffButton,
    );
  });

  it('closes and reopens a request only after Telegram confirms the action', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));

    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.closedTopics).toEqual([900]);

    await router.route(createOperatorUpdate(3, 602, 900, '/reopen'));
    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: '900',
    });
    expect(gateway.reopened).toEqual([900]);
  });

  it('reopens the Telegram topic before accepting a reply after close', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));

    await router.route(
      createOperatorUpdate(3, 602, 900, 'Ответ после закрытия'),
    );

    expect(gateway.reopened).toEqual([900]);
    expect(repository.findRequestById(request.id)?.status).toBe('active');
    expect(repository.findConversationMessages(request.id, 10)).toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );
  });

  it('keeps a reply retryable when automatic reopen fails', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.failNextReopen = true;
    const reply = createOperatorUpdate(3, 602, 900, 'Ответ после закрытия');

    await router.route(reply);
    expect(repository.findRequestById(request.id)?.status).toBe('closed');
    expect(
      repository.findConversationMessages(request.id, 10),
    ).not.toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );

    const incident = repository.findOperatorActionIncidents(10)[0];
    expect(incident).toMatchObject({ heldReplyCount: 1, status: 'failed' });
    if (!incident) {
      throw new Error('Expected a failed reopen incident');
    }

    await handoff.retryHeldOperatorReply(incident.id);
    expect(gateway.reopened).toEqual([900]);
    expect(repository.findRequestById(request.id)?.status).toBe('active');
    expect(repository.findConversationMessages(request.id, 10)).toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );
  });

  it('delivers a held reply after an uncertain reopen is confirmed', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;
    const reply = createOperatorUpdate(3, 602, 900, 'Ответ после закрытия');

    await router.route(reply);
    expect(repository.findRequestById(request.id)?.status).toBe('closed');
    expect(
      repository.findConversationMessages(request.id, 10),
    ).not.toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );
    const incident = repository.findOperatorActionIncidents(10)[0];
    if (!incident) {
      throw new Error('Expected an uncertain reopen incident');
    }

    expect(
      repository.resolveOperatorLifecycleAction(
        incident.id,
        'completed',
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(true);

    expect(repository.findRequestById(request.id)?.status).toBe('active');
    expect(repository.findConversationMessages(request.id, 10)).toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );
  });

  it('advances the poller past a held reply with an uncertain reopen', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;
    const updates = [
      createOperatorUpdate(100, 602, 900, 'Сохранённый ответ'),
      createPrivateUpdate(101, 701, 'Новый вопрос', 202),
    ];
    const offsets: (number | undefined)[] = [];
    const abortController = new AbortController();
    gateway.getUpdates = (options) => {
      offsets.push(options.offset);
      if (options.offset === 102) {
        abortController.abort();
        return Promise.resolve([]);
      }
      return Promise.resolve(updates);
    };
    const poller = new TelegramPoller(gateway, router, 30, repository, {
      retryDelay: () => Promise.resolve(),
      retryDelayMs: 0,
    });

    await poller.run(abortController.signal);

    expect(offsets).toEqual([undefined, 102]);
    expect(repository.findRequestById(request.id)?.status).toBe('closed');
    expect(repository.findOperatorActionIncidents(10)[0]).toMatchObject({
      heldReplyCount: 1,
      status: 'outcome_unknown',
    });
    expect(repository.findActiveRequest('telegram', '202')).toBeDefined();
  });

  it('deduplicates a repeated held-reply update', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await deliveryWorker.processPending();
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;
    const reply = createOperatorUpdate(3, 602, 900, 'Сохранённый ответ');

    await router.route(reply);
    await router.route(reply);

    const incident = repository.findOperatorActionIncidents(10)[0];
    expect(incident).toMatchObject({ heldReplyCount: 1 });
    expect(gateway.reopenAttempts).toBe(1);
    if (!incident) {
      throw new Error('Expected an uncertain reopen incident');
    }
    expect(
      repository.resolveOperatorLifecycleAction(
        incident.id,
        'completed',
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(true);
    expect(
      repository
        .findConversationMessages(request.id, 10)
        .filter((message) => message.text === 'Сохранённый ответ'),
    ).toHaveLength(1);
    expect(repository.getDeliverySummary()).toMatchObject({ pending: 1 });
  });

  it('releases two held replies in their original order', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await deliveryWorker.processPending();
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;

    await router.route(createOperatorUpdate(3, 602, 900, 'Первый ответ'));
    await router.route(createOperatorUpdate(4, 603, 900, 'Второй ответ'));

    const incident = repository.findOperatorActionIncidents(10)[0];
    expect(incident).toMatchObject({ heldReplyCount: 2 });
    expect(gateway.reopenAttempts).toBe(1);
    if (!incident) {
      throw new Error('Expected an uncertain reopen incident');
    }
    repository.resolveOperatorLifecycleAction(
      incident.id,
      'completed',
      new Date('2026-08-31T12:01:00.000Z'),
    );
    await deliveryWorker.processPending();
    await deliveryWorker.processPending();

    expect(
      gateway.sent
        .filter((message) => message.chatId === 101)
        .map((message) => message.text)
        .slice(-2),
    ).toEqual(['Первый ответ', 'Второй ответ']);
    expect(
      repository
        .findConversationMessages(request.id, 10)
        .filter((message) => message.direction === 'operator_to_client')
        .map((message) => message.text),
    ).toEqual(['Первый ответ', 'Второй ответ']);
  });

  it('supersedes historical relay uncertainty when the client starts a newer request', async () => {
    await router.route(createPrivateUpdate(1, 501, 'First question'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    if (!firstRequest) {
      throw new Error('Expected the first request');
    }
    gateway.unknownOnSendNumber = gateway.sent.length + 1;
    await router.route(createPrivateUpdate(2, 502, 'Uncertain follow-up'));
    const incident = repository
      .findOperatorActionIncidents(10)
      .find((candidate) => candidate.kind === 'relay_message');
    if (!incident) {
      throw new Error('Expected an uncertain relay action');
    }
    await router.route(createOperatorUpdate(3, 601, 900, '/close'));

    await router.route(createPrivateUpdate(4, 503, handoffButton));
    await router.route(createPrivateUpdate(5, 504, 'Next question'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(repository.findRequestById(firstRequest.id)?.status).toBe('closed');
    expect(nextRequest?.id).not.toBe(firstRequest.id);
    expect(repository.prepareOperatorAction(incident).status).toBe(
      'superseded',
    );
    expect(repository.findOperatorActionIncidents(10)).toEqual([]);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 0 });
  });

  it('delivers held replies when the client starts a newer request', async () => {
    await router.route(createPrivateUpdate(1, 501, 'First question'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    if (!firstRequest) {
      throw new Error('Expected the first request');
    }
    await deliveryWorker.processPending();
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;
    await router.route(createOperatorUpdate(3, 602, 900, 'Late answer'));

    await router.route(createPrivateUpdate(4, 502, handoffButton));
    await router.route(createPrivateUpdate(5, 503, 'Next question'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(repository.findRequestById(firstRequest.id)?.status).toBe('closed');
    expect(nextRequest).toMatchObject({ operatorTopicId: '900' });
    expect(nextRequest?.id).not.toBe(firstRequest.id);
    expect(repository.findOperatorActionIncidents(10)).toEqual([]);
    expect(
      repository.findConversationMessages(firstRequest.id, 10),
    ).toContainEqual(expect.objectContaining({ text: 'Late answer' }));
    expect(gateway.reopenAttempts).toBe(2);

    const sentBeforeDelivery = gateway.sent.length;
    await deliveryWorker.processPending();
    await deliveryWorker.processPending();

    expect(
      gateway.sent
        .slice(sentBeforeDelivery)
        .find((message) => message.chatId === 101)?.text,
    ).toBe('Late answer');
    expect(
      gateway.sent.filter(
        (message) => message.chatId === 101 && message.text === 'Late answer',
      ),
    ).toHaveLength(1);
    expect(repository.findActiveRequest('telegram', '101')?.id).toBe(
      nextRequest?.id,
    );
  });

  it('does not reuse a failed reopen action after its held reply is released', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Question'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await deliveryWorker.processPending();
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.failNextReopen = true;
    await router.route(createOperatorUpdate(3, 602, 900, 'First late answer'));
    expect(repository.findOperatorActionIncidents(10)[0]).toMatchObject({
      status: 'failed',
    });

    await router.route(createTopicServiceUpdate(4, 'reopened'));
    expect(repository.findOperatorActionIncidents(10)).toEqual([]);
    await router.route(createOperatorUpdate(5, 603, 900, '/close'));
    await router.route(createOperatorUpdate(6, 604, 900, 'Second late answer'));

    expect(gateway.reopenAttempts).toBe(2);
    expect(repository.findRequestById(request.id)?.status).toBe('active');
    expect(
      repository
        .findConversationMessages(request.id, 10)
        .filter((message) => message.direction === 'operator_to_client')
        .map((message) => message.text),
    ).toEqual(['First late answer', 'Second late answer']);
  });

  it('holds a reply when the closed Telegram topic is missing', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unavailableTopics.add(900);

    await router.route(
      createOperatorUpdate(3, 602, 900, 'Ответ в удалённой теме'),
    );
    await router.route(createPrivateUpdate(4, 701, 'Новый вопрос', 202));

    expect(repository.findRequestById(request.id)?.status).toBe('closed');
    const incident = repository.findOperatorActionIncidents(10)[0];
    expect(incident).toMatchObject({
      heldReplyCount: 1,
      status: 'failed',
    });
    expect(repository.findActiveRequest('telegram', '202')).toBeDefined();
    if (!incident) {
      throw new Error('Expected a failed reopen incident');
    }
    expect(
      repository.moveHeldOperatorReplyToWeb(
        incident.id,
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(true);
    expect(repository.findRequestById(request.id)).toMatchObject({
      operatorTopicId: `web:${request.id}`,
      status: 'active',
    });
    expect(repository.findConversationMessages(request.id, 10)).toContainEqual(
      expect.objectContaining({ text: 'Ответ в удалённой теме' }),
    );
    expect(repository.findOperatorActionIncident(incident.id)).toBeUndefined();
  });

  it('retries a held reply when uncertain reopen did not complete', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    const request = repository.findActiveRequest('telegram', '101');
    if (!request) {
      throw new Error('Expected an active request');
    }
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.unknownNextReopen = true;
    const reply = createOperatorUpdate(3, 602, 900, 'Ответ после закрытия');

    await router.route(reply);
    const incident = repository.findOperatorActionIncidents(10)[0];
    if (!incident) {
      throw new Error('Expected an uncertain reopen incident');
    }
    expect(
      repository.resolveOperatorLifecycleAction(
        incident.id,
        'not_completed',
        new Date('2026-08-31T12:01:00.000Z'),
      ),
    ).toBe(true);

    expect(repository.findOperatorActionIncident(incident.id)).toMatchObject({
      heldReplyCount: 1,
      status: 'abandoned',
    });
    await handoff.retryHeldOperatorReply(incident.id);

    expect(gateway.reopened).toEqual([900]);
    expect(repository.findRequestById(request.id)?.status).toBe('active');
    expect(repository.findConversationMessages(request.id, 10)).toContainEqual(
      expect.objectContaining({ text: 'Ответ после закрытия' }),
    );
  });

  it('keeps a request active and delivers a reply after a failed close', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    gateway.failNextClose = true;

    await expect(
      router.route(createOperatorUpdate(2, 601, 900, '/close')),
    ).rejects.toThrow('Temporary Telegram close failure');
    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();

    await router.route(createOperatorUpdate(3, 602, 900, 'Ответ после ошибки'));
    await deliveryWorker.processPending();
    await deliveryWorker.processPending();

    expect(
      gateway.sent.some((message) => message.text === 'Ответ после ошибки'),
    ).toBe(true);
  });

  it('does not retry an uncertain close and keeps the request active', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    gateway.unknownNextClose = true;
    const closeUpdate = createOperatorUpdate(2, 601, 900, '/close');

    await router.route(closeUpdate);
    await router.route(closeUpdate);

    expect(gateway.closeAttempts).toBe(1);
    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
  });

  it('treats an already closed topic as an idempotent close success', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    gateway.alreadyClosedTopics.add(900);

    await router.route(createOperatorUpdate(2, 601, 900, '/close'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.closeAttempts).toBe(1);
  });

  it('keeps a closed request closed when Telegram reopen fails', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    gateway.failNextReopen = true;

    await expect(
      router.route(createOperatorUpdate(3, 602, 900, '/reopen')),
    ).rejects.toThrow('Temporary Telegram reopen failure');

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
  });

  it('uses the current closed state for a delayed outgoing keyboard', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Вопрос'));
    await deliveryWorker.processPending();
    await router.route(createOperatorUpdate(2, 601, 900, 'Ответ'));
    await router.route(createOperatorUpdate(3, 602, 900, '/close'));

    await deliveryWorker.processPending();

    const delivered = gateway.sent.at(-1);
    expect(delivered?.text).toBe('Ответ');
    expect(delivered?.replyMarkup).toMatchObject({ is_persistent: true });
    if (!delivered?.replyMarkup || !('keyboard' in delivered.replyMarkup)) {
      throw new Error('Expected an idle Telegram keyboard');
    }
    expect(
      delivered.replyMarkup.keyboard.flat().map((button) => button.text),
    ).toContain(handoffButton);
  });

  it('explains an unsupported private location message', async () => {
    const update = createPrivateUpdate(1, 501, 'placeholder');
    if (!update.message) {
      throw new Error('Expected a Telegram message');
    }
    delete update.message.text;
    update.message.location = { latitude: 55.75, longitude: 37.62 };

    await router.route(update);

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent.at(-1)?.text).toBe(
      'Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.',
    );
  });

  it('ignores edited client messages without sending an unsupported reply', async () => {
    const original = createPrivateUpdate(1, 501, 'Исправленный вопрос');
    const update: TelegramUpdate = {
      edited_message: original.message,
      update_id: 2,
    };

    await router.route(update);

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(0);
  });

  it('replaces a deleted topic when the customer sends another message', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    gateway.unavailableTopics.add(900);

    await router.route(createPrivateUpdate(2, 502, 'Второй вопрос'));

    expect(
      repository.findActiveRequest('telegram', '101')?.operatorTopicId,
    ).toBe('901');
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 901,
    });
    expect(gateway.sent[1]?.text).toContain('Второй вопрос');
  });

  it('does not forward a former active-menu action as client text', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    gateway.unavailableTopics.add(900);

    await router.route(createPrivateUpdate(2, 502, '/start'));
    await router.route(createPrivateUpdate(3, 503, 'Начать новый вопрос'));

    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: '900',
    });
    expect(gateway.sent[2]).toMatchObject({
      chatId: 101,
      text: 'Напишите свой вопрос. Мы ответим здесь.',
    });
    expect(gateway.createdTopics).toEqual([900]);
  });

  it('keeps explicit question intent across a repository restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-handoff-'));
    const databasePath = join(directory, 'handoff.sqlite');
    const firstRepository = new SqliteSupportRepository(databasePath);
    let firstRepositoryOpen = true;
    try {
      const firstMenu = new TelegramClientMenu(
        gateway,
        firstRepository,
        information,
      );
      await firstMenu.handle({
        chatId: 202,
        externalEventId: 'question-button',
        text: handoffButton,
      });
      firstRepository.close();
      firstRepositoryOpen = false;

      const restartedRepository = new SqliteSupportRepository(databasePath);
      try {
        const restartedHandoff = new HandoffService({
          operatorInbox: new TelegramTopicsInbox(
            gateway,
            -1_001,
            restartedRepository,
          ),
          repository: restartedRepository,
        });
        const restartedRouter = new TelegramUpdateRouter(
          restartedHandoff,
          -1_001,
          new TelegramClientMenu(gateway, restartedRepository, information),
          gateway,
        );

        await restartedRouter.route(
          createPrivateUpdate(20, 520, 'Вопрос после рестарта', 202),
        );

        expect(
          restartedRepository.findActiveRequest('telegram', '202'),
        ).toBeDefined();
        expect(
          restartedRepository.isAwaitingClientQuestion(
            'telegram',
            '202',
            new Date(),
          ),
        ).toBe(false);
      } finally {
        restartedRepository.close();
      }
    } finally {
      if (firstRepositoryOpen) {
        firstRepository.close();
      }
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('repeats the question prompt after its first delivery fails', async () => {
    const update = createPrivateUpdate(1, 501, handoffButton);
    gateway.failNextSend = true;

    await expect(router.route(update)).rejects.toThrow(
      'Temporary Telegram failure',
    );
    expect(
      repository.isAwaitingClientQuestion('telegram', '101', new Date()),
    ).toBe(true);

    await router.route(update);

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toEqual([
      expect.objectContaining({
        chatId: 101,
        text: 'Напишите свой вопрос. Мы ответим здесь.',
      }),
    ]);
  });

  it('cancels a pending new question when the client opens the menu', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createOperatorUpdate(2, 601, 900, '/close'));
    await router.route(createPrivateUpdate(3, 502, handoffButton));

    await router.route(createPrivateUpdate(4, 503, '/menu'));

    expect(
      repository.isAwaitingClientQuestion('telegram', '101', new Date()),
    ).toBe(false);
    const menu = gateway.sent.at(-1);
    expect(menu?.text).toBe(clientMessages.menuOpened);
    if (!menu?.replyMarkup || !('keyboard' in menu.replyMarkup)) {
      throw new Error('Expected a restored Telegram menu');
    }
    expect(
      menu.replyMarkup.keyboard.flat().map((button) => button.text),
    ).toContain(handoffButton);

    await router.route(createPrivateUpdate(5, 504, 'Спасибо'));
    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
  });

  it('reopens one client topic after an explicit new-question action', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Ого'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    await router.route(createTopicServiceUpdate(2, 'closed'));
    await router.route(createPrivateUpdate(3, 503, handoffButton));

    await router.route(createPrivateUpdate(4, 504, 'Ты кто?'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(firstRequest?.id).toBeDefined();
    expect(nextRequest?.id).not.toBe(firstRequest?.id);
    expect(nextRequest?.operatorTopicId).toBe('900');
    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.closedTopics).toEqual([]);
    expect(gateway.reopened).toEqual([900]);
  });

  it('closes a web-owned request without calling the Telegram topic API', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    if (!firstRequest) {
      throw new Error('Expected an active request');
    }
    expect(
      repository.switchOperatorTopic(
        firstRequest.id,
        firstRequest.operatorTopicId,
        `web:${firstRequest.id}`,
      ),
    ).toBe(true);

    const webHandoff = new HandoffService({
      operatorInbox: new EmergencyOperatorInbox(),
      repository,
    });
    await webHandoff.handleOperatorMessage(
      'web-close',
      {
        externalMessageId: 'web-close-message',
        operatorTopicId: `web:${firstRequest.id}`,
        receivedAt: new Date('2026-09-16T10:00:00.000Z'),
        text: '/close',
      },
      'operator:web',
    );

    expect(gateway.closedTopics).toEqual([]);
    expect(repository.findRequestById(firstRequest.id)?.status).toBe('closed');

    await router.route(createPrivateUpdate(3, 503, handoffButton));
    await router.route(createPrivateUpdate(4, 504, 'Следующий вопрос'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(nextRequest).toMatchObject({ operatorTopicId: '901' });
    expect(nextRequest?.id).not.toBe(firstRequest.id);
    expect(gateway.createdTopics).toEqual([900, 901]);
  });

  it('creates a replacement when the previous customer topic was deleted', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createTopicServiceUpdate(2, 'closed'));
    gateway.unavailableTopics.add(900);

    await router.route(createPrivateUpdate(3, 502, handoffButton));
    await router.route(createPrivateUpdate(3, 502, 'Следующий вопрос'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(gateway.reopened).toEqual([]);
    expect(gateway.createdTopics).toEqual([900, 901]);
    expect(nextRequest?.operatorTopicId).toBe('901');
  });

  it('reuses a topic that Telegram reports as already open', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createTopicServiceUpdate(2, 'closed'));
    gateway.alreadyOpenTopics.add(900);

    await router.route(createPrivateUpdate(3, 502, handoffButton));
    await router.route(createPrivateUpdate(4, 503, 'Следующий вопрос'));

    expect(gateway.createdTopics).toEqual([900]);
    expect(repository.findActiveRequest('telegram', '101')).toMatchObject({
      operatorTopicId: '900',
    });
  });

  it('does not create a duplicate when reopening has an unknown outcome', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createTopicServiceUpdate(2, 'closed'));
    gateway.unknownNextReopen = true;

    await router.route(createPrivateUpdate(3, 502, handoffButton));
    await router.route(createPrivateUpdate(3, 502, 'Следующий вопрос'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(gateway.createdTopics).toEqual([900]);
    expect(nextRequest?.operatorTopicId).toMatch(/^web:/);
    expect(repository.getOperatorActionSummary()).toEqual({ uncertain: 1 });
  });

  it('synchronizes manual topic closing and reopening', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));

    await router.route(createTopicServiceUpdate(2, 'closed'));
    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();

    await router.route(createTopicServiceUpdate(3, 'reopened'));
    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
  });

  it('reuses the customer topic for a new request after close', async () => {
    await router.route(createPrivateUpdate(1, 501, 'First question'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    await router.route(createTopicServiceUpdate(2, 'closed'));

    await router.route(createPrivateUpdate(3, 502, handoffButton));
    await router.route(createPrivateUpdate(3, 502, 'New question'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(gateway.reopened).toEqual([900]);
    expect(gateway.createdTopics).toEqual([900]);
    expect(nextRequest?.operatorTopicId).toBe('900');
    expect(nextRequest?.id).not.toBe(firstRequest?.id);
    expect(gateway.sent).toHaveLength(3);
    expect(gateway.sent[2]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[2]?.text).toContain('New question');
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).new_request,
    ).toBe(2);
  });
});

function createPrivateUpdate(
  updateId: number,
  messageId: number,
  text: string,
  chatId = 101,
): TelegramUpdate {
  return {
    message: {
      chat: { id: chatId, type: 'private' },
      date: 1_788_177_600,
      from: {
        first_name: 'Test',
        id: chatId,
        is_bot: false,
      },
      message_id: messageId,
      text,
    },
    update_id: updateId,
  };
}

function createOperatorUpdate(
  updateId: number,
  messageId: number,
  messageThreadId: number,
  text: string,
): TelegramUpdate {
  return {
    message: {
      chat: { id: -1_001, type: 'supergroup' },
      date: 1_788_177_600,
      from: {
        first_name: 'Operator',
        id: 202,
        is_bot: false,
      },
      message_id: messageId,
      message_thread_id: messageThreadId,
      text,
    },
    update_id: updateId,
  };
}

function createTopicServiceUpdate(
  updateId: number,
  state: 'closed' | 'reopened',
): TelegramUpdate {
  return {
    message: {
      chat: { id: -1_001, type: 'supergroup' },
      date: 1_788_177_600,
      ...(state === 'closed'
        ? { forum_topic_closed: {} }
        : { forum_topic_reopened: {} }),
      message_id: 600 + updateId,
      message_thread_id: 900,
    },
    update_id: updateId,
  };
}
