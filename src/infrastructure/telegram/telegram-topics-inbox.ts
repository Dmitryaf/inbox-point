import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import type {
  OpenOperatorRequest,
  OperatorInbox,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import {
  OperatorActionOutcomeUnknownError,
  OperatorConversationUnavailableError,
} from '@/core/contracts/operator-inbox.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { OperatorActionStore } from '@/core/contracts/support-repository.js';
import type { PendingOperatorAction } from '@/core/model/operator-action.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { createWebOperatorTopicId } from '@/core/model/operator-topic.js';

import {
  isMissingForumTopicError,
  isUnavailableForumTopicError,
  type TelegramGateway,
} from './telegram-api-client.js';

export class TelegramTopicsInbox
  implements OperatorInbox, DeliveryIncidentNotifier
{
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly operatorChatId: number,
    private readonly actions: OperatorActionStore,
    private readonly clock: () => Date = () => new Date(),
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
    const actionId = `operator-open:${request.requestId}`;
    const topicId = await this.executeAction(
      {
        clientMessageId: request.source.externalMessageId,
        createdAt: this.clock(),
        id: actionId,
        initial: true,
        kind: 'open_request',
        operatorTopicId: createWebOperatorTopicId(request.requestId),
        requestId: request.requestId,
        sequence: 0,
      },
      'open',
      async () => {
        if (request.reusableTopicId) {
          try {
            await this.gateway.reopenForumTopic(
              this.operatorChatId,
              Number(request.reusableTopicId),
            );
            return request.reusableTopicId;
          } catch (error: unknown) {
            if (!isMissingForumTopicError(error)) {
              throw error;
            }
          }
        }
        const topic = await this.gateway.createForumTopic(
          this.operatorChatId,
          request.title,
        );
        return String(topic.topicId);
      },
    );
    return { topicId };
  }

  public async notifyDeliveryFailure(delivery: FailedDelivery): Promise<void> {
    await this.gateway.sendMessage({
      chatId: this.operatorChatId,
      messageThreadId: Number(delivery.operatorTopicId),
      text: formatDeliveryFailureNotification(delivery),
    });
  }

  public async relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    try {
      const operatorMessageIds: string[] = [];
      const firstAction = this.actions.prepareOperatorAction(
        createRelayAction(operatorTopicId, message, options, 0, this.clock()),
      );
      const effectiveOptions = { ...options, initial: firstAction.initial };
      const messages = formatCustomerMessages(message, effectiveOptions);
      const actions = messages.map((_, sequence) =>
        createRelayAction(
          operatorTopicId,
          message,
          effectiveOptions,
          sequence,
          this.clock(),
        ),
      );
      for (const action of actions) {
        this.actions.prepareOperatorAction(action);
      }

      let outcomeUnknown: OperatorActionOutcomeUnknownError | undefined;
      for (const [sequence, text] of messages.entries()) {
        try {
          const operatorMessageId = await this.executeAction(
            actions[sequence] ??
              createRelayAction(
                operatorTopicId,
                message,
                effectiveOptions,
                sequence,
                this.clock(),
              ),
            'relay',
            async () => {
              const sent = await this.gateway.sendMessage({
                chatId: this.operatorChatId,
                messageThreadId: Number(operatorTopicId),
                text,
              });
              return String(sent.messageId);
            },
          );
          operatorMessageIds.push(operatorMessageId);
        } catch (error: unknown) {
          if (error instanceof OperatorActionOutcomeUnknownError) {
            outcomeUnknown ??= error;
            continue;
          }
          if (outcomeUnknown) {
            throw outcomeUnknown;
          }
          throw error;
        }
      }
      if (outcomeUnknown) {
        throw outcomeUnknown;
      }
      return { operatorMessageIds, operatorTopicId };
    } catch (error: unknown) {
      if (isUnavailableForumTopicError(error)) {
        throw new OperatorConversationUnavailableError();
      }
      throw error;
    }
  }

  private async executeAction(
    action: PendingOperatorAction,
    operation: 'open' | 'relay',
    execute: () => Promise<string>,
  ): Promise<string> {
    const prepared = this.actions.prepareOperatorAction(action);
    if (prepared.status === 'sent' && prepared.externalResultId) {
      return prepared.externalResultId;
    }
    if (
      prepared.status === 'outcome_unknown' ||
      prepared.status === 'sending'
    ) {
      throw new OperatorActionOutcomeUnknownError(action.id, operation);
    }
    if (!this.actions.claimOperatorAction(action.id, this.clock())) {
      throw new Error('Operator action could not be claimed');
    }

    let externalResultId: string;
    try {
      externalResultId = await execute();
    } catch (error: unknown) {
      if (error instanceof DeliveryOutcomeUnknownError) {
        this.actions.markOperatorActionOutcomeUnknown(
          action.id,
          safeErrorMessage(error),
        );
        throw new OperatorActionOutcomeUnknownError(action.id, operation);
      }
      this.actions.markOperatorActionFailed(action.id, safeErrorMessage(error));
      throw error;
    }

    try {
      this.actions.completeOperatorAction(
        action.id,
        externalResultId,
        this.clock(),
      );
    } catch {
      this.actions.markOperatorActionOutcomeUnknown(
        action.id,
        'Telegram accepted the operation but persistence failed',
      );
      throw new OperatorActionOutcomeUnknownError(action.id, operation);
    }
    return externalResultId;
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

function createRelayActionId(
  requestId: string,
  clientMessageId: string,
  sequence: number,
): string {
  return `operator-relay:${requestId}:${clientMessageId}:${sequence}`;
}

function createRelayAction(
  operatorTopicId: string,
  message: SupportMessage,
  options: RelayCustomerMessageOptions,
  sequence: number,
  createdAt: Date,
): PendingOperatorAction {
  return {
    clientMessageId: message.externalMessageId,
    createdAt,
    id: createRelayActionId(
      options.requestId,
      message.externalMessageId,
      sequence,
    ),
    initial: options.initial,
    kind: 'relay_message',
    operatorTopicId,
    requestId: options.requestId,
    sequence,
  };
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : 'Unknown operator action error';
}

const telegramTextLimit = 4_096;

function formatDeliveryFailureNotification(delivery: FailedDelivery): string {
  const channelName = delivery.channel === 'telegram' ? 'Telegram' : 'VK';
  const messageReference = delivery.operatorMessageId
    ? `\nСообщение оператора: ${delivery.operatorMessageId}`
    : '';

  if (delivery.outcomeUnknown) {
    return [
      '⚠️ Не удалось подтвердить доставку ответа.',
      '',
      `Канал: ${channelName}${messageReference}`,
      '',
      'Не отправляйте ответ повторно вслепую. Владелец должен уточнить получение и разрешить инцидент в /ops.',
    ].join('\n');
  }

  return [
    '⚠️ Ответ не доставлен.',
    '',
    `Канал: ${channelName}${messageReference}`,
    '',
    'Владелец может повторить доставку в /ops.',
  ].join('\n');
}

function formatCustomerMessages(
  message: SupportMessage,
  options: RelayCustomerMessageOptions,
): readonly string[] {
  const channelName = message.channel === 'telegram' ? 'Telegram' : 'VK';
  const firstPrefix = options.initial
    ? [
        `Новое обращение из ${channelName}`,
        `Отправитель: ${message.displayName}`,
        '',
        'Ответьте сообщением в этой теме.',
        'Чтобы закрыть обращение, отправьте /close.',
        '',
        'Вопрос:',
        '',
      ].join('\n')
    : 'Сообщение:\n\n';
  const continuationPrefix = 'Новое сообщение:\n\n';
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
