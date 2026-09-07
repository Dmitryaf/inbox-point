import type {
  ConversationMessage,
  FailedDelivery,
  MessageLink,
  PendingDelivery,
  QueuedDelivery,
  OperatorRequestSummary,
  SupportRequest,
} from '@/core/model/support-request.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { UsageEvent, UsageEventCounts } from '@/core/model/usage-event.js';

export interface DeliverySummary {
  failed: number;
  oldestPendingAt?: Date;
  pending: number;
  uncertain?: number;
}

export interface PendingInboundEvent {
  externalEventId: string;
  payload: string;
  receivedAt: Date;
  source: string;
}

export interface RetentionCleanupResult {
  deliveriesRedacted: number;
  eligibleRequests: number;
  messagesDeleted: number;
  requestsAnonymized: number;
  skippedRequests: number;
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
  claimDeliveryAttempt(deliveryId: string, startedAt: Date): boolean;
  claimEvent(source: string, externalEventId: string, claimedAt: Date): boolean;
  confirmUnknownDeliveryNotReceived(deliveryId: string, retryAt: Date): boolean;
  confirmUnknownDeliveryReceived(
    deliveryId: string,
    confirmedAt: Date,
  ): boolean;
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
  findActiveWebOperatorRequests(
    limit: number,
  ): readonly OperatorRequestSummary[];
  findConversationMessages(
    requestId: string,
    limit: number,
  ): readonly ConversationMessage[];
  findFailedDeliveries(limit: number): readonly FailedDelivery[];
  findUnnotifiedFailedDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly FailedDelivery[];
  findLatestRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined;
  findRequestByTopicId(topicId: string): SupportRequest | undefined;
  findRequestById(requestId: string): SupportRequest | undefined;
  findPendingDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly QueuedDelivery[];
  getUsageEventCounts(since: Date): UsageEventCounts;
  getDeliverySummary(): DeliverySummary;
  markDeliveryFailed(deliveryId: string, error: string): void;
  markDeliveryFailureNotificationRetry(
    deliveryId: string,
    nextAttemptAt: Date,
  ): void;
  markDeliveryFailureNotified(deliveryId: string, notifiedAt: Date): void;
  markDeliveryOutcomeUnknown(deliveryId: string, error: string): void;
  markDeliveryRetry(
    deliveryId: string,
    error: string,
    nextAttemptAt: Date,
  ): void;
  purgeClosedConversationContent(closedBefore: Date): RetentionCleanupResult;
  releaseEvent(source: string, externalEventId: string): void;
  reopenRequest(requestId: string): void;
  recordUsageEvent(event: UsageEvent): void;
  recordConversationMessage(message: ConversationMessage): void;
  retryFailedDelivery(deliveryId: string, retryAt: Date): boolean;
  switchOperatorTopic(
    requestId: string,
    expectedTopicId: string,
    nextTopicId: string,
  ): boolean;
}
