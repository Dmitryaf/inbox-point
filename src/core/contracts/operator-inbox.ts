import type { SupportMessage } from '@/core/model/support-message.js';

export interface OpenOperatorRequest {
  requestId: string;
  source: SupportMessage;
}

export interface OperatorInbox {
  closeRequest(requestId: string): Promise<void>;
  openRequest(request: OpenOperatorRequest): Promise<void>;
  relayCustomerMessage(
    requestId: string,
    message: SupportMessage,
  ): Promise<void>;
}
