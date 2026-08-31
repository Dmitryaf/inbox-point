import type {
  ClientChannelKind,
  SupportMessage,
} from '@/core/model/support-message.js';

export interface OutgoingClientMessage {
  conversationId: string;
  idempotencyKey: string;
  replyToExternalMessageId?: string;
  text: string;
}

export interface ClientChannel {
  readonly kind: ClientChannelKind;

  receive(message: SupportMessage): Promise<void>;
  send(message: OutgoingClientMessage): Promise<void>;
}
