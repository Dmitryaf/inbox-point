import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';

import type { TelegramGateway } from './telegram-api-client.js';

export class TelegramClientChannel implements ClientChannel {
  public readonly kind = 'telegram' as const;

  public constructor(private readonly gateway: TelegramGateway) {}

  public async send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    const sent = await this.gateway.sendMessage({
      chatId: Number(message.conversationId),
      text: message.text,
    });
    return { externalMessageId: String(sent.messageId) };
  }
}
