import type { ClientChannelKind } from './support-message.js';

export interface OperatorMessage {
  externalMessageId: string;
  operatorTopicId: string;
  receivedAt: Date;
  text: string;
}

export interface ChannelOperatorMessage {
  channel: ClientChannelKind;
  conversationId: string;
  externalMessageId: string;
  receivedAt: Date;
  text: string;
}
