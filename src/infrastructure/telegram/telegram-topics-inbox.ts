import type {
  OpenOperatorRequest,
  OperatorInbox,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import { OperatorConversationUnavailableError } from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';

import {
  isUnavailableForumTopicError,
  type TelegramGateway,
} from './telegram-api-client.js';

export class TelegramTopicsInbox implements OperatorInbox {
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly operatorChatId: number,
  ) {}

  public async closeRequest(operatorTopicId: string): Promise<void> {
    await this.gateway.closeForumTopic(
      this.operatorChatId,
      Number(operatorTopicId),
    );
  }

  public async openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    const topic = await this.gateway.createForumTopic(
      this.operatorChatId,
      request.title,
    );
    return { topicId: String(topic.topicId) };
  }

  public async relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{ operatorMessageIds: readonly string[] }> {
    try {
      const operatorMessageIds: string[] = [];
      for (const text of formatCustomerMessages(message, options)) {
        const sent = await this.gateway.sendMessage({
          chatId: this.operatorChatId,
          messageThreadId: Number(operatorTopicId),
          text,
        });
        operatorMessageIds.push(String(sent.messageId));
      }
      return { operatorMessageIds };
    } catch (error: unknown) {
      if (isUnavailableForumTopicError(error)) {
        throw new OperatorConversationUnavailableError();
      }
      throw error;
    }
  }

  public async reopenRequest(operatorTopicId: string): Promise<void> {
    try {
      await this.gateway.reopenForumTopic(
        this.operatorChatId,
        Number(operatorTopicId),
      );
    } catch (error: unknown) {
      if (isUnavailableForumTopicError(error)) {
        throw new OperatorConversationUnavailableError();
      }
      throw error;
    }
  }
}

const telegramTextLimit = 4_096;

function formatCustomerMessages(
  message: SupportMessage,
  options: RelayCustomerMessageOptions,
): readonly string[] {
  const channelName = message.channel === 'telegram' ? 'Telegram' : 'VK';
  const firstPrefix = options.initial
    ? [
        `Новое обращение из ${channelName}`,
        `Клиент: ${message.displayName}`,
        '',
        'Ответьте сообщением в этой теме.',
        'Чтобы закрыть обращение, отправьте /close.',
        '',
        'Вопрос:',
        '',
      ].join('\n')
    : 'Клиент:\n\n';
  const continuationPrefix = 'Клиент (продолжение):\n\n';
  const characters = Array.from(message.text);
  const messages: string[] = [];
  let offset = 0;
  let prefix = firstPrefix;

  while (offset < characters.length) {
    const capacity = telegramTextLimit - Array.from(prefix).length;
    const chunk = characters.slice(offset, offset + capacity).join('');
    messages.push(prefix + chunk);
    offset += capacity;
    prefix = continuationPrefix;
  }

  return messages;
}
