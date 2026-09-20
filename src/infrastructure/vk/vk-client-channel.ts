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

import type { VkGateway } from './vk-api-client.js';
import { createVkMainKeyboard } from './vk-client-menu.js';
import { createVkRandomId } from './vk-random-id.js';

export class VkClientChannel implements ClientChannel {
  public readonly kind = 'vk' as const;

  public constructor(
    private readonly gateway: VkGateway,
    private readonly repository: SupportRepository,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
  ) {}

  public send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    return this.gateway.sendMessage(
      Number(message.conversationId),
      message.text,
      createVkRandomId(message.idempotencyKey),
      createVkMainKeyboard(
        this.information,
        resolveClientConversationState(
          this.repository,
          this.intakePolicy,
          'vk',
          message.conversationId,
          new Date(),
        ),
      ),
    );
  }
}
