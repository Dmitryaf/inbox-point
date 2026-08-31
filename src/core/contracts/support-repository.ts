import type {
  MessageLink,
  PendingDelivery,
  SupportRequest,
} from '@/core/model/support-request.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface SupportRepository {
  addMessageLink(link: MessageLink): void;
  claimEvent(source: string, externalEventId: string, claimedAt: Date): boolean;
  close(): void;
  closeRequest(requestId: string, closedAt: Date): void;
  createRequest(request: SupportRequest): void;
  enqueueDelivery(delivery: PendingDelivery): string;
  findActiveRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined;
  findRequestByTopicId(topicId: string): SupportRequest | undefined;
  markDeliveryFailed(deliveryId: string, error: string): void;
  markDeliverySent(
    deliveryId: string,
    externalMessageId: string,
    sentAt: Date,
  ): void;
  releaseEvent(source: string, externalEventId: string): void;
  reopenRequest(requestId: string): void;
}
