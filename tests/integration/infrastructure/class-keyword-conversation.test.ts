import { afterEach, describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { classGateways } from '@test/support/class-gateways.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { VkClientMenu } from '@/infrastructure/vk/vk-client-menu.js';

const repositories: SqliteSupportRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach((repository) => repository.close()),
);
const now = new Date('2026-10-11T10:00:00Z');
describe.each(['telegram', 'vk'] as const)(
  '%s configured words with an active request',
  (channel) => {
    function setup() {
      const repository = new SqliteSupportRepository(':memory:');
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
      const lastText = () =>
        channel === 'telegram'
          ? gateways.telegram.sendMessage.mock.calls.at(-1)?.[0].text
          : gateways.vk.sendMessage.mock.calls.at(-1)?.[1];
      return { repository, gateways, catalog, handle, answer, lastText };
    }
    it('opens a configured group after Menu, sends its buttons once and preserves the active request', async () => {
      const context = setup();
      await context.answer('initial', 'Здравствуйте');
      const id = context.repository.findActiveRequest(channel, '101')!.id;
      await context.handle('menu', 'Меню');
      expect(context.lastText()).toContain('Меню открыто');
      expect(await context.handle('word', ' ТЕСТОВЫЙ  ТАНЕЦ ')).toBe(true);
      expect(context.lastText()).toContain('Начинающие');
      const keyboard =
        channel === 'telegram'
          ? context.gateways.telegram.sendMessage.mock.calls.at(-1)?.[0]
              .replyMarkup
          : context.gateways.vk.sendMessage.mock.calls.at(-1)?.[3];
      expect(JSON.stringify(keyboard)).toContain('Записаться на занятие');
      expect(JSON.stringify(keyboard)).toContain('classes:signup:beginners');
      const count =
        channel === 'telegram'
          ? context.gateways.telegram.sendMessage.mock.calls.length
          : context.gateways.vk.sendMessage.mock.calls.length;
      await context.handle('word', ' ТЕСТОВЫЙ  ТАНЕЦ ');
      expect(
        channel === 'telegram'
          ? context.gateways.telegram.sendMessage.mock.calls.length
          : context.gateways.vk.sendMessage.mock.calls.length,
      ).toBe(count);
      expect(context.gateways.inbox.relayCustomerMessage).toHaveBeenCalledTimes(
        1,
      );
      expect(context.repository.findActiveRequest(channel, '101')?.id).toBe(id);
      expect(await context.handle('sentence', 'Хочу тестовый танец')).toBe(
        false,
      );
      await context.answer('sentence', 'Хочу тестовый танец');
      expect(
        context.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1].text,
      ).toBe('Хочу тестовый танец');
      const content = classContent();
      content.keywords = [];
      context.catalog.replace(content);
      expect(await context.handle('removed-word', 'Тестовый танец')).toBe(
        false,
      );
    });
    it('keeps a matching word as the pending answer, and Menu cancels that protection without closing the request', async () => {
      const context = setup();
      await context.answer('initial', 'Здравствуйте');
      await context.handle('signup', '', 'classes:signup:beginners');
      expect(await context.handle('answer', 'Тестовый танец')).toBe(false);
      await context.answer('answer', 'Тестовый танец');
      expect(
        context.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1]
          .applicationLabel,
      ).toBe('Тестовый танец / Начинающие');
      await context.handle('question', '', 'classes:question:beginners');
      expect(await context.handle('question-answer', 'Тестовый танец')).toBe(
        false,
      );
      await context.answer('question-answer', 'Тестовый танец');
      expect(
        context.gateways.inbox.relayCustomerMessage.mock.calls.at(-1)?.[1]
          .questionContext,
      ).toBe('Тестовый танец / Начинающие');
      await context.handle('signup-again', '', 'classes:signup:beginners');
      await context.handle('cancel', 'Меню');
      expect(
        context.repository.isAwaitingClientQuestion(channel, '101', now),
      ).toBe(false);
      expect(await context.handle('word-after-cancel', 'Тестовый танец')).toBe(
        true,
      );
      expect(context.lastText()).toContain('Начинающие');
      expect(context.gateways.inbox.openRequest).toHaveBeenCalledTimes(1);
      expect(context.gateways.inbox.relayCustomerMessage).toHaveBeenCalledTimes(
        3,
      );
    });
  },
);
