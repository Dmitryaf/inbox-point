import type { SupportMessage } from '@/core/model/support-message.js';
import { clientMessages } from '@/core/application/client-messages.js';
import type { ChannelOperatorMessage } from '@/core/model/operator-message.js';

import type { VkGateway } from './vk-api-client.js';
import type { VkClientMenuHandler } from './vk-client-menu.js';
import { createVkRandomId } from './vk-random-id.js';
import { vkMessageEventSchema, type VkLongPollEvent } from './vk-types.js';

export interface VkClientMessageHandler {
  handleChannelOperatorMessage(
    externalEventId: string,
    message: ChannelOperatorMessage,
  ): Promise<void>;
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
}

export class VkUpdateRouter {
  public constructor(
    private readonly handoff: VkClientMessageHandler,
    private readonly gateway: Pick<
      VkGateway,
      'getUserDisplayName' | 'sendMessage'
    >,
    private readonly clientMenu?: VkClientMenuHandler,
  ) {}

  public async route(event: VkLongPollEvent): Promise<void> {
    if (event.type !== 'message_new' && event.type !== 'message_reply') {
      return;
    }
    const parsedEvent = vkMessageEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      const eventId = event.event_id ?? 'without event_id';
      throw new Error(`VK ${event.type} event ${eventId} is invalid`);
    }
    const message = parsedEvent.data.object.message;
    const externalMessageId = `${message.peer_id}:${
      message.conversation_message_id ?? message.id
    }`;
    const externalEventId =
      parsedEvent.data.event_id ?? `vk-message:${externalMessageId}`;
    if (parsedEvent.data.type === 'message_reply' || message.out === 1) {
      if (
        message.admin_author_id === undefined ||
        (message.random_id ?? 0) !== 0 ||
        message.peer_id >= 2_000_000_000 ||
        message.text.trim().length === 0
      ) {
        return;
      }
      await this.handoff.handleChannelOperatorMessage(externalEventId, {
        channel: 'vk',
        conversationId: String(message.peer_id),
        externalMessageId,
        receivedAt: new Date(message.date * 1_000),
        text: message.text,
      });
      return;
    }
    if (message.from_id <= 0 || message.peer_id !== message.from_id) {
      return;
    }
    if ((message.attachments?.length ?? 0) > 0) {
      await this.gateway.sendMessage(
        message.peer_id,
        clientMessages.unsupportedContent,
        createVkRandomId(`unsupported:${externalEventId}`),
      );
      return;
    }
    if (message.text.trim().length === 0) {
      return;
    }
    const handledByMenu = await this.clientMenu?.handle({
      externalEventId,
      ...(message.payload ? { payload: message.payload } : {}),
      peerId: message.peer_id,
      text: message.text,
    });
    if (handledByMenu) {
      return;
    }
    const displayName = await this.gateway.getUserDisplayName(message.from_id);
    await this.handoff.handleClientMessage(externalEventId, {
      channel: 'vk',
      conversationId: String(message.peer_id),
      displayName,
      externalMessageId,
      receivedAt: new Date(message.date * 1_000),
      text: message.text,
    });
  }
}
