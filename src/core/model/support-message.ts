export type ClientChannelKind = 'telegram' | 'vk';

export interface SupportMessage {
  applicationLabel?: string;
  questionContext?: string;
  channel: ClientChannelKind;
  conversationId: string;
  displayName: string;
  externalMessageId: string;
  receivedAt: Date;
  text: string;
}
