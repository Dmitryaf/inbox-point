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
import type {
  OperatorAction,
  OperatorActionIncident,
  OperatorActionSummary,
  PendingOperatorAction,
} from '@/core/model/operator-action.js';
import type { UsageEvent, UsageEventCounts } from '@/core/model/usage-event.js';
import type {
  InboundEventFailureOutcome,
  InboundEventIncident,
  InboundEventSummary,
  PendingInboundEvent,
  QueuedInboundEvent,
} from '@/core/model/inbound-event.js';

export interface DeliverySummary {
  failed: number;
  oldestPendingAt?: Date;
  pending: number;
  uncertain?: number;
}

export interface WebOperatorRequestSummary {
  recoverable: number;
  webOwned: number;
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
  ): readonly QueuedInboundEvent[];
  findQuarantinedInboundEvents(limit: number): readonly InboundEventIncident[];
  getInboundEventSummary(): InboundEventSummary;
  recordInboundEventFailure(
    source: string,
    externalEventId: string,
    error: string,
    nextAttemptAt: Date,
    maxAttempts: number,
  ): InboundEventFailureOutcome;
  retryQuarantinedInboundEvent(
    source: string,
    externalEventId: string,
  ): boolean;
  skipQuarantinedInboundEvent(source: string, externalEventId: string): boolean;
}

export interface OperatorActionStore {
  claimOperatorAction(actionId: string, startedAt: Date): boolean;
  completeOperatorAction(
    actionId: string,
    externalResultId: string,
    completedAt: Date,
  ): void;
  markOperatorActionFailed(actionId: string, error: string): void;
  markOperatorActionOutcomeUnknown(actionId: string, error: string): void;
  prepareOperatorAction(action: PendingOperatorAction): OperatorAction;
}

export interface SupportRepository
  extends InboundEventStore, OperatorActionStore {
  addMessageLink(link: MessageLink): void;
  ensureMessageLink(link: MessageLink): void;
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
  countActiveWebOperatorRequests(): number;
  createRequest(request: SupportRequest): void;
  enqueueDelivery(delivery: PendingDelivery): string;
  findActiveRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined;
  findActiveWebOperatorRequests(
    limit: number,
  ): readonly OperatorRequestSummary[];
  findRecoverableWebOperatorRequests(
    limit: number,
  ): readonly OperatorRequestSummary[];
  findConversationMessages(
    requestId: string,
    limit?: number,
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
  findOperatorActionIncident(
    actionId: string,
  ): OperatorActionIncident | undefined;
  findOperatorActionIncidents(limit: number): readonly OperatorActionIncident[];
  hasUnknownOperatorActions(
    requestId: string,
    clientMessageId: string,
  ): boolean;
  findRequestByTopicId(topicId: string): SupportRequest | undefined;
  findRequestById(requestId: string): SupportRequest | undefined;
  findPendingDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly QueuedDelivery[];
  isAwaitingClientQuestion(
    channel: ClientChannelKind,
    conversationId: string,
  ): boolean;
  getUsageEventCounts(since: Date): UsageEventCounts;
  getDeliverySummary(): DeliverySummary;
  getOperatorActionSummary(): OperatorActionSummary;
  getWebOperatorRequestSummary(): WebOperatorRequestSummary;
  markDeliveryFailed(deliveryId: string, error: string): void;
  markDeliveryFailureNotificationRetry(
    deliveryId: string,
    nextAttemptAt: Date,
  ): void;
  markDeliveryFailureNotified(deliveryId: string, notifiedAt: Date): void;
  markDeliveryOutcomeUnknown(deliveryId: string, error: string): void;
  markWebOperatorOwned(requestId: string, claimedAt: Date): void;
  markDeliveryRetry(
    deliveryId: string,
    error: string,
    nextAttemptAt: Date,
  ): void;
  confirmOperatorActionReceived(actionId: string, confirmedAt: Date): boolean;
  confirmOperatorLifecycleAction(
    requestId: string,
    kind: 'close_request' | 'reopen_request',
    externalResultId: string,
    confirmedAt: Date,
  ): void;
  moveOperatorActionRequestToWeb(actionId: string): boolean;
  purgeClosedConversationContent(closedBefore: Date): RetentionCleanupResult;
  releaseEvent(source: string, externalEventId: string): void;
  reopenRequest(requestId: string): void;
  recordUsageEvent(event: UsageEvent): void;
  recordConversationMessage(message: ConversationMessage): void;
  rejectOperatorLifecycleActionOutcome(
    requestId: string,
    kind: 'close_request' | 'reopen_request',
    resolvedAt: Date,
  ): void;
  setAwaitingClientQuestion(
    channel: ClientChannelKind,
    conversationId: string,
    updatedAt: Date,
  ): void;
  retryFailedDelivery(deliveryId: string, retryAt: Date): boolean;
  resolveOperatorActionAsWeb(actionId: string, resolvedAt: Date): boolean;
  resolveOperatorLifecycleAction(
    actionId: string,
    resolution: 'completed' | 'not_completed',
    resolvedAt: Date,
  ): boolean;
  switchOperatorTopic(
    requestId: string,
    expectedTopicId: string,
    nextTopicId: string,
  ): boolean;
}
