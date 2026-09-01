import type { SupportMessage } from '@/core/model/support-message.js';

export class OperatorConversationUnavailableError extends Error {
  public constructor() {
    super('The operator conversation is unavailable');
    this.name = 'OperatorConversationUnavailableError';
  }
}

export interface OpenOperatorRequest {
  requestId: string;
  source: SupportMessage;
  title: string;
}

export interface OperatorInbox {
  closeRequest(operatorTopicId: string): Promise<void>;
  openRequest(request: OpenOperatorRequest): Promise<{
    operatorMessageId: string;
    topicId: string;
  }>;
  reopenRequest(operatorTopicId: string): Promise<void>;
  relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
  ): Promise<{ operatorMessageId: string }>;
}
