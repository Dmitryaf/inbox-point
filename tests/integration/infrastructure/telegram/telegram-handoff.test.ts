import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import {
  ClientInformationCatalog,
  faqButton,
  handoffButton,
  newQuestionButton,
} from '@/core/application/client-information.js';
import { type ClientIntakePolicy } from '@/core/contracts/client-intake-policy.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  GetUpdatesOptions,
  SendMessageOptions,
  TelegramGateway,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import type { TelegramUpdate } from '@/infrastructure/telegram/telegram-types.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';

class FakeTelegramGateway implements TelegramGateway {
  public readonly closedTopics: number[] = [];
  public readonly createdTopics: number[] = [];
  public failNextSend = false;
  public unknownNextOpen = false;
  public unknownNextReopen = false;
  public unknownOnSendNumber: number | undefined;
  public readonly reopened: number[] = [];
  public readonly sent: SendMessageOptions[] = [];
  public readonly unavailableTopics = new Set<number>();
  private nextTopicId = 900;

  public closeForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    void chatId;
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
    if (this.unknownNextReopen) {
      this.unknownNextReopen = false;
      return Promise.reject(new DeliveryOutcomeUnknownError('telegram'));
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
    const handoff = new HandoffService({
      clock: () => new Date('2026-08-31T12:00:00.000Z'),
      createId: (() => {
        let nextId = 1;
        return () => `id-${nextId++}`;
      })(),
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001, repository),
      repository,
    });
    deliveryWorker = new DeliveryWorker({
      channels: [new TelegramClientChannel(gateway, information)],
      repository,
    });
    router = new TelegramUpdateRouter(
      handoff,
      -1_001,
      new TelegramClientMenu(
        gateway,
        repository,
        -1_001,
        information,
        intakePolicy,
      ),
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
      text: 'Вопрос отправлен.',
    });
    expect(gateway.sent[2]).toMatchObject({
      chatId: 101,
      text: 'Answer',
    });
    const refreshedMenu = gateway.sent[2]?.replyMarkup;
    if (!refreshedMenu || !('keyboard' in refreshedMenu)) {
      throw new Error('Expected an updated reply keyboard');
    }
    expect(
      refreshedMenu.keyboard.flat().map((button) => button.text),
    ).toContain('Как добраться');
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
    expect(gateway.sent[0]?.text).toContain('Сообщение оператора: 502');
    expect(gateway.sent[0]?.text).toContain('/ops');
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
      'Не отправляйте ответ повторно вслепую',
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

  it('splits a maximum-length customer message without creating extra topics', async () => {
    const update = createPrivateUpdate(1, 501, 'Я'.repeat(4_096));

    await router.route(update);
    await router.route(update);

    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent.every((message) => message.text.length <= 4_096)).toBe(
      true,
    );
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
    expect(gateway.sent[1]?.replyMarkup).toMatchObject({
      is_persistent: true,
    });

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
      text: 'Открытого обращения нет. Выберите нужный раздел в меню.',
    });
  });

  it('redirects a new customer while Telegram intake is paused', async () => {
    telegramPaused = true;

    await router.route(createPrivateUpdate(1, 501, 'Мне нужна помощь'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent).toHaveLength(1);
    expect(gateway.sent[0]?.chatId).toBe(101);
    expect(gateway.sent[0]?.text).toBe(
      'Сейчас бот временно не принимает новые обращения. Попробуйте немного позже или свяжитесь по контакту, указанному в описании бота.',
    );
    expect(gateway.sent[0]?.replyMarkup).toEqual({ remove_keyboard: true });
  });

  it('keeps configured Telegram information available while intake is paused', async () => {
    information.replace({
      customSections: [{ label: 'Как добраться', text: 'Вход со двора.' }],
      schedule: 'Понедельник 19:00',
    });
    telegramPaused = true;

    await router.route(createPrivateUpdate(1, 501, 'Расписание'));
    await router.route(createPrivateUpdate(2, 502, 'Как добраться'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent.map((message) => message.text)).toEqual([
      'Расписание\n\n• Понедельник 19:00',
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
      text: 'Расписание пока не добавлено. Задайте вопрос, чтобы уточнить время.',
    });
  });

  it('reports an active request instead of forwarding /start to operators', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createPrivateUpdate(2, 502, '/start'));

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      replyMarkup: { is_persistent: true },
      text: 'Разговор уже начат. Напишите сообщение, чтобы продолжить, или выберите нужный раздел.',
    });
    const activeMenu = gateway.sent[1]?.replyMarkup;
    if (!activeMenu || !('keyboard' in activeMenu)) {
      throw new Error('Expected an active-request keyboard');
    }
    expect(activeMenu.keyboard.flat().map((button) => button.text)).toEqual([
      newQuestionButton,
    ]);
  });

  it('keeps reference buttons available during an active request', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createPrivateUpdate(2, 502, 'Расписание'));

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      replyMarkup: { is_persistent: true },
      text: 'Расписание пока не добавлено. Задайте вопрос, чтобы уточнить время.',
    });
  });

  it('shows and resolves the built-in FAQ without opening a request', async () => {
    information.replace({
      faq: [
        {
          answer: 'Напишите оператору.',
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

  it('lets the customer abandon a stale request and return to the menu', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    gateway.unavailableTopics.add(900);

    await router.route(createPrivateUpdate(2, 502, '/start'));
    await router.route(createPrivateUpdate(3, 503, 'Начать новый вопрос'));

    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();
    expect(gateway.sent[2]).toMatchObject({
      chatId: 101,
      text: 'Предыдущий разговор завершён. Выберите нужный раздел.',
    });
  });

  it('reopens one client topic after the new-question button', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Ого'));
    const firstRequest = repository.findActiveRequest('telegram', '101');
    await router.route(createPrivateUpdate(2, 502, '/start'));
    await router.route(createPrivateUpdate(3, 503, newQuestionButton));

    await router.route(createPrivateUpdate(4, 504, 'Ты кто?'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(firstRequest?.id).toBeDefined();
    expect(nextRequest?.id).not.toBe(firstRequest?.id);
    expect(nextRequest?.operatorTopicId).toBe('900');
    expect(gateway.createdTopics).toEqual([900]);
    expect(gateway.closedTopics).toEqual([900]);
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

    await router.route(createPrivateUpdate(2, 502, '/start'));
    await router.route(createPrivateUpdate(3, 503, newQuestionButton));

    expect(gateway.closedTopics).toEqual([]);
    expect(repository.findRequestById(firstRequest.id)?.status).toBe('closed');

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

    await router.route(createPrivateUpdate(3, 502, 'Следующий вопрос'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(gateway.reopened).toEqual([]);
    expect(gateway.createdTopics).toEqual([900, 901]);
    expect(nextRequest?.operatorTopicId).toBe('901');
  });

  it('does not create a duplicate when reopening has an unknown outcome', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createTopicServiceUpdate(2, 'closed'));
    gateway.unknownNextReopen = true;

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

    await router.route(createPrivateUpdate(3, 502, 'New question'));

    const nextRequest = repository.findActiveRequest('telegram', '101');
    expect(gateway.reopened).toEqual([900]);
    expect(gateway.createdTopics).toEqual([900]);
    expect(nextRequest?.operatorTopicId).toBe('900');
    expect(nextRequest?.id).not.toBe(firstRequest?.id);
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[1]?.text).toContain('New question');
    expect(
      repository.getUsageEventCounts(new Date('2026-01-01')).new_request,
    ).toBe(2);
  });
});

function createPrivateUpdate(
  updateId: number,
  messageId: number,
  text: string,
): TelegramUpdate {
  return {
    message: {
      chat: { id: 101, type: 'private' },
      date: 1_788_177_600,
      from: {
        first_name: 'Test',
        id: 101,
        is_bot: false,
      },
      message_id: messageId,
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
