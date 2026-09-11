import { randomUUID } from 'node:crypto';

import { KeyedTaskQueue } from '@/core/application/keyed-task-queue.js';
import { enqueueHandoffAcknowledgement } from '@/core/application/handoff-acknowledgement.js';
import {
  OperatorActionOutcomeUnknownError,
  OperatorConversationUnavailableError,
  type OperatorInbox,
} from '@/core/contracts/operator-inbox.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorMessage } from '@/core/model/operator-message.js';
import {
  createWebOperatorTopicId,
  isWebOperatorTopic,
} from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export interface HandoffServiceDependencies {
  clock?: () => Date;
  createId?: () => string;
  operatorInbox: OperatorInbox;
  repository: SupportRepository;
}

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
      if (isWebOperatorTopic(existingRequest.operatorTopicId)) {
        this.recordWebTakeover(existingRequest.id, message.channel);
      }
      try {
        await this.relayClientMessage(existingRequest, message);
        return;
      } catch (error: unknown) {
        if (error instanceof OperatorActionOutcomeUnknownError) {
          return;
        }
        if (!(error instanceof OperatorConversationUnavailableError)) {
          throw error;
        }
        this.repository.closeRequest(existingRequest.id, this.clock());
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
      this.repository.ensureMessageLink({
        clientMessageId: message.externalMessageId,
        createdAt: this.clock(),
        direction: 'client_to_operator',
        id: this.createId(),
        operatorMessageId,
        requestId: request.id,
      });
    }
    enqueueHandoffAcknowledgement(
      this.repository,
      {
        channel: message.channel,
        conversationId: message.conversationId,
        id: request.id,
      },
      this.clock(),
    );
  }

  private async openClientRequest(message: SupportMessage): Promise<void> {
    const requestId = this.createId();
    const createdAt = this.clock();
    const webTopicId = createWebOperatorTopicId(requestId);
    const latestRequest = this.repository.findLatestRequest(
      message.channel,
      message.conversationId,
    );
    const reusableTopicId =
      latestRequest && !isWebOperatorTopic(latestRequest.operatorTopicId)
        ? latestRequest.operatorTopicId
        : undefined;

    this.repository.createRequest({
      channel: message.channel,
      conversationId: message.conversationId,
      createdAt,
      displayName: message.displayName,
      id: requestId,
      operatorTopicId: webTopicId,
      status: 'active',
    });
    this.repository.recordConversationMessage({
      createdAt: message.receivedAt,
      direction: 'client_to_operator',
      externalMessageId: message.externalMessageId,
      id: this.createId(),
      requestId,
      senderName: message.displayName,
      text: message.text,
    });
    this.repository.recordUsageEvent({
      channel: message.channel,
      id: `new-request:${requestId}`,
      occurredAt: createdAt,
      requestId,
      type: 'new_request',
    });
    let opened: { topicId: string };
    try {
      opened = await this.operatorInbox.openRequest({
        requestId,
        ...(reusableTopicId ? { reusableTopicId } : {}),
        source: message,
        title: createTopicTitle(message.channel, message.displayName),
      });
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
      this.recordWebTakeover(requestId, message.channel);
      enqueueHandoffAcknowledgement(
        this.repository,
        {
          channel: message.channel,
          conversationId: message.conversationId,
          id: requestId,
        },
        this.clock(),
      );
      return;
    }
    if (opened.topicId !== webTopicId) {
      const switched = this.repository.switchOperatorTopic(
        requestId,
        webTopicId,
        opened.topicId,
      );
      if (!switched) {
        const current = this.repository.findRequestById(requestId);
        if (current?.operatorTopicId !== opened.topicId) {
          throw new Error('The operator surface changed concurrently');
        }
      }
    }
    if (isWebOperatorTopic(opened.topicId)) {
      this.recordWebTakeover(requestId, message.channel);
    }
    try {
      await this.relayClientMessage(
        { id: requestId, operatorTopicId: opened.topicId },
        message,
        true,
      );
    } catch (error: unknown) {
      if (!(error instanceof OperatorActionOutcomeUnknownError)) {
        throw error;
      }
    }
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
      this.repository.recordUsageEvent({
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
    this.repository.recordUsageEvent({
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
      if (
        request &&
        topicEventCanAffectRequest(request.createdAt, occurredAt)
      ) {
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

function topicEventCanAffectRequest(
  requestCreatedAt: Date,
  eventOccurredAt: Date,
): boolean {
  const requestCreatedSecond = Math.floor(requestCreatedAt.getTime() / 1_000);
  const eventOccurredSecond = Math.floor(eventOccurredAt.getTime() / 1_000);
  return requestCreatedSecond <= eventOccurredSecond;
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
