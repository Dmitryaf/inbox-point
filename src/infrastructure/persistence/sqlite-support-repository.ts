import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  DeliverySummary,
  RetentionCleanupResult,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type {
  InboundEventFailureOutcome,
  InboundEventIncident,
  InboundEventSummary,
  PendingInboundEvent,
  QueuedInboundEvent,
} from '@/core/model/inbound-event.js';
import type {
  ConversationMessage,
  FailedDelivery,
  MessageLink,
  OperatorRequestSummary,
  PendingDelivery,
  QueuedDelivery,
  SupportRequest,
} from '@/core/model/support-request.js';
import type {
  OperatorAction,
  OperatorActionIncident,
  OperatorActionSummary,
  PendingOperatorAction,
} from '@/core/model/operator-action.js';
import { webOperatorTopicPrefix } from '@/core/model/operator-topic.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import {
  usageEventTypes,
  type UsageEvent,
  type UsageEventCounts,
  type UsageEventType,
} from '@/core/model/usage-event.js';
import { initializeSqliteSchema } from '@/infrastructure/persistence/sqlite-schema.js';
import { purgeClosedConversationContent as purgeRetainedContent } from '@/infrastructure/persistence/sqlite-retention.js';
import { recoverInterruptedSqliteWork } from '@/infrastructure/persistence/sqlite-startup-recovery.js';
import {
  mapOperatorAction,
  mapOperatorActionIncident,
  mapRequest,
  operatorActionMatches,
  type ConversationMessageRow,
  type DeliveryRow,
  type FailedDeliveryRow,
  type OperatorActionIncidentRow,
  type OperatorActionRow,
  type OperatorRequestSummaryRow,
  type SupportRequestRow,
} from '@/infrastructure/persistence/sqlite-support-records.js';

export class SqliteSupportRepository implements SupportRepository {
  private readonly database: DatabaseSync;

  public constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec('PRAGMA synchronous = FULL');
    try {
      initializeSqliteSchema(this.database);
    } catch (error: unknown) {
      this.database.close();
      throw error;
    }
    recoverInterruptedSqliteWork(this.database);
  }

  public addMessageLink(link: MessageLink): void {
    this.database
      .prepare(
        `INSERT INTO message_links (
          id,
          request_id,
          direction,
          client_message_id,
          operator_message_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        link.id,
        link.requestId,
        link.direction,
        link.clientMessageId,
        link.operatorMessageId,
        link.createdAt.toISOString(),
      );
  }

  public ensureMessageLink(link: MessageLink): void {
    const existing = this.database
      .prepare(
        `SELECT 1
         FROM message_links
         WHERE request_id = ?
           AND direction = ?
           AND client_message_id = ?
           AND operator_message_id = ?
         LIMIT 1`,
      )
      .get(
        link.requestId,
        link.direction,
        link.clientMessageId,
        link.operatorMessageId,
      );
    if (!existing) {
      this.addMessageLink(link);
    }
  }

  public getUsageEventCounts(since: Date): UsageEventCounts {
    const counts = Object.fromEntries(
      usageEventTypes.map((type) => [type, 0]),
    ) as UsageEventCounts;
    const rows = this.database
      .prepare(
        `SELECT event_type, COUNT(*) AS event_count
         FROM usage_events
         WHERE occurred_at >= ?
         GROUP BY event_type`,
      )
      .all(since.toISOString()) as unknown as {
      event_count: number;
      event_type: UsageEventType;
    }[];
    for (const row of rows) {
      counts[row.event_type] = row.event_count;
    }
    return counts;
  }

  public recordUsageEvent(event: UsageEvent): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO usage_events (
          id,
          event_type,
          channel,
          request_id,
          occurred_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.type,
        event.channel,
        event.requestId ?? null,
        event.occurredAt.toISOString(),
      );
  }

  public claimEvent(
    source: string,
    externalEventId: string,
    claimedAt: Date,
  ): boolean {
    const result = this.database
      .prepare(
        `INSERT OR IGNORE INTO processed_events (
          source,
          external_event_id,
          claimed_at,
          status,
          completed_at
        ) VALUES (?, ?, ?, 'processing', NULL)`,
      )
      .run(source, externalEventId, claimedAt.toISOString());

    return Number(result.changes) === 1;
  }

  public claimDeliveryAttempt(deliveryId: string, startedAt: Date): boolean {
    const result = this.database
      .prepare(
        `UPDATE deliveries
         SET attempt_started_at = ?
         WHERE id = ?
           AND status = 'pending'
           AND attempt_started_at IS NULL`,
      )
      .run(startedAt.toISOString(), deliveryId);

    return Number(result.changes) === 1;
  }

  public claimOperatorAction(actionId: string, startedAt: Date): boolean {
    const result = this.database
      .prepare(
        `UPDATE operator_actions
         SET status = 'sending', attempt_started_at = ?
         WHERE id = ? AND status IN ('pending', 'failed')`,
      )
      .run(startedAt.toISOString(), actionId);

    return Number(result.changes) === 1;
  }

  public close(): void {
    this.database.close();
  }

  public closeRequest(requestId: string, closedAt: Date): void {
    this.database
      .prepare(
        `UPDATE support_requests
         SET status = 'closed', closed_at = ?
         WHERE id = ?`,
      )
      .run(closedAt.toISOString(), requestId);
  }

  public confirmUnknownDeliveryNotReceived(
    deliveryId: string,
    retryAt: Date,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'pending',
             attempts = 0,
             external_message_id = NULL,
             last_error = NULL,
             next_attempt_at = ?,
             outcome_unknown = 0,
             attempt_started_at = NULL,
             sent_at = NULL,
             manual_resolution = 'confirmed_not_received',
             resolved_at = ?,
             operator_notified_at = NULL,
             notification_next_attempt_at = NULL
         WHERE id = ? AND status = 'failed' AND outcome_unknown = 1`,
      )
      .run(retryAt.toISOString(), retryAt.toISOString(), deliveryId);

    return Number(result.changes) === 1;
  }

  public confirmUnknownDeliveryReceived(
    deliveryId: string,
    confirmedAt: Date,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'sent',
             last_error = NULL,
             next_attempt_at = NULL,
             outcome_unknown = 0,
             attempt_started_at = NULL,
             sent_at = ?,
             manual_resolution = 'confirmed_received',
             resolved_at = ?
         WHERE id = ? AND status = 'failed' AND outcome_unknown = 1`,
      )
      .run(confirmedAt.toISOString(), confirmedAt.toISOString(), deliveryId);

    return Number(result.changes) === 1;
  }

  public completeEvent(
    source: string,
    externalEventId: string,
    completedAt: Date,
  ): void {
    const result = this.database
      .prepare(
        `UPDATE processed_events
         SET status = 'completed', completed_at = ?
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'processing'`,
      )
      .run(completedAt.toISOString(), source, externalEventId);

    if (Number(result.changes) !== 1) {
      throw new Error('Claimed event was not found');
    }
  }

  public completeInboundEvent(source: string, externalEventId: string): void {
    this.database
      .prepare(
        `DELETE FROM inbound_events
         WHERE source = ? AND external_event_id = ?`,
      )
      .run(source, externalEventId);
  }

  public recordInboundEventFailure(
    source: string,
    externalEventId: string,
    error: string,
    nextAttemptAt: Date,
    maxAttempts: number,
  ): InboundEventFailureOutcome {
    const result = this.database
      .prepare(
        `UPDATE inbound_events
         SET attempts = attempts + 1,
             status = CASE
               WHEN attempts + 1 >= ? THEN 'quarantined'
               ELSE 'pending'
             END,
             last_error = ?,
             next_attempt_at = CASE
               WHEN attempts + 1 >= ? THEN NULL
               ELSE ?
             END
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'pending'
         RETURNING status`,
      )
      .get(
        maxAttempts,
        error,
        maxAttempts,
        nextAttemptAt.toISOString(),
        source,
        externalEventId,
      ) as { status: 'pending' | 'quarantined' } | undefined;
    if (!result) {
      throw new Error('Pending inbound event was not found');
    }
    return result.status === 'quarantined' ? 'quarantined' : 'retry';
  }

  public completeDelivery(
    deliveryId: string,
    externalMessageId: string,
    sentAt: Date,
    link: MessageLink,
  ): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = this.database
        .prepare(
          `UPDATE deliveries
           SET status = 'sent',
               attempts = attempts + 1,
               external_message_id = ?,
               last_error = NULL,
               attempt_started_at = NULL,
               sent_at = ?
           WHERE id = ? AND status = 'pending'`,
        )
        .run(externalMessageId, sentAt.toISOString(), deliveryId);
      if (Number(result.changes) !== 1) {
        throw new Error('Pending delivery was not found');
      }
      this.addMessageLink(link);
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public completeOperatorAction(
    actionId: string,
    externalResultId: string,
    completedAt: Date,
  ): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const action = this.database
        .prepare(
          `SELECT id, request_id, kind, client_message_id, operator_topic_id,
                  sequence, initial, status, external_result_id, created_at,
                  last_error
           FROM operator_actions
           WHERE id = ? AND status = 'sending'`,
        )
        .get(actionId) as OperatorActionRow | undefined;
      if (!action) {
        throw new Error('Claimed operator action was not found');
      }

      if (action.kind === 'open_request') {
        const switched = this.database
          .prepare(
            `UPDATE support_requests
             SET operator_topic_id = ?
             WHERE id = ? AND operator_topic_id = ? AND status = 'active'`,
          )
          .run(externalResultId, action.request_id, action.operator_topic_id);
        if (Number(switched.changes) !== 1) {
          const request = this.findRequestById(action.request_id);
          if (request?.operatorTopicId !== externalResultId) {
            throw new Error('The operator surface changed concurrently');
          }
        }
      } else {
        this.addMessageLink({
          clientMessageId: action.client_message_id,
          createdAt: completedAt,
          direction: 'client_to_operator',
          id: `operator-action-link:${action.id}`,
          operatorMessageId: externalResultId,
          requestId: action.request_id,
        });
      }

      const completed = this.database
        .prepare(
          `UPDATE operator_actions
           SET status = 'sent',
               external_result_id = ?,
               last_error = NULL,
               attempt_started_at = NULL,
               completed_at = ?
           WHERE id = ? AND status = 'sending'`,
        )
        .run(externalResultId, completedAt.toISOString(), actionId);
      if (Number(completed.changes) !== 1) {
        throw new Error('Claimed operator action was not completed');
      }
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public createRequest(request: SupportRequest): void {
    this.database
      .prepare(
        `INSERT INTO support_requests (
          id,
          channel,
          external_conversation_id,
          client_display_name,
          operator_topic_id,
          status,
          created_at,
          closed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        request.id,
        request.channel,
        request.conversationId,
        request.displayName ?? null,
        request.operatorTopicId,
        request.status,
        request.createdAt.toISOString(),
        request.closedAt?.toISOString() ?? null,
      );
  }

  public enqueueDelivery(delivery: PendingDelivery): string {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO deliveries (
          id,
          request_id,
          idempotency_key,
          operator_message_id,
          channel,
          external_conversation_id,
          text,
          reply_to_external_message_id,
          status,
          attempts,
          created_at,
          next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      )
      .run(
        delivery.id,
        delivery.requestId,
        delivery.idempotencyKey,
        delivery.operatorMessageId,
        delivery.channel,
        delivery.conversationId,
        delivery.text,
        delivery.replyToExternalMessageId ?? null,
        delivery.createdAt.toISOString(),
        delivery.createdAt.toISOString(),
      );

    const row = this.database
      .prepare(
        `SELECT id
         FROM deliveries
         WHERE idempotency_key = ?`,
      )
      .get(delivery.idempotencyKey) as { id: string } | undefined;

    if (!row) {
      throw new Error('Failed to persist outbound delivery');
    }
    return row.id;
  }

  public enqueueInboundEvents(events: readonly PendingInboundEvent[]): void {
    if (events.length === 0) {
      return;
    }

    const insert = this.database.prepare(
      `INSERT OR IGNORE INTO inbound_events (
        source,
        external_event_id,
        payload,
        received_at
      ) VALUES (?, ?, ?, ?)`,
    );
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        insert.run(
          event.source,
          event.externalEventId,
          event.payload,
          event.receivedAt.toISOString(),
        );
      }
      this.database.exec('COMMIT');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  public prepareOperatorAction(action: PendingOperatorAction): OperatorAction {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO operator_actions (
          id,
          request_id,
          kind,
          client_message_id,
          operator_topic_id,
          sequence,
          initial,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        action.id,
        action.requestId,
        action.kind,
        action.clientMessageId,
        action.operatorTopicId,
        action.sequence,
        action.initial ? 1 : 0,
        action.createdAt.toISOString(),
      );

    const row = this.findOperatorActionRow(action.id);
    if (!row || !operatorActionMatches(row, action)) {
      throw new Error('Operator action identity collision');
    }
    return mapOperatorAction(row);
  }

  public findActiveRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          client_display_name,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE channel = ?
          AND external_conversation_id = ?
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1`,
      )
      .get(channel, conversationId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public findActiveWebOperatorRequests(
    limit: number,
  ): readonly OperatorRequestSummary[] {
    const rows = this.database
      .prepare(
        `SELECT
          request.id,
          request.channel,
          request.external_conversation_id,
          request.client_display_name,
          request.operator_topic_id,
          request.status,
          request.created_at,
          request.closed_at,
          MAX(message.created_at) AS latest_message_at
        FROM support_requests AS request
        LEFT JOIN conversation_messages AS message
          ON message.request_id = request.id
        WHERE request.status = 'active'
          AND request.operator_topic_id LIKE ?
        GROUP BY request.id
        ORDER BY COALESCE(MAX(message.created_at), request.created_at) DESC,
                 request.id DESC
        LIMIT ?`,
      )
      .all(
        `${webOperatorTopicPrefix}%`,
        limit,
      ) as unknown as OperatorRequestSummaryRow[];

    return rows.map((row) => ({
      ...mapRequest(row),
      ...(row.latest_message_at
        ? { latestMessageAt: new Date(row.latest_message_at) }
        : {}),
    }));
  }

  public findConversationMessages(
    requestId: string,
    limit: number,
  ): readonly ConversationMessage[] {
    const rows = this.database
      .prepare(
        `SELECT *
         FROM (
           SELECT
             message.id,
             message.request_id,
             message.direction,
             message.external_message_id,
             message.sender_name,
             message.text,
             message.created_at,
             delivery.status AS delivery_status,
             delivery.outcome_unknown AS delivery_outcome_unknown
           FROM conversation_messages AS message
           LEFT JOIN deliveries AS delivery
             ON delivery.request_id = message.request_id
            AND delivery.operator_message_id = message.external_message_id
           WHERE message.request_id = ?
           ORDER BY message.created_at DESC, message.id DESC
           LIMIT ?
         )
         ORDER BY created_at, id`,
      )
      .all(requestId, limit) as unknown as ConversationMessageRow[];

    return rows.map((row) => ({
      createdAt: new Date(row.created_at),
      ...(row.delivery_outcome_unknown !== null
        ? { deliveryOutcomeUnknown: row.delivery_outcome_unknown === 1 }
        : {}),
      ...(row.delivery_status ? { deliveryStatus: row.delivery_status } : {}),
      direction: row.direction,
      externalMessageId: row.external_message_id,
      id: row.id,
      requestId: row.request_id,
      ...(row.sender_name ? { senderName: row.sender_name } : {}),
      text: row.text,
    }));
  }

  public findFailedDeliveries(limit: number): readonly FailedDelivery[] {
    return this.findFailureRows(
      `WHERE delivery.status = 'failed'
       ORDER BY delivery.created_at DESC, delivery.id DESC
       LIMIT ?`,
      limit,
    );
  }

  public findUnnotifiedFailedDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly FailedDelivery[] {
    return this.findFailureRows(
      `WHERE delivery.status = 'failed'
         AND delivery.operator_notified_at IS NULL
         AND COALESCE(
           delivery.notification_next_attempt_at,
           delivery.created_at
         ) <= ?
       ORDER BY delivery.created_at, delivery.id
       LIMIT ?`,
      availableBefore.toISOString(),
      limit,
    );
  }

  private findFailureRows(
    whereClause: string,
    ...parameters: readonly (number | string)[]
  ): readonly FailedDelivery[] {
    const rows = this.database
      .prepare(
        `SELECT
           delivery.id,
           delivery.request_id,
           delivery.operator_message_id,
           delivery.channel,
           delivery.attempts,
           delivery.last_error,
           delivery.created_at,
           delivery.outcome_unknown,
           request.operator_topic_id
         FROM deliveries AS delivery
         JOIN support_requests AS request ON request.id = delivery.request_id
         ${whereClause}`,
      )
      .all(...parameters) as unknown as FailedDeliveryRow[];

    return rows.map((row) => ({
      attempts: row.attempts,
      channel: row.channel,
      createdAt: new Date(row.created_at),
      id: row.id,
      lastError: row.last_error ?? 'Unknown delivery error',
      ...(row.operator_message_id
        ? { operatorMessageId: row.operator_message_id }
        : {}),
      operatorTopicId: row.operator_topic_id,
      outcomeUnknown: row.outcome_unknown === 1,
      requestId: row.request_id,
    }));
  }

  public findLatestRequest(
    channel: ClientChannelKind,
    conversationId: string,
  ): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          client_display_name,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE channel = ?
          AND external_conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      )
      .get(channel, conversationId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public findOperatorActionIncident(
    actionId: string,
  ): OperatorActionIncident | undefined {
    const rows = this.findOperatorActionIncidentRows(
      `WHERE action.id = ? AND action.status = 'outcome_unknown'`,
      actionId,
    );
    const row = rows[0];
    return row ? mapOperatorActionIncident(row) : undefined;
  }

  public findOperatorActionIncidents(
    limit: number,
  ): readonly OperatorActionIncident[] {
    return this.findOperatorActionIncidentRows(
      `WHERE action.status = 'outcome_unknown'
       ORDER BY action.created_at DESC, action.id DESC
       LIMIT ?`,
      limit,
    ).map(mapOperatorActionIncident);
  }

  public hasUnknownOperatorActions(
    requestId: string,
    clientMessageId: string,
  ): boolean {
    const row = this.database
      .prepare(
        `SELECT 1
         FROM operator_actions
         WHERE request_id = ?
           AND client_message_id = ?
           AND status = 'outcome_unknown'
         LIMIT 1`,
      )
      .get(requestId, clientMessageId);
    return row !== undefined;
  }

  private findOperatorActionIncidentRows(
    whereClause: string,
    ...parameters: readonly (number | string)[]
  ): readonly OperatorActionIncidentRow[] {
    return this.database
      .prepare(
        `SELECT action.id, action.request_id, action.kind,
                action.client_message_id, action.operator_topic_id,
                action.sequence, action.initial, action.status,
                action.external_result_id, action.last_error,
                action.created_at, request.channel,
                CASE WHEN action.kind = 'relay_message' AND NOT EXISTS (
                  SELECT 1
                  FROM operator_actions AS blocking_action
                  WHERE blocking_action.request_id = action.request_id
                    AND blocking_action.client_message_id = action.client_message_id
                    AND blocking_action.id != action.id
                    AND blocking_action.status IN ('pending', 'sending', 'failed')
                ) THEN 1 ELSE 0 END AS confirmable,
                request.external_conversation_id
         FROM operator_actions AS action
         JOIN support_requests AS request ON request.id = action.request_id
         ${whereClause}`,
      )
      .all(...parameters) as unknown as OperatorActionIncidentRow[];
  }

  private findOperatorActionRow(
    actionId: string,
  ): OperatorActionRow | undefined {
    return this.database
      .prepare(
        `SELECT id, request_id, kind, client_message_id, operator_topic_id,
                sequence, initial, status, external_result_id, last_error,
                created_at
         FROM operator_actions
         WHERE id = ?`,
      )
      .get(actionId) as OperatorActionRow | undefined;
  }

  public findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly QueuedInboundEvent[] {
    const rows = this.database
      .prepare(
        `SELECT source, external_event_id, payload, received_at,
                attempts, next_attempt_at
         FROM inbound_events
         WHERE source = ? AND status = 'pending'
         ORDER BY received_at, rowid
         LIMIT ?`,
      )
      .all(source, limit) as unknown as {
      attempts: number;
      external_event_id: string;
      next_attempt_at: string | null;
      payload: string;
      received_at: string;
      source: string;
    }[];

    return rows.map((row) => ({
      attempts: row.attempts,
      externalEventId: row.external_event_id,
      ...(row.next_attempt_at
        ? { nextAttemptAt: new Date(row.next_attempt_at) }
        : {}),
      payload: row.payload,
      receivedAt: new Date(row.received_at),
      source: row.source,
    }));
  }

  public findQuarantinedInboundEvents(
    limit: number,
  ): readonly InboundEventIncident[] {
    const rows = this.database
      .prepare(
        `SELECT source, external_event_id, attempts, last_error, received_at
         FROM inbound_events
         WHERE status = 'quarantined'
         ORDER BY received_at, rowid
         LIMIT ?`,
      )
      .all(limit) as unknown as {
      attempts: number;
      external_event_id: string;
      last_error: string;
      received_at: string;
      source: string;
    }[];
    return rows.map((row) => ({
      attempts: row.attempts,
      externalEventId: row.external_event_id,
      lastError: row.last_error,
      receivedAt: new Date(row.received_at),
      source: row.source,
    }));
  }

  public getInboundEventSummary(): InboundEventSummary {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS quarantined
         FROM inbound_events
         WHERE status = 'quarantined'`,
      )
      .get() as { quarantined: number };
    return row;
  }

  public retryQuarantinedInboundEvent(
    source: string,
    externalEventId: string,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE inbound_events
         SET status = 'pending', attempts = 0, last_error = NULL,
             next_attempt_at = NULL
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'quarantined'`,
      )
      .run(source, externalEventId);
    return Number(result.changes) === 1;
  }

  public skipQuarantinedInboundEvent(
    source: string,
    externalEventId: string,
  ): boolean {
    const result = this.database
      .prepare(
        `DELETE FROM inbound_events
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'quarantined'`,
      )
      .run(source, externalEventId);
    return Number(result.changes) === 1;
  }

  public findRequestByTopicId(topicId: string): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          client_display_name,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE operator_topic_id = ?`,
      )
      .get(topicId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public findRequestById(requestId: string): SupportRequest | undefined {
    const row = this.database
      .prepare(
        `SELECT
          id,
          channel,
          external_conversation_id,
          client_display_name,
          operator_topic_id,
          status,
          created_at,
          closed_at
        FROM support_requests
        WHERE id = ?`,
      )
      .get(requestId) as SupportRequestRow | undefined;

    return row ? mapRequest(row) : undefined;
  }

  public getDeliverySummary(): DeliverySummary {
    const row = this.database
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN outcome_unknown = 1 THEN 1 ELSE 0 END) AS uncertain,
          MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldest_pending_at
         FROM deliveries`,
      )
      .get() as {
      failed: number | null;
      oldest_pending_at: string | null;
      pending: number | null;
      uncertain: number | null;
    };

    return {
      failed: row.failed ?? 0,
      ...(row.oldest_pending_at
        ? { oldestPendingAt: new Date(row.oldest_pending_at) }
        : {}),
      pending: row.pending ?? 0,
      ...((row.uncertain ?? 0) > 0 ? { uncertain: row.uncertain ?? 0 } : {}),
    };
  }

  public getOperatorActionSummary(): OperatorActionSummary {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS uncertain
         FROM operator_actions
         WHERE status = 'outcome_unknown'`,
      )
      .get() as { uncertain: number };
    return { uncertain: row.uncertain };
  }

  public findPendingDeliveries(
    availableBefore: Date,
    limit: number,
  ): readonly QueuedDelivery[] {
    const rows = this.database
      .prepare(
        `SELECT delivery.id, delivery.request_id, delivery.idempotency_key,
          delivery.operator_message_id, delivery.channel,
          delivery.external_conversation_id, delivery.text,
          delivery.reply_to_external_message_id, delivery.attempts,
          delivery.created_at
         FROM deliveries AS delivery
         WHERE delivery.status = 'pending'
           AND delivery.attempt_started_at IS NULL
           AND COALESCE(delivery.next_attempt_at, delivery.created_at) <= ?
           AND NOT EXISTS (
             SELECT 1
             FROM deliveries AS earlier
             WHERE earlier.status = 'pending'
               AND earlier.channel = delivery.channel
               AND earlier.external_conversation_id =
                 delivery.external_conversation_id
               AND (
                 earlier.created_at < delivery.created_at
                 OR (
                   earlier.created_at = delivery.created_at
                   AND earlier.rowid < delivery.rowid
                 )
               )
           )
         ORDER BY delivery.created_at, delivery.rowid
         LIMIT ?`,
      )
      .all(availableBefore.toISOString(), limit) as unknown as DeliveryRow[];

    return rows.map((row) => ({
      attempts: row.attempts,
      channel: row.channel,
      conversationId: row.external_conversation_id,
      createdAt: new Date(row.created_at),
      id: row.id,
      idempotencyKey: row.idempotency_key,
      operatorMessageId: row.operator_message_id ?? row.idempotency_key,
      ...(row.reply_to_external_message_id
        ? { replyToExternalMessageId: row.reply_to_external_message_id }
        : {}),
      requestId: row.request_id,
      text: row.text,
    }));
  }

  public markDeliveryFailed(deliveryId: string, error: string): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'failed',
             attempts = attempts + 1,
             last_error = ?,
             operator_notified_at = NULL,
             notification_next_attempt_at = NULL,
             attempt_started_at = NULL
         WHERE id = ? AND status = 'pending'`,
      )
      .run(error, deliveryId);
  }

  public markDeliveryFailureNotificationRetry(
    deliveryId: string,
    nextAttemptAt: Date,
  ): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET notification_next_attempt_at = ?
         WHERE id = ? AND status = 'failed' AND operator_notified_at IS NULL`,
      )
      .run(nextAttemptAt.toISOString(), deliveryId);
  }

  public markDeliveryFailureNotified(
    deliveryId: string,
    notifiedAt: Date,
  ): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET operator_notified_at = ?, notification_next_attempt_at = NULL
         WHERE id = ? AND status = 'failed' AND operator_notified_at IS NULL`,
      )
      .run(notifiedAt.toISOString(), deliveryId);
  }

  public markDeliveryOutcomeUnknown(deliveryId: string, error: string): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'failed',
             attempts = attempts + 1,
             last_error = ?,
             outcome_unknown = 1,
             operator_notified_at = NULL,
             notification_next_attempt_at = NULL,
             attempt_started_at = NULL
         WHERE id = ? AND status = 'pending'`,
      )
      .run(error, deliveryId);
  }

  public markOperatorActionFailed(actionId: string, error: string): void {
    this.database
      .prepare(
        `UPDATE operator_actions
         SET status = 'failed',
             last_error = ?,
             attempt_started_at = NULL
         WHERE id = ? AND status = 'sending'`,
      )
      .run(error, actionId);
  }

  public markOperatorActionOutcomeUnknown(
    actionId: string,
    error: string,
  ): void {
    this.database
      .prepare(
        `UPDATE operator_actions
         SET status = 'outcome_unknown',
             last_error = ?,
             attempt_started_at = NULL
         WHERE id = ? AND status = 'sending'`,
      )
      .run(error, actionId);
  }

  public markDeliveryRetry(
    deliveryId: string,
    error: string,
    nextAttemptAt: Date,
  ): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET attempts = attempts + 1,
             last_error = ?,
             next_attempt_at = ?,
             attempt_started_at = NULL
         WHERE id = ? AND status = 'pending'`,
      )
      .run(error, nextAttemptAt.toISOString(), deliveryId);
  }

  public releaseEvent(source: string, externalEventId: string): void {
    this.database
      .prepare(
        `DELETE FROM processed_events
         WHERE source = ?
           AND external_event_id = ?
           AND status = 'processing'`,
      )
      .run(source, externalEventId);
  }

  public reopenRequest(requestId: string): void {
    this.database
      .prepare(
        `UPDATE support_requests
         SET status = 'active', closed_at = NULL
         WHERE id = ?`,
      )
      .run(requestId);
  }

  public recordConversationMessage(message: ConversationMessage): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO conversation_messages (
          id,
          request_id,
          direction,
          external_message_id,
          sender_name,
          text,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.requestId,
        message.direction,
        message.externalMessageId,
        message.senderName ?? null,
        message.text,
        message.createdAt.toISOString(),
      );
  }

  public purgeClosedConversationContent(
    closedBefore: Date,
  ): RetentionCleanupResult {
    return purgeRetainedContent(this.database, closedBefore);
  }

  public retryFailedDelivery(deliveryId: string, retryAt: Date): boolean {
    const result = this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'pending',
             attempts = 0,
             external_message_id = NULL,
             last_error = NULL,
             next_attempt_at = ?,
             attempt_started_at = NULL,
             sent_at = NULL,
             operator_notified_at = NULL,
             notification_next_attempt_at = NULL
         WHERE id = ? AND status = 'failed' AND outcome_unknown = 0`,
      )
      .run(retryAt.toISOString(), deliveryId);

    return Number(result.changes) === 1;
  }

  public confirmOperatorActionReceived(
    actionId: string,
    confirmedAt: Date,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE operator_actions
         SET status = 'sent',
             last_error = NULL,
             completed_at = ?,
             manual_resolution = 'confirmed_received',
             resolved_at = ?
         WHERE id = ?
           AND kind = 'relay_message'
           AND status = 'outcome_unknown'
           AND NOT EXISTS (
             SELECT 1
             FROM operator_actions AS blocking_action
             WHERE blocking_action.request_id = operator_actions.request_id
               AND blocking_action.client_message_id = operator_actions.client_message_id
               AND blocking_action.id != operator_actions.id
               AND blocking_action.status IN ('pending', 'sending', 'failed')
           )`,
      )
      .run(confirmedAt.toISOString(), confirmedAt.toISOString(), actionId);
    return Number(result.changes) === 1;
  }

  public moveOperatorActionRequestToWeb(actionId: string): boolean {
    const incident = this.findOperatorActionIncident(actionId);
    if (!incident) {
      return false;
    }
    const webTopicId = `${webOperatorTopicPrefix}${incident.requestId}`;
    const request = this.findRequestById(incident.requestId);
    if (request?.status !== 'active') {
      return false;
    }
    if (request.operatorTopicId === webTopicId) {
      return true;
    }
    if (request.operatorTopicId !== incident.operatorTopicId) {
      return false;
    }
    return this.switchOperatorTopic(
      incident.requestId,
      incident.operatorTopicId,
      webTopicId,
    );
  }

  public resolveOperatorActionAsWeb(
    actionId: string,
    resolvedAt: Date,
  ): boolean {
    const incident = this.findOperatorActionIncident(actionId);
    if (!incident) {
      return false;
    }
    const result = this.database
      .prepare(
        `UPDATE operator_actions
         SET status = 'abandoned',
             last_error = NULL,
             manual_resolution = 'use_web',
             resolved_at = ?
         WHERE request_id = ?
           AND client_message_id = ?
           AND status = 'outcome_unknown'`,
      )
      .run(
        resolvedAt.toISOString(),
        incident.requestId,
        incident.clientMessageId,
      );
    return Number(result.changes) > 0;
  }

  public switchOperatorTopic(
    requestId: string,
    expectedTopicId: string,
    nextTopicId: string,
  ): boolean {
    const result = this.database
      .prepare(
        `UPDATE support_requests
         SET operator_topic_id = ?
         WHERE id = ?
           AND operator_topic_id = ?
           AND status = 'active'`,
      )
      .run(nextTopicId, requestId, expectedTopicId);

    return Number(result.changes) === 1;
  }
}
