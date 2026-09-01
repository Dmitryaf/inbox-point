import type {
  OpenOperatorRequest,
  OperatorInbox,
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

  public async openRequest(request: OpenOperatorRequest): Promise<{
    operatorMessageId: string;
    topicId: string;
  }> {
    const topic = await this.gateway.createForumTopic(
      this.operatorChatId,
      request.title,
    );
    const sent = await this.gateway.sendMessage({
      chatId: this.operatorChatId,
      messageThreadId: topic.topicId,
      text: formatInitialMessage(request),
    });
    return {
      operatorMessageId: String(sent.messageId),
      topicId: String(topic.topicId),
    };
  }

  public async relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
  ): Promise<{ operatorMessageId: string }> {
    try {
      const sent = await this.gateway.sendMessage({
        chatId: this.operatorChatId,
        messageThreadId: Number(operatorTopicId),
        text: `Клиент:\n\n${message.text}`,
      });
      return { operatorMessageId: String(sent.messageId) };
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

function formatInitialMessage(request: OpenOperatorRequest): string {
  const channelName = request.source.channel === 'telegram' ? 'Telegram' : 'VK';
  return [
    `Новое обращение из ${channelName}`,
    `Клиент: ${request.source.displayName}`,
    '',
    'Вопрос:',
    request.source.text,
    '',
    'Ответьте сообщением в этой теме.',
    'Чтобы закрыть обращение, отправьте /close.',
  ].join('\n');
}
