import type {
  FailedDelivery,
  MessageLink,
  PendingDelivery,
  QueuedDelivery,
  SupportRequest,
} from '@/core/model/support-request.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface DeliverySummary {
  failed: number;
  pending: number;
}

export interface PendingInboundEvent {
  externalEventId: string;
  payload: string;
  receivedAt: Date;
  source: string;
}

export interface InboundEventStore {
  completeInboundEvent(source: string, externalEventId: string): void;
  enqueueInboundEvents(events: readonly PendingInboundEvent[]): void;
  findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly PendingInboundEvent[];
}

export interface SupportRepository extends InboundEventStore {
  addMessageLink(link: MessageLink): void;
  claimEvent(source: string, externalEventId: string, claimedAt: Date): boolean;
  close(): void;
  closeRequest(requestId: string, closedAt: Date): void;
  completeEvent(
    source: string,
    externalEventId: string,
    completedAt: Date,
  ): void;
  completeDelivery(
    deliveryId: string,
    externalMessageId: string,
    sentAt: Date,
    link: MessageLink,
  ): void;
  createRequest(request: SupportRequest): void;
  enqueueDelivery(delivery: PendingDelivery): string;
  findActiveRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined;
  findFailedDeliveries(limit: number): readonly FailedDelivery[];
  findLatestRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined;
  findRequestByTopicId(topicId: string): SupportRequest | undefined;
  findPendingDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly QueuedDelivery[];
  getDeliverySummary(): DeliverySummary;
  markDeliveryFailed(deliveryId: string, error: string): void;
  markDeliveryRetry(
    deliveryId: string,
    error: string,
    nextAttemptAt: Date,
  ): void;
  releaseEvent(source: string, externalEventId: string): void;
  reopenRequest(requestId: string): void;
  retryFailedDelivery(deliveryId: string, retryAt: Date): boolean;
}
