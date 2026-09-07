import { randomUUID } from 'node:crypto';

import { KeyedTaskQueue } from '@/core/application/keyed-task-queue.js';
import {
  OperatorConversationUnavailableError,
  type OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorMessage } from '@/core/model/operator-message.js';
import { isWebOperatorTopic } from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export interface HandoffServiceDependencies {
  clock?: () => Date;
  createId?: () => string;
  operatorInbox: OperatorInbox;
  repository: SupportRepository;
}

export const handoffAcknowledgement =
  'Сообщение отправлено оператору. Ответ появится в этом чате.';

export class HandoffService {
  private readonly clientMessageQueue = new KeyedTaskQueue();
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly operatorInbox: OperatorInbox;
  private readonly repository: SupportRepository;

  public constructor(dependencies: HandoffServiceDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.operatorInbox = dependencies.operatorInbox;
    this.repository = dependencies.repository;
  }

  public async handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void> {
    const conversationKey = createConversationKey(message);

    await this.clientMessageQueue.run(conversationKey, async () => {
      await this.handleEvent(
        `client:${message.channel}`,
        externalEventId,
        async () => {
          await this.processClientMessage(message);
        },
      );
    });
  }

  private async processClientMessage(message: SupportMessage): Promise<void> {
    const existingRequest = this.repository.findActiveRequest(
      message.channel,
      message.conversationId,
    );

    if (existingRequest) {
      try {
        await this.relayClientMessage(existingRequest, message);
        return;
      } catch (error: unknown) {
        if (!(error instanceof OperatorConversationUnavailableError)) {
          throw error;
        }
        this.repository.closeRequest(existingRequest.id, this.clock());
      }
    }

    const previousRequest = this.repository.findLatestRequest(
      message.channel,
      message.conversationId,
    );
    if (
      previousRequest?.status === 'closed' &&
      !isWebOperatorTopic(previousRequest.operatorTopicId)
    ) {
      try {
        await this.operatorInbox.reopenRequest(previousRequest.operatorTopicId);
        this.repository.reopenRequest(previousRequest.id);
        await this.relayClientMessage(previousRequest, message);
        return;
      } catch (error: unknown) {
        if (!(error instanceof OperatorConversationUnavailableError)) {
          throw error;
        }
        this.repository.closeRequest(previousRequest.id, this.clock());
      }
    }

    await this.openClientRequest(message);
  }

  private async relayClientMessage(
    request: {
      id: string;
      operatorTopicId: string;
    },
    message: SupportMessage,
    initial = false,
  ): Promise<void> {
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'client_to_operator',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId: request.id,
      senderName: message.displayName,
      text: message.text,
    });
    const relayed = await this.operatorInbox.relayCustomerMessage(
      request.operatorTopicId,
      message,
      { initial, requestId: request.id },
    );
    if (relayed.operatorTopicId !== request.operatorTopicId) {
      const switched = this.repository.switchOperatorTopic(
        request.id,
        request.operatorTopicId,
        relayed.operatorTopicId,
      );
      if (!switched) {
        const current = this.repository.findRequestById(request.id);
        if (current?.operatorTopicId !== relayed.operatorTopicId) {
          throw new Error('The operator surface changed concurrently');
        }
      }
      if (
        isWebOperatorTopic(relayed.operatorTopicId) &&
        !isWebOperatorTopic(request.operatorTopicId)
      ) {
        this.recordWebTakeover(request.id, message.channel);
      }
    }
    for (const operatorMessageId of relayed.operatorMessageIds) {
      this.repository.addMessageLink({
        clientMessageId: message.externalMessageId,
        createdAt: this.clock(),
        direction: 'client_to_operator',
        id: this.createId(),
        operatorMessageId,
        requestId: request.id,
      });
    }
    this.enqueueHandoffAcknowledgement(request.id, message);
  }

  private enqueueHandoffAcknowledgement(
    requestId: string,
    message: SupportMessage,
  ): void {
    const deliveryId = `system:handoff-ack:${requestId}`;
    this.repository.enqueueDelivery({
      channel: message.channel,
      conversationId: message.conversationId,
      createdAt: this.clock(),
      id: deliveryId,
      idempotencyKey: deliveryId,
      operatorMessageId: deliveryId,
      requestId,
      text: handoffAcknowledgement,
    });
  }

  private async openClientRequest(message: SupportMessage): Promise<void> {
    const requestId = this.createId();
    const opened = await this.operatorInbox.openRequest({
      requestId,
      source: message,
      title: createTopicTitle(message.channel, message.displayName),
    });
    const createdAt = this.clock();

    this.repository.createRequest({
      channel: message.channel,
      conversationId: message.conversationId,
      createdAt,
      displayName: message.displayName,
      id: requestId,
      operatorTopicId: opened.topicId,
      status: 'active',
    });
    this.repository.recordPilotEvent({
      channel: message.channel,
      id: `new-request:${requestId}`,
      occurredAt: createdAt,
      requestId,
      type: 'new_request',
    });
    if (isWebOperatorTopic(opened.topicId)) {
      this.recordWebTakeover(requestId, message.channel);
    }
    await this.relayClientMessage(
      { id: requestId, operatorTopicId: opened.topicId },
      message,
      true,
    );
  }

  public async handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
    source = 'operator:telegram',
  ): Promise<void> {
    await this.handleEvent(source, externalEventId, async () => {
      const request = this.repository.findRequestByTopicId(
        message.operatorTopicId,
      );

      if (!request) {
        return;
      }

      const command = parseOperatorCommand(message.text);
      if (command === 'close') {
        this.repository.closeRequest(request.id, this.clock());
        await this.operatorInbox.closeRequest(request.operatorTopicId);
        return;
      }

      if (command === 'reopen') {
        if (!this.canReopenRequest(request)) {
          await this.operatorInbox.closeRequest(request.operatorTopicId);
          return;
        }
        await this.operatorInbox.reopenRequest(request.operatorTopicId);
        this.repository.reopenRequest(request.id);
        return;
      }

      if (request.status === 'closed') {
        return;
      }

      const idempotencyKey = `operator:${externalEventId}`;
      const occurredAt = this.clock();
      this.repository.recordPilotEvent({
        channel: request.channel,
        id: `first-reply:${request.id}`,
        occurredAt,
        requestId: request.id,
        type: 'first_reply',
      });
      this.repository.recordConversationMessage({
        createdAt: message.receivedAt,
        direction: 'operator_to_client',
        externalMessageId: message.externalMessageId,
        id: this.createId(),
        requestId: request.id,
        text: message.text,
      });
      this.repository.enqueueDelivery({
        channel: request.channel,
        conversationId: request.conversationId,
        createdAt: occurredAt,
        id: this.createId(),
        idempotencyKey,
        operatorMessageId: message.externalMessageId,
        requestId: request.id,
        text: message.text,
      });
    });
  }

  private recordWebTakeover(
    requestId: string,
    channel: SupportMessage['channel'],
  ): void {
    this.repository.recordPilotEvent({
      channel,
      id: `web-takeover:${requestId}`,
      occurredAt: this.clock(),
      requestId,
      type: 'web_takeover',
    });
  }

  public async handleOperatorTopicClosed(
    externalEventId: string,
    operatorTopicId: string,
    occurredAt: Date,
  ): Promise<void> {
    await this.handleEvent('operator:telegram', externalEventId, () => {
      const request = this.repository.findRequestByTopicId(operatorTopicId);
      if (request) {
        this.repository.closeRequest(request.id, occurredAt);
      }
      return Promise.resolve();
    });
  }

  public async handleOperatorTopicReopened(
    externalEventId: string,
    operatorTopicId: string,
  ): Promise<void> {
    await this.handleEvent('operator:telegram', externalEventId, async () => {
      const request = this.repository.findRequestByTopicId(operatorTopicId);
      if (request) {
        if (this.canReopenRequest(request)) {
          this.repository.reopenRequest(request.id);
        } else {
          await this.operatorInbox.closeRequest(request.operatorTopicId);
        }
      }
    });
  }

  private canReopenRequest(request: {
    channel: SupportMessage['channel'];
    conversationId: string;
    id: string;
  }): boolean {
    const latest = this.repository.findLatestRequest(
      request.channel,
      request.conversationId,
    );
    const active = this.repository.findActiveRequest(
      request.channel,
      request.conversationId,
    );
    return latest?.id === request.id && (!active || active.id === request.id);
  }

  private async handleEvent(
    source: string,
    externalEventId: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const claimed = this.repository.claimEvent(
      source,
      externalEventId,
      this.clock(),
    );
    if (!claimed) {
      return;
    }

    try {
      await operation();
      this.repository.completeEvent(source, externalEventId, this.clock());
    } catch (error: unknown) {
      this.repository.releaseEvent(source, externalEventId);
      throw error;
    }
  }
}

function createConversationKey(message: SupportMessage): string {
  return `${message.channel}\u0000${message.conversationId}`;
}

function createTopicTitle(
  channel: SupportMessage['channel'],
  displayName: string,
): string {
  const normalized = displayName.replaceAll(/\s+/g, ' ').trim();
  const suffix = normalized.length > 0 ? normalized : 'Customer';
  const prefix = channel === 'telegram' ? 'TG' : 'VK';
  return `${prefix} - ${suffix}`.slice(0, 128);
}

function parseOperatorCommand(text: string): 'close' | 'reopen' | undefined {
  const command = text
    .trim()
    .split(/\s+/, 1)[0]
    ?.split('@', 1)[0]
    ?.toLowerCase();

  if (command === '/close') {
    return 'close';
  }
  if (command === '/reopen') {
    return 'reopen';
  }
  return undefined;
}
