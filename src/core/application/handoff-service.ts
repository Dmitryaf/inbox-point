import { randomUUID } from 'node:crypto';

import type { ClientChannel } from '@/core/contracts/client-channel.js';
import type { OperatorInbox } from '@/core/contracts/operator-inbox.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';

export interface HandoffServiceDependencies {
  clientChannels: readonly ClientChannel[];
  clock?: () => Date;
  createId?: () => string;
  operatorInbox: OperatorInbox;
  repository: SupportRepository;
}

export class HandoffService {
  private readonly channels: ReadonlyMap<string, ClientChannel>;
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly operatorInbox: OperatorInbox;
  private readonly repository: SupportRepository;

  public constructor(dependencies: HandoffServiceDependencies) {
    this.channels = new Map(
      dependencies.clientChannels.map((channel) => [channel.kind, channel]),
    );
    this.clock = dependencies.clock ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.operatorInbox = dependencies.operatorInbox;
    this.repository = dependencies.repository;
  }

  public async handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void> {
    await this.handleEvent(
      `client:${message.channel}`,
      externalEventId,
      async () => {
        const existingRequest = this.repository.findActiveRequest(
          message.channel,
          message.conversationId,
        );

        if (existingRequest) {
          const relayed = await this.operatorInbox.relayCustomerMessage(
            existingRequest.operatorTopicId,
            message,
          );
          this.repository.addMessageLink({
            clientMessageId: message.externalMessageId,
            createdAt: this.clock(),
            direction: 'client_to_operator',
            id: this.createId(),
            operatorMessageId: relayed.operatorMessageId,
            requestId: existingRequest.id,
          });
          return;
        }

        const requestId = this.createId();
        const opened = await this.operatorInbox.openRequest({
          requestId,
          source: message,
          title: createTopicTitle(message.displayName),
        });
        const createdAt = this.clock();

        this.repository.createRequest({
          channel: message.channel,
          conversationId: message.conversationId,
          createdAt,
          id: requestId,
          operatorTopicId: opened.topicId,
          status: 'active',
        });
        this.repository.addMessageLink({
          clientMessageId: message.externalMessageId,
          createdAt,
          direction: 'client_to_operator',
          id: this.createId(),
          operatorMessageId: opened.operatorMessageId,
          requestId,
        });
      },
    );
  }

  public async handleOperatorMessage(
    externalEventId: string,
    message: OperatorMessage,
  ): Promise<void> {
    await this.handleEvent('operator:telegram', externalEventId, async () => {
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
        await this.operatorInbox.reopenRequest(request.operatorTopicId);
        this.repository.reopenRequest(request.id);
        return;
      }

      if (request.status === 'closed') {
        return;
      }

      const channel = this.channels.get(request.channel);
      if (!channel) {
        throw new Error(`Client channel is not configured: ${request.channel}`);
      }

      const idempotencyKey = `operator:${externalEventId}`;
      const deliveryId = this.repository.enqueueDelivery({
        channel: request.channel,
        conversationId: request.conversationId,
        createdAt: this.clock(),
        id: this.createId(),
        idempotencyKey,
        requestId: request.id,
        text: message.text,
      });

      try {
        const delivered = await channel.send({
          conversationId: request.conversationId,
          idempotencyKey,
          text: message.text,
        });
        const sentAt = this.clock();
        this.repository.markDeliverySent(
          deliveryId,
          delivered.externalMessageId,
          sentAt,
        );
        this.repository.addMessageLink({
          clientMessageId: delivered.externalMessageId,
          createdAt: sentAt,
          direction: 'operator_to_client',
          id: this.createId(),
          operatorMessageId: message.externalMessageId,
          requestId: request.id,
        });
      } catch (error: unknown) {
        this.repository.markDeliveryFailed(deliveryId, safeErrorMessage(error));
        throw error;
      }
    });
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
    } catch (error: unknown) {
      this.repository.releaseEvent(source, externalEventId);
      throw error;
    }
  }
}

function createTopicTitle(displayName: string): string {
  const normalized = displayName.replaceAll(/\s+/g, ' ').trim();
  const suffix = normalized.length > 0 ? normalized : 'Customer';
  return `TG - ${suffix}`.slice(0, 128);
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

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return 'Unknown delivery error';
}
