import type { OperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';

import type { TelegramUpdate } from './telegram-types.js';

export interface TelegramUpdateHandler {
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
  handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
  ): Promise<void>;
}

export class TelegramUpdateRouter {
  public constructor(
    private readonly handoffService: TelegramUpdateHandler,
    private readonly operatorChatId: number,
  ) {}

  public async route(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (
      !message?.text ||
      !message.from ||
      message.from.is_bot ||
      message.text.trim().length === 0
    ) {
      return;
    }

    const externalEventId = String(update.update_id);
    const receivedAt = new Date(message.date * 1_000);

    if (
      message.chat.id === this.operatorChatId &&
      message.chat.type === 'supergroup' &&
      message.message_thread_id !== undefined
    ) {
      await this.handoffService.handleOperatorMessage(externalEventId, {
        externalMessageId: String(message.message_id),
        operatorTopicId: String(message.message_thread_id),
        receivedAt,
        text: message.text,
      });
      return;
    }

    if (message.chat.type !== 'private') {
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
