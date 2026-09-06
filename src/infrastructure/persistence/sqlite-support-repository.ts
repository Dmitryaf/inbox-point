import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  DeliverySummary,
  PendingInboundEvent,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type {
  ConversationMessage,
  FailedDelivery,
  MessageLink,
  OperatorRequestSummary,
  PendingDelivery,
  QueuedDelivery,
  SupportRequest,
  SupportRequestStatus,
} from '@/core/model/support-request.js';
import { webOperatorTopicPrefix } from '@/core/model/operator-topic.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

interface SupportRequestRow {
  channel: ClientChannelKind;
  client_display_name: string | null;
  closed_at: string | null;
  created_at: string;
  external_conversation_id: string;
  id: string;
  operator_topic_id: string;
  status: SupportRequestStatus;
}

interface OperatorRequestSummaryRow extends SupportRequestRow {
  latest_message_at: string | null;
}

interface ConversationMessageRow {
  created_at: string;
  delivery_outcome_unknown: number | null;
  delivery_status: 'failed' | 'pending' | 'sent' | null;
  direction: ConversationMessage['direction'];
  external_message_id: string;
  id: string;
  request_id: string;
  sender_name: string | null;
  text: string;
}

interface DeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  external_conversation_id: string;
  id: string;
  idempotency_key: string;
  operator_message_id: string | null;
  reply_to_external_message_id: string | null;
  request_id: string;
  text: string;
}

interface FailedDeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  id: string;
  last_error: string | null;
  operator_message_id: string | null;
  operator_topic_id: string;
  outcome_unknown: number;
  request_id: string;
}

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
    this.migrate();
    this.releaseInterruptedEvents();
    this.markInterruptedDeliveriesUnknown();
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

  public findPendingInboundEvents(
    source: string,
    limit: number,
  ): readonly PendingInboundEvent[] {
    const rows = this.database
      .prepare(
        `SELECT source, external_event_id, payload, received_at
         FROM inbound_events
         WHERE source = ?
         ORDER BY received_at, rowid
         LIMIT ?`,
      )
      .all(source, limit) as unknown as {
      external_event_id: string;
      payload: string;
      received_at: string;
      source: string;
    }[];

    return rows.map((row) => ({
      externalEventId: row.external_event_id,
      payload: row.payload,
      receivedAt: new Date(row.received_at),
      source: row.source,
    }));
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

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS support_requests (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        client_display_name TEXT,
        operator_topic_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        created_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS one_active_request_per_conversation
        ON support_requests(channel, external_conversation_id)
        WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS message_links (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        direction TEXT NOT NULL CHECK (
          direction IN ('client_to_operator', 'operator_to_client')
        ),
        client_message_id TEXT NOT NULL,
        operator_message_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        direction TEXT NOT NULL CHECK (
          direction IN ('client_to_operator', 'operator_to_client')
        ),
        external_message_id TEXT NOT NULL,
        sender_name TEXT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (request_id, direction, external_message_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS conversation_messages_by_request
        ON conversation_messages(request_id, created_at, id);

      CREATE TABLE IF NOT EXISTS processed_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing' CHECK (
          status IN ('processing', 'completed')
        ),
        completed_at TEXT,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS inbound_events (
        source TEXT NOT NULL,
        external_event_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL,
        PRIMARY KEY (source, external_event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL REFERENCES support_requests(id),
        idempotency_key TEXT NOT NULL UNIQUE,
        operator_message_id TEXT,
        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
        external_conversation_id TEXT NOT NULL,
        text TEXT NOT NULL,
        reply_to_external_message_id TEXT,
        status TEXT NOT NULL CHECK (
          status IN ('pending', 'sent', 'failed')
        ),
        attempts INTEGER NOT NULL DEFAULT 0,
        external_message_id TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        next_attempt_at TEXT,
        outcome_unknown INTEGER NOT NULL DEFAULT 0 CHECK (
          outcome_unknown IN (0, 1)
        ),
        manual_resolution TEXT CHECK (
          manual_resolution IN ('confirmed_received', 'confirmed_not_received')
        ),
        resolved_at TEXT,
        operator_notified_at TEXT,
        notification_next_attempt_at TEXT,
        sent_at TEXT
      ) STRICT;
    `);

    const requestColumns = this.database
      .prepare('PRAGMA table_info(support_requests)')
      .all() as unknown as { name: string }[];
    if (
      !requestColumns.some((column) => column.name === 'client_display_name')
    ) {
      this.database.exec(
        'ALTER TABLE support_requests ADD COLUMN client_display_name TEXT',
      );
    }

    const deliveryColumns = this.database
      .prepare('PRAGMA table_info(deliveries)')
      .all() as unknown as { name: string }[];
    if (
      !deliveryColumns.some((column) => column.name === 'operator_message_id')
    ) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN operator_message_id TEXT',
      );
    }
    if (
      !deliveryColumns.some((column) => column.name === 'manual_resolution')
    ) {
      this.database.exec(
        "ALTER TABLE deliveries ADD COLUMN manual_resolution TEXT CHECK (manual_resolution IN ('confirmed_received', 'confirmed_not_received'))",
      );
    }
    if (!deliveryColumns.some((column) => column.name === 'resolved_at')) {
      this.database.exec('ALTER TABLE deliveries ADD COLUMN resolved_at TEXT');
    }
    if (
      !deliveryColumns.some((column) => column.name === 'operator_notified_at')
    ) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN operator_notified_at TEXT',
      );
    }
    if (
      !deliveryColumns.some(
        (column) => column.name === 'notification_next_attempt_at',
      )
    ) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN notification_next_attempt_at TEXT',
      );
    }
    if (!deliveryColumns.some((column) => column.name === 'next_attempt_at')) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN next_attempt_at TEXT',
      );
    }
    if (!deliveryColumns.some((column) => column.name === 'outcome_unknown')) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN outcome_unknown INTEGER NOT NULL DEFAULT 0 CHECK (outcome_unknown IN (0, 1))',
      );
    }
    if (
      !deliveryColumns.some((column) => column.name === 'attempt_started_at')
    ) {
      this.database.exec(
        'ALTER TABLE deliveries ADD COLUMN attempt_started_at TEXT',
      );
    }

    const eventColumns = this.database
      .prepare('PRAGMA table_info(processed_events)')
      .all() as unknown as { name: string }[];
    if (!eventColumns.some((column) => column.name === 'status')) {
      this.database.exec(
        "ALTER TABLE processed_events ADD COLUMN status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed'))",
      );
    }
    if (!eventColumns.some((column) => column.name === 'completed_at')) {
      this.database.exec(
        'ALTER TABLE processed_events ADD COLUMN completed_at TEXT',
      );
    }
  }

  private releaseInterruptedEvents(): void {
    // One SQLite database is owned by one application process. A processing row
    // found during repository startup therefore belongs to an interrupted run.
    this.database
      .prepare("DELETE FROM processed_events WHERE status = 'processing'")
      .run();
  }

  private markInterruptedDeliveriesUnknown(): void {
    this.database
      .prepare(
        `UPDATE deliveries
         SET status = 'failed',
             attempts = attempts + 1,
             last_error = 'Delivery was interrupted after the attempt started',
             outcome_unknown = 1,
             attempt_started_at = NULL
         WHERE status = 'pending' AND attempt_started_at IS NOT NULL`,
      )
      .run();
  }
}

function mapRequest(row: SupportRequestRow): SupportRequest {
  return {
    channel: row.channel,
    ...(row.closed_at ? { closedAt: new Date(row.closed_at) } : {}),
    conversationId: row.external_conversation_id,
    createdAt: new Date(row.created_at),
    ...(row.client_display_name
      ? { displayName: row.client_display_name }
      : {}),
    id: row.id,
    operatorTopicId: row.operator_topic_id,
    status: row.status,
  };
}
