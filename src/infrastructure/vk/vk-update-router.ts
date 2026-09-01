import type { SupportMessage } from '@/core/model/support-message.js';

import type { VkGateway } from './vk-api-client.js';
import type { VkClientMenuHandler } from './vk-client-menu.js';
import type { VkLongPollEvent } from './vk-types.js';

export interface VkClientMessageHandler {
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
}

export class VkUpdateRouter {
  public constructor(
    private readonly handoff: VkClientMessageHandler,
    private readonly gateway: Pick<VkGateway, 'getUserDisplayName'>,
    private readonly clientMenu?: VkClientMenuHandler,
  ) {}

  public async route(event: VkLongPollEvent): Promise<void> {
    if (event.type !== 'message_new') {
      return;
    }
    const message = event.object.message;
    if (
      message.out === 1 ||
      message.from_id <= 0 ||
      message.peer_id !== message.from_id ||
      message.text.trim().length === 0
    ) {
      return;
    }
    const externalMessageId = `${message.peer_id}:${
      message.conversation_message_id ?? message.id
    }`;
    const handledByMenu = await this.clientMenu?.handle({
      externalEventId: event.event_id ?? `vk-message:${externalMessageId}`,
      peerId: message.peer_id,
      text: message.text,
    });
    if (handledByMenu) return;
    const displayName = await this.gateway.getUserDisplayName(message.from_id);
    await this.handoff.handleClientMessage(
      event.event_id ?? `vk-message:${externalMessageId}`,
      {
        channel: 'vk',
        conversationId: String(message.peer_id),
        displayName,
        externalMessageId,
        receivedAt: new Date(message.date * 1_000),
        text: message.text,
      },
    );
  }
}
