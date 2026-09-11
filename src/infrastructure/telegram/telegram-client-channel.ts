import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';
import {
  ClientInformationCatalog,
  type ClientInformationResolver,
} from '@/core/application/client-information.js';

import type { TelegramGateway } from './telegram-api-client.js';
import { createTelegramMainKeyboard } from './telegram-client-menu.js';

export class TelegramClientChannel implements ClientChannel {
  public readonly kind = 'telegram' as const;

  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
  ) {}

  public async send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    const sent = await this.gateway.sendMessage({
      chatId: Number(message.conversationId),
      replyMarkup: createTelegramMainKeyboard(this.information, true),
      text: message.text,
    });
    return { externalMessageId: String(sent.messageId) };
  }
}
