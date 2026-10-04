export type ClientChannelKind = 'telegram' | 'vk';

export interface SupportMessage {
  channel: ClientChannelKind;
  conversationId: string;
  displayName: string;
  externalMessageId: string;
  receivedAt: Date;
  text: string;
}
