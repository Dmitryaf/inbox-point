import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';
import {
  ClientInformationCatalog,
  type ClientInformationResolver,
} from '@/core/application/client-information.js';
import { resolveClientConversationState } from '@/core/application/client-conversation-state.js';
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';

import type { TelegramGateway } from './telegram-api-client.js';
import { createTelegramMainKeyboard } from './telegram-client-menu.js';

export class TelegramClientChannel implements ClientChannel {
  public readonly kind = 'telegram' as const;

  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly repository: SupportRepository,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
  ) {}

  public async send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    const sent = await this.gateway.sendMessage({
      chatId: Number(message.conversationId),
      replyMarkup: createTelegramMainKeyboard(
        this.information,
        resolveClientConversationState(
          this.repository,
          this.intakePolicy,
          'telegram',
          message.conversationId,
        ),
      ),
      text: message.text,
    });
    return { externalMessageId: String(sent.messageId) };
  }
}
