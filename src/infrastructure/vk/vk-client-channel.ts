import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';
import {
  ClientInformationCatalog,
  type ClientInformationResolver,
} from '@/core/application/client-information.js';

import type { VkGateway } from './vk-api-client.js';
import { createVkMainKeyboard } from './vk-client-menu.js';
import { createVkRandomId } from './vk-random-id.js';

export class VkClientChannel implements ClientChannel {
  public readonly kind = 'vk' as const;

  public constructor(
    private readonly gateway: VkGateway,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
  ) {}

  public send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    return this.gateway.sendMessage(
      Number(message.conversationId),
      message.text,
      createVkRandomId(message.idempotencyKey),
      createVkMainKeyboard(this.information),
    );
  }
}
