import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { classGateways } from '@test/support/class-gateways.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { defaultEnrollmentConfirmation } from '@/core/application/class-content.js';
import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import {
  DeliveryOutcomeUnknownError,
  type ClientChannel,
} from '@/core/contracts/client-channel.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { VkClientMenu } from '@/infrastructure/vk/vk-client-menu.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';

const repositories: SqliteSupportRepository[] = [];
const directories: string[] = [];
afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close());
  directories
    .splice(0)
    .forEach((directory) => rmSync(directory, { recursive: true }));
});
function setup(channel: 'telegram' | 'vk', path = ':memory:') {
  const repository = new SqliteSupportRepository(path);
  repositories.push(repository);
  const gateways = classGateways();
  const editMessageReplyMarkup = vi.fn().mockResolvedValue(undefined);
  const answerCallbackQuery = vi.fn().mockResolvedValue(undefined);
  const gateway = {
    ...gateways.telegram,
    editMessageReplyMarkup,
    answerCallbackQuery,
  };
  let messageId = 10;
  gateway.sendMessage.mockImplementation(() =>
    Promise.resolve({ messageId: ++messageId }),
  );
  const content = classContent();
  content.groups![0]!.confirmationText =
    'Запись подтверждена. Приходите за 10 минут.';
  const catalog = new ClientInformationCatalog(content);
  const runtime = new HandoffRuntime({
    repository,
    logger: { error: vi.fn() },
  });
  const inbox = new TelegramTopicsInbox(gateway, -100, repository);
  runtime.registerOperatorInbox(inbox);
  const menu =
    channel === 'telegram'
      ? new TelegramClientMenu(gateway, repository, catalog)
      : new VkClientMenu(gateways.vk, repository, catalog);
  const router = new TelegramUpdateRouter(runtime, -100, undefined, gateway);
  const outgoing = {
    kind: channel,
    send: vi
      .fn<ClientChannel['send']>()
      .mockResolvedValue({ externalMessageId: 'sent' }),
  };
  const clock = () => new Date(Date.now() + 60_000);
  const worker = new DeliveryWorker({
    repository,
    channels: [outgoing],
    incidentNotifier: inbox,
    clock,
    maxAttempts: 1,
  });
  const signup = (event = 'signup') =>
    menu.handle({
      chatId: 101,
      peerId: 101,
      externalEventId: event,
      text: '',
      action: 'classes:signup:beginners',
      payload: JSON.stringify({ action: 'classes:signup:beginners' }),
    });
  const answer = (event = 'answer') =>
    runtime.handleClientMessage(event, {
      channel,
      conversationId: '101',
      externalMessageId: event,
      displayName: 'Synthetic',
      text: 'В четверг',
      receivedAt: new Date(),
    });
  const enrollment = () => {
    const request = repository.findActiveRequest(channel, '101')!;
    const item = repository.findClassEnrollment(request.id, 'answer')!;
    const relay = gateway.sendMessage.mock.calls.findIndex(
      ([options]) =>
        options.chatId === -100 && options.replyMarkup !== undefined,
    );
    const operatorMessageId = String(
      gateway.sendMessage.mock.results[relay]!.value ? 10 + relay + 1 : 0,
    );
    return { id: item.id, topic: request.operatorTopicId, operatorMessageId };
  };
  const click = async (data = enrollment(), chatId = -100) =>
    router.route({
      update_id: 90,
      callback_query: {
        id: 'callback',
        from: { id: 9, first_name: 'Synthetic admin', is_bot: false },
        data: `enroll:${data.id}`,
        message: {
          chat: { id: chatId, type: 'supergroup' },
          message_id: Number(data.operatorMessageId),
          message_thread_id: Number(data.topic),
          date: 1,
        },
      },
    });
  const confirmations = () =>
    outgoing.send.mock.calls.filter(([message]) =>
      message.idempotencyKey.startsWith('enrollment:'),
    );
  return {
    repository,
    gateway,
    catalog,
    runtime,
    inbox,
    worker,
    outgoing,
    signup,
    answer,
    enrollment,
    click,
    confirmations,
    path,
  };
}

describe.each(['telegram', 'vk'] as const)(
  '%s enrollment confirmation',
  (channel) => {
    it('keeps the selected reply through restart before the client submits the day', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'enrollment-pending-'));
      directories.push(directory);
      const path = join(directory, 'state.sqlite');
      const first = setup(channel, path);
      await first.signup();
      first.repository.close();
      repositories.splice(repositories.indexOf(first.repository), 1);
      const restarted = setup(channel, path);
      const changed = classContent();
      changed.groups![0]!.confirmationText = 'Changed after restart';
      restarted.catalog.replace(changed);
      await restarted.answer();
      await restarted.click();
      await restarted.worker.processPending();
      await restarted.worker.processPending();
      expect(restarted.confirmations()[0]?.[0].text).toBe(
        'Запись подтверждена. Приходите за 10 минут.',
      );
    });
    it('freezes group text, adds the Telegram button, delivers once and updates it only after delivery', async () => {
      const context = setup(channel);
      await context.signup();
      const changed = classContent();
      changed.groups![0]!.confirmationText = 'Changed';
      context.catalog.replace(changed);
      await context.answer();
      const data = context.enrollment();
      expect(context.gateway.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: -100,
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: 'Подтвердить запись',
                  callback_data: `enroll:${data.id}`,
                },
              ],
            ],
          },
        }),
      );
      await Promise.all([context.click(), context.click()]);
      expect(context.gateway.editMessageReplyMarkup).not.toHaveBeenCalled();
      await context.worker.processPending();
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(1);
      expect(context.confirmations()[0]?.[0]).toMatchObject({
        conversationId: '101',
        text: 'Запись подтверждена. Приходите за 10 минут.',
      });
      expect(context.gateway.editMessageReplyMarkup).toHaveBeenCalledWith(
        -100,
        Number(data.operatorMessageId),
        {
          inline_keyboard: [
            [
              {
                text: 'Подтверждение отправлено',
                callback_data: `enroll:${data.id}`,
              },
            ],
          ],
        },
      );
      await context.click();
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(1);
      expect(
        context.repository
          .findConversationMessages(
            context.repository.findActiveRequest(channel, '101')!.id,
          )
          .filter(
            (message) =>
              message.text === 'Запись подтверждена. Приходите за 10 минут.',
          ),
      ).toHaveLength(1);
    });
    it('rejects foreign chats, topics, unrelated messages and a stale button after topic reuse', async () => {
      const context = setup(channel);
      await context.signup();
      await context.answer();
      const old = context.enrollment();
      await context.click(old, -200);
      await context.click({ ...old, topic: '999' });
      await context.click({ ...old, operatorMessageId: '999' });
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(0);
      const request = context.repository.findActiveRequest(channel, '101')!;
      context.repository.closeRequest(request.id, new Date());
      await context.signup('new-signup');
      await context.answer('new-answer');
      expect(
        context.repository.findActiveRequest(channel, '101')!.operatorTopicId,
      ).toBe(old.topic);
      await context.click(old);
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(0);
    });
    it('keeps failed or uncertain delivery unconfirmed and permits existing manual resolution', async () => {
      const context = setup(channel);
      await context.signup();
      await context.answer();
      await context.worker.processPending(); // acknowledge receipt first
      await context.click();
      context.outgoing.send.mockRejectedValueOnce(
        new DeliveryOutcomeUnknownError(channel),
      );
      await context.worker.processPending();
      expect(context.gateway.editMessageReplyMarkup).not.toHaveBeenCalled();
      await context.click();
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(1);
      const delivery = context.repository.findFailedDeliveries(10)[0]!;
      expect(delivery.outcomeUnknown).toBe(true);
      context.repository.confirmUnknownDeliveryReceived(
        delivery.id,
        new Date(),
      );
      await context.worker.processPending();
      expect(context.confirmations()).toHaveLength(1);
      expect(context.gateway.editMessageReplyMarkup).toHaveBeenCalledTimes(1);
    });
    it('survives restart and separately retries a failed button update without sending the client a second answer', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'enrollment-confirmation-'));
      directories.push(directory);
      const path = join(directory, 'state.sqlite');
      const first = setup(channel, path);
      await first.signup();
      await first.answer();
      await first.click();
      const data = first.enrollment();
      first.repository.close();
      repositories.splice(repositories.indexOf(first.repository), 1);
      const restarted = setup(channel, path);
      restarted.gateway.editMessageReplyMarkup.mockRejectedValueOnce(
        new Error('Transient edit failure'),
      );
      await restarted.worker.processPending();
      await restarted.worker.processPending();
      expect(restarted.confirmations()).toHaveLength(1);
      restarted.repository.markEnrollmentNotification(
        data.id,
        new Date(0),
        false,
      );
      await restarted.click(data);
      await restarted.worker.processPending();
      expect(restarted.confirmations()).toHaveLength(1);
      expect(restarted.gateway.editMessageReplyMarkup).toHaveBeenCalledTimes(2);
      await restarted.worker.processPending();
      expect(restarted.gateway.editMessageReplyMarkup).toHaveBeenCalledTimes(2);
    });
    it('migrates v15 pending signup, uses a default reply and keeps generic applications without a confirmation button', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'enrollment-migration-'));
      directories.push(directory);
      const path = join(directory, 'state.sqlite');
      const first = setup(channel, path);
      await first.signup();
      first.repository.close();
      repositories.splice(repositories.indexOf(first.repository), 1);
      const database = new DatabaseSync(path);
      database.exec(
        'ALTER TABLE client_conversation_states DROP COLUMN enrollment_confirmation_text; ALTER TABLE conversation_messages DROP COLUMN enrollment_confirmation_text; ALTER TABLE conversation_messages DROP COLUMN enrollment_notified_at; ALTER TABLE conversation_messages DROP COLUMN enrollment_notification_next_attempt_at; PRAGMA user_version = 15;',
      );
      database.close();
      const restarted = setup(channel, path);
      await restarted.answer();
      await restarted.click();
      await restarted.worker.processPending();
      await restarted.worker.processPending();
      expect(restarted.confirmations()[0]?.[0].text).toBe(
        defaultEnrollmentConfirmation,
      );
      restarted.repository.setAwaitingClientQuestion(
        channel,
        '101',
        new Date(),
        'Custom application',
      );
      await restarted.answer('generic-answer');
      expect(
        restarted.gateway.sendMessage.mock.calls.at(-1)?.[0].replyMarkup,
      ).toBeUndefined();
    });
  },
);
