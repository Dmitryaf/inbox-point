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

export interface OpenOperatorRequest {
  requestId: string;
  source: SupportMessage;
  title: string;
}

export interface RelayCustomerMessageOptions {
  initial: boolean;
  requestId: string;
}

export interface RelayedCustomerMessage {
  operatorMessageIds: readonly string[];
  operatorTopicId: string;
}

export interface OperatorInbox {
  closeRequest(operatorTopicId: string): Promise<void>;
  openRequest(request: OpenOperatorRequest): Promise<{ topicId: string }>;
  reopenRequest(operatorTopicId: string): Promise<void>;
  relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<RelayedCustomerMessage>;
}
