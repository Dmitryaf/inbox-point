import type { SupportMessage } from '@/core/model/support-message.js';

import type { VkGateway } from './vk-api-client.js';
import type { VkClientMenuHandler } from './vk-client-menu.js';
import { createVkRandomId } from './vk-random-id.js';
import { vkMessageNewEventSchema, type VkLongPollEvent } from './vk-types.js';

export interface VkClientMessageHandler {
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
    if (event.type !== 'message_new') {
      return;
    }
    const parsedEvent = vkMessageNewEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      const eventId = event.event_id ?? 'without event_id';
      throw new Error(`VK message_new event ${eventId} is invalid`);
    }
    const message = parsedEvent.data.object.message;
    if (
      message.out === 1 ||
      message.from_id <= 0 ||
      message.peer_id !== message.from_id
    ) {
      return;
    }
    const externalMessageId = `${message.peer_id}:${
      message.conversation_message_id ?? message.id
    }`;
    const externalEventId =
      parsedEvent.data.event_id ?? `vk-message:${externalMessageId}`;
    if ((message.attachments?.length ?? 0) > 0) {
      await this.gateway.sendMessage(
        message.peer_id,
        'Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.',
        createVkRandomId(`unsupported:${externalEventId}`),
      );
      return;
    }
    if (message.text.trim().length === 0) {
      return;
    }
    const handledByMenu = await this.clientMenu?.handle({
      externalEventId,
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
