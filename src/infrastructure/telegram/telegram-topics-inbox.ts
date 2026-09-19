import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import type {
  OpenOperatorRequest,
  MirrorOperatorMessageOptions,
  OperatorInbox,
  OperatorLifecycleActionOptions,
  RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import {
  OperatorActionOutcomeUnknownError,
  OperatorConversationUnavailableError,
} from '@/core/contracts/operator-inbox.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { OperatorActionStore } from '@/core/contracts/support-repository.js';
import {
  createOperatorLifecycleAction,
  type PendingOperatorAction,
} from '@/core/model/operator-action.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import type { ChannelOperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import { createWebOperatorTopicId } from '@/core/model/operator-topic.js';

import {
  isAlreadyOpenForumTopicError,
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

  public async closeRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void> {
    await this.executeAction(
      createLifecycleAction(
        'close_request',
        operatorTopicId,
        options,
        this.clock(),
      ),
      'close',
      async () => {
        try {
          await this.gateway.closeForumTopic(
            this.operatorChatId,
            Number(operatorTopicId),
          );
        } catch (error: unknown) {
          if (!isUnavailableForumTopicError(error)) {
            throw error;
          }
        }
        return operatorTopicId;
      },
    );
  }

  public async openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    const actionId = request.unavailableTopicId
      ? `operator-open-replacement:${request.requestId}:${request.unavailableTopicId}`
      : `operator-open:${request.requestId}`;
    const topicId = await this.executeAction(
      {
        clientMessageId: request.source.externalMessageId,
        createdAt: this.clock(),
        id: actionId,
        initial: true,
        kind: 'open_request',
        operatorTopicId:
          request.expectedTopicId ??
          request.unavailableTopicId ??
          createWebOperatorTopicId(request.requestId),
        requestId: request.requestId,
        sequence: 0,
      },
      'open',
      async () => {
        if (request.reusableTopicId && !request.unavailableTopicId) {
          try {
            await this.gateway.reopenForumTopic(
              this.operatorChatId,
              Number(request.reusableTopicId),
            );
            return request.reusableTopicId;
          } catch (error: unknown) {
            if (isAlreadyOpenForumTopicError(error)) {
              return request.reusableTopicId;
            }
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

  public async mirrorOperatorMessage(
    operatorTopicId: string,
    message: ChannelOperatorMessage,
    options: MirrorOperatorMessageOptions,
  ): Promise<void> {
    try {
      const messages = formatMirroredOperatorMessages(message);
      const actions = messages.map((_, sequence) =>
        createMirrorAction(
          operatorTopicId,
          message,
          options,
          sequence,
          this.clock(),
        ),
      );
      for (const action of actions) {
        this.actions.prepareOperatorAction(action);
      }

      let outcomeUnknown: OperatorActionOutcomeUnknownError | undefined;
      for (const [sequence, text] of messages.entries()) {
        const action = actions[sequence];
        if (!action) {
          throw new Error('Mirrored operator action was not prepared');
        }
        try {
          await this.executeAction(action, 'mirror', async () => {
            const sent = await this.gateway.sendMessage({
              chatId: this.operatorChatId,
              messageThreadId: Number(operatorTopicId),
              text,
            });
            return String(sent.messageId);
          });
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
    } catch (error: unknown) {
      if (isUnavailableForumTopicError(error)) {
        throw new OperatorConversationUnavailableError();
      }
      throw error;
    }
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
    operation: 'close' | 'mirror' | 'open' | 'relay' | 'reopen',
    execute: () => Promise<string>,
  ): Promise<string> {
    const prepared = this.actions.prepareOperatorAction(action);
    if (prepared.status === 'sent') {
      if (prepared.externalResultId) {
        return prepared.externalResultId;
      }
      if (operation === 'mirror') {
        return action.operatorTopicId;
      }
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

  public async reopenRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void> {
    await this.executeAction(
      createLifecycleAction(
        'reopen_request',
        operatorTopicId,
        options,
        this.clock(),
      ),
      'reopen',
      async () => {
        try {
          await this.gateway.reopenForumTopic(
            this.operatorChatId,
            Number(operatorTopicId),
          );
        } catch (error: unknown) {
          if (isAlreadyOpenForumTopicError(error)) {
            return operatorTopicId;
          }
          if (isUnavailableForumTopicError(error)) {
            throw new OperatorConversationUnavailableError();
          }
          throw error;
        }
        return operatorTopicId;
      },
    );
  }
}

function createLifecycleAction(
  kind: 'close_request' | 'reopen_request',
  operatorTopicId: string,
  options: OperatorLifecycleActionOptions,
  createdAt: Date,
): PendingOperatorAction {
  return createOperatorLifecycleAction(
    kind,
    operatorTopicId,
    options,
    createdAt,
  );
}

function createRelayActionId(
  requestId: string,
  clientMessageId: string,
  sequence: number,
  actionScope?: string,
): string {
  const scopeSuffix = actionScope ? `:${actionScope}` : '';
  return `operator-relay:${requestId}:${clientMessageId}:${sequence}${scopeSuffix}`;
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
      options.actionScope,
    ),
    initial: options.initial,
    kind: 'relay_message',
    operatorTopicId,
    requestId: options.requestId,
    sequence,
  };
}

function createMirrorAction(
  operatorTopicId: string,
  message: ChannelOperatorMessage,
  options: MirrorOperatorMessageOptions,
  sequence: number,
  createdAt: Date,
): PendingOperatorAction {
  const actionScope = options.actionScope
    ? `${options.requestId}:${options.actionScope}`
    : options.requestId;
  return {
    clientMessageId: message.externalMessageId,
    createdAt,
    id: `operator-mirror:${actionScope}:${message.channel}:${message.externalMessageId}:${sequence}`,
    initial: false,
    kind: 'mirror_operator_message',
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
    ? `\nСообщение администратора: ${delivery.operatorMessageId}`
    : '';

  if (delivery.outcomeUnknown) {
    return [
      '⚠️ Не удалось подтвердить доставку ответа.',
      '',
      `Канал: ${channelName}${messageReference}`,
      '',
      'Не отправляйте тот же ответ повторно, пока не проверите, получил ли его клиент.',
      'После проверки откройте раздел «Состояние» в Inbox Point и укажите результат.',
    ].join('\n');
  }

  return [
    '⚠️ Ответ не доставлен.',
    '',
    `Канал: ${channelName}${messageReference}`,
    '',
    'Откройте раздел «Состояние» в Inbox Point, чтобы повторить отправку.',
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
        'Первое сообщение:',
        '',
      ].join('\n')
    : 'Сообщение:\n\n';
  const continuationPrefix = 'Продолжение сообщения:\n\n';
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

function formatMirroredOperatorMessages(
  message: ChannelOperatorMessage,
): readonly string[] {
  const channelName = message.channel === 'telegram' ? 'Telegram' : 'VK';
  const firstPrefix = `Ответ администратора из ${channelName}:\n\n`;
  const continuationPrefix = `Продолжение ответа администратора из ${channelName}:\n\n`;
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
