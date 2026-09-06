import type { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import { isWebOperatorTopic } from '@/core/model/operator-topic.js';
import type { SupportRequest } from '@/core/model/support-request.js';

export interface OperatorInboxRequestView {
  channel: SupportRequest['channel'];
  createdAt: Date;
  displayName?: string;
  id: string;
  latestMessageAt?: Date;
  status: SupportRequest['status'];
}

export interface OperatorInboxMessageView {
  createdAt: Date;
  deliveryOutcomeUnknown?: boolean;
  deliveryStatus?: 'failed' | 'pending' | 'sent';
  direction: 'client_to_operator' | 'operator_to_client';
  id: string;
  senderName?: string;
  text: string;
}

export class OperatorRequestNotFoundError extends Error {
  public constructor() {
    super('Operator request was not found');
    this.name = 'OperatorRequestNotFoundError';
  }
}

export class OperatorRequestClosedError extends Error {
  public constructor() {
    super('Operator request is closed');
    this.name = 'OperatorRequestClosedError';
  }
}

export interface WebOperatorAction {
  idempotencyKey: string;
  occurredAt: Date;
}

export interface WebOperatorReply extends WebOperatorAction {
  text: string;
}

export class OperatorInboxService {
  public constructor(
    private readonly repository: SupportRepository,
    private readonly handoff: Pick<HandoffRuntime, 'handleWebOperatorMessage'>,
  ) {}

  public closeRequest(
    requestId: string,
    action: WebOperatorAction,
  ): Promise<void> {
    const request = this.requireRequest(requestId);
    if (request.status === 'closed') {
      return Promise.resolve();
    }
    const eventId = `close:${requestId}:${action.idempotencyKey}`;
    return this.handoff.handleWebOperatorMessage(eventId, {
      externalMessageId: `web:${eventId}`,
      operatorTopicId: request.operatorTopicId,
      receivedAt: action.occurredAt,
      text: '/close',
    });
  }

  public getActiveRequests(limit = 50): readonly OperatorInboxRequestView[] {
    return this.repository
      .findActiveWebOperatorRequests(limit)
      .map((request) => ({
        channel: request.channel,
        createdAt: request.createdAt,
        ...(request.displayName ? { displayName: request.displayName } : {}),
        id: request.id,
        ...(request.latestMessageAt
          ? { latestMessageAt: request.latestMessageAt }
          : {}),
        status: request.status,
      }));
  }

  public getMessages(
    requestId: string,
    limit = 200,
  ): readonly OperatorInboxMessageView[] {
    this.requireRequest(requestId);
    return this.repository
      .findConversationMessages(requestId, limit)
      .map((message) => ({
        createdAt: message.createdAt,
        ...(message.deliveryOutcomeUnknown !== undefined
          ? { deliveryOutcomeUnknown: message.deliveryOutcomeUnknown }
          : {}),
        ...(message.deliveryStatus
          ? { deliveryStatus: message.deliveryStatus }
          : {}),
        direction: message.direction,
        id: message.id,
        ...(message.senderName ? { senderName: message.senderName } : {}),
        text: message.text,
      }));
  }

  public reply(requestId: string, reply: WebOperatorReply): Promise<void> {
    const request = this.requireActiveRequest(requestId);
    const eventId = `reply:${requestId}:${reply.idempotencyKey}`;
    return this.handoff.handleWebOperatorMessage(eventId, {
      externalMessageId: `web:${eventId}`,
      operatorTopicId: request.operatorTopicId,
      receivedAt: reply.occurredAt,
      text: reply.text,
    });
  }

  private requireActiveRequest(requestId: string): SupportRequest {
    const request = this.requireRequest(requestId);
    if (request.status !== 'active') {
      throw new OperatorRequestClosedError();
    }
    return request;
  }

  private requireRequest(requestId: string): SupportRequest {
    const request = this.repository.findRequestById(requestId);
    if (!request || !isWebOperatorTopic(request.operatorTopicId)) {
      throw new OperatorRequestNotFoundError();
    }
    return request;
  }
}
