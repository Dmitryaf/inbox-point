import { createHash } from 'node:crypto';

import type {
  ClientChannel,
  OutgoingClientMessage,
} from '@/core/contracts/client-channel.js';

import type { VkGateway } from './vk-api-client.js';

export class VkClientChannel implements ClientChannel {
  public readonly kind = 'vk' as const;

  public constructor(private readonly gateway: VkGateway) {}

  public send(
    message: OutgoingClientMessage,
  ): Promise<{ externalMessageId: string }> {
    return this.gateway.sendMessage(
      Number(message.conversationId),
      message.text,
      createRandomId(message.idempotencyKey),
    );
  }
}

function createRandomId(idempotencyKey: string): number {
  const value = createHash('sha256')
    .update(idempotencyKey)
    .digest()
    .readUInt32LE(0);
  return value & 0x7fffffff || 1;
}
