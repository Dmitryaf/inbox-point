import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { classGateways } from '@test/support/class-gateways.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';
import {
  TelegramKeyboardError,
  TelegramCallbackExpiredError,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { VkClientMenu } from '@/infrastructure/vk/vk-client-menu.js';
import { VkApiError } from '@/infrastructure/vk/vk-api-client.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

const repositories: SqliteSupportRepository[] = [];
const directories: string[] = [];
afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close());
  directories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true }));
});
const now = new Date('2026-10-10T10:00:00Z');
function setup(channel: 'telegram' | 'vk', path = ':memory:') {
  const repository = new SqliteSupportRepository(path);
  repositories.push(repository);
  const gateways = classGateways();
  const catalog = new ClientInformationCatalog(classContent());
  const menu =
    channel === 'telegram'
      ? new TelegramClientMenu(
          gateways.telegram,
          repository,
          catalog,
          undefined,
          () => now,
        )
      : new VkClientMenu(
          gateways.vk,
          repository,
          catalog,
          undefined,
          () => now,
        );
  const handle = (event: string, text: string, action?: string) =>
    menu.handle({
      chatId: 101,
      peerId: 101,
      externalEventId: event,
      text,
      ...(action ? { action, payload: JSON.stringify({ action }) } : {}),
    });
  const service = new HandoffService({
    repository,
    operatorInbox: gateways.inbox,
    clock: () => now,
  });
  const answer = (event: string, text: string) =>
    service.handleClientMessage(event, {
      channel,
      conversationId: '101',
      externalMessageId: event,
      displayName: 'Synthetic',
      receivedAt: now,
      text,
    });
  return { repository, gateways, catalog, menu, handle, service, answer };
}
describe.each(['telegram', 'vk'] as const)('%s class enrollment', (channel) => {
  it('upgrades a v13 database without losing a pending application', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-schema-'));
    directories.push(directory);
    const path = join(directory, 'support.sqlite');
    const first = setup(channel, path);
    await first.handle('signup', '', 'classes:signup:beginners');
    first.repository.close();
    repositories.splice(repositories.indexOf(first.repository), 1);
    const database = new DatabaseSync(path);
    database.exec(
      'ALTER TABLE client_conversation_states DROP COLUMN question_context; ALTER TABLE conversation_messages DROP COLUMN question_context; PRAGMA user_version = 13;',
    );
    database.close();
    const restarted = setup(channel, path);
    expect(
      restarted.repository.findAwaitingApplicationLabel(channel, '101', now),
    ).toBe('Тестовый танец / Начинающие');
    await restarted.answer('existing-application', 'Приду');
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1]
        .applicationLabel,
    ).toBe('Тестовый танец / Начинающие');
    await restarted.handle('question', '', 'classes:question:beginners');
    await restarted.answer('new-question', 'А обувь?');
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1]
        .questionContext,
    ).toBe('Тестовый танец / Начинающие');
  });
  it('recovers a question after relay failure without consuming the next selected group', async () => {
    const context = setup(channel);
    await context.answer('initial', 'Здравствуйте');
    await context.handle('question', '', 'classes:question:beginners');
    context.gateways.inbox.relayCustomerMessage.mockRejectedValueOnce(
      new Error('Synthetic relay failure'),
    );
    await expect(
      context.answer('question-failed', 'Без пары?'),
    ).rejects.toThrow('Synthetic relay failure');
    expect(
      context.repository.findAwaitingQuestionContext(channel, '101', now),
    ).toBeUndefined();
    await context.handle('next', '', 'classes:signup:beginners');
    await context.answer('question-failed', 'Без пары?');
    expect(
      context.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1],
    ).toMatchObject({
      text: 'Вопрос о группе: Тестовый танец / Начинающие\n\nБез пары?',
      questionContext: 'Тестовый танец / Начинающие',
    });
    expect(
      context.repository.findAwaitingApplicationLabel(channel, '101', now),
    ).toBe('Тестовый танец / Начинающие');
  });
  it('persists a group question across restart, sends its context once and never counts it as an application', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-question-'));
    directories.push(directory);
    const path = join(directory, 'support.sqlite');
    const first = setup(channel, path);
    await first.handle('question', '', 'classes:question:beginners');
    expect(await first.handle('keyword-answer', 'Тестовый танец')).toBe(false);
    first.repository.close();
    repositories.splice(repositories.indexOf(first.repository), 1);
    const restarted = setup(channel, path);
    const content = classContent();
    content.groups![0]!.name = 'Переименована';
    restarted.catalog.replace(content);
    await restarted.answer('question-answer', 'Можно без пары?');
    await restarted.answer('question-answer', 'Можно без пары?');
    expect(restarted.gateways.inbox.relayCustomerMessage).toHaveBeenCalledTimes(
      1,
    );
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1],
    ).toMatchObject({
      text: 'Вопрос о группе: Тестовый танец / Начинающие\n\nМожно без пары?',
      questionContext: 'Тестовый танец / Начинающие',
    });
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1]
        .applicationLabel,
    ).toBeUndefined();
    expect(
      restarted.repository
        .getUsageAnalytics(new Date('2026-10-10'), now)
        .actions.some((action) => action.key.startsWith('application:')),
    ).toBe(false);
    expect(
      restarted.repository.findAwaitingQuestionContext(channel, '101', now),
    ).toBeUndefined();
    await restarted.answer('ordinary', 'Спасибо');
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1].text,
    ).toBe('Спасибо');
  });
  it('clears group context on Menu and on choosing a generic administrator question', async () => {
    const context = setup(channel);
    await context.handle('question', '', 'classes:question:beginners');
    await context.handle('cancel', 'Меню');
    expect(
      context.repository.findAwaitingQuestionContext(channel, '101', now),
    ).toBeUndefined();
    await context.handle('again', '', 'classes:question:beginners');
    context.repository.setAwaitingClientQuestion(channel, '101', now);
    await context.answer('generic', 'Общий вопрос');
    expect(
      context.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1].text,
    ).toBe('Общий вопрос');
  });
  it('opens the group in a new/old dialogue, carries selection into one administrator request and counts submission once', async () => {
    const context = setup(channel);
    await context.handle('keyword', ' ТЕСТОВЫЙ   ТАНЕЦ ');
    if (channel === 'vk') {
      expect(context.gateways.vk.sendMessage.mock.calls[0]?.[3]?.inline).toBe(
        true,
      );
    } else {
      expect(
        context.gateways.telegram.sendMessage.mock.calls[0]?.[0].replyMarkup,
      ).toHaveProperty('inline_keyboard');
    }
    await context.handle(
      'signup',
      'Записаться на занятие',
      'classes:signup:beginners',
    );
    expect(await context.handle('answer-text', 'Тестовый танец')).toBe(false);
    await context.answer('answer-text', 'Тестовый танец');
    await context.answer('answer-text', 'Тестовый танец');
    expect(context.gateways.inbox.openRequest).toHaveBeenCalledTimes(1);
    expect(context.gateways.inbox.relayCustomerMessage).toHaveBeenCalledTimes(
      1,
    );
    expect(
      context.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1],
    ).toMatchObject({
      channel,
      text: 'Заявка: Тестовый танец / Начинающие\n\nТестовый танец',
    });
    expect(await context.handle('active-keyword', 'Тестовый танец')).toBe(
      false,
    );
    const request = context.repository.findActiveRequest(channel, '101')!;
    const actions = context.repository.getUsageAnalytics(
      new Date('2026-10-10'),
      now,
    ).actions;
    expect(
      actions.find((item) => item.key.startsWith('application:'))?.count,
    ).toBe(1);
    expect(actions.find((item) => item.key === 'signup:beginners')?.count).toBe(
      1,
    );
    context.repository.closeRequest(request.id, now);
    await context.handle('old-keyword', 'Тестовый танец');
    await context.handle('old-signup', '', 'classes:signup:beginners');
    await context.answer('old-answer', 'Хочу прийти в четверг');
    expect(
      context.gateways.inbox.openRequest.mock.calls.at(-1)?.[0].reusableTopicId,
    ).toBe('topic-1');
  });
  it('keeps the selected group and deduplication after restart and after a group rename', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'inbox-point-enrollment-'));
    directories.push(directory);
    const path = join(directory, 'support.sqlite');
    const first = setup(channel, path);
    await first.handle('signup', '', 'classes:signup:beginners');
    first.repository.close();
    repositories.splice(repositories.indexOf(first.repository), 1);
    const restarted = setup(channel, path);
    const content = classContent();
    content.groups![0]!.name = 'Другое название';
    restarted.catalog.replace(content);
    await restarted.handle('signup', '', 'classes:signup:beginners');
    expect(restarted.gateways.telegram.sendMessage).not.toHaveBeenCalled();
    expect(restarted.gateways.vk.sendMessage).not.toHaveBeenCalled();
    await restarted.answer('after-restart', 'В понедельник');
    expect(
      restarted.gateways.inbox.relayCustomerMessage.mock.calls[0]?.[1]
        .applicationLabel,
    ).toBe('Тестовый танец / Начинающие');
  });
  it('cancels pending entry through Menu, handles closed enrollment and keeps old information available', async () => {
    const context = setup(channel);
    await context.handle('signup', '', 'classes:signup:beginners');
    await context.handle('cancel', 'мЕнЮ');
    expect(
      context.repository.findAwaitingApplicationLabel(channel, '101', now),
    ).toBeUndefined();
    const content = classContent();
    content.groups![0]!.enrollmentOpen = false;
    context.catalog.replace(content);
    await context.handle('closed-signup', '', 'classes:signup:beginners');
    expect(
      context.repository.isAwaitingClientQuestion(channel, '101', now),
    ).toBe(false);
    await context.handle('prices', 'Цены', 'prices');
    await context.handle('address', 'Адрес', 'address');
    await context.handle('legacy', '', 'classes:legacy');
    expect(
      context.repository.findActiveRequest(channel, '101'),
    ).toBeUndefined();
  });
  it('sends usable text when a keyboard is rejected and never falls back on uncertain transport errors', async () => {
    const context = setup(channel);
    if (channel === 'vk') {
      context.gateways.vk.sendMessage.mockRejectedValueOnce(
        new VkApiError(911, 'messages.send'),
      );
    } else {
      context.gateways.telegram.sendMessage.mockRejectedValueOnce(
        new TelegramKeyboardError('Synthetic rejection'),
      );
    }
    await context.handle('fallback', 'Тестовый танец');
    const text =
      channel === 'vk'
        ? context.gateways.vk.sendMessage.mock.calls.at(-1)?.[1]
        : context.gateways.telegram.sendMessage.mock.calls.at(-1)?.[0].text;
    expect(text).toContain('Кнопки недоступны');
    expect(text).toContain('Записаться: Тестовый танец / Начинающие');
    await context.handle(
      'text-signup',
      'Записаться: Тестовый танец / Начинающие',
    );
    expect(
      context.repository.findAwaitingApplicationLabel(channel, '101', now),
    ).toBe('Тестовый танец / Начинающие');
    const gateway =
      channel === 'vk' ? context.gateways.vk : context.gateways.telegram;
    gateway.sendMessage.mockRejectedValueOnce(
      new Error('Synthetic transport failure'),
    );
    await expect(
      context.handle('failed', '', 'classes:group:beginners'),
    ).rejects.toThrow('Synthetic transport failure');
  });
});
it('routes only private owner callbacks through client navigation and acknowledges them', async () => {
  const context = setup('telegram');
  const router = new TelegramUpdateRouter(
    context.service,
    -999,
    context.menu as TelegramClientMenu,
    context.gateways.telegram,
  );
  const callback = {
    id: 'query',
    data: 'classes:group:beginners',
    from: { id: 101, first_name: 'Synthetic', is_bot: false },
    message: {
      message_id: 1,
      date: 1,
      chat: { id: 101, type: 'private' as const },
    },
  };
  await router.route({ update_id: 1, callback_query: callback });
  expect(context.gateways.telegram.answerCallbackQuery).toHaveBeenCalledWith(
    'query',
  );
  await router.route({
    update_id: 2,
    callback_query: { ...callback, from: { ...callback.from, id: 102 } },
  });
  expect(context.gateways.telegram.sendMessage).toHaveBeenCalledTimes(1);
  context.gateways.telegram.answerCallbackQuery.mockRejectedValueOnce(
    new TelegramCallbackExpiredError('Synthetic expired query'),
  );
  await expect(
    router.route({ update_id: 3, callback_query: callback }),
  ).resolves.toBeUndefined();
  expect(context.gateways.telegram.sendMessage).toHaveBeenCalledTimes(2);
});
