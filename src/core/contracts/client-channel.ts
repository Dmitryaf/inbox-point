import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface OutgoingClientMessage {
  conversationId: string;
  idempotencyKey: string;
  replyToExternalMessageId?: string;
  text: string;
}

export interface ClientChannel {
  readonly kind: ClientChannelKind;

  send(message: OutgoingClientMessage): Promise<{ externalMessageId: string }>;
}

export class DeliveryOutcomeUnknownError extends Error {
  public constructor(
    channel: ClientChannelKind,
    reason = 'delivery outcome is unknown',
  ) {
    super(`${channel} ${reason}`);
    this.name = 'DeliveryOutcomeUnknownError';
  }
}
