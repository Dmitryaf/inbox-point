import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import type { TelegramGateway } from '@/infrastructure/telegram/telegram-api-client.js';
import {
  createVkMainKeyboard,
  VkClientMenu,
} from '@/infrastructure/vk/vk-client-menu.js';
import type { VkGateway } from '@/infrastructure/vk/vk-api-client.js';

const stores: SqliteSupportRepository[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.close()));
function setup() {
  const repository = new SqliteSupportRepository(':memory:');
  stores.push(repository);
  const information = new ClientInformationCatalog({
    prices: '500',
    address: 'Тестовый адрес',
    schedule: [{ title: 'Тест', dayTime: 'Пн 19:00' }],
    faq: [{ question: 'Вопрос?', answer: 'Ответ.' }],
    customSections: [
      { id: 'stable-id', label: 'Пробное занятие', text: 'Тестовый ответ.' },
    ],
  });
  const telegram = {
    closeForumTopic: vi
      .fn<TelegramGateway['closeForumTopic']>()
      .mockResolvedValue(undefined),
    createForumTopic: vi
      .fn<TelegramGateway['createForumTopic']>()
      .mockResolvedValue({ topicId: 1 }),
    reopenForumTopic: vi
      .fn<TelegramGateway['reopenForumTopic']>()
      .mockResolvedValue(undefined),
    getUpdates: vi.fn<TelegramGateway['getUpdates']>().mockResolvedValue([]),
    sendMessage: vi
      .fn<TelegramGateway['sendMessage']>()
      .mockResolvedValue({ messageId: 1 }),
  };
  const vk = {
    getLongPollServer: vi
      .fn<VkGateway['getLongPollServer']>()
      .mockResolvedValue({
        key: 'synthetic',
        server: 'https://example.test',
        ts: '1',
      }),
    getUserDisplayName: vi
      .fn<VkGateway['getUserDisplayName']>()
      .mockResolvedValue('Synthetic'),
    poll: vi
      .fn<VkGateway['poll']>()
      .mockResolvedValue({ ts: '1', updates: [] }),
    sendMessage: vi
      .fn<VkGateway['sendMessage']>()
      .mockResolvedValue({ externalMessageId: '1' }),
  };
  const clock = () => new Date('2026-10-04T12:00:00Z');
  return { repository, information, telegram, vk, clock };
}
const choices = [
  ['Расписание', 'schedule'],
  ['Цены', 'prices'],
  ['Адрес', 'address'],
  ['Частые вопросы', 'faq'],
  ['Пробное занятие', 'custom:stable-id'],
  ['Задать вопрос', 'handoff'],
  ['Начать новый вопрос', 'new_question'],
] as const;

describe('menu analytics in both channels', () => {
  it.each(['telegram', 'vk'] as const)(
    'records stable actions separately from requests in %s without duplicates',
    async (channel) => {
      const context = setup();
      const menu =
        channel === 'telegram'
          ? new TelegramClientMenu(
              context.telegram,
              context.repository,
              context.information,
              undefined,
              context.clock,
            )
          : new VkClientMenu(
              context.vk,
              context.repository,
              context.information,
              undefined,
              context.clock,
            );
      for (const [text, key] of choices) {
        const message = {
          chatId: 101,
          peerId: 101,
          text,
          externalEventId: key,
          payload: JSON.stringify({ action: key }),
        };
        expect(await menu.handle(message)).toBe(true);
        expect(await menu.handle(message)).toBe(true);
      }
      const report = context.repository.getUsageAnalytics(
        new Date('2026-10-01'),
        context.clock(),
      );
      expect(report.channels[channel]).toEqual({ menuActions: 7, requests: 0 });
      expect(report.actions.map((action) => action.key).sort()).toEqual(
        choices.map((choice) => choice[1]).sort(),
      );
      expect(
        context.repository.getUsageEventCounts(new Date('2026-01-01'))
          .information_section,
      ).toBe(0);
      await menu.handle({
        chatId: 101,
        peerId: 101,
        text: '/menu',
        externalEventId: 'command',
      });
      expect(
        context.repository.getUsageEventCounts(new Date('2026-01-01'))
          .menu_action,
      ).toBe(7);
    },
  );

  it.each(['telegram', 'vk'] as const)(
    'counts the choice once when sending the response fails and %s retries',
    async (channel) => {
      const context = setup();
      const gateway = channel === 'telegram' ? context.telegram : context.vk;
      vi.mocked(gateway.sendMessage).mockRejectedValueOnce(
        new Error('Synthetic transport failure'),
      );
      const menu =
        channel === 'telegram'
          ? new TelegramClientMenu(
              context.telegram,
              context.repository,
              context.information,
              undefined,
              context.clock,
            )
          : new VkClientMenu(
              context.vk,
              context.repository,
              context.information,
              undefined,
              context.clock,
            );
      const message = {
        chatId: 101,
        peerId: 101,
        text: 'Цены',
        externalEventId: 'retry',
        payload: JSON.stringify({ action: 'prices' }),
      };
      await expect(menu.handle(message)).rejects.toThrow('Synthetic');
      expect(
        context.repository.getUsageEventCounts(new Date('2026-01-01'))
          .menu_action,
      ).toBe(1);
      expect(await menu.handle(message)).toBe(true);
      expect(await menu.handle(message)).toBe(true);
      expect(
        context.repository.getUsageEventCounts(new Date('2026-01-01'))
          .menu_action,
      ).toBe(1);
      expect(gateway.sendMessage).toHaveBeenCalledTimes(2);
    },
  );

  it('uses VK keys after renaming and reordering, supports old payloads, and rejects removed keys', async () => {
    const context = setup();
    const menu = new VkClientMenu(
      context.vk,
      context.repository,
      context.information,
      undefined,
      context.clock,
    );
    const payload = JSON.stringify({ action: 'custom:stable-id' });
    const keyboard = createVkMainKeyboard(context.information);
    expect(
      keyboard.buttons
        .flat()
        .map(
          (button) => JSON.parse(button.action.payload) as { action: string },
        ),
    ).toContainEqual({ action: 'custom:stable-id' });
    context.information.replace({
      customSections: [
        { id: 'other-id', label: 'Другой раздел', text: 'Другой ответ.' },
        {
          id: 'stable-id',
          label: 'Записаться на пробное',
          text: 'Новый ответ.',
        },
      ],
      prices: '500',
    });
    await menu.handle({
      peerId: 101,
      text: 'Пробное занятие',
      payload,
      externalEventId: 'renamed',
    });
    expect(context.vk.sendMessage).toHaveBeenLastCalledWith(
      101,
      'Новый ответ.',
      expect.any(Number),
      expect.any(Object),
    );
    await menu.handle({
      peerId: 101,
      text: 'Цены',
      payload: JSON.stringify({ action: 'information-0' }),
      externalEventId: 'legacy-keyboard',
    });
    context.information.replace({});
    await menu.handle({
      peerId: 101,
      text: 'Задать вопрос',
      payload,
      externalEventId: 'removed',
    });
    expect(
      context.repository.getUsageEventCounts(new Date('2026-01-01'))
        .menu_action,
    ).toBe(2);
    expect(context.repository.findActiveRequest('vk', '101')).toBeUndefined();
    expect(
      context.repository.isAwaitingClientQuestion('vk', '101', context.clock()),
    ).toBe(false);
  });
});
