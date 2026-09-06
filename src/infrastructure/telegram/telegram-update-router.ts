import type { OperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';

import type { TelegramUpdate } from './telegram-types.js';
import type { TelegramClientMenuHandler } from './telegram-client-menu.js';
import type { TelegramGateway } from './telegram-api-client.js';

export interface TelegramUpdateHandler {
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
  handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
  ): Promise<void>;
  handleOperatorTopicClosed(
    externalEventId: string,
    operatorTopicId: string,
    occurredAt: Date,
  ): Promise<void>;
  handleOperatorTopicReopened(
    externalEventId: string,
    operatorTopicId: string,
  ): Promise<void>;
}

export class TelegramUpdateRouter {
  public constructor(
    private readonly handoffService: TelegramUpdateHandler,
    private readonly operatorChatId: number,
    private readonly clientMenu?: TelegramClientMenuHandler,
    private readonly notifier?: Pick<TelegramGateway, 'sendMessage'>,
  ) {}

  public async route(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (
      message?.chat.id === this.operatorChatId &&
      message.chat.type === 'supergroup' &&
      message.message_thread_id !== undefined
    ) {
      const externalEventId = String(update.update_id);
      if (message.forum_topic_closed) {
        await this.handoffService.handleOperatorTopicClosed(
          externalEventId,
          String(message.message_thread_id),
          new Date(message.date * 1_000),
        );
        return;
      }
      if (message.forum_topic_reopened) {
        await this.handoffService.handleOperatorTopicReopened(
          externalEventId,
          String(message.message_thread_id),
        );
        return;
      }
    }

    if (!message?.from || message.from.is_bot) {
      return;
    }

    const externalEventId = String(update.update_id);
    const receivedAt = new Date(message.date * 1_000);
    const operatorTopicId =
      message.chat.id === this.operatorChatId &&
      message.chat.type === 'supergroup' &&
      message.message_thread_id !== undefined
        ? message.message_thread_id
        : undefined;

    if (hasUnsupportedContent(message)) {
      if (operatorTopicId !== undefined) {
        await this.notifier?.sendMessage({
          chatId: this.operatorChatId,
          messageThreadId: operatorTopicId,
          text: operatorUnsupportedMessage,
        });
      } else if (message.chat.type === 'private') {
        await this.notifier?.sendMessage({
          chatId: message.chat.id,
          text: clientUnsupportedMessage,
        });
      }
      return;
    }

    if (!message.text || message.text.trim().length === 0) {
      return;
    }

    if (operatorTopicId !== undefined) {
      await this.handoffService.handleOperatorMessage(externalEventId, {
        externalMessageId: String(message.message_id),
        operatorTopicId: String(operatorTopicId),
        receivedAt,
        text: message.text,
      });
      return;
    }

    if (message.chat.type !== 'private') {
      return;
    }

    const handledByMenu = await this.clientMenu?.handle({
      chatId: message.chat.id,
      externalEventId,
      text: message.text,
    });
    if (handledByMenu) {
      return;
    }

    await this.handoffService.handleClientMessage(externalEventId, {
      channel: 'telegram',
      conversationId: String(message.chat.id),
      displayName: createDisplayName(message.from),
      externalMessageId: String(message.message_id),
      receivedAt,
      text: message.text,
    });
  }
}

const clientUnsupportedMessage =
  'Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.';
const operatorUnsupportedMessage =
  'Это сообщение не отправлено клиенту: сейчас поддерживаются только текстовые ответы.';

const unsupportedContentFields = [
  'animation',
  'audio',
  'contact',
  'dice',
  'document',
  'paid_media',
  'photo',
  'poll',
  'sticker',
  'story',
  'venue',
  'video',
  'video_note',
  'voice',
] as const;

function hasUnsupportedContent(
  message: NonNullable<TelegramUpdate['message']>,
): boolean {
  return unsupportedContentFields.some((field) => message[field] !== undefined);
}

interface TelegramDisplayUser {
  first_name: string;
  last_name?: string | undefined;
  username?: string | undefined;
}

function createDisplayName(user: TelegramDisplayUser): string {
  const name = [user.first_name, user.last_name]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim();
  return name || (user.username ? `@${user.username}` : 'Telegram customer');
}
