import type { SupportMessage } from '@/core/model/support-message.js';

export class OperatorConversationUnavailableError extends Error {
  public constructor() {
    super('The operator conversation is unavailable');
    this.name = 'OperatorConversationUnavailableError';
  }
}

export class OperatorInboxUnavailableError extends Error {
  public constructor() {
    super('The operator inbox is unavailable');
    this.name = 'OperatorInboxUnavailableError';
  }
}

export class OperatorConversationOwnershipConflictError extends Error {
  public constructor() {
    super('The operator conversation moved to another surface');
    this.name = 'OperatorConversationOwnershipConflictError';
  }
}

export class OperatorActionOutcomeUnknownError extends Error {
  public constructor(
    public readonly actionId: string,
    public readonly operation: 'close' | 'open' | 'relay' | 'reopen',
  ) {
    super(`Operator inbox ${operation} outcome is unknown`);
    this.name = 'OperatorActionOutcomeUnknownError';
  }
}

export interface OpenOperatorRequest {
  requestId: string;
  reusableTopicId?: string;
  source: SupportMessage;
  title: string;
  unavailableTopicId?: string;
}

export interface OperatorLifecycleActionOptions {
  externalEventId: string;
  requestId: string;
}

export interface RelayCustomerMessageOptions {
  actionScope?: string;
  initial: boolean;
  requestId: string;
}

export interface RelayedCustomerMessage {
  operatorMessageIds: readonly string[];
  operatorTopicId: string;
}

export interface OperatorInbox {
  closeRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void>;
  openRequest(request: OpenOperatorRequest): Promise<{ topicId: string }>;
  reopenRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void>;
  relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<RelayedCustomerMessage>;
}
