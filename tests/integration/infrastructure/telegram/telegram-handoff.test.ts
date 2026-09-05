import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import {
  ClientInformationCatalog,
  faqButton,
  newQuestionButton,
  teacherButton,
} from '@/core/application/client-information.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import type { ClientIntakePolicy } from '@/core/contracts/client-intake-policy.js';

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
    return Promise.resolve();
  }

  public createForumTopic(
    chatId: number,
    name: string,
  ): Promise<{ topicId: number }> {
    void chatId;
    void name;
    return Promise.resolve({ topicId: this.nextTopicId++ });
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
      createId: (() => {
        let nextId = 1;
        return () => `id-${nextId++}`;
      })(),
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001),
      repository,
    });
    deliveryWorker = new DeliveryWorker({
      channels: [new TelegramClientChannel(gateway)],
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

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain('Question');
    expect(gateway.sent[1]).toEqual({
      chatId: 101,
      text: 'Answer',
    });
  });

  it('shows the menu without opening a request and hands off the actual question', async () => {
    const startUpdate = createPrivateUpdate(1, 501, '/start');

    await router.route(startUpdate);
    await router.route(startUpdate);
    await router.route(
      createPrivateUpdate(2, 502, 'Задать вопрос преподавателю'),
    );

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
      teacherButton,
      newQuestionButton,
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
    expect(gateway.sent[0]?.text).toContain('в описании бота');
  });

  it('continues an open Telegram conversation after intake is paused', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    telegramPaused = true;

    await router.route(createPrivateUpdate(2, 502, 'Уточнение'));

    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]?.chatId).toBe(-1_001);
    expect(gateway.sent[1]?.messageThreadId).toBe(900);
    expect(gateway.sent[1]?.text).toContain('Уточнение');
  });

  it('reports an active request instead of forwarding /start to operators', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createPrivateUpdate(2, 502, '/start'));

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      replyMarkup: { is_persistent: true },
      text: 'У вас уже есть открытый вопрос. Напишите сообщение, чтобы продолжить разговор, или выберите нужный раздел.',
    });
  });

  it('keeps reference buttons available during an active request', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));
    await router.route(createPrivateUpdate(2, 502, 'Расписание'));

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: 101,
      replyMarkup: { is_persistent: true },
      text: 'Расписание пока не добавлено. Вы можете задать вопрос преподавателю.',
    });
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

  it('synchronizes manual topic closing and reopening', async () => {
    await router.route(createPrivateUpdate(1, 501, 'Первый вопрос'));

    await router.route(createTopicServiceUpdate(2, 'closed'));
    expect(repository.findActiveRequest('telegram', '101')).toBeUndefined();

    await router.route(createTopicServiceUpdate(3, 'reopened'));
    expect(repository.findActiveRequest('telegram', '101')).toBeDefined();
  });

  it('reopens a closed topic for a returning customer', async () => {
    await router.route(createPrivateUpdate(1, 501, 'First question'));
    await router.route(createTopicServiceUpdate(2, 'closed'));

    await router.route(createPrivateUpdate(3, 502, 'New question'));

    expect(gateway.reopened).toEqual([900]);
    expect(
      repository.findActiveRequest('telegram', '101')?.operatorTopicId,
    ).toBe('900');
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[1]?.text).toContain('New question');
  });

  it('creates a replacement only when the closed topic was deleted', async () => {
    await router.route(createPrivateUpdate(1, 501, 'First question'));
    await router.route(createTopicServiceUpdate(2, 'closed'));
    gateway.unavailableTopics.add(900);

    await router.route(createPrivateUpdate(3, 502, 'New question'));

    expect(gateway.reopened).toHaveLength(0);
    expect(
      repository.findActiveRequest('telegram', '101')?.operatorTopicId,
    ).toBe('901');
    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[1]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 901,
    });
    expect(gateway.sent[1]?.text).toContain('New question');
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
