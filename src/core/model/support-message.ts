export type ClientChannelKind = 'telegram' | 'vk';

export interface SupportMessage {
  channel: ClientChannelKind;
  conversationId: string;
  externalMessageId: string;
  receivedAt: Date;
  text: string;
}
